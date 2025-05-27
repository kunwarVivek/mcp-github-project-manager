import { Octokit } from "@octokit/rest";
import { GitHubError, OctokitInstance } from "../types";
import { GitHubErrorHandler } from "../GitHubErrorHandler";
import { GitHubConfig } from "../GitHubConfig"; // Fixed import path
import { Resource, ResourceStatus } from "../../../domain/resource-types";
import { GitHubApiUtil, PaginationOptions } from "../util/GitHubApiUtil";
import { ILogger, getLogger } from "../../logger";

export interface IGitHubRepository {
  readonly octokit: OctokitInstance;
  readonly config: GitHubConfig;
}

export abstract class BaseGitHubRepository implements IGitHubRepository {
  private readonly errorHandler: GitHubErrorHandler;
  protected readonly retryAttempts: number = 3;
  protected readonly apiUtil: GitHubApiUtil;
  protected readonly logger: ILogger;

  constructor(
    public readonly octokit: OctokitInstance,
    public readonly config: GitHubConfig
  ) {
    this.errorHandler = new GitHubErrorHandler();
    this.apiUtil = GitHubApiUtil.getInstance();
    this.logger = getLogger(this.constructor.name);
  }

  protected get owner(): string {
    return this.config.owner;
  }

  protected get repo(): string {
    return this.config.repo;
  }

  protected get token(): string {
    return this.config.token;
  }

  /**
   * Execute operation with automatic retries and rate limit handling
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: unknown;
    let error: unknown;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        // Check if we should throttle due to rate limits
        if (await this.apiUtil.shouldThrottle(this.octokit)) {
          const delay = await this.apiUtil.calculateRequestDelay(this.octokit);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        return await operation();
      } catch (e) {
        error = e;
        lastError = e;

        const isRetryable = this.errorHandler.isRetryableError(error);
        const isLastAttempt = attempt === this.retryAttempts - 1;

        if (!isRetryable || isLastAttempt) {
          throw this.errorHandler.handleError(
            error,
            isLastAttempt ? `${context} (max retries exceeded)` : context
          );
        }

        const headers = (error as GitHubError)?.response?.headers || {};
        const delay = this.errorHandler.calculateRetryDelay(headers);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw this.errorHandler.handleError(lastError, context);
  }

  /**
   * Execute GraphQL query with rate limiting support
   */
  protected async graphql<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    return this.withRetry(
      () =>
        this.octokit.graphql<T>(query, {
          ...variables,
          owner: this.owner,
          repo: this.repo,
        }),
      'executing GraphQL query'
    );
  }

  /**
   * Handle GraphQL errors consistently
   */
  protected handleGraphQLError(error: unknown): Error {
    this.logger.error('GraphQL operation failed', error);
    return this.errorHandler.handleError(error, 'GraphQL operation');
  }

  /**
   * Execute REST API call with rate limiting support
   */
  protected async rest<T>(
    operation: (params: any) => Promise<{ data: T }>,
    params?: Record<string, unknown>
  ): Promise<T> {
    const result = await this.withRetry(
      () => operation(this.getRequestParams(params)),
      'executing REST API call'
    );
    return result.data;
  }

  /**
   * Execute paginated REST API call with comprehensive pagination support
   */
  protected async paginatedRest<T>(
    operation: (params: any) => Promise<{ data: T[] }>,
    params?: Record<string, unknown>,
    paginationOptions?: PaginationOptions
  ): Promise<T[]> {
    const finalParams = this.getRequestParams(params);

    return this.apiUtil.paginateRequest<T>(
      (paginationParams) => operation({
        ...finalParams,
        ...paginationParams
      }),
      paginationOptions
    );
  }

  /**
   * Execute paginated GraphQL query with cursor-based pagination support
   */
  protected async paginatedGraphQL<T>(
    query: string,
    getNodesAndPageInfo: (data: any) => {
      pageInfo: { hasNextPage: boolean; endCursor?: string };
      nodes: T[];
    },
    variables: Record<string, unknown> = {},
    options: {
      pageSize?: number;
      maxItems?: number;
      initialCursor?: string
    } = {}
  ): Promise<T[]> {
    return this.apiUtil.paginateGraphQL<T>(
      async ({ cursor, pageSize }) => {
        const data = await this.graphql(query, {
          ...variables,
          first: pageSize,
          after: cursor,
          owner: this.owner,
          repo: this.repo,
        });

        return getNodesAndPageInfo(data);
      },
      options
    );
  }

  /**
   * Get rate limit information
   */
  protected async getRateLimit() {
    return this.apiUtil.getRateLimit(this.octokit);
  }

  protected getRequestParams<T extends Record<string, unknown>>(
    params?: Partial<T>
  ): T & { owner: string; repo: string } {
    return {
      owner: this.owner,
      repo: this.repo,
      ...params,
    } as T & { owner: string; repo: string };
  }

  protected toISOString(date: string | Date): string {
    if (date instanceof Date) {
      return date.toISOString();
    }
    return new Date(date).toISOString();
  }

  protected parseDate(date: string | null | undefined): string | undefined {
    if (!date) return undefined;
    return new Date(date).toISOString();
  }

  protected convertGitHubStatus(githubStatus: "open" | "closed"): ResourceStatus {
    return githubStatus === "open" ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
  }

  protected convertToGitHubStatus(status: ResourceStatus): "open" | "closed" {
    switch (status) {
      case ResourceStatus.ACTIVE:
      case ResourceStatus.PLANNED:
        return "open";
      case ResourceStatus.CLOSED:
      case ResourceStatus.COMPLETED:
      case ResourceStatus.ARCHIVED:
      case ResourceStatus.DELETED:
        return "closed";
      default:
        return "closed";
    }
  }
}