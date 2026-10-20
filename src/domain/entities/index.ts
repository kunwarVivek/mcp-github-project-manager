/**
 * Domain Entities
 *
 * Rich domain models with behavior and business logic.
 * These entities implement the existing interfaces for backward compatibility
 * while adding computed properties and invariant enforcement.
 *
 * ## Usage
 * ```typescript
 * import { IssueEntity, MilestoneEntity, SprintEntity } from '../domain/entities';
 *
 * // Create from existing data
 * const issue = IssueEntity.fromData(githubIssueData);
 *
 * // Use business logic
 * issue.addLabel('bug');
 * issue.assignTo('user1');
 * console.log(issue.priority); // 'high'
 * console.log(issue.isStale); // true if no update in 14+ days
 *
 * // Convert back to plain object
 * const plainIssue = issue.toData();
 * ```
 */

export type { IssueEntityConfig } from "./IssueEntity";
export { IssueEntity, IssuePriority, IssueType } from "./IssueEntity";
export type { MilestoneEntityConfig } from "./MilestoneEntity";
export { MILESTONE_TRANSITIONS, MilestoneEntity } from "./MilestoneEntity";
export type { ProjectEntityConfig } from "./ProjectEntity";
export { ActivityLevel, ProjectEntity, ProjectHealth, ProjectVisibility } from "./ProjectEntity";
export type { PullRequestEntityConfig, PullRequestReview } from "./PullRequestEntity";
export { MergeMethod, PullRequestEntity, PullRequestState, ReviewState } from "./PullRequestEntity";
export type { SprintEntityConfig } from "./SprintEntity";
export { SprintEntity, SprintState } from "./SprintEntity";
