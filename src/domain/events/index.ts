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
  IssueStatusChangedEvent,
  IssueAssignedEvent,
  IssueLabelChangedEvent,
  // Sprint events
  SprintCreatedEvent,
  SprintStatusChangedEvent,
  SprintIssuesChangedEvent,
  // Milestone events
  MilestoneCreatedEvent,
  MilestoneStatusChangedEvent,
  // Project events
  ProjectCreatedEvent,
  ProjectStatusChangedEvent,
} from './DomainEvent';

export {
  // Agent events
  AgentRegisteredEvent,
  AgentDeregisteredEvent,
  TaskCheckedOutEvent,
  TaskReleasedEvent,
  TaskCompletedEvent,
  TaskSubmittedForReviewEvent,
  TaskApprovedEvent,
  TaskRejectedEvent,
  AgentHeartbeatEvent,
  TaskReclaimedEvent,
} from './AgentEvents';

export {
  // Event bus
  DomainEventBus,
  domainEventBus,

  // Types
} from './DomainEventBus';

// Type-only re-exports. Required by `isolatedModules`: these are types, and a
// per-file transpiler (tsx/esbuild/bundlers) would otherwise emit them as real
// runtime imports that fail to resolve.
export type {
  AgentDeregisteredEventData,
  AgentHeartbeatEventData,
  AgentRegisteredEventData,
  TaskReclaimedEventData,
  TaskReleasedEventData,
} from './AgentEvents';
export type {
  IssueAssignedEventData,
  IssueCreatedEventData,
  IssueLabelChangedEventData,
  IssueStatusChangedEventData,
  MilestoneCreatedEventData,
  MilestoneStatusChangedEventData,
  ProjectCreatedEventData,
  ProjectStatusChangedEventData,
  SprintCreatedEventData,
  SprintIssuesChangedEventData,
  SprintStatusChangedEventData,
} from './DomainEvent';
export type {
  AsyncEventHandler,
  EventHandler,
  SubscriptionOptions,
} from './DomainEventBus';
