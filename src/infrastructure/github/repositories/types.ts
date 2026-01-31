import { Octokit } from "@octokit/rest";
import { BaseGitHubRepository } from "./BaseRepository";
import { GitHubConfig } from "../config";
import { 
  IssueRepository, 
  MilestoneRepository, 
  ProjectRepository, 
  SprintRepository 
} from "../../../domain/types";

export type OctokitWithExtensions = InstanceType<typeof Octokit>;

export interface GitHubRepositoryConstructor<T extends BaseGitHubRepository> {
  new(octokit: OctokitWithExtensions, config: GitHubConfig): T;
}

export interface GitHubIssueRepositoryConstructor extends GitHubRepositoryConstructor<BaseGitHubRepository & IssueRepository> {}
export interface GitHubMilestoneRepositoryConstructor extends GitHubRepositoryConstructor<BaseGitHubRepository & MilestoneRepository> {}
export interface GitHubProjectRepositoryConstructor extends GitHubRepositoryConstructor<BaseGitHubRepository & ProjectRepository> {}
export interface GitHubSprintRepositoryConstructor extends GitHubRepositoryConstructor<BaseGitHubRepository & SprintRepository> {}

export type GitHubRepository =
  | (BaseGitHubRepository & IssueRepository)
  | (BaseGitHubRepository & MilestoneRepository)
  | (BaseGitHubRepository & ProjectRepository)
  | (BaseGitHubRepository & SprintRepository);

// ============================================================================
// Sub-Issue Types
// ============================================================================

/**
 * A sub-issue item returned from list operations
 */
export interface SubIssueListItem {
  id: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  url: string;
  position?: number;
}

/**
 * Summary statistics for sub-issues
 */
export interface SubIssueSummary {
  total: number;
  completed: number;
  percentCompleted: number;
}

/**
 * Result of sub-issue list operation with pagination
 */
export interface SubIssueListResult {
  subIssues: SubIssueListItem[];
  summary: SubIssueSummary;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}

/**
 * Result of add/reprioritize sub-issue operations
 */
export interface SubIssueResult {
  issue: {
    id: string;
    title: string;
  };
  subIssue: SubIssueListItem;
}

/**
 * Parent issue information
 */
export interface ParentIssueResult {
  id: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  url: string;
}

// ============================================================================
// Status Update Types
// ============================================================================

/**
 * Status update status enum - matches GitHub's ProjectV2StatusUpdateStatus
 */
export enum StatusUpdateStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  OFF_TRACK = 'OFF_TRACK',
  COMPLETE = 'COMPLETE',
  INACTIVE = 'INACTIVE',
}

/**
 * Creator information for status updates
 */
export interface StatusUpdateCreator {
  login: string;
}

/**
 * A project status update
 */
export interface StatusUpdate {
  id: string;
  body: string;
  bodyHTML: string;
  status: StatusUpdateStatus;
  startDate?: string;
  targetDate?: string;
  createdAt: string;
  creator: StatusUpdateCreator;
}

/**
 * Options for creating a status update
 */
export interface StatusUpdateOptions {
  status?: StatusUpdateStatus;
  startDate?: string;
  targetDate?: string;
}

/**
 * Result of status update list operation with pagination
 */
export interface StatusUpdateListResult {
  statusUpdates: StatusUpdate[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  totalCount: number;
}