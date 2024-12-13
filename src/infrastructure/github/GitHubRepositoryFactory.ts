import { GitHubConfig } from "./GitHubConfig";
import { GitHubIssueRepository } from "./repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "./repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "./repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "./repositories/GitHubSprintRepository";

export class GitHubRepositoryFactory {
  private static instance: GitHubRepositoryFactory;
  private config: GitHubConfig | null = null;

  private constructor() {}

  static getInstance(): GitHubRepositoryFactory {
    if (!GitHubRepositoryFactory.instance) {
      GitHubRepositoryFactory.instance = new GitHubRepositoryFactory();
    }
    return GitHubRepositoryFactory.instance;
  }

  configure(owner: string, repo: string, token: string): void {
    this.config = new GitHubConfig(owner, repo, token);
  }

  createProjectRepository(): GitHubProjectRepository {
    this.ensureConfigured();
    return new GitHubProjectRepository(this.config!);
  }

  createIssueRepository(): GitHubIssueRepository {
    this.ensureConfigured();
    return new GitHubIssueRepository(this.config!);
  }

  createMilestoneRepository(): GitHubMilestoneRepository {
    this.ensureConfigured();
    return new GitHubMilestoneRepository(this.config!);
  }

  createSprintRepository(): GitHubSprintRepository {
    this.ensureConfigured();
    return new GitHubSprintRepository(this.config!);
  }

  private ensureConfigured(): void {
    if (!this.config) {
      throw new Error(
        "GitHubRepositoryFactory must be configured with owner, repo, and token before use"
      );
    }
  }
}

// Example usage:
/*
const factory = GitHubRepositoryFactory.getInstance();
factory.configure("owner", "repo", "github-token");

const projectRepo = factory.createProjectRepository();
const issueRepo = factory.createIssueRepository();
const milestoneRepo = factory.createMilestoneRepository();
const sprintRepo = factory.createSprintRepository();
*/
