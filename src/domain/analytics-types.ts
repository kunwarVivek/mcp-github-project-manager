/**
 * Types for the analytics & reporting service (Projects v2 item metrics).
 * Plain JSON shapes only: every result is returned to the MCP client as-is.
 */

export type AnalyticsItemType = "ISSUE" | "PULL_REQUEST" | "DRAFT_ISSUE" | "UNKNOWN";

export interface AnalyticsIteration {
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD). */
  startDate: string;
  /** Length in days. */
  duration: number;
}

export interface AnalyticsMilestone {
  title: string;
  /** ISO timestamp or null when the milestone has no due date. */
  dueOn: string | null;
  state: string;
}

/** One project item reduced to what the analytics computations need. */
export interface AnalyticsItem {
  id: string;
  type: AnalyticsItemType;
  /** ISO timestamp the underlying issue/PR/draft was created (falls back to the item). */
  createdAt: string;
  /** ISO timestamp the project item last changed. */
  updatedAt: string;
  /** ISO timestamp the issue was closed or the PR merged/closed; null while open. */
  closedAt: string | null;
  /** Issue/PR content state (OPEN, CLOSED, MERGED) when the item has content. */
  state: string | null;
  /** Value of the project's "Status" single-select field. */
  status: string | null;
  /** Value of the points/estimate number field when the project has one. */
  points: number | null;
  iteration: AnalyticsIteration | null;
  milestone: AnalyticsMilestone | null;
  /** All single-select field values, keyed by field name. */
  fields: Record<string, string>;
}

export interface AnalyticsItemSet {
  items: AnalyticsItem[];
  /** True when the page cap was hit and the project has more items than were read. */
  truncated: boolean;
}

/** Fields shared by every analytics result. */
export interface AnalyticsResultBase {
  projectId: string;
  /** ISO timestamp the result was computed. */
  generatedAt: string;
  /** Number of project items read. */
  itemCount: number;
  /** True when the item read hit the page cap; figures are then lower bounds. */
  truncated: boolean;
}

/** What `completed`/`committed` figures count: points when the project has a points field, else items. */
export type AnalyticsUnit = "points" | "items";

export interface IterationVelocity {
  iterationId: string;
  title: string;
  startDate: string;
  endDate: string;
  /** True when the iteration has not ended yet. */
  inProgress: boolean;
  committedItems: number;
  completedItems: number;
  committedPoints: number;
  completedPoints: number;
}

export interface SprintVelocityResult extends AnalyticsResultBase {
  unit: AnalyticsUnit;
  /** Oldest first. */
  iterations: IterationVelocity[];
  /** Mean completed figure (in `unit`) over the finished iterations; null when none finished. */
  averageCompleted: number | null;
}

export interface BurndownDay {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Remaining work at the end of the day; null for days still in the future. */
  remaining: number | null;
  /** Straight line from the full scope down to zero at the end of the last day. */
  ideal: number;
}

export interface SprintBurndownResult extends AnalyticsResultBase {
  unit: AnalyticsUnit;
  iteration: { id: string; title: string; startDate: string; endDate: string } | null;
  totalScope: number;
  days: BurndownDay[];
}

export interface DurationStats {
  count: number;
  meanDays: number | null;
  medianDays: number | null;
  p90Days: number | null;
  minDays: number | null;
  maxDays: number | null;
}

export interface CycleTimeResult extends AnalyticsResultBase, DurationStats {
  sinceDays: number;
}

export type ThroughputBucket = "day" | "week" | "month";

export interface ThroughputPoint {
  /** ISO date of the bucket start (UTC; weeks start on Monday). */
  bucketStart: string;
  closedItems: number;
  closedPoints: number;
}

export interface ThroughputResult extends AnalyticsResultBase {
  sinceDays: number;
  bucket: ThroughputBucket;
  buckets: ThroughputPoint[];
  totalClosed: number;
}

export interface OverdueMilestone {
  title: string;
  dueOn: string;
  openItems: number;
}

export interface ProjectSummaryResult extends AnalyticsResultBase {
  openItems: number;
  closedItems: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  /** Counts per single-select field, e.g. `{ Priority: { High: 3 } }`. */
  byField: Record<string, Record<string, number>>;
  totalPoints: number | null;
  completedPoints: number | null;
  overdueMilestones: OverdueMilestone[];
}
