/**
 * Domain Events Module
 *
 * Provides domain events for entity state change notifications.
 */

// Type-only re-exports. Required by `isolatedModules`: these are types, and a
// per-file transpiler (tsx/esbuild/bundlers) would otherwise emit them as real
// runtime imports that fail to resolve.
export type {
  AgentDeregisteredEventData,
  AgentHeartbeatEventData,
  AgentRegisteredEventData,
  TaskReclaimedEventData,
  TaskReleasedEventData,
} from "./AgentEvents";

export {
  AgentDeregisteredEvent,
  AgentHeartbeatEvent,
  // Agent events
  AgentRegisteredEvent,
  TaskApprovedEvent,
  TaskCheckedOutEvent,
  TaskCompletedEvent,
  TaskReclaimedEvent,
  TaskRejectedEvent,
  TaskReleasedEvent,
  TaskSubmittedForReviewEvent,
} from "./AgentEvents";
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
} from "./DomainEvent";
export {
  // Base class
  DomainEvent,
  IssueAssignedEvent,
  // Issue events
  IssueCreatedEvent,
  IssueLabelChangedEvent,
  IssueStatusChangedEvent,
  // Milestone events
  MilestoneCreatedEvent,
  MilestoneStatusChangedEvent,
  // Project events
  ProjectCreatedEvent,
  ProjectStatusChangedEvent,
  // Sprint events
  SprintCreatedEvent,
  SprintIssuesChangedEvent,
  SprintStatusChangedEvent,
} from "./DomainEvent";
export type {
  AsyncEventHandler,
  EventHandler,
  SubscriptionOptions,
} from "./DomainEventBus";
export {
  // Event bus
  DomainEventBus,
  domainEventBus,

  // Types
} from "./DomainEventBus";
