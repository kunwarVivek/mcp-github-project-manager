/**
 * Agent Domain Events
 *
 * Events specific to the agent orchestration flow.
 * These events enable loose coupling between agent operations and side effects
 * (notifications, logging, analytics, etc.).
 *
 * ## Usage
 * ```typescript
 * // Publish agent events
 * domainEventBus.publish(AgentRegisteredEvent.create({
 *   agentId: 'agent-1',
 *   agentName: 'CodeReviewer',
 *   role: 'reviewer',
 * }));
 *
 * domainEventBus.publish(TaskCheckedOutEvent.create({
 *   agentId: 'agent-1',
 *   issueNumber: 42,
 *   issueTitle: 'Fix bug',
 *   strategy: 'highest_priority',
 * }));
 * ```
 */

import { ResourceType, ResourceStatus } from '../resource-types';
import { DomainEvent } from './DomainEvent';

// =============================================================================
// Agent Registration Events
// =============================================================================

/**
 * Data for AgentRegisteredEvent
 */
export interface AgentRegisteredEventData {
  agentName: string;
  role: string;
  runtime?: string;
  capabilities: string[];
  parentAgentId?: string;
}

/**
 * Event emitted when an agent is registered
 */
export class AgentRegisteredEvent extends DomainEvent<AgentRegisteredEventData> {
  public readonly eventType = 'AgentRegistered';
  public readonly resourceType = ResourceType.ISSUE; // Agents are tracked via issues

  constructor(aggregateId: string, data: AgentRegisteredEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    agentName: string;
    role: string;
    runtime?: string;
    capabilities?: string[];
    parentAgentId?: string;
    causedBy?: string;
  }): AgentRegisteredEvent {
    return new AgentRegisteredEvent(
      params.agentId,
      {
        agentName: params.agentName,
        role: params.role,
        runtime: params.runtime,
        capabilities: params.capabilities ?? [],
        parentAgentId: params.parentAgentId,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for AgentDeregisteredEvent
 */
export interface AgentDeregisteredEventData {
  agentName: string;
  reason?: string;
}

/**
 * Event emitted when an agent is deregistered
 */
export class AgentDeregisteredEvent extends DomainEvent<AgentDeregisteredEventData> {
  public readonly eventType = 'AgentDeregistered';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: AgentDeregisteredEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    agentName: string;
    reason?: string;
    causedBy?: string;
  }): AgentDeregisteredEvent {
    return new AgentDeregisteredEvent(
      params.agentId,
      {
        agentName: params.agentName,
        reason: params.reason,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Task Checkout Events
// =============================================================================

/**
 * Data for TaskCheckedOutEvent
 */
export interface TaskCheckedOutEventData {
  issueNumber: number;
  issueTitle: string;
  strategy: string;
  selectionRationale?: string;
  milestone?: string;
  labels: string[];
  branchSuggestion: string;
}

/**
 * Event emitted when an agent checks out a task
 */
export class TaskCheckedOutEvent extends DomainEvent<TaskCheckedOutEventData> {
  public readonly eventType = 'TaskCheckedOut';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskCheckedOutEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    issueNumber: number;
    issueTitle: string;
    strategy?: string;
    selectionRationale?: string;
    milestone?: string;
    labels?: string[];
    branchSuggestion: string;
    causedBy?: string;
  }): TaskCheckedOutEvent {
    return new TaskCheckedOutEvent(
      params.agentId,
      {
        issueNumber: params.issueNumber,
        issueTitle: params.issueTitle,
        strategy: params.strategy ?? 'highest_priority',
        selectionRationale: params.selectionRationale,
        milestone: params.milestone,
        labels: params.labels ?? [],
        branchSuggestion: params.branchSuggestion,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for TaskReleasedEvent
 */
export interface TaskReleasedEventData {
  issueNumber: number;
  reason?: string;
}

/**
 * Event emitted when an agent releases a task
 */
export class TaskReleasedEvent extends DomainEvent<TaskReleasedEventData> {
  public readonly eventType = 'TaskReleased';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskReleasedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    issueNumber: number;
    reason?: string;
    causedBy?: string;
  }): TaskReleasedEvent {
    return new TaskReleasedEvent(
      params.agentId,
      {
        issueNumber: params.issueNumber,
        reason: params.reason,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for TaskCompletedEvent
 */
export interface TaskCompletedEventData {
  issueNumber: number;
  summary: string;
  prNumber?: number;
  closeIssue: boolean;
}

/**
 * Event emitted when an agent completes a task
 */
export class TaskCompletedEvent extends DomainEvent<TaskCompletedEventData> {
  public readonly eventType = 'TaskCompleted';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskCompletedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    issueNumber: number;
    summary: string;
    prNumber?: number;
    closeIssue?: boolean;
    causedBy?: string;
  }): TaskCompletedEvent {
    return new TaskCompletedEvent(
      params.agentId,
      {
        issueNumber: params.issueNumber,
        summary: params.summary,
        prNumber: params.prNumber,
        closeIssue: params.closeIssue ?? true,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Review Workflow Events
// =============================================================================

/**
 * Data for TaskSubmittedForReviewEvent
 */
export interface TaskSubmittedForReviewEventData {
  issueNumber: number;
  summary?: string;
}

/**
 * Event emitted when a task is submitted for review
 */
export class TaskSubmittedForReviewEvent extends DomainEvent<TaskSubmittedForReviewEventData> {
  public readonly eventType = 'TaskSubmittedForReview';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskSubmittedForReviewEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    issueNumber: number;
    summary?: string;
    causedBy?: string;
  }): TaskSubmittedForReviewEvent {
    return new TaskSubmittedForReviewEvent(
      params.agentId,
      {
        issueNumber: params.issueNumber,
        summary: params.summary,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for TaskApprovedEvent
 */
export interface TaskApprovedEventData {
  issueNumber: number;
  reviewerId: string;
  summary?: string;
}

/**
 * Event emitted when a task is approved
 */
export class TaskApprovedEvent extends DomainEvent<TaskApprovedEventData> {
  public readonly eventType = 'TaskApproved';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskApprovedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueNumber: number;
    reviewerId: string;
    summary?: string;
    causedBy?: string;
  }): TaskApprovedEvent {
    return new TaskApprovedEvent(
      params.reviewerId,
      {
        issueNumber: params.issueNumber,
        reviewerId: params.reviewerId,
        summary: params.summary,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for TaskRejectedEvent
 */
export interface TaskRejectedEventData {
  issueNumber: number;
  reviewerId: string;
  feedback?: string;
}

/**
 * Event emitted when a task is rejected
 */
export class TaskRejectedEvent extends DomainEvent<TaskRejectedEventData> {
  public readonly eventType = 'TaskRejected';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskRejectedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueNumber: number;
    reviewerId: string;
    feedback?: string;
    causedBy?: string;
  }): TaskRejectedEvent {
    return new TaskRejectedEvent(
      params.reviewerId,
      {
        issueNumber: params.issueNumber,
        reviewerId: params.reviewerId,
        feedback: params.feedback,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Heartbeat Events
// =============================================================================

/**
 * Data for AgentHeartbeatEvent
 */
export interface AgentHeartbeatEventData {
  status: string;
  progress?: number;
  progressSummary?: string;
  currentBranch?: string;
  estimatedCompletionMinutes?: number;
  blockerDescription?: string;
}

/**
 * Event emitted when an agent sends a heartbeat
 */
export class AgentHeartbeatEvent extends DomainEvent<AgentHeartbeatEventData> {
  public readonly eventType = 'AgentHeartbeat';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: AgentHeartbeatEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    agentId: string;
    status: string;
    progress?: number;
    progressSummary?: string;
    currentBranch?: string;
    estimatedCompletionMinutes?: number;
    blockerDescription?: string;
    causedBy?: string;
  }): AgentHeartbeatEvent {
    return new AgentHeartbeatEvent(
      params.agentId,
      {
        status: params.status,
        progress: params.progress,
        progressSummary: params.progressSummary,
        currentBranch: params.currentBranch,
        estimatedCompletionMinutes: params.estimatedCompletionMinutes,
        blockerDescription: params.blockerDescription,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Task Reclaim Events
// =============================================================================

/**
 * Data for TaskReclaimedEvent
 */
export interface TaskReclaimedEventData {
  issueNumber: number;
  previousAgentId: string;
  reason: string;
}

/**
 * Event emitted when a task is reclaimed from a stale agent
 */
export class TaskReclaimedEvent extends DomainEvent<TaskReclaimedEventData> {
  public readonly eventType = 'TaskReclaimed';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: TaskReclaimedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueNumber: number;
    previousAgentId: string;
    reason?: string;
    causedBy?: string;
  }): TaskReclaimedEvent {
    return new TaskReclaimedEvent(
      `task-${params.issueNumber}`,
      {
        issueNumber: params.issueNumber,
        previousAgentId: params.previousAgentId,
        reason: params.reason ?? 'Heartbeat timeout',
      },
      params.causedBy ?? 'system'
    );
  }
}
