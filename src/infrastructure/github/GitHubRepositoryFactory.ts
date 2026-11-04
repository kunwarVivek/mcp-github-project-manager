import { Octokit } from "@octokit/rest";
import type { GitHubAuth } from "./auth/GitHubAuth";
import { GitHubConfig } from "./GitHubConfig";
import { GitHubErrorHandler } from "./GitHubErrorHandler";
import { RateLimitManager } from "./RateLimitManager";
import type { IGitHubRepository } from "./repositories/BaseRepository";
import { GitHubIssueRepository } from "./repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "./repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "./repositories/GitHubProjectRepository";
import { GitHubProjectWorkflowRepository } from "./repositories/GitHubProjectWorkflowRepository";
import { GitHubSprintRepository } from "./repositories/GitHubSprintRepository";
import { GitHubStatusUpdateRepository } from "./repositories/GitHubStatusUpdateRepository";
import { GitHubSubIssueRepository } from "./repositories/GitHubSubIssueRepository";
import type { OctokitInstance } from "./types";

export interface RepositoryFactoryOptions {
  baseUrl?: string;
  previews?: string[];
}

export class GitHubRepositoryFactory {
  private readonly octokit: OctokitInstance;
  private readonly errorHandler: GitHubErrorHandler;
  private readonly config: GitHubConfig;
  private readonly rateLimitManager: RateLimitManager;

  constructor(
    auth: GitHubAuth,
    owner: string,
    repo: string,
    options: RepositoryFactoryOptions = {}
  ) {
    this.config = GitHubConfig.create(owner, repo);
    this.errorHandler = new GitHubErrorHandler();

    // The single Octokit construction site in the codebase. How requests are
    // authenticated (static token, OAuth user token, App installation) is the
    // auth object's concern, so this covers every repository the factory hands out.
    this.octokit = new Octokit({
      baseUrl: options.baseUrl || "https://api.github.com",
      previews: options.previews || ["inertia-preview"],
      ...auth.octokitAuth(),
    });

    this.rateLimitManager = new RateLimitManager(this.octokit as Octokit);
  }

  getErrorHandler(): GitHubErrorHandler {
    return this.errorHandler;
  }

  /**
   * Returns the rate limit manager for proactive monitoring and backoff.
   */
  getRateLimitManager(): RateLimitManager {
    return this.rateLimitManager;
  }

  /**
   * Returns the octokit instance for direct GraphQL queries
   */
  public getOctokit(): OctokitInstance {
    return this.octokit;
  }

  /**
   * Get the configuration
   */
  public getConfig(): GitHubConfig {
    return this.config;
  }

  /**
   * Execute a GraphQL query directly
   */
  public async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    try {
      return await this.octokit.graphql<T>(query, {
        ...variables,
        owner: this.config.owner,
        repo: this.config.repo,
      });
    } catch (error) {
      throw this.errorHandler.handleError(error, "GraphQL operation");
    }
  }

  /**
   * Creates an instance of an Issue Repository
   */
  createIssueRepository(): GitHubIssueRepository {
    return new GitHubIssueRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Milestone Repository
   */
  createMilestoneRepository(): GitHubMilestoneRepository {
    return new GitHubMilestoneRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Project Repository
   */
  createProjectRepository(): GitHubProjectRepository {
    return new GitHubProjectRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Sprint Repository
   */
  createSprintRepository(): GitHubSprintRepository {
    return new GitHubSprintRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Project Workflow Repository
   */
  createProjectWorkflowRepository(): GitHubProjectWorkflowRepository {
    return new GitHubProjectWorkflowRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Sub-Issue Repository
   *
   * Sub-issues allow creating parent-child hierarchies between issues.
   * Note: Sub-issue operations require the 'sub_issues' GraphQL feature flag,
   * which is handled automatically by the repository.
   */
  createSubIssueRepository(): GitHubSubIssueRepository {
    return new GitHubSubIssueRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of a Status Update Repository
   *
   * Status updates allow project managers to communicate project progress
   * with predefined status values (ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE).
   */
  createStatusUpdateRepository(): GitHubStatusUpdateRepository {
    return new GitHubStatusUpdateRepository(this.octokit, this.config);
  }

  /**
   * Creates an instance of any GitHub repository implementation
   * @param RepositoryClass The repository class to instantiate
   */
  protected createRepository<T extends IGitHubRepository>(
    RepositoryClass: new (octokit: OctokitInstance, config: GitHubConfig) => T
  ): T {
    return new RepositoryClass(this.octokit, this.config);
  }

  /**
   * Creates a new factory instance for the given repository
   */
  static create(
    auth: GitHubAuth,
    target: { owner: string; repo: string },
    options?: RepositoryFactoryOptions
  ): GitHubRepositoryFactory {
    if (!target.owner || !target.repo) {
      throw new Error("Missing required GitHub configuration");
    }

    return new GitHubRepositoryFactory(auth, target.owner, target.repo, options);
  }
}
