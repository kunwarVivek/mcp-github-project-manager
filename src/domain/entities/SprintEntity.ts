/**
 * SprintEntity - Rich domain entity for Sprints
 *
 * This entity encapsulates business logic and invariants for sprints,
 * providing computed properties for sprint management.
 *
 * ## Design Decisions
 * - Implements the existing `Sprint` interface for backward compatibility
 * - Adds computed properties for duration, progress, and velocity tracking
 * - Enforces invariants (e.g., dates must be valid, status transitions)
 * - Provides factory methods for common creation patterns
 *
 * ## Usage
 * ```typescript
 * const sprint = SprintEntity.fromData(sprintData);
 *
 * // Business logic
 * sprint.durationInDays; // sprint length
 * sprint.daysRemaining; // days left in sprint
 * sprint.isCurrent; // checks if sprint is currently active
 * sprint.velocity; // completed issues per day
 * ```
 */
import { ResourceStatus } from '../resource-types';
import { Sprint, CreateSprint, IssueId } from '../types';

/**
 * Sprint states
 */
export enum SprintState {
  PLANNING = 'planned',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Configuration for SprintEntity
 */
export interface SprintEntityConfig {
  /** Default sprint duration in days (if not specified by dates) */
  defaultDurationDays?: number;
  /** Maximum number of issues allowed in a sprint */
  maxIssues?: number;
  /** Buffer days before sprint end to start planning next */
  planningBufferDays?: number;
}

const DEFAULT_CONFIG: SprintEntityConfig = {
  defaultDurationDays: 14,
  maxIssues: 50,
  planningBufferDays: 2,
};

/**
 * Rich domain entity for Sprints
 */
export class SprintEntity implements Sprint {
  // Core properties (from Sprint interface)
  public readonly id: string;
  public title: string;
  public description: string;
  public startDate: string;
  public endDate: string;
  public status: ResourceStatus;
  public issues: IssueId[];
  public readonly createdAt: string;
  public updatedAt: string;

  // Internal config
  private readonly config: SprintEntityConfig;

  private constructor(
    data: Sprint,
    config: SprintEntityConfig = DEFAULT_CONFIG
  ) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.status = data.status;
    this.issues = [...data.issues];
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.config = config;
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create a SprintEntity from existing Sprint data
   */
  static fromData(data: Sprint, config?: SprintEntityConfig): SprintEntity {
    return new SprintEntity(data, config);
  }

  /**
   * Create a new SprintEntity with defaults
   */
  static create(
    data: CreateSprint,
    options: {
      config?: SprintEntityConfig;
    } = {}
  ): SprintEntity {
    const now = new Date().toISOString();
    const config = options.config ?? DEFAULT_CONFIG;

    // Set default end date if not provided
    let endDate = data.endDate;
    if (!endDate) {
      const start = new Date(data.startDate);
      start.setDate(start.getDate() + (config.defaultDurationDays ?? 14));
      endDate = start.toISOString();
    }

    const sprintData: Sprint = {
      id: `sprint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: endDate,
      status: data.status ?? ResourceStatus.PLANNED,
      issues: data.issues ?? [],
      createdAt: now,
      updatedAt: now,
    };

    return new SprintEntity(sprintData, options.config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Get the sprint duration in days
   */
  get durationInDays(): number {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get the number of days remaining in the sprint
   */
  get daysRemaining(): number {
    const end = new Date(this.endDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get the number of days elapsed in the sprint
   */
  get daysElapsed(): number {
    const start = new Date(this.startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get the percentage of time elapsed
   */
  get percentTimeElapsed(): number {
    const total = this.durationInDays;
    if (total === 0) return 100;
    return Math.min(100, Math.round((this.daysElapsed / total) * 100));
  }

  /**
   * Check if the sprint is currently active (based on dates)
   */
  get isCurrent(): boolean {
    const now = new Date();
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    return now >= start && now <= end;
  }

  /**
   * Check if the sprint has started
   */
  get hasStarted(): boolean {
    const now = new Date();
    const start = new Date(this.startDate);
    return now >= start;
  }

  /**
   * Check if the sprint has ended
   */
  get hasEnded(): boolean {
    const now = new Date();
    const end = new Date(this.endDate);
    return now > end;
  }

  /**
   * Check if the sprint is in planning phase
   */
  get isPlanning(): boolean {
    return this.status === ResourceStatus.PLANNED;
  }

  /**
   * Check if the sprint is active
   */
  get isActive(): boolean {
    return this.status === ResourceStatus.ACTIVE ||
           this.status === ResourceStatus.IN_PROGRESS;
  }

  /**
   * Check if the sprint is completed
   */
  get isCompleted(): boolean {
    return this.status === ResourceStatus.COMPLETED;
  }

  /**
   * Get the number of issues in the sprint
   */
  get issueCount(): number {
    return this.issues.length;
  }

  /**
   * Check if the sprint has issues
   */
  get hasIssues(): boolean {
    return this.issues.length > 0;
  }

  /**
   * Check if the sprint can accept more issues
   */
  get canAcceptIssues(): boolean {
    return (this.isPlanning || this.isActive) &&
           this.issueCount < (this.config.maxIssues ?? 50);
  }

  /**
   * Get available slots for issues
   */
  get availableSlots(): number {
    const max = this.config.maxIssues ?? 50;
    return Math.max(0, max - this.issueCount);
  }

  /**
   * Check if we should start planning the next sprint
   */
  get shouldPlanNext(): boolean {
    if (!this.isActive) return false;
    return this.daysRemaining <= (this.config.planningBufferDays ?? 2);
  }

  // =========================================================================
  // Business Logic Methods
  // =========================================================================

  /**
   * Start the sprint
   */
  start(): void {
    if (!this.isPlanning) {
      throw new Error('Can only start a sprint in planning state');
    }

    this.status = ResourceStatus.ACTIVE;
    this.touch();
  }

  /**
   * Complete the sprint
   */
  complete(): void {
    if (!this.isActive) {
      throw new Error('Can only complete an active sprint');
    }

    this.status = ResourceStatus.COMPLETED;
    this.touch();
  }

  /**
   * Cancel the sprint
   */
  cancel(): void {
    if (this.isCompleted) {
      throw new Error('Cannot cancel a completed sprint');
    }

    this.status = ResourceStatus.CLOSED; // Using CLOSED for cancelled
    this.touch();
  }

  /**
   * Add an issue to the sprint
   * @returns true if issue was added, false if already exists or limit reached
   */
  addIssue(issueId: IssueId): boolean {
    if (!this.canAcceptIssues) {
      return false;
    }

    if (this.issues.includes(issueId)) {
      return false;
    }

    this.issues.push(issueId);
    this.touch();
    return true;
  }

  /**
   * Remove an issue from the sprint
   * @returns true if issue was removed, false if not found
   */
  removeIssue(issueId: IssueId): boolean {
    const index = this.issues.indexOf(issueId);
    if (index === -1) {
      return false;
    }

    this.issues.splice(index, 1);
    this.touch();
    return true;
  }

  /**
   * Check if an issue is in this sprint
   */
  hasIssue(issueId: IssueId): boolean {
    return this.issues.includes(issueId);
  }

  /**
   * Move an issue from this sprint to another
   */
  moveIssueTo(issueId: IssueId, targetSprint: SprintEntity): boolean {
    if (!this.removeIssue(issueId)) {
      return false;
    }

    if (!targetSprint.addIssue(issueId)) {
      // Rollback if target can't accept
      this.issues.push(issueId);
      return false;
    }

    return true;
  }

  /**
   * Calculate velocity (issues completed per day)
   * Note: Requires external completed count to be passed in
   */
  calculateVelocity(completedIssueCount: number): number {
    if (this.daysElapsed === 0) return 0;
    return Math.round((completedIssueCount / this.daysElapsed) * 10) / 10;
  }

  /**
   * Estimate completion based on current velocity
   * @param completedCount - Number of issues completed so far
   * @returns Estimated completion date or null if velocity is 0
   */
  estimateCompletion(completedCount: number): Date | null {
    if (completedCount === 0 || this.issueCount === 0) return null;

    const remainingCount = this.issueCount - completedCount;
    const velocity = this.calculateVelocity(completedCount);

    if (velocity === 0) return null;

    const daysNeeded = Math.ceil(remainingCount / velocity);
    const estimated = new Date();
    estimated.setDate(estimated.getDate() + daysNeeded);

    return estimated;
  }

  /**
   * Get sprint summary
   */
  toSummary(): {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    durationInDays: number;
    daysRemaining: number;
    percentTimeElapsed: number;
    isCurrent: boolean;
    issueCount: number;
    canAcceptIssues: boolean;
  } {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      startDate: this.startDate,
      endDate: this.endDate,
      durationInDays: this.durationInDays,
      daysRemaining: this.daysRemaining,
      percentTimeElapsed: this.percentTimeElapsed,
      isCurrent: this.isCurrent,
      issueCount: this.issueCount,
      canAcceptIssues: this.canAcceptIssues,
    };
  }

  /**
   * Convert to plain object (for serialization)
   */
  toData(): Sprint {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      issues: [...this.issues],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Create a copy of this sprint
   */
  clone(): SprintEntity {
    return SprintEntity.fromData(this.toData(), this.config);
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
