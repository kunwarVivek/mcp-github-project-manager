/**
 * AgentMetrics - Immutable Value Object
 *
 * Represents computed metrics for an agent or the agent swarm.
 * This is a value object, not an entity:
 * - It has no identity (equality is based on value, not ID)
 * - It is immutable (all properties are readonly)
 * - It can be freely replaced without side effects
 *
 * ## Usage
 * ```typescript
 * const metrics = AgentMetrics.create({
 *   agentId: 'agent-1',
 *   tasksCompleted: 10,
 *   tasksInProgress: 2,
 *   totalTokensUsed: 50000,
 *   budgetLimit: 100000,
 * });
 *
 * console.log(metrics.utilizationRate); // 20%
 * console.log(metrics.isBudgetExhausted); // false
 * ```
 */

/**
 * Configuration for creating AgentMetrics
 */
export interface AgentMetricsConfig {
  agentId: string;
  agentName?: string;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksReleased: number;
  tasksReclaimed: number;
  totalTokensUsed: number;
  budgetLimit?: number;
  lastHeartbeat?: Date | null;
  registeredAt?: Date;
}

/**
 * Immutable Value Object for Agent Metrics
 */
export class AgentMetrics {
  /**
   * The ID of the agent these metrics represent
   */
  public readonly agentId: string;

  /**
   * The name of the agent
   */
  public readonly agentName: string;

  /**
   * Number of tasks completed by this agent
   */
  public readonly tasksCompleted: number;

  /**
   * Number of tasks currently in progress
   */
  public readonly tasksInProgress: number;

  /**
   * Number of tasks released back to the pool
   */
  public readonly tasksReleased: number;

  /**
   * Number of tasks reclaimed due to stale heartbeat
   */
  public readonly tasksReclaimed: number;

  /**
   * Total tokens used by this agent
   */
  public readonly totalTokensUsed: number;

  /**
   * Budget limit for this agent (undefined = unlimited)
   */
  public readonly budgetLimit: number | undefined;

  /**
   * When the agent last sent a heartbeat
   */
  public readonly lastHeartbeat: Date | null;

  /**
   * When the agent was registered
   */
  public readonly registeredAt: Date;

  private constructor(config: AgentMetricsConfig) {
    this.agentId = config.agentId;
    this.agentName = config.agentName ?? 'Unknown';
    this.tasksCompleted = config.tasksCompleted;
    this.tasksInProgress = config.tasksInProgress;
    this.tasksReleased = config.tasksReleased;
    this.tasksReclaimed = config.tasksReclaimed;
    this.totalTokensUsed = config.totalTokensUsed;
    this.budgetLimit = config.budgetLimit;
    this.lastHeartbeat = config.lastHeartbeat ?? null;
    this.registeredAt = config.registeredAt ?? new Date();

    // Freeze the object for immutability
    Object.freeze(this);
  }

  // =========================================================================
  // Factory Method
  // =========================================================================

  /**
   * Create a new AgentMetrics instance
   */
  static create(config: AgentMetricsConfig): AgentMetrics {
    // Validate inputs
    if (config.tasksCompleted < 0) {
      throw new Error('tasksCompleted cannot be negative');
    }
    if (config.tasksInProgress < 0) {
      throw new Error('tasksInProgress cannot be negative');
    }
    if (config.tasksReleased < 0) {
      throw new Error('tasksReleased cannot be negative');
    }
    if (config.tasksReclaimed < 0) {
      throw new Error('tasksReclaimed cannot be negative');
    }
    if (config.totalTokensUsed < 0) {
      throw new Error('totalTokensUsed cannot be negative');
    }

    return new AgentMetrics(config);
  }

  // =========================================================================
  // Computed Properties
  // =========================================================================

  /**
   * Total tasks handled (completed + in progress + released + reclaimed)
   */
  get totalTasksHandled(): number {
    return this.tasksCompleted + this.tasksInProgress + this.tasksReleased + this.tasksReclaimed;
  }

  /**
   * Task completion rate (completed / total handled)
   */
  get completionRate(): number {
    if (this.totalTasksHandled === 0) {
      return 0;
    }
    return Math.round((this.tasksCompleted / this.totalTasksHandled) * 100);
  }

  /**
   * Whether the agent has a budget limit
   */
  get hasBudget(): boolean {
    return this.budgetLimit !== undefined && this.budgetLimit > 0;
  }

  /**
   * Budget utilization percentage (used / limit)
   */
  get budgetUtilization(): number | undefined {
    if (!this.hasBudget) {
      return undefined;
    }
    return Math.round((this.totalTokensUsed / this.budgetLimit!) * 100);
  }

  /**
   * Whether the budget is exhausted (>= 100%)
   */
  get isBudgetExhausted(): boolean {
    if (!this.hasBudget) {
      return false;
    }
    return this.totalTokensUsed >= this.budgetLimit!;
  }

  /**
   * Whether the budget is in warning zone (>= 80%)
   */
  get isBudgetWarning(): boolean {
    if (!this.hasBudget) {
      return false;
    }
    return this.budgetUtilization! >= 80;
  }

  /**
   * Whether the agent is stale (no heartbeat in 30+ minutes)
   */
  get isStale(): boolean {
    if (!this.lastHeartbeat) {
      return true; // Never heartbeated
    }
    const elapsed = Date.now() - this.lastHeartbeat.getTime();
    return elapsed > 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Time since last heartbeat in minutes
   */
  get minutesSinceHeartbeat(): number | undefined {
    if (!this.lastHeartbeat) {
      return undefined;
    }
    const elapsed = Date.now() - this.lastHeartbeat.getTime();
    return Math.round(elapsed / (60 * 1000));
  }

  /**
   * Agent age in days since registration
   */
  get ageInDays(): number {
    const elapsed = Date.now() - this.registeredAt.getTime();
    return Math.floor(elapsed / (24 * 60 * 60 * 1000));
  }

  // =========================================================================
  // Equality
  // =========================================================================

  /**
   * Check equality with another AgentMetrics instance
   */
  equals(other: AgentMetrics): boolean {
    if (!(other instanceof AgentMetrics)) {
      return false;
    }

    return (
      this.agentId === other.agentId &&
      this.tasksCompleted === other.tasksCompleted &&
      this.tasksInProgress === other.tasksInProgress &&
      this.tasksReleased === other.tasksReleased &&
      this.tasksReclaimed === other.tasksReclaimed &&
      this.totalTokensUsed === other.totalTokensUsed &&
      this.budgetLimit === other.budgetLimit
    );
  }

  // =========================================================================
  // Serialization
  // =========================================================================

  /**
   * Convert to plain object
   */
  toData(): {
    agentId: string;
    agentName: string;
    tasksCompleted: number;
    tasksInProgress: number;
    tasksReleased: number;
    tasksReclaimed: number;
    totalTasksHandled: number;
    completionRate: number;
    totalTokensUsed: number;
    budgetLimit: number | undefined;
    budgetUtilization: number | undefined;
    isBudgetExhausted: boolean;
    isBudgetWarning: boolean;
    isStale: boolean;
    minutesSinceHeartbeat: number | undefined;
    ageInDays: number;
  } {
    return {
      agentId: this.agentId,
      agentName: this.agentName,
      tasksCompleted: this.tasksCompleted,
      tasksInProgress: this.tasksInProgress,
      tasksReleased: this.tasksReleased,
      tasksReclaimed: this.tasksReclaimed,
      totalTasksHandled: this.totalTasksHandled,
      completionRate: this.completionRate,
      totalTokensUsed: this.totalTokensUsed,
      budgetLimit: this.budgetLimit,
      budgetUtilization: this.budgetUtilization,
      isBudgetExhausted: this.isBudgetExhausted,
      isBudgetWarning: this.isBudgetWarning,
      isStale: this.isStale,
      minutesSinceHeartbeat: this.minutesSinceHeartbeat,
      ageInDays: this.ageInDays,
    };
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `AgentMetrics(${this.agentName}: ${this.tasksCompleted} completed, ${this.tasksInProgress} in progress)`;
  }
}
