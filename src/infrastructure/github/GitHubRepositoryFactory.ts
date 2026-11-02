import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { type GitHubAuth, GitHubConfig } from "./GitHubConfig";
import { GitHubErrorHandler } from "./GitHubErrorHandler";
import { GitHubRequestExecutor } from "./GitHubRequestExecutor";
import type { RateLimitManager } from "./RateLimitManager";
import type { IGitHubRepository } from "./repositories/BaseRepository";
import { GitHubDraftIssueRepository } from "./repositories/GitHubDraftIssueRepository";
import { GitHubFieldValueRepository } from "./repositories/GitHubFieldValueRepository";
import { GitHubIssueCommentRepository } from "./repositories/GitHubIssueCommentRepository";
import { GitHubIssueRepository } from "./repositories/GitHubIssueRepository";
import { GitHubLabelRepository } from "./repositories/GitHubLabelRepository";
import { GitHubMilestoneRepository } from "./repositories/GitHubMilestoneRepository";
import { GitHubProjectAnalyticsRepository } from "./repositories/GitHubProjectAnalyticsRepository";
import { GitHubProjectItemRepository } from "./repositories/GitHubProjectItemRepository";
import { GitHubProjectLinkingRepository } from "./repositories/GitHubProjectLinkingRepository";
import { GitHubProjectRepository } from "./repositories/GitHubProjectRepository";
import { GitHubProjectSearchRepository } from "./repositories/GitHubProjectSearchRepository";
import { GitHubProjectTemplateRepository } from "./repositories/GitHubProjectTemplateRepository";
import { GitHubProjectWorkflowRepository } from "./repositories/GitHubProjectWorkflowRepository";
import { GitHubPullRequestRepository } from "./repositories/GitHubPullRequestRepository";
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
  private readonly executor: GitHubRequestExecutor;

  private constructor(
    auth: GitHubAuth,
    owner: string,
    repo: string,
    options: RepositoryFactoryOptions
  ) {
    this.config = new GitHubConfig(owner, repo, auth);
    this.errorHandler = new GitHubErrorHandler();

    // GitHub App installation auth or a PAT, per the descriptor. This is the
    // single Octokit construction site in the codebase, so the branch here
    // covers every repository the factory hands out. `createAppAuth` mints the
    // installation token on first use and refreshes it before it expires.
    const baseOptions = {
      baseUrl: options.baseUrl || "https://api.github.com",
      previews: options.previews || ["inertia-preview"],
    };

    this.octokit =
      auth.kind === "app"
        ? new Octokit({
            ...baseOptions,
            authStrategy: createAppAuth,
            auth: {
              appId: auth.appId,
              privateKey: auth.privateKey,
              installationId: auth.installationId,
            },
          })
        : new Octokit({ ...baseOptions, auth: auth.token });

    this.executor = GitHubRequestExecutor.for(this.octokit);
  }

  getErrorHandler(): GitHubErrorHandler {
    return this.errorHandler;
  }

  /**
   * Returns the rate limit manager for proactive monitoring and backoff.
   */
  getRateLimitManager(): RateLimitManager {
    return this.executor.rateLimiter;
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
    return this.executor.graphql<T>(
      this.octokit,
      query,
      { owner: this.config.owner, repo: this.config.repo, ...variables },
      "executing GraphQL operation"
    );
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

  /** Creates an instance of a Pull Request Repository */
  createPullRequestRepository(): GitHubPullRequestRepository {
    return new GitHubPullRequestRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Label Repository */
  createLabelRepository(): GitHubLabelRepository {
    return new GitHubLabelRepository(this.octokit, this.config);
  }

  /** Creates an instance of an Issue Comment Repository */
  createIssueCommentRepository(): GitHubIssueCommentRepository {
    return new GitHubIssueCommentRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Projects v2 Draft Issue Repository */
  createDraftIssueRepository(): GitHubDraftIssueRepository {
    return new GitHubDraftIssueRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Projects v2 Field Value Repository */
  createFieldValueRepository(): GitHubFieldValueRepository {
    return new GitHubFieldValueRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Project Item Repository (draft conversion, item position) */
  createProjectItemRepository(): GitHubProjectItemRepository {
    return new GitHubProjectItemRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Project Search Repository (issue search, project item listing) */
  createProjectSearchRepository(): GitHubProjectSearchRepository {
    return new GitHubProjectSearchRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Project Template Repository (README, templates) */
  createProjectTemplateRepository(): GitHubProjectTemplateRepository {
    return new GitHubProjectTemplateRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Project Linking Repository (items, repository/team links) */
  createProjectLinkingRepository(): GitHubProjectLinkingRepository {
    return new GitHubProjectLinkingRepository(this.octokit, this.config);
  }

  /** Creates an instance of a Project Analytics Repository (paginated item read for metrics) */
  createProjectAnalyticsRepository(): GitHubProjectAnalyticsRepository {
    return new GitHubProjectAnalyticsRepository(this.octokit, this.config);
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
   * Create the factory for the given credentials. This is the only way to
   * construct one; resolve credentials with `resolveGitHubAuth()`.
   */
  static fromAuth(
    auth: GitHubAuth,
    owner: string,
    repo: string,
    options: RepositoryFactoryOptions = {}
  ): GitHubRepositoryFactory {
    return new GitHubRepositoryFactory(auth, owner, repo, options);
  }
}
