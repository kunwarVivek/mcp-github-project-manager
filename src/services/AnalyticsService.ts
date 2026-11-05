import type {
  AnalyticsItem,
  AnalyticsItemSet,
  AnalyticsResultBase,
  AnalyticsUnit,
  BurndownDay,
  CycleTimeResult,
  DurationStats,
  IterationVelocity,
  OverdueMilestone,
  ProjectSummaryResult,
  SprintBurndownResult,
  SprintVelocityResult,
  ThroughputBucket,
  ThroughputPoint,
  ThroughputResult,
} from "../domain/analytics-types";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectAnalyticsRepository } from "../infrastructure/github/repositories/GitHubProjectAnalyticsRepository";

const DAY_MS = 86_400_000;
const DONE_STATUS = /^(done|closed|complete|completed|shipped|merged)$/i;

// ============================================================================
// Pure computations (exported for unit tests)
// ============================================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
}

/** An item is done when its issue/PR is closed or merged, or its status reads as finished. */
export function isItemDone(item: AnalyticsItem): boolean {
  if (item.closedAt) return true;
  if (item.state && /^(closed|merged)$/i.test(item.state)) return true;
  return item.status !== null && DONE_STATUS.test(item.status);
}

/** When the item was finished: its close/merge time, else the last item change for a done status. */
export function completionDate(item: AnalyticsItem): Date | null {
  if (!isItemDone(item)) return null;
  const date = new Date(item.closedAt ?? item.updatedAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Points when any item carries an estimate; otherwise plain item counts. */
export function chooseUnit(items: AnalyticsItem[]): AnalyticsUnit {
  return items.some((item) => item.points !== null) ? "points" : "items";
}

function weight(item: AnalyticsItem, unit: AnalyticsUnit): number {
  return unit === "points" ? (item.points ?? 0) : 1;
}

function iterationStart(iteration: { startDate: string }): Date {
  return parseDate(iteration.startDate);
}

/** Exclusive end: the instant the iteration's last day finishes. */
function iterationEnd(iteration: { startDate: string; duration: number }): Date {
  return new Date(iterationStart(iteration).getTime() + iteration.duration * DAY_MS);
}

function lastDay(iteration: { startDate: string; duration: number }): string {
  return isoDate(new Date(iterationEnd(iteration).getTime() - DAY_MS));
}

/** Velocity (committed vs completed work) of the last `lastN` iterations that have started. */
export function computeVelocity(
  items: AnalyticsItem[],
  lastN: number,
  now: Date
): { unit: AnalyticsUnit; iterations: IterationVelocity[]; averageCompleted: number | null } {
  const unit = chooseUnit(items);
  const byIteration = new Map<string, IterationVelocity & { start: number }>();

  for (const item of items) {
    const it = item.iteration;
    if (!it) continue;
    const start = iterationStart(it).getTime();
    if (start > now.getTime()) continue;

    let entry = byIteration.get(it.id);
    if (!entry) {
      entry = {
        iterationId: it.id,
        title: it.title,
        startDate: it.startDate,
        endDate: lastDay(it),
        inProgress: iterationEnd(it).getTime() > now.getTime(),
        committedItems: 0,
        completedItems: 0,
        committedPoints: 0,
        completedPoints: 0,
        start,
      };
      byIteration.set(it.id, entry);
    }
    entry.committedItems++;
    entry.committedPoints += item.points ?? 0;
    if (isItemDone(item)) {
      entry.completedItems++;
      entry.completedPoints += item.points ?? 0;
    }
  }

  const iterations = [...byIteration.values()]
    .sort((a, b) => a.start - b.start)
    .slice(-lastN)
    .map(({ start: _start, ...rest }) => rest);

  const finished = iterations.filter((i) => !i.inProgress);
  const completed = (i: IterationVelocity) =>
    unit === "points" ? i.completedPoints : i.completedItems;
  const averageCompleted =
    finished.length === 0
      ? null
      : round2(finished.reduce((sum, i) => sum + completed(i), 0) / finished.length);

  return { unit, iterations, averageCompleted };
}

/** The iteration a burndown is drawn for: the named one, else the current, else the latest started. */
export function selectIteration(
  items: AnalyticsItem[],
  sprintId: string | undefined,
  now: Date
): NonNullable<AnalyticsItem["iteration"]> | null {
  const unique = new Map<string, NonNullable<AnalyticsItem["iteration"]>>();
  for (const item of items) {
    if (item.iteration) unique.set(item.iteration.id, item.iteration);
  }
  const all = [...unique.values()];

  if (sprintId) {
    const wanted = sprintId.toLowerCase();
    return all.find((i) => i.id === sprintId || i.title.toLowerCase() === wanted) ?? null;
  }

  const t = now.getTime();
  const current = all.find(
    (i) => iterationStart(i).getTime() <= t && t < iterationEnd(i).getTime()
  );
  if (current) return current;

  const started = all
    .filter((i) => iterationStart(i).getTime() <= t)
    .sort((a, b) => iterationStart(b).getTime() - iterationStart(a).getTime());
  return started[0] ?? null;
}

/** Remaining work at the end of each day of the iteration; future days are `null`. */
export function computeBurndown(
  items: AnalyticsItem[],
  iteration: NonNullable<AnalyticsItem["iteration"]>,
  now: Date
): { unit: AnalyticsUnit; totalScope: number; days: BurndownDay[] } {
  const scoped = items.filter((item) => item.iteration?.id === iteration.id);
  const unit = chooseUnit(scoped);
  const totalScope = scoped.reduce((sum, item) => sum + weight(item, unit), 0);
  const start = iterationStart(iteration).getTime();

  const days: BurndownDay[] = [];
  for (let i = 0; i < iteration.duration; i++) {
    const dayStart = start + i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    let remaining: number | null = null;
    if (dayStart <= now.getTime()) {
      remaining = 0;
      for (const item of scoped) {
        const done = completionDate(item);
        if (!done || done.getTime() >= dayEnd) remaining += weight(item, unit);
      }
    }
    days.push({
      date: isoDate(new Date(dayStart)),
      remaining: remaining === null ? null : round2(remaining),
      ideal: round2(totalScope * (1 - (i + 1) / iteration.duration)),
    });
  }
  return { unit, totalScope, days };
}

/** Linear-interpolated percentile (p in 0..100) of an ascending-sorted list. */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Created-to-done durations (days) of items finished within the last `sinceDays` days. */
export function computeCycleTime(
  items: AnalyticsItem[],
  sinceDays: number,
  now: Date
): DurationStats {
  const since = now.getTime() - sinceDays * DAY_MS;
  const durations: number[] = [];

  for (const item of items) {
    const done = completionDate(item);
    const created = new Date(item.createdAt).getTime();
    if (!done || Number.isNaN(created) || done.getTime() < since) continue;
    durations.push(Math.max(0, done.getTime() - created) / DAY_MS);
  }

  durations.sort((a, b) => a - b);
  const stat = (value: number | null) => (value === null ? null : round2(value));
  return {
    count: durations.length,
    meanDays: stat(
      durations.length === 0 ? null : durations.reduce((s, d) => s + d, 0) / durations.length
    ),
    medianDays: stat(percentile(durations, 50)),
    p90Days: stat(percentile(durations, 90)),
    minDays: stat(durations.length === 0 ? null : durations[0]),
    maxDays: stat(durations.length === 0 ? null : durations[durations.length - 1]),
  };
}

/** UTC start of the day/week (Monday)/month containing `date`. */
export function bucketStart(date: Date, bucket: ThroughputBucket): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (bucket === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (bucket === "month") d.setUTCDate(1);
  return d;
}

function nextBucket(date: Date, bucket: ThroughputBucket): Date {
  const d = new Date(date);
  if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
  else if (bucket === "week") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** Items finished per bucket over the last `sinceDays` days; empty buckets are included as zero. */
export function computeThroughput(
  items: AnalyticsItem[],
  sinceDays: number,
  bucket: ThroughputBucket,
  now: Date
): { buckets: ThroughputPoint[]; totalClosed: number } {
  const windowStart = new Date(now.getTime() - sinceDays * DAY_MS);
  const points = new Map<string, ThroughputPoint>();

  for (
    let b = bucketStart(windowStart, bucket);
    b.getTime() <= now.getTime();
    b = nextBucket(b, bucket)
  ) {
    points.set(isoDate(b), { bucketStart: isoDate(b), closedItems: 0, closedPoints: 0 });
  }

  let totalClosed = 0;
  for (const item of items) {
    const done = completionDate(item);
    if (!done || done.getTime() < windowStart.getTime() || done.getTime() > now.getTime()) continue;
    const point = points.get(isoDate(bucketStart(done, bucket)));
    if (!point) continue;
    point.closedItems++;
    point.closedPoints += item.points ?? 0;
    totalClosed++;
  }

  return { buckets: [...points.values()], totalClosed };
}

/** Counts by status, type and single-select field, open vs closed, and overdue milestones. */
export function computeSummary(
  items: AnalyticsItem[],
  now: Date
): Omit<ProjectSummaryResult, keyof AnalyticsResultBase> {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byField: Record<string, Record<string, number>> = {};
  let closedItems = 0;
  let totalPoints = 0;
  let completedPoints = 0;
  const milestones = new Map<string, { title: string; dueOn: string; openItems: number }>();

  for (const item of items) {
    const done = isItemDone(item);
    if (done) closedItems++;
    totalPoints += item.points ?? 0;
    if (done) completedPoints += item.points ?? 0;

    byType[item.type] = (byType[item.type] ?? 0) + 1;
    const status = item.status ?? "(none)";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    for (const [field, value] of Object.entries(item.fields)) {
      byField[field] ??= {};
      byField[field][value] = (byField[field][value] ?? 0) + 1;
    }

    const m = item.milestone;
    if (m?.dueOn && /^open$/i.test(m.state) && new Date(m.dueOn).getTime() < now.getTime()) {
      const entry = milestones.get(m.title) ?? { title: m.title, dueOn: m.dueOn, openItems: 0 };
      if (!done) entry.openItems++;
      milestones.set(m.title, entry);
    }
  }

  const overdueMilestones: OverdueMilestone[] = [...milestones.values()].sort((a, b) =>
    a.dueOn.localeCompare(b.dueOn)
  );
  const hasPoints = chooseUnit(items) === "points";

  return {
    openItems: items.length - closedItems,
    closedItems,
    byType,
    byStatus,
    byField,
    totalPoints: hasPoints ? totalPoints : null,
    completedPoints: hasPoints ? completedPoints : null,
    overdueMilestones,
  };
}

// ============================================================================
// Service
// ============================================================================

function requirePositiveInt(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got ${value}`);
  }
  return value;
}

/**
 * Minimal analytics & reporting over Projects v2 items: sprint velocity and
 * burndown, cycle time, throughput and a project summary. Every call reads the
 * project's items once (page-capped; `truncated` is set when the cap is hit).
 */
export class AnalyticsService {
  private readonly repository: GitHubProjectAnalyticsRepository;

  constructor(
    factory: GitHubRepositoryFactory,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.repository = factory.createProjectAnalyticsRepository();
  }

  private async load(
    projectId: string
  ): Promise<{ set: AnalyticsItemSet; base: AnalyticsResultBase }> {
    const set = await this.repository.listItems(projectId);
    return {
      set,
      base: {
        projectId,
        generatedAt: this.clock().toISOString(),
        itemCount: set.items.length,
        truncated: set.truncated,
      },
    };
  }

  async sprintVelocity(params: {
    projectId: string;
    lastN?: number;
  }): Promise<SprintVelocityResult> {
    const lastN = requirePositiveInt(params.lastN ?? 6, "lastN");
    const { set, base } = await this.load(params.projectId);
    return { ...base, ...computeVelocity(set.items, lastN, this.clock()) };
  }

  async sprintBurndown(params: {
    projectId: string;
    sprintId?: string;
  }): Promise<SprintBurndownResult> {
    const { set, base } = await this.load(params.projectId);
    const now = this.clock();
    const iteration = selectIteration(set.items, params.sprintId, now);
    if (!iteration) {
      return { ...base, unit: chooseUnit(set.items), iteration: null, totalScope: 0, days: [] };
    }
    return {
      ...base,
      iteration: {
        id: iteration.id,
        title: iteration.title,
        startDate: iteration.startDate,
        endDate: lastDay(iteration),
      },
      ...computeBurndown(set.items, iteration, now),
    };
  }

  async cycleTime(params: { projectId: string; sinceDays?: number }): Promise<CycleTimeResult> {
    const sinceDays = requirePositiveInt(params.sinceDays ?? 30, "sinceDays");
    const { set, base } = await this.load(params.projectId);
    return { ...base, sinceDays, ...computeCycleTime(set.items, sinceDays, this.clock()) };
  }

  async throughput(params: {
    projectId: string;
    sinceDays?: number;
    bucket?: ThroughputBucket;
  }): Promise<ThroughputResult> {
    const sinceDays = requirePositiveInt(params.sinceDays ?? 30, "sinceDays");
    const bucket = params.bucket ?? "week";
    const { set, base } = await this.load(params.projectId);
    return {
      ...base,
      sinceDays,
      bucket,
      ...computeThroughput(set.items, sinceDays, bucket, this.clock()),
    };
  }

  async projectSummary(params: { projectId: string }): Promise<ProjectSummaryResult> {
    const { set, base } = await this.load(params.projectId);
    return { ...base, ...computeSummary(set.items, this.clock()) };
  }
}
