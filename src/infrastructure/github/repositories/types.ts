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