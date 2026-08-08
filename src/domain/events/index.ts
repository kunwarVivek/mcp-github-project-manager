/**
 * Domain Events Module
 *
 * Provides domain events for entity state change notifications.
 */

export {
  // Base class
  DomainEvent,

  // Issue events
  IssueCreatedEvent,
  IssueCreatedEventData,
  IssueStatusChangedEvent,
  IssueStatusChangedEventData,
  IssueAssignedEvent,
  IssueAssignedEventData,
  IssueLabelChangedEvent,
  IssueLabelChangedEventData,

  // Sprint events
  SprintCreatedEvent,
  SprintCreatedEventData,
  SprintStatusChangedEvent,
  SprintStatusChangedEventData,
  SprintIssuesChangedEvent,
  SprintIssuesChangedEventData,

  // Milestone events
  MilestoneCreatedEvent,
  MilestoneCreatedEventData,
  MilestoneStatusChangedEvent,
  MilestoneStatusChangedEventData,

  // Project events
  ProjectCreatedEvent,
  ProjectCreatedEventData,
  ProjectStatusChangedEvent,
  ProjectStatusChangedEventData,
} from './DomainEvent';

export {
  // Agent events
  AgentRegisteredEvent,
  AgentRegisteredEventData,
  AgentDeregisteredEvent,
  AgentDeregisteredEventData,
  TaskCheckedOutEvent,
  TaskCheckedOutEventData,
  TaskReleasedEvent,
  TaskReleasedEventData,
  TaskCompletedEvent,
  TaskCompletedEventData,
  TaskSubmittedForReviewEvent,
  TaskSubmittedForReviewEventData,
  TaskApprovedEvent,
  TaskApprovedEventData,
  TaskRejectedEvent,
  TaskRejectedEventData,
  AgentHeartbeatEvent,
  AgentHeartbeatEventData,
  TaskReclaimedEvent,
  TaskReclaimedEventData,
} from './AgentEvents';

export {
  // Event bus
  DomainEventBus,
  domainEventBus,

  // Types
  EventHandler,
  AsyncEventHandler,
  SubscriptionOptions,
} from './DomainEventBus';
