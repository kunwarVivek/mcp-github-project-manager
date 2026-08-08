/**
 * MilestoneEntity - Rich domain entity for GitHub Milestones
 *
 * This entity encapsulates business logic and invariants for milestones,
 * providing computed properties and validation methods.
 *
 * ## Design Decisions
 * - Implements the existing `Milestone` interface for backward compatibility
 * - Adds computed properties for progress tracking and deadline management
 * - Enforces invariants (e.g., due date must be in the future for active milestones)
 * - Provides factory methods for common creation patterns
 *
 * ## Usage
 * ```typescript
 * const milestone = MilestoneEntity.fromData(milestoneData);
 *
 * // Business logic
 * milestone.isOverdue; // checks if past due date
 * milestone.daysUntilDue; // days remaining
 * milestone.progressPercent; // completion percentage
 * milestone.canClose(); // checks if all issues are resolved
 * ```
 */
import { ResourceStatus } from '../resource-types';
import { Milestone, CreateMilestone } from '../types';

/**
 * Milestone state transitions
 */
export const MILESTONE_TRANSITIONS: Record<ResourceStatus, ResourceStatus[]> = {
  [ResourceStatus.ACTIVE]: [ResourceStatus.COMPLETED, ResourceStatus.CLOSED],
  [ResourceStatus.PLANNED]: [ResourceStatus.ACTIVE, ResourceStatus.CLOSED],
  [ResourceStatus.COMPLETED]: [], // Terminal state
  [ResourceStatus.CLOSED]: [ResourceStatus.ACTIVE], // Can be reopened
  [ResourceStatus.IN_PROGRESS]: [ResourceStatus.COMPLETED, ResourceStatus.CLOSED],
  [ResourceStatus.ARCHIVED]: [],
  [ResourceStatus.DELETED]: [],
};

/**
 * Configuration for MilestoneEntity
 */
export interface MilestoneEntityConfig {
  /** Number of days before due date to consider "at risk" */
  atRiskDaysThreshold?: number;
  /** Minimum progress percentage to allow closing */
  minProgressToClose?: number;
}

const DEFAULT_CONFIG: MilestoneEntityConfig = {
  atRiskDaysThreshold: 7,
  minProgressToClose: 80,
};

/**
 * Rich domain entity for GitHub Milestones
 */
export class MilestoneEntity implements Milestone {
  // Core properties (from Milestone interface)
  public readonly id: string;
  public readonly number: number;
  public title: string;
  public description: string;
  public dueDate?: string;
  public status: ResourceStatus;
  public readonly createdAt: string;
  public updatedAt: string;
  public readonly url: string;
  public progress?: {
    percent: number;
    complete: number;
    total: number;
  };

  // Internal config
  private readonly config: MilestoneEntityConfig;

  private constructor(
    data: Milestone,
    config: MilestoneEntityConfig = DEFAULT_CONFIG
  ) {
    this.id = data.id;
    this.number = data.number;
    this.title = data.title;
    this.description = data.description;
    this.dueDate = data.dueDate;
    this.status = data.status;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.url = data.url;
    this.progress = data.progress ? { ...data.progress } : undefined;
    this.config = config;
  }

  // =========================================================================
  // Factory Methods
  // =========================================================================

  /**
   * Create a MilestoneEntity from existing Milestone data
   */
  static fromData(data: Milestone, config?: MilestoneEntityConfig): MilestoneEntity {
    return new MilestoneEntity(data, config);
  }

  /**
   * Create a new MilestoneEntity with defaults
   */
  static create(
    data: CreateMilestone,
    options: {
      number: number;
      url: string;
      config?: MilestoneEntityConfig;
    }
  ): MilestoneEntity {
    const now = new Date().toISOString();
    const milestoneData: Milestone = {
      id: `milestone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      number: options.number,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      status: data.status ?? ResourceStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      url: options.url,
      progress: { percent: 0, complete: 0, total: 0 },
    };

    return new MilestoneEntity(milestoneData, options.config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Check if the milestone has a due date
   */
  get hasDueDate(): boolean {
    return this.dueDate !== undefined && this.dueDate !== null;
  }

  /**
   * Check if the milestone is overdue
   */
  get isOverdue(): boolean {
    if (!this.hasDueDate) return false;
    const due = new Date(this.dueDate!);
    const now = new Date();
    return due < now && this.status !== ResourceStatus.COMPLETED;
  }

  /**
   * Get the number of days until the due date (negative if overdue)
   */
  get daysUntilDue(): number | null {
    if (!this.hasDueDate) return null;
    const due = new Date(this.dueDate!);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the milestone is at risk (due within threshold)
   */
  get isAtRisk(): boolean {
    if (!this.hasDueDate || this.isOverdue) return false;
    const daysLeft = this.daysUntilDue!;
    return daysLeft <= (this.config.atRiskDaysThreshold ?? 7);
  }

  /**
   * Get the progress percentage
   */
  get progressPercent(): number {
    return this.progress?.percent ?? 0;
  }

  /**
   * Get the number of completed issues
   */
  get completedCount(): number {
    return this.progress?.complete ?? 0;
  }

  /**
   * Get the total number of issues
   */
  get totalCount(): number {
    return this.progress?.total ?? 0;
  }

  /**
   * Check if the milestone is complete
   */
  get isComplete(): boolean {
    return this.status === ResourceStatus.COMPLETED;
  }

  /**
   * Check if the milestone has any issues
   */
  get hasIssues(): boolean {
    return this.totalCount > 0;
  }

  /**
   * Check if all issues are completed
   */
  get allIssuesComplete(): boolean {
    return this.hasIssues && this.completedCount === this.totalCount;
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

  // =========================================================================
  // Business Logic Methods
  // =========================================================================

  /**
   * Update progress tracking
   */
  updateProgress(complete: number, total: number): void {
    if (complete < 0 || total < 0) {
      throw new Error('Progress values cannot be negative');
    }
    if (complete > total) {
      throw new Error('Completed count cannot exceed total');
    }

    this.progress = {
      complete,
      total,
      percent: total > 0 ? Math.round((complete / total) * 100) : 0,
    };
    this.touch();
  }

  /**
   * Close the milestone
   * Business rule: Can only close if all issues are complete or explicitly forced
   */
  close(force: boolean = false): void {
    if (this.isComplete) {
      return; // Already closed
    }

    if (!force && this.hasIssues && !this.allIssuesComplete) {
      throw new Error(
        `Cannot close milestone: ${this.completedCount}/${this.totalCount} issues complete. ` +
        `Use force=true to close anyway.`
      );
    }

    this.status = ResourceStatus.COMPLETED;
    this.touch();
  }

  /**
   * Reopen the milestone
   */
  reopen(): void {
    if (!this.isComplete) {
      return; // Already open
    }

    this.status = ResourceStatus.ACTIVE;
    this.touch();
  }

  /**
   * Check if the milestone can be closed
   */
  canClose(): boolean {
    return !this.isComplete && 
           (this.allIssuesComplete || !this.hasIssues);
  }

  /**
   * Check if the milestone can accept new issues
   */
  canAcceptIssues(): boolean {
    return this.status === ResourceStatus.ACTIVE ||
           this.status === ResourceStatus.PLANNED;
  }

  /**
   * Add an issue to the milestone (increments total count)
   */
  addIssue(): void {
    if (!this.canAcceptIssues()) {
      throw new Error('Milestone cannot accept issues in current state');
    }

    if (!this.progress) {
      this.progress = { percent: 0, complete: 0, total: 0 };
    }

    this.progress.total += 1;
    this.updateProgressPercent();
    this.touch();
  }

  /**
   * Complete an issue in the milestone (increments complete count)
   */
  completeIssue(): void {
    if (!this.progress) {
      return;
    }

    if (this.completedCount >= this.totalCount) {
      throw new Error('No incomplete issues remaining');
    }

    this.progress.complete += 1;
    this.updateProgressPercent();
    this.touch();
  }

  /**
   * Remove an issue from the milestone (decrements counts)
   */
  removeIssue(wasComplete: boolean): void {
    if (!this.progress || this.totalCount === 0) {
      return;
    }

    this.progress.total -= 1;
    if (wasComplete) {
      this.progress.complete -= 1;
    }

    this.updateProgressPercent();
    this.touch();
  }

  /**
   * Get a status summary
   */
  getStatusSummary(): {
    id: string;
    number: number;
    title: string;
    status: string;
    dueDate: string | null;
    daysUntilDue: number | null;
    isOverdue: boolean;
    isAtRisk: boolean;
    progress: { complete: number; total: number; percent: number };
    canClose: boolean;
  } {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      status: this.status,
      dueDate: this.dueDate ?? null,
      daysUntilDue: this.daysUntilDue,
      isOverdue: this.isOverdue,
      isAtRisk: this.isAtRisk,
      progress: this.progress ?? { complete: 0, total: 0, percent: 0 },
      canClose: this.canClose(),
    };
  }

  /**
   * Convert to plain object (for serialization)
   */
  toData(): Milestone {
    return {
      id: this.id,
      number: this.number,
      title: this.title,
      description: this.description,
      dueDate: this.dueDate,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      url: this.url,
      progress: this.progress ? { ...this.progress } : undefined,
    };
  }

  /**
   * Create a copy of this milestone
   */
  clone(): MilestoneEntity {
    return MilestoneEntity.fromData(this.toData(), this.config);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Recalculate progress percentage
   */
  private updateProgressPercent(): void {
    if (this.progress) {
      this.progress.percent = this.progress.total > 0
        ? Math.round((this.progress.complete / this.progress.total) * 100)
        : 0;
    }
  }

  /**
   * Update the updatedAt timestamp
   */
  private touch(): void {
    this.updatedAt = new Date().toISOString();
  }
}
