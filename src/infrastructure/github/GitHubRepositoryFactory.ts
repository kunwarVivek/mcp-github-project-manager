import { Octokit } from "@octokit/rest";
import { IGitHubRepository } from "./repositories/BaseRepository";
import { GitHubErrorHandler } from "./GitHubErrorHandler";
import { OctokitInstance } from "./types";
import { GitHubConfig } from "./GitHubConfig";
import { GitHubIssueRepository } from "./repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "./repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "./repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "./repositories/GitHubSprintRepository";

export interface RepositoryFactoryOptions {
  baseUrl?: string;
  previews?: string[];
}

export class GitHubRepositoryFactory {
  private readonly octokit: OctokitInstance;
  private readonly errorHandler: GitHubErrorHandler;
  private readonly config: GitHubConfig;

  constructor(
    token: string,
    owner: string,
    repo: string,
    options: RepositoryFactoryOptions = {}
  ) {
    this.config = GitHubConfig.create(owner, repo, token);
    this.errorHandler = new GitHubErrorHandler();

    this.octokit = new Octokit({
      auth: token,
      baseUrl: options.baseUrl || "https://api.github.com",
      previews: options.previews || ["inertia-preview"],
    });
  }

  getErrorHandler(): GitHubErrorHandler {
    return this.errorHandler;
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
