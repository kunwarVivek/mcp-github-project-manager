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

export { IssueEntity } from './IssueEntity';
export type { IssueEntityConfig } from './IssueEntity';
export { IssuePriority, IssueType } from './IssueEntity';

export { MilestoneEntity } from './MilestoneEntity';
export type { MilestoneEntityConfig } from './MilestoneEntity';
export { MILESTONE_TRANSITIONS } from './MilestoneEntity';

export { SprintEntity } from './SprintEntity';
export type { SprintEntityConfig } from './SprintEntity';
export { SprintState } from './SprintEntity';

export { ProjectEntity } from './ProjectEntity';
export type { ProjectEntityConfig } from './ProjectEntity';
export { ProjectHealth, ActivityLevel, ProjectVisibility } from './ProjectEntity';

export { PullRequestEntity } from './PullRequestEntity';
export type { PullRequestEntityConfig, PullRequestReview } from './PullRequestEntity';
export { PullRequestState, ReviewState, MergeMethod } from './PullRequestEntity';
