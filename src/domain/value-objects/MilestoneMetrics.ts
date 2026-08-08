/**
 * MilestoneMetrics - Immutable Value Object
 *
 * Represents computed metrics for a milestone. This is a value object, not an entity:
 * - It has no identity (equality is based on value, not ID)
 * - It is immutable (all properties are readonly)
 * - It can be freely replaced without side effects
 *
 * ## Design Decisions
 * - All properties are readonly for immutability
 * - Equality is based on all properties (structural equality)
 * - Factory method for creation with validation
 * - Computed properties for derived values
 *
 * ## Usage
 * ```typescript
 * const metrics = MilestoneMetrics.create({
 *   milestoneId: 'ms-1',
 *   title: 'v1.0 Release',
 *   dueDate: '2024-02-01',
 *   totalIssues: 20,
 *   closedIssues: 15,
 *   status: ResourceStatus.ACTIVE,
 * });
 *
 * console.log(metrics.completionPercentage); // 75
 * console.log(metrics.daysUntilDue); // calculated from dueDate
 * ```
 */

import { ResourceStatus } from '../resource-types';
import { Issue } from '../types';

/**
 * Configuration for creating MilestoneMetrics
 */
export interface MilestoneMetricsConfig {
  milestoneId: string;
  title: string;
  dueDate?: string | null;
  totalIssues: number;
  closedIssues: number;
  status: ResourceStatus;
  issues?: readonly Issue[];
}

/**
 * Immutable Value Object for Milestone Metrics
 */
export class MilestoneMetrics {
  /**
   * The ID of the milestone these metrics represent
   */
  public readonly milestoneId: string;

  /**
   * The title of the milestone
   */
  public readonly title: string;

  /**
   * The due date of the milestone (ISO 8601), if set
   */
  public readonly dueDate: string | null;

  /**
   * Total number of issues in the milestone
   */
  public readonly totalIssues: number;

  /**
   * Number of closed/completed issues
   */
  public readonly closedIssues: number;

  /**
   * Current status of the milestone
   */
  public readonly status: ResourceStatus;

  /**
   * Optional list of issues in the milestone
   */
  public readonly issues?: readonly Issue[];

  private constructor(config: MilestoneMetricsConfig) {
    this.milestoneId = config.milestoneId;
    this.title = config.title;
    this.dueDate = config.dueDate ?? null;
    this.totalIssues = config.totalIssues;
    this.closedIssues = config.closedIssues;
    this.status = config.status;
    this.issues = config.issues ? [...config.issues] : undefined;

    // Freeze the object for immutability
    Object.freeze(this);
    if (this.issues) {
      Object.freeze(this.issues);
    }
  }

  // =========================================================================
  // Factory Method
  // =========================================================================

  /**
   * Create a new MilestoneMetrics instance
   */
  static create(config: MilestoneMetricsConfig): MilestoneMetrics {
    // Validate inputs
    if (config.totalIssues < 0) {
      throw new Error('totalIssues cannot be negative');
    }
    if (config.closedIssues < 0) {
      throw new Error('closedIssues cannot be negative');
    }
    if (config.closedIssues > config.totalIssues) {
      throw new Error('closedIssues cannot exceed totalIssues');
    }

    return new MilestoneMetrics(config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Number of open issues
   */
  get openIssues(): number {
    return this.totalIssues - this.closedIssues;
  }

  /**
   * Completion percentage (0-100)
   */
  get completionPercentage(): number {
    if (this.totalIssues === 0) {
      return 0;
    }
    return Math.round((this.closedIssues / this.totalIssues) * 100);
  }

  /**
   * Whether the milestone has a due date
   */
  get hasDueDate(): boolean {
    return this.dueDate !== null && this.dueDate !== undefined;
  }

  /**
   * Whether the milestone is overdue
   */
  get isOverdue(): boolean {
    if (!this.hasDueDate) {
      return false;
    }

    const now = new Date();
    const due = new Date(this.dueDate!);
    return now > due && this.status !== ResourceStatus.COMPLETED;
  }

  /**
   * Number of days until the due date
   * Returns undefined if no due date is set
   * Returns negative number if overdue
   */
  get daysUntilDue(): number | undefined {
    if (!this.hasDueDate) {
      return undefined;
    }

    const now = new Date();
    const due = new Date(this.dueDate!);
    const diffMs = due.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Whether the milestone is at risk (due within 7 days and less than 50% complete)
   */
  get isAtRisk(): boolean {
    if (!this.hasDueDate) {
      return false;
    }

    const daysLeft = this.daysUntilDue;
    if (daysLeft === undefined || daysLeft < 0) {
      return false;
    }

    return daysLeft <= 7 && this.completionPercentage < 50;
  }

  /**
   * Whether the milestone is complete (all issues closed)
   */
  get isComplete(): boolean {
    return this.totalIssues > 0 && this.closedIssues === this.totalIssues;
  }

  // =========================================================================
  // Equality
  // =========================================================================

  /**
   * Check equality with another MilestoneMetrics instance
   * Value objects are equal if all their properties are equal
   */
  equals(other: MilestoneMetrics): boolean {
    if (!(other instanceof MilestoneMetrics)) {
      return false;
    }

    return (
      this.milestoneId === other.milestoneId &&
      this.title === other.title &&
      this.dueDate === other.dueDate &&
      this.totalIssues === other.totalIssues &&
      this.closedIssues === other.closedIssues &&
      this.status === other.status
    );
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Convert to plain object
   */
  toData(): {
    milestoneId: string;
    title: string;
    dueDate: string | null;
    totalIssues: number;
    closedIssues: number;
    openIssues: number;
    completionPercentage: number;
    status: ResourceStatus;
    hasDueDate: boolean;
    isOverdue: boolean;
    daysUntilDue: number | undefined;
    isAtRisk: boolean;
    isComplete: boolean;
  } {
    return {
      milestoneId: this.milestoneId,
      title: this.title,
      dueDate: this.dueDate,
      totalIssues: this.totalIssues,
      closedIssues: this.closedIssues,
      openIssues: this.openIssues,
      completionPercentage: this.completionPercentage,
      status: this.status,
      hasDueDate: this.hasDueDate,
      isOverdue: this.isOverdue,
      daysUntilDue: this.daysUntilDue,
      isAtRisk: this.isAtRisk,
      isComplete: this.isComplete,
    };
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `MilestoneMetrics(${this.title}: ${this.completionPercentage}% complete, ${this.openIssues} open)`;
  }
}
