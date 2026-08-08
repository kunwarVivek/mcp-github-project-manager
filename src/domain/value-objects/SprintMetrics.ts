/**
 * SprintMetrics - Immutable Value Object
 *
 * Represents computed metrics for a sprint. This is a value object, not an entity:
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
 * const metrics = SprintMetrics.create({
 *   sprintId: 'sprint-1',
 *   title: 'Sprint 1',
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-14',
 *   totalIssues: 10,
 *   completedIssues: 5,
 *   status: ResourceStatus.ACTIVE,
 * });
 *
 * console.log(metrics.completionPercentage); // 50
 * console.log(metrics.daysRemaining); // calculated from endDate
 * ```
 */

import { ResourceStatus } from '../resource-types';
import { Issue } from '../types';

/**
 * Configuration for creating SprintMetrics
 */
export interface SprintMetricsConfig {
  sprintId: string;
  title: string;
  startDate: string;
  endDate: string;
  totalIssues: number;
  completedIssues: number;
  status: ResourceStatus;
  issues?: readonly Issue[];
}

/**
 * Immutable Value Object for Sprint Metrics
 */
export class SprintMetrics {
  /**
   * The ID of the sprint these metrics represent
   */
  public readonly sprintId: string;

  /**
   * The title of the sprint
   */
  public readonly title: string;

  /**
   * The start date of the sprint (ISO 8601)
   */
  public readonly startDate: string;

  /**
   * The end date of the sprint (ISO 8601)
   */
  public readonly endDate: string;

  /**
   * Total number of issues in the sprint
   */
  public readonly totalIssues: number;

  /**
   * Number of completed issues
   */
  public readonly completedIssues: number;

  /**
   * Current status of the sprint
   */
  public readonly status: ResourceStatus;

  /**
   * Optional list of issues in the sprint
   */
  public readonly issues?: readonly Issue[];

  private constructor(config: SprintMetricsConfig) {
    this.sprintId = config.sprintId;
    this.title = config.title;
    this.startDate = config.startDate;
    this.endDate = config.endDate;
    this.totalIssues = config.totalIssues;
    this.completedIssues = config.completedIssues;
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
   * Create a new SprintMetrics instance
   */
  static create(config: SprintMetricsConfig): SprintMetrics {
    // Validate inputs
    if (config.totalIssues < 0) {
      throw new Error('totalIssues cannot be negative');
    }
    if (config.completedIssues < 0) {
      throw new Error('completedIssues cannot be negative');
    }
    if (config.completedIssues > config.totalIssues) {
      throw new Error('completedIssues cannot exceed totalIssues');
    }

    return new SprintMetrics(config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Number of remaining (incomplete) issues
   */
  get remainingIssues(): number {
    return this.totalIssues - this.completedIssues;
  }

  /**
   * Completion percentage (0-100)
   */
  get completionPercentage(): number {
    if (this.totalIssues === 0) {
      return 0;
    }
    return Math.round((this.completedIssues / this.totalIssues) * 100);
  }

  /**
   * Whether the sprint is currently active
   */
  get isActive(): boolean {
    const now = new Date();
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    return now >= start && now <= end && this.status === ResourceStatus.ACTIVE;
  }

  /**
   * Number of days remaining until the sprint ends
   * Returns undefined if the sprint has ended
   */
  get daysRemaining(): number | undefined {
    const now = new Date();
    const end = new Date(this.endDate);

    if (now > end) {
      return undefined; // Sprint has ended
    }

    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Duration of the sprint in days
   */
  get durationInDays(): number {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Whether the sprint is overdue (past end date and not completed)
   */
  get isOverdue(): boolean {
    const now = new Date();
    const end = new Date(this.endDate);
    return now > end && this.status !== ResourceStatus.COMPLETED;
  }

  /**
   * Velocity (completed issues per day)
   */
  get velocity(): number {
    const duration = this.durationInDays;
    if (duration === 0) {
      return 0;
    }
    return Math.round((this.completedIssues / duration) * 10) / 10;
  }

  // =========================================================================
  // Equality
  // =========================================================================

  /**
   * Check equality with another SprintMetrics instance
   * Value objects are equal if all their properties are equal
   */
  equals(other: SprintMetrics): boolean {
    if (!(other instanceof SprintMetrics)) {
      return false;
    }

    return (
      this.sprintId === other.sprintId &&
      this.title === other.title &&
      this.startDate === other.startDate &&
      this.endDate === other.endDate &&
      this.totalIssues === other.totalIssues &&
      this.completedIssues === other.completedIssues &&
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
    sprintId: string;
    title: string;
    startDate: string;
    endDate: string;
    totalIssues: number;
    completedIssues: number;
    remainingIssues: number;
    completionPercentage: number;
    status: ResourceStatus;
    isActive: boolean;
    daysRemaining: number | undefined;
    durationInDays: number;
    isOverdue: boolean;
    velocity: number;
  } {
    return {
      sprintId: this.sprintId,
      title: this.title,
      startDate: this.startDate,
      endDate: this.endDate,
      totalIssues: this.totalIssues,
      completedIssues: this.completedIssues,
      remainingIssues: this.remainingIssues,
      completionPercentage: this.completionPercentage,
      status: this.status,
      isActive: this.isActive,
      daysRemaining: this.daysRemaining,
      durationInDays: this.durationInDays,
      isOverdue: this.isOverdue,
      velocity: this.velocity,
    };
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `SprintMetrics(${this.title}: ${this.completionPercentage}% complete, ${this.remainingIssues} remaining)`;
  }
}
