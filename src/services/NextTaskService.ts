import type { Issue, IssueDependency } from "../domain/types";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import type { FilteredProjectItem } from "./ProjectSearchService";
import { ProjectSearchService } from "./ProjectSearchService";

/** Items fetched per page and the page cap when reading a project's items. */
const ITEMS_PAGE_SIZE = 100;
const MAX_ITEM_PAGES = 10;

export type TaskPhase = "planning" | "development" | "testing" | "review" | "deployment";

export type TaskPriorityName = "critical" | "high" | "medium" | "low";

const PRIORITY_RANK: Record<TaskPriorityName, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** A "Status" value (or issue state) that marks an item as finished. */
const DONE_STATUS =
  /^(done|closed|complete|completed|shipped|released|cancell?ed|wontfix|duplicate|archived|deleted)$/i;

/** Words in a Status value or label that place an item in a phase. */
const PHASE_PATTERNS: Record<TaskPhase, RegExp> = {
  planning: /plan|backlog|triage|design/i,
  development: /\bdev|develop|in progress|implement/i,
  testing: /test|qa\b/i,
  review: /review/i,
  deployment: /deploy|release/i,
};

export interface NextTaskOptions {
  /** Read this project's items; without it the configured repository's issues are used. */
  projectId?: string;
  /** Only items carrying this label or the label `feature:<featureId>`. */
  featureId?: string;
  /** Only items assigned to this login. */
  assignee?: string;
  /** Labels (skills) of the team; items matching more of them rank higher within a priority. */
  teamSkills?: string[];
  /** Only items whose Status or a label places them in this phase. */
  currentPhase?: TaskPhase;
  /** Drop items blocked by an open issue (default true). */
  excludeBlocked?: boolean;
  /** Drop items whose known complexity exceeds this. Items without a known complexity are kept. */
  maxComplexity?: number;
  /** Maximum number of recommendations (default 5). */
  limit?: number;
}

export interface TaskRecommendation {
  /** Issue node id. */
  id: string;
  title: string;
  /** Issue body; only available when the source returns it (repository issues). */
  description?: string;
  /** Project item id, when read from a project. */
  projectItemId?: string;
  priority?: TaskPriorityName;
  /** 1-10, from the "Complexity" project field or a `complexity:N` label. */
  complexity?: number;
  /** Hours, from an "Estimated Hours"/"Hours" project field or an `estimate:Nh` label. */
  estimatedHours?: number;
  /** Unit-less value of a plain "Estimate" project field. */
  estimate?: number;
  /** Project "Status" field value, or the issue state. */
  status: string;
  assignees: string[];
  /** Numbers of the issues blocking this one (all of them closed unless `excludeBlocked` is false). */
  dependencies: number[];
  tags: string[];
  /** Why the item is where it is in the ranking, derived from its data. */
  reason: string;
}

export interface NextTaskResult {
  recommendations: TaskRecommendation[];
  /** Open, unfinished candidates that matched the filters, before blocker exclusion. */
  candidateCount: number;
  /** Candidates dropped because an open issue blocks them. */
  blockedCount: number;
  /** Where the candidates were read from. */
  source: "project" | "repository";
}

interface Candidate {
  id: string;
  title: string;
  description?: string;
  projectItemId?: string;
  status: string;
  labels: string[];
  assignees: string[];
  fieldValues: Record<string, string | null>;
  createdAt?: string;
  order: number;
  priority?: PriorityRef;
  complexity?: number;
  estimatedHours?: number;
  estimate?: number;
  skillMatches: string[];
}

interface PriorityRef {
  name: TaskPriorityName;
  rank: number;
}

function fieldValue(fields: Record<string, string | null>, pattern: RegExp): string | null {
  for (const [name, value] of Object.entries(fields)) {
    if (value != null && pattern.test(name)) return value;
  }
  return null;
}

function labelValue(labels: string[], pattern: RegExp): string | null {
  for (const label of labels) {
    const match = pattern.exec(label);
    if (match?.[1] != null) return match[1];
  }
  return null;
}

function toNumber(value: string | null): number | undefined {
  if (value == null) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePriority(raw: string | null): PriorityRef | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  let name: TaskPriorityName | undefined;
  if (/^(critical|urgent|blocker|p0)$/.test(value)) name = "critical";
  else if (/^(high|important|p1)$/.test(value)) name = "high";
  else if (/^(medium|normal|p2)$/.test(value)) name = "medium";
  else if (/^(low|minor|p3|p4)$/.test(value)) name = "low";
  return name ? { name, rank: PRIORITY_RANK[name] } : undefined;
}

function priorityOf(candidate: {
  fieldValues: Record<string, string | null>;
  labels: string[];
}): PriorityRef | undefined {
  return (
    normalizePriority(fieldValue(candidate.fieldValues, /^priority$/i)) ??
    normalizePriority(labelValue(candidate.labels, /^priority\s*[:/-]\s*(.+)$/i)) ??
    normalizePriority(labelValue(candidate.labels, /^(p[0-4])$/i))
  );
}

function isPhase(candidate: Candidate, phase: TaskPhase): boolean {
  const pattern = PHASE_PATTERNS[phase];
  return pattern.test(candidate.status) || candidate.labels.some((label) => pattern.test(label));
}

function isDone(status: string, fields: Record<string, string | null>, state: string | null) {
  if (state && /^(closed|merged)$/i.test(state)) return true;
  const statusField = fieldValue(fields, /^status$/i);
  return DONE_STATUS.test((statusField ?? status).trim());
}

function describeReason(candidate: Candidate, openBlockers: number[]): string {
  const parts: string[] = [];
  if (candidate.priority) parts.push(`${candidate.priority.name} priority`);
  if (candidate.skillMatches.length > 0) {
    parts.push(`matches team skills (${candidate.skillMatches.join(", ")})`);
  }
  if (candidate.complexity !== undefined) parts.push(`complexity ${candidate.complexity}/10`);
  if (candidate.estimatedHours !== undefined) parts.push(`${candidate.estimatedHours}h estimate`);
  else if (candidate.estimate !== undefined) parts.push(`estimate ${candidate.estimate}`);
  if (candidate.assignees.length > 0) parts.push(`assigned to ${candidate.assignees.join(", ")}`);
  if (parts.length === 0) {
    parts.push("no priority, estimate or complexity data; ordered by board/creation order");
  }
  parts.push(
    openBlockers.length > 0
      ? `blocked by open issue(s) ${openBlockers.map((n) => `#${n}`).join(", ")}`
      : "not blocked by any open issue"
  );
  return parts.join("; ");
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const priority = (b.priority?.rank ?? 0) - (a.priority?.rank ?? 0);
  if (priority !== 0) return priority;

  const skills = b.skillMatches.length - a.skillMatches.length;
  if (skills !== 0) return skills;

  // Smaller work first; items without the datum follow the ones that have it.
  const byAscending = (x: number | undefined, y: number | undefined): number => {
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return x - y;
  };
  const complexity = byAscending(a.complexity, b.complexity);
  if (complexity !== 0) return complexity;
  const effort = byAscending(a.estimatedHours ?? a.estimate, b.estimatedHours ?? b.estimate);
  if (effort !== 0) return effort;

  if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
    return a.createdAt < b.createdAt ? -1 : 1;
  }
  return a.order - b.order;
}

/**
 * Recommends the next work items from real GitHub data: a project's items
 * (with their Status/Priority/Complexity/Estimate field values) or, without a
 * project, the configured repository's issues.
 *
 * Ranking: priority, then skill match, then complexity, then estimate, then
 * age (repository issues) or board order (project items). Items that are
 * closed, have a finished Status or are blocked by an open issue are never
 * recommended while `excludeBlocked` holds. Data the source does not carry is
 * left out of the result, never guessed.
 */
export class NextTaskService {
  private readonly search: ProjectSearchService;

  constructor(private readonly factory: GitHubRepositoryFactory) {
    this.search = new ProjectSearchService(factory);
  }

  async recommend(options: NextTaskOptions = {}): Promise<NextTaskResult> {
    const limit = options.limit ?? 5;
    const excludeBlocked = options.excludeBlocked ?? true;

    const all = options.projectId
      ? await this.loadProjectCandidates(options.projectId, options.assignee)
      : await this.loadRepositoryCandidates();
    const source = options.projectId ? "project" : "repository";

    const skills = (options.teamSkills ?? []).map((skill) => skill.toLowerCase());
    const candidates = all.filter((candidate) => this.matches(candidate, options));
    for (const candidate of candidates) {
      candidate.skillMatches = skills.length
        ? candidate.labels.filter((label) => skills.includes(label.toLowerCase()))
        : [];
    }
    candidates.sort(compareCandidates);

    const issues = this.factory.createIssueRepository();
    const recommendations: TaskRecommendation[] = [];
    let blockedCount = 0;

    for (const candidate of candidates) {
      if (recommendations.length >= limit) break;

      const blockers = await this.openBlockers(candidate, issues);
      const blocked = blockers.open.length > 0;
      if (blocked && excludeBlocked) {
        blockedCount++;
        continue;
      }

      recommendations.push({
        id: candidate.id,
        title: candidate.title,
        description: candidate.description || undefined,
        projectItemId: candidate.projectItemId,
        priority: candidate.priority?.name,
        complexity: candidate.complexity,
        estimatedHours: candidate.estimatedHours,
        estimate: candidate.estimate,
        status: candidate.status,
        assignees: candidate.assignees,
        dependencies: blockers.all,
        tags: candidate.labels,
        reason: describeReason(candidate, blockers.open),
      });
    }

    return { recommendations, candidateCount: candidates.length, blockedCount, source };
  }

  private matches(candidate: Candidate, options: NextTaskOptions): boolean {
    if (options.assignee && !candidate.assignees.includes(options.assignee)) return false;
    if (options.featureId) {
      const wanted = [options.featureId, `feature:${options.featureId}`].map((v) =>
        v.toLowerCase()
      );
      if (!candidate.labels.some((label) => wanted.includes(label.toLowerCase()))) return false;
    }
    if (options.currentPhase && !isPhase(candidate, options.currentPhase)) return false;
    if (
      options.maxComplexity !== undefined &&
      candidate.complexity !== undefined &&
      candidate.complexity > options.maxComplexity
    ) {
      return false;
    }
    return true;
  }

  /** Blockers of a candidate; `open` holds those still open. */
  private async openBlockers(
    candidate: Candidate,
    issues: GitHubIssueRepository
  ): Promise<{ all: number[]; open: number[] }> {
    const edges: IssueDependency[] = await issues.listBlockers(candidate.id);
    const all: number[] = [];
    const open: number[] = [];
    for (const edge of edges) {
      all.push(edge.blockingIssueNumber);
      let state = edge.state;
      if (state === undefined) {
        // Label emulation carries only the blocker's number: look its state up.
        const blocker = await issues.findById(String(edge.blockingIssueNumber));
        state = blocker ? blocker.status : undefined;
      }
      // An unresolvable blocker (deleted issue) blocks nothing.
      if (state !== undefined && !/^(closed|completed|deleted|archived)$/i.test(state)) {
        open.push(edge.blockingIssueNumber);
      }
    }
    return { all, open };
  }

  private async loadProjectCandidates(projectId: string, assignee?: string): Promise<Candidate[]> {
    const items: FilteredProjectItem[] = [];
    let after: string | undefined;
    for (let page = 0; page < MAX_ITEM_PAGES; page++) {
      const result = await this.search.filterProjectItems({
        projectId,
        filter: { type: "Issue", assignee },
        first: ITEMS_PAGE_SIZE,
        after,
      });
      items.push(...result.items);
      if (!result.pageInfo.hasNextPage || !result.pageInfo.endCursor) break;
      after = result.pageInfo.endCursor;
    }

    // filterProjectItems drops assignees from the rendering, so the filter
    // already did the assignee matching; carry the requested login over.
    const candidates: Candidate[] = [];
    items.forEach((item, order) => {
      if (!item.contentId) return;
      if (isDone("", item.fieldValues, item.state)) return;
      candidates.push(
        this.buildCandidate({
          id: item.contentId,
          title: item.title,
          projectItemId: item.id,
          status: fieldValue(item.fieldValues, /^status$/i) ?? (item.state ?? "open").toLowerCase(),
          labels: item.labels,
          assignees: assignee ? [assignee] : [],
          fieldValues: item.fieldValues,
          order,
        })
      );
    });
    return candidates;
  }

  private async loadRepositoryCandidates(): Promise<Candidate[]> {
    const issues: Issue[] = await this.factory.createIssueRepository().findAll();
    const candidates: Candidate[] = [];
    issues.forEach((issue, order) => {
      if (isDone(issue.status, {}, issue.status)) return;
      candidates.push(
        this.buildCandidate({
          id: issue.id,
          title: issue.title,
          description: issue.description,
          status: "open",
          labels: issue.labels,
          assignees: issue.assignees,
          fieldValues: {},
          createdAt: issue.createdAt,
          order,
        })
      );
    });
    return candidates;
  }

  private buildCandidate(
    base: Omit<
      Candidate,
      "priority" | "complexity" | "estimatedHours" | "estimate" | "skillMatches"
    >
  ): Candidate {
    const { fieldValues, labels } = base;
    return {
      ...base,
      skillMatches: [],
      priority: priorityOf(base),
      complexity:
        toNumber(fieldValue(fieldValues, /^complexity$/i)) ??
        toNumber(labelValue(labels, /^complexity\s*[:/-]\s*(\d+(?:\.\d+)?)$/i)),
      estimatedHours:
        toNumber(fieldValue(fieldValues, /^(estimated?[ _-]?hours|hours)$/i)) ??
        toNumber(labelValue(labels, /^(?:estimate|hours)\s*[:/-]\s*(\d+(?:\.\d+)?)h?$/i)),
      estimate: toNumber(fieldValue(fieldValues, /^estimate$/i)),
    };
  }
}
