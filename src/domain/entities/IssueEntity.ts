/**
 * IssueEntity - Rich domain entity for GitHub Issues
 *
 * This entity encapsulates business logic and invariants for issues,
 * providing a richer model than the plain interface.
 *
 * ## Design Decisions
 * - Implements the existing `Issue` interface for backward compatibility
 * - Adds computed properties and business logic methods
 * - Enforces invariants (e.g., labels are normalized, dates are valid)
 * - Provides factory methods for common creation patterns
 *
 * ## Usage
 * ```typescript
 * // From existing data
 * const issue = IssueEntity.fromData(issueData);
 *
 * // Create new issue
 * const issue = IssueEntity.create({ title: 'Fix bug', description: 'Details...' });
 *
 * // Business logic
 * issue.addLabel('bug');
 * issue.assignTo('user1');
 * issue.canBeClosed(); // checks if all acceptance criteria met
 * ```
 */
import { ResourceStatus } from "../resource-types";
import type { CreateIssue, Issue } from "../types";

/**
 * Priority levels for issues
 */
export enum IssuePriority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

/**
 * Issue types/categories
 */
export enum IssueType {
  BUG = "bug",
  FEATURE = "feature",
  ENHANCEMENT = "enhancement",
  DOCUMENTATION = "documentation",
  TASK = "task",
}

/**
 * Configuration for IssueEntity
 */
export interface IssueEntityConfig {
  /** Auto-normalize labels to lowercase */
  normalizeLabels?: boolean;
  /** Maximum number of labels allowed */
  maxLabels?: number;
  /** Allowed label prefixes (e.g., ['priority:', 'type:']) */
  allowedLabelPrefixes?: string[];
}

const DEFAULT_CONFIG: IssueEntityConfig = {
  normalizeLabels: true,
  maxLabels: 20,
  allowedLabelPrefixes: [],
};

/** The label prefix that emulates a native "blocked by" edge. */
export const BLOCKED_BY_LABEL_PREFIX = "blocked-by:";

/** The label prefix that emulates a native issue type. */
export const ISSUE_TYPE_LABEL_PREFIX = "type:";

/**
 * The label name that emulates "this issue is blocked by #<number>".
 */
export function blockerLabelName(issueNumber: number): string {
  return `${BLOCKED_BY_LABEL_PREFIX}#${issueNumber}`;
}

/**
 * The issue numbers a set of labels declares as blockers.
 *
 * This is the platform's emulation of GitHub's native `blockedBy` issue
 * edges; it is used as a fallback when the deployment does not expose the
 * native field.
 */
export function parseBlockerLabelNumbers(labels: string[]): number[] {
  return labels
    .filter((label) => label.startsWith(BLOCKED_BY_LABEL_PREFIX))
    .map((label) => {
      const afterPrefix = label.slice(BLOCKED_BY_LABEL_PREFIX.length);
      // Handle both '#123' and '123' formats
      const numStr = afterPrefix.startsWith("#") ? afterPrefix.slice(1) : afterPrefix;
      return parseInt(numStr, 10);
    })
    .filter((n) => !Number.isNaN(n));
}

/**
 * The issue type a set of labels declares, e.g. "type:bug" → "bug".
 *
 * This is the platform's emulation of GitHub's native issue types; it is used
 * as a fallback when the deployment does not expose the native field.
 */
export function parseIssueTypeLabel(labels: string[]): string | null {
  const typeLabel = labels.find((label) => label.startsWith(ISSUE_TYPE_LABEL_PREFIX));
  if (!typeLabel) return null;
  const type = typeLabel.slice(ISSUE_TYPE_LABEL_PREFIX.length).trim();
  return type.length > 0 ? type : null;
}

/**
 * Rich domain entity for GitHub Issues
 */
export class IssueEntity implements Issue {
  // Core properties (from Issue interface)
  public readonly id: string;
  public readonly number: number;
  public title: string;
  public description: string;
  public status: ResourceStatus;
  public assignees: string[];
  public labels: string[];
  public milestoneId?: string;
  public readonly createdAt: string;
  public updatedAt: string;
  public readonly url: string;

  /** The native GitHub issue type name, when the issue has one. */
  public readonly issueTypeName?: string;
  /** The native GitHub issue type node id, when the issue has one. */
  public readonly issueTypeId?: string;
  /** Node ids of the projects the issue is a member of. */
  public projectIds?: string[];

  // Native issue edges read from GitHub (`Issue.blockedBy` / `Issue.blocking`).
  private readonly nativeBlockedBy: number[];
  private readonly nativeBlocking: number[];

  // Internal config
  private readonly config: IssueEntityConfig;

  private constructor(data: Issue, config: IssueEntityConfig = DEFAULT_CONFIG) {
    this.id = data.id;
    this.number = data.number;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status;
    this.assignees = [...data.assignees];
    this.labels = [...data.labels];
    this.milestoneId = data.milestoneId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.url = data.url;
    this.issueTypeName = data.issueTypeName;
    this.issueTypeId = data.issueTypeId;
    this.projectIds = data.projectIds ? [...data.projectIds] : undefined;
    this.nativeBlockedBy = [...(data.blockedBy ?? [])];
    this.nativeBlocking = [...(data.blocking ?? [])];
    this.config = config;

    // Normalize labels on creation
    if (config.normalizeLabels) {
      this.labels = this.labels.map((l) => l.toLowerCase());
    }
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create an IssueEntity from existing Issue data
   */
  static fromData(data: Issue, config?: IssueEntityConfig): IssueEntity {
    return new IssueEntity(data, config);
  }

  /**
   * Create a new IssueEntity with defaults
   */
  static create(
    data: CreateIssue,
    options: {
      number: number;
      url: string;
      config?: IssueEntityConfig;
    }
  ): IssueEntity {
    const now = new Date().toISOString();
    const issueData: Issue = {
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: options.number,
      title: data.title,
      description: data.description,
      status: data.status ?? ResourceStatus.ACTIVE,
      assignees: data.assignees ?? [],
      labels: data.labels ?? [],
      milestoneId: data.milestoneId,
      createdAt: now,
      updatedAt: now,
      url: options.url,
    };

    return new IssueEntity(issueData, options.config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Check if the issue is open (active or in progress)
   */
  get isOpen(): boolean {
    return this.status === ResourceStatus.ACTIVE || this.status === ResourceStatus.IN_PROGRESS;
  }

  /**
   * Check if the issue is closed
   */
  get isClosed(): boolean {
    return this.status === ResourceStatus.CLOSED || this.status === ResourceStatus.COMPLETED;
  }

  /**
   * Check if the issue has a milestone assigned
   */
  get hasMilestone(): boolean {
    return this.milestoneId !== undefined && this.milestoneId !== null;
  }

  /**
   * Check if the issue has assignees
   */
  get isAssigned(): boolean {
    return this.assignees.length > 0;
  }

  /**
   * Get the number of assignees
   */
  get assigneeCount(): number {
    return this.assignees.length;
  }

  /**
   * Get the number of labels
   */
  get labelCount(): number {
    return this.labels.length;
  }

  /**
   * Get the priority from labels (e.g., "priority:high" → "high")
   */
  get priority(): IssuePriority | null {
    const priorityLabel = this.labels.find((l) => l.startsWith("priority:"));
    if (priorityLabel) {
      const priority = priorityLabel.replace("priority:", "") as IssuePriority;
      return Object.values(IssuePriority).includes(priority) ? priority : null;
    }
    return null;
  }

  /**
   * Get the issue type.
   *
   * The native GitHub issue type wins when the issue has one; the `type:`
   * label is the fallback for issues that were typed before the native type
   * existed (or on deployments that do not expose it).
   */
  get issueType(): IssueType | null {
    const native = this.nativeIssueType;
    if (native) {
      const match = Object.values(IssueType).find((type) => type === native.toLowerCase());
      if (match) return match;
    }

    const typeLabel = this.labels.find((l) => l.startsWith(ISSUE_TYPE_LABEL_PREFIX));
    if (typeLabel) {
      const type = typeLabel.replace(ISSUE_TYPE_LABEL_PREFIX, "") as IssueType;
      return Object.values(IssueType).includes(type) ? type : null;
    }
    return null;
  }

  /**
   * The native GitHub issue type name, e.g. "Bug".
   *
   * `null` when the issue has no native type (the `type:` label emulation is
   * then still readable through {@link issueType}).
   */
  get nativeIssueType(): string | null {
    return this.issueTypeName ?? null;
  }

  /**
   * Get age in days since creation
   */
  get ageInDays(): number {
    const created = new Date(this.createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get time since last update in days
   */
  get daysSinceUpdate(): number {
    const updated = new Date(this.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - updated.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the issue is stale (no update in 14+ days)
   */
  get isStale(): boolean {
    return this.daysSinceUpdate >= 14;
  }

  // =========================================================================
  // Business Logic Methods
  // =========================================================================

  /**
   * Add a label to the issue
   * @returns true if label was added, false if already exists or limit reached
   */
  addLabel(label: string): boolean {
    const normalizedLabel = this.config.normalizeLabels ? label.toLowerCase() : label;

    // Check if label already exists
    if (this.labels.includes(normalizedLabel)) {
      return false;
    }

    // Check max labels limit
    if (this.config.maxLabels && this.labels.length >= this.config.maxLabels) {
      return false;
    }

    this.labels.push(normalizedLabel);
    this.touch();
    return true;
  }

  /**
   * Remove a label from the issue
   * @returns true if label was removed, false if not found
   */
  removeLabel(label: string): boolean {
    const normalizedLabel = this.config.normalizeLabels ? label.toLowerCase() : label;

    const index = this.labels.indexOf(normalizedLabel);
    if (index === -1) {
      return false;
    }

    this.labels.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Check if the issue has a specific label
   */
  hasLabel(label: string): boolean {
    const normalizedLabel = this.config.normalizeLabels ? label.toLowerCase() : label;
    return this.labels.includes(normalizedLabel);
  }

  /**
   * Assign the issue to a user
   * @returns true if user was assigned, false if already assigned
   */
  assignTo(userId: string): boolean {
    if (this.assignees.includes(userId)) {
      return false;
    }

    this.assignees.push(userId);
    this.touch();
    return true;
  }

  /**
   * Unassign a user from the issue
   * @returns true if user was unassigned, false if not found
   */
  unassign(userId: string): boolean {
    const index = this.assignees.indexOf(userId);
    if (index === -1) {
      return false;
    }

    this.assignees.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Check if a specific user is assigned
   */
  isAssignedTo(userId: string): boolean {
    return this.assignees.includes(userId);
  }

  /**
   * Assign to a milestone
   */
  assignToMilestone(milestoneId: string): void {
    this.milestoneId = milestoneId;
    this.touch();
  }

  /**
   * Remove from milestone
   */
  removeFromMilestone(): void {
    this.milestoneId = undefined;
    this.touch();
  }

  /**
   * Close the issue
   */
  close(): void {
    if (this.isClosed) {
      return; // Already closed
    }
    this.status = ResourceStatus.CLOSED;
    this.touch();
  }

  /**
   * Reopen the issue
   */
  reopen(): void {
    if (!this.isClosed) {
      return; // Already open
    }
    this.status = ResourceStatus.ACTIVE;
    this.touch();
  }

  /**
   * Start working on the issue
   */
  startWork(): void {
    if (!this.isOpen) {
      throw new Error("Cannot start work on a closed issue");
    }
    this.status = ResourceStatus.IN_PROGRESS;
    this.touch();
  }

  /**
   * Check if the issue can be closed
   * Business rule: Issue can be closed if it's open and has a description
   */
  canBeClosed(): boolean {
    return this.isOpen && this.description.length > 0;
  }

  /**
   * Check if the issue can be assigned to a sprint
   * Business rule: Only open issues with priority can be added to sprints
   */
  canBeAddedToSprint(): boolean {
    return this.isOpen && this.priority !== null;
  }

  /**
   * Check if the issue is blocked by another issue.
   *
   * True when GitHub's native `blockedBy` edge exists, when the "blocked"
   * label is present, or when a `blocked-by:#123` label is present.
   */
  get isBlocked(): boolean {
    return (
      this.nativeBlockedBy.length > 0 ||
      this.hasLabel("blocked") ||
      this.labels.some((l) => l.startsWith(BLOCKED_BY_LABEL_PREFIX))
    );
  }

  /**
   * Get the issue numbers that block this issue.
   *
   * GitHub's native `blockedBy` edges come first; the `blocked-by:#123`
   * labels are the fallback and are still reported for issues that were
   * wired up before the native edges existed.
   */
  get blockedBy(): number[] {
    const blockers = [...this.nativeBlockedBy];
    for (const number of parseBlockerLabelNumbers(this.labels)) {
      if (!blockers.includes(number)) blockers.push(number);
    }
    return blockers;
  }

  /**
   * Get the issue numbers that this issue blocks.
   *
   * Only GitHub's native `blocking` edges can express this direction — the
   * label emulation lives on the blocked issue, not on the blocker.
   */
  get blocking(): number[] {
    return [...this.nativeBlocking];
  }

  /**
   * Mark the issue as blocked by another issue
   */
  blockBy(issueNumber: number): void {
    this.addLabel(blockerLabelName(issueNumber));
  }

  /**
   * Remove blocking label for a specific issue
   */
  unblockBy(issueNumber: number): void {
    this.removeLabel(blockerLabelName(issueNumber));
  }

  /**
   * Convert to plain object (for serialization)
   */
  toData(): Issue {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      description: this.description,
      status: this.status,
      assignees: [...this.assignees],
      labels: [...this.labels],
      milestoneId: this.milestoneId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      url: this.url,
      issueTypeName: this.issueTypeName,
      issueTypeId: this.issueTypeId,
      blockedBy: this.nativeBlockedBy.length > 0 ? [...this.nativeBlockedBy] : undefined,
      blocking: this.nativeBlocking.length > 0 ? [...this.nativeBlocking] : undefined,
      projectIds: this.projectIds ? [...this.projectIds] : undefined,
    };
  }

  /**
   * Create a copy of this issue
   */
  clone(): IssueEntity {
    return IssueEntity.fromData(this.toData(), this.config);
  }

  /**
   * Get a summary of the issue
   */
  toSummary(): {
    id: string;
    number: number;
    title: string;
    status: string;
    priority: string | null;
    assignees: string[];
    labels: string[];
    isStale: boolean;
    ageInDays: number;
  } {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      status: this.status,
      priority: this.priority,
      assignees: [...this.assignees],
      labels: [...this.labels],
      isStale: this.isStale,
      ageInDays: this.ageInDays,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Update the updatedAt timestamp
   */
  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }
}
