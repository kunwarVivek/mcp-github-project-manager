/**
 * Domain Events System
 *
 * This module provides a domain events system for entity state change notifications.
 * Domain events represent something meaningful that happened in the domain.
 *
 * ## Design Decisions
 * - Events are immutable value objects
 * - Each event has a timestamp, aggregate ID, and event type
 * - Events can carry additional data specific to the event type
 * - Events are published to a bus for subscribers to handle
 *
 * ## Usage
 * ```typescript
 * // Create an event
 * const event = IssueCreatedEvent.create({
 *   issueId: 'issue-1',
 *   title: 'Fix bug',
 *   creator: 'user1',
 * });
 *
 * // Publish to bus
 * domainEventBus.publish(event);
 *
 * // Subscribe to events
 * domainEventBus.subscribe(IssueCreatedEvent, (event) => {
 *   console.log(`Issue created: ${event.data.title}`);
 * });
 * ```
 */

import { ResourceType, type ResourceStatus } from '../resource-types';

/**
 * Base class for all domain events
 */
export abstract class DomainEvent<T = unknown> {
  /**
   * Unique identifier for this event instance
   */
  public readonly eventId: string;

  /**
   * The type of event (e.g., 'IssueCreated', 'SprintCompleted')
   */
  public abstract readonly eventType: string;

  /**
   * The type of resource this event relates to
   */
  public abstract readonly resourceType: ResourceType;

  /**
   * The ID of the aggregate (resource) this event relates to
   */
  public readonly aggregateId: string;

  /**
   * When this event occurred
   */
  public readonly timestamp: Date;

  /**
   * The user or system that caused this event
   */
  public readonly causedBy: string;

  /**
   * Additional data specific to this event type
   */
  public readonly data: T;

  protected constructor(aggregateId: string, data: T, causedBy: string = 'system') {
    this.eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.aggregateId = aggregateId;
    this.timestamp = new Date();
    this.causedBy = causedBy;
    this.data = data;

    // Freeze the data for immutability
    if (data && typeof data === 'object') {
      Object.freeze(data);
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toData(): {
    eventId: string;
    eventType: string;
    resourceType: ResourceType;
    aggregateId: string;
    timestamp: string;
    causedBy: string;
    data: T;
  } {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      resourceType: this.resourceType,
      aggregateId: this.aggregateId,
      timestamp: this.timestamp.toISOString(),
      causedBy: this.causedBy,
      data: this.data,
    };
  }

  /**
   * Create a string representation
   */
  toString(): string {
    return `${this.eventType}(${this.aggregateId} at ${this.timestamp.toISOString()})`;
  }
}

// =============================================================================
// Issue Events
// =============================================================================

/**
 * Data for IssueCreatedEvent
 */
export interface IssueCreatedEventData {
  title: string;
  description: string;
  labels: string[];
  assignees: string[];
  milestoneId?: string;
}

/**
 * Event emitted when an issue is created
 */
export class IssueCreatedEvent extends DomainEvent<IssueCreatedEventData> {
  public readonly eventType = 'IssueCreated';
  public readonly resourceType = ResourceType.ISSUE;

  constructor(aggregateId: string, data: IssueCreatedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueId: string;
    title: string;
    description: string;
    labels?: string[];
    assignees?: string[];
    milestoneId?: string;
    causedBy?: string;
  }): IssueCreatedEvent {
    return new IssueCreatedEvent(
      params.issueId,
      {
        title: params.title,
        description: params.description,
        labels: params.labels ?? [],
        assignees: params.assignees ?? [],
        milestoneId: params.milestoneId,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for IssueStatusChangedEvent
 */
export interface IssueStatusChangedEventData {
  previousStatus: ResourceStatus;
  newStatus: ResourceStatus;
}

/**
 * Event emitted when an issue's status changes
 */
export class IssueStatusChangedEvent extends DomainEvent<IssueStatusChangedEventData> {
  public readonly eventType = 'IssueStatusChanged';
  public readonly resourceType = ResourceType.ISSUE;

  private constructor(aggregateId: string, data: IssueStatusChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueId: string;
    previousStatus: ResourceStatus;
    newStatus: ResourceStatus;
    causedBy?: string;
  }): IssueStatusChangedEvent {
    return new IssueStatusChangedEvent(
      params.issueId,
      {
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for IssueAssignedEvent
 */
export interface IssueAssignedEventData {
  previousAssignees: string[];
  newAssignees: string[];
  addedAssignees: string[];
  removedAssignees: string[];
}

/**
 * Event emitted when issue assignment changes
 */
export class IssueAssignedEvent extends DomainEvent<IssueAssignedEventData> {
  public readonly eventType = 'IssueAssigned';
  public readonly resourceType = ResourceType.ISSUE;

  private constructor(aggregateId: string, data: IssueAssignedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueId: string;
    previousAssignees: string[];
    newAssignees: string[];
    causedBy?: string;
  }): IssueAssignedEvent {
    const added = params.newAssignees.filter(a => !params.previousAssignees.includes(a));
    const removed = params.previousAssignees.filter(a => !params.newAssignees.includes(a));

    return new IssueAssignedEvent(
      params.issueId,
      {
        previousAssignees: [...params.previousAssignees],
        newAssignees: [...params.newAssignees],
        addedAssignees: added,
        removedAssignees: removed,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for IssueLabelChangedEvent
 */
export interface IssueLabelChangedEventData {
  previousLabels: string[];
  newLabels: string[];
  addedLabels: string[];
  removedLabels: string[];
}

/**
 * Event emitted when issue labels change
 */
export class IssueLabelChangedEvent extends DomainEvent<IssueLabelChangedEventData> {
  public readonly eventType = 'IssueLabelChanged';
  public readonly resourceType = ResourceType.ISSUE;

  private constructor(aggregateId: string, data: IssueLabelChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    issueId: string;
    previousLabels: string[];
    newLabels: string[];
    causedBy?: string;
  }): IssueLabelChangedEvent {
    const added = params.newLabels.filter(l => !params.previousLabels.includes(l));
    const removed = params.previousLabels.filter(l => !params.newLabels.includes(l));

    return new IssueLabelChangedEvent(
      params.issueId,
      {
        previousLabels: [...params.previousLabels],
        newLabels: [...params.newLabels],
        addedLabels: added,
        removedLabels: removed,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Sprint Events
// =============================================================================

/**
 * Data for SprintCreatedEvent
 */
export interface SprintCreatedEventData {
  title: string;
  startDate: string;
  endDate: string;
  issueIds: string[];
}

/**
 * Event emitted when a sprint is created
 */
export class SprintCreatedEvent extends DomainEvent<SprintCreatedEventData> {
  public readonly eventType = 'SprintCreated';
  public readonly resourceType = ResourceType.SPRINT;

  constructor(aggregateId: string, data: SprintCreatedEventData, causedBy: string = 'system') {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    sprintId: string;
    title: string;
    startDate: string;
    endDate: string;
    issueIds?: string[];
    causedBy?: string;
  }): SprintCreatedEvent {
    return new SprintCreatedEvent(
      params.sprintId,
      {
        title: params.title,
        startDate: params.startDate,
        endDate: params.endDate,
        issueIds: params.issueIds ?? [],
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for SprintStatusChangedEvent
 */
export interface SprintStatusChangedEventData {
  previousStatus: ResourceStatus;
  newStatus: ResourceStatus;
}

/**
 * Event emitted when a sprint's status changes
 */
export class SprintStatusChangedEvent extends DomainEvent<SprintStatusChangedEventData> {
  public readonly eventType = 'SprintStatusChanged';
  public readonly resourceType = ResourceType.SPRINT;

  private constructor(aggregateId: string, data: SprintStatusChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    sprintId: string;
    previousStatus: ResourceStatus;
    newStatus: ResourceStatus;
    causedBy?: string;
  }): SprintStatusChangedEvent {
    return new SprintStatusChangedEvent(
      params.sprintId,
      {
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for SprintIssuesChangedEvent
 */
export interface SprintIssuesChangedEventData {
  addedIssueIds: string[];
  removedIssueIds: string[];
}

/**
 * Event emitted when sprint issues change
 */
export class SprintIssuesChangedEvent extends DomainEvent<SprintIssuesChangedEventData> {
  public readonly eventType = 'SprintIssuesChanged';
  public readonly resourceType = ResourceType.SPRINT;

  private constructor(aggregateId: string, data: SprintIssuesChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    sprintId: string;
    addedIssueIds?: string[];
    removedIssueIds?: string[];
    causedBy?: string;
  }): SprintIssuesChangedEvent {
    return new SprintIssuesChangedEvent(
      params.sprintId,
      {
        addedIssueIds: params.addedIssueIds ?? [],
        removedIssueIds: params.removedIssueIds ?? [],
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Milestone Events
// =============================================================================

/**
 * Data for MilestoneCreatedEvent
 */
export interface MilestoneCreatedEventData {
  title: string;
  description: string;
  dueDate?: string;
}

/**
 * Event emitted when a milestone is created
 */
export class MilestoneCreatedEvent extends DomainEvent<MilestoneCreatedEventData> {
  public readonly eventType = 'MilestoneCreated';
  public readonly resourceType = ResourceType.MILESTONE;

  private constructor(aggregateId: string, data: MilestoneCreatedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    milestoneId: string;
    title: string;
    description: string;
    dueDate?: string;
    causedBy?: string;
  }): MilestoneCreatedEvent {
    return new MilestoneCreatedEvent(
      params.milestoneId,
      {
        title: params.title,
        description: params.description,
        dueDate: params.dueDate,
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for MilestoneStatusChangedEvent
 */
export interface MilestoneStatusChangedEventData {
  previousStatus: ResourceStatus;
  newStatus: ResourceStatus;
}

/**
 * Event emitted when a milestone's status changes
 */
export class MilestoneStatusChangedEvent extends DomainEvent<MilestoneStatusChangedEventData> {
  public readonly eventType = 'MilestoneStatusChanged';
  public readonly resourceType = ResourceType.MILESTONE;

  private constructor(aggregateId: string, data: MilestoneStatusChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    milestoneId: string;
    previousStatus: ResourceStatus;
    newStatus: ResourceStatus;
    causedBy?: string;
  }): MilestoneStatusChangedEvent {
    return new MilestoneStatusChangedEvent(
      params.milestoneId,
      {
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
      },
      params.causedBy ?? 'system'
    );
  }
}

// =============================================================================
// Project Events
// =============================================================================

/**
 * Data for ProjectCreatedEvent
 */
export interface ProjectCreatedEventData {
  title: string;
  description?: string;
  visibility: 'private' | 'public';
}

/**
 * Event emitted when a project is created
 */
export class ProjectCreatedEvent extends DomainEvent<ProjectCreatedEventData> {
  public readonly eventType = 'ProjectCreated';
  public readonly resourceType = ResourceType.PROJECT;

  private constructor(aggregateId: string, data: ProjectCreatedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    projectId: string;
    title: string;
    description?: string;
    visibility?: 'private' | 'public';
    causedBy?: string;
  }): ProjectCreatedEvent {
    return new ProjectCreatedEvent(
      params.projectId,
      {
        title: params.title,
        description: params.description,
        visibility: params.visibility ?? 'private',
      },
      params.causedBy ?? 'system'
    );
  }
}

/**
 * Data for ProjectStatusChangedEvent
 */
export interface ProjectStatusChangedEventData {
  previousStatus: ResourceStatus;
  newStatus: ResourceStatus;
}

/**
 * Event emitted when a project's status changes
 */
export class ProjectStatusChangedEvent extends DomainEvent<ProjectStatusChangedEventData> {
  public readonly eventType = 'ProjectStatusChanged';
  public readonly resourceType = ResourceType.PROJECT;

  private constructor(aggregateId: string, data: ProjectStatusChangedEventData, causedBy: string) {
    super(aggregateId, data, causedBy);
  }

  static create(params: {
    projectId: string;
    previousStatus: ResourceStatus;
    newStatus: ResourceStatus;
    causedBy?: string;
  }): ProjectStatusChangedEvent {
    return new ProjectStatusChangedEvent(
      params.projectId,
      {
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
      },
      params.causedBy ?? 'system'
    );
  }
}
