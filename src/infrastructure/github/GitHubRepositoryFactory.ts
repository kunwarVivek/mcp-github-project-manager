import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import type { IGitHubRepository } from "./repositories/BaseRepository";
import { GitHubErrorHandler } from "./GitHubErrorHandler";
import type { OctokitInstance } from "./types";
import { GitHubConfig } from "./GitHubConfig";
import { GitHubIssueRepository } from "./repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "./repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "./repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "./repositories/GitHubSprintRepository";
import { GitHubAutomationRuleRepository } from "./repositories/GitHubAutomationRuleRepository";
import { GitHubSubIssueRepository } from "./repositories/GitHubSubIssueRepository";
import { GitHubStatusUpdateRepository } from "./repositories/GitHubStatusUpdateRepository";
import { RateLimitManager } from "./RateLimitManager";

export interface RepositoryFactoryOptions {
  baseUrl?: string;
  previews?: string[];
  /**
   * GitHub App installation credentials. When supplied, the factory
   * authenticates as the App installation instead of using `token` as a PAT.
   * A PAT remains the default and documented path.
   */
  app?: GitHubAppCredentials;
}

/** Credentials for authenticating as a GitHub App installation. */
export interface GitHubAppCredentials {
  appId: string | number;
  privateKey: string;
  installationId: string | number;
}

export class GitHubRepositoryFactory {
  private readonly octokit: OctokitInstance;
  private readonly errorHandler: GitHubErrorHandler;
  private readonly config: GitHubConfig;
  private readonly rateLimitManager: RateLimitManager;

  constructor(
    token: string,
    owner: string,
    repo: string,
    options: RepositoryFactoryOptions = {}
  ) {
    this.config = GitHubConfig.create(owner, repo, token);
    this.errorHandler = new GitHubErrorHandler();

    // GitHub App installation auth when configured, otherwise a PAT. This is
    // the single Octokit construction site in the codebase, so the branch here
    // covers every repository the factory hands out.
    const baseOptions = {
      baseUrl: options.baseUrl || "https://api.github.com",
      previews: options.previews || ["inertia-preview"],
    };

    this.octokit = options.app
      ? new Octokit({
          ...baseOptions,
          authStrategy: createAppAuth,
          auth: {
            appId: options.app.appId,
            privateKey: options.app.privateKey,
            installationId: options.app.installationId,
          },
        })
      : new Octokit({ ...baseOptions, auth: token });

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
  public async graphql<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
    try {
      return await this.octokit.graphql<T>(query, {
        ...variables,
        owner: this.config.owner,
        repo: this.config.repo,
      });
    } catch (error) {
      throw this.errorHandler.handleError(error, 'GraphQL operation');
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
   * Creates an instance of an Automation Rule Repository
   */
  createAutomationRuleRepository(): GitHubAutomationRuleRepository {
    return new GitHubAutomationRuleRepository(this.octokit, this.config);
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
   * Creates a new factory instance from environment variables
   */
  static create(env: {
    GITHUB_TOKEN: string;
    GITHUB_OWNER: string;
    GITHUB_REPO: string;
  }, options?: RepositoryFactoryOptions): GitHubRepositoryFactory {
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
      throw new Error('Missing required GitHub configuration');
    }

    return new GitHubRepositoryFactory(
      env.GITHUB_TOKEN,
      env.GITHUB_OWNER,
      env.GITHUB_REPO,
      options
    );
  }
}
