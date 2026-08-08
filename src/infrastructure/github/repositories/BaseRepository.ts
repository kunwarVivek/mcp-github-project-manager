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
   * Execute GraphQL query with preview feature headers
   *
   * Some GitHub GraphQL APIs require preview headers to be enabled.
   * For example, sub-issues require the 'sub_issues' feature flag.
   *
   * @param query - The GraphQL query string
   * @param variables - Variables for the query
   * @param features - Array of feature flags (e.g., ['sub_issues'])
   * @returns The query result
   */
  protected async graphqlWithFeatures<T>(
    query: string,
    variables: Record<string, unknown> = {},
    features: string[] = []
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (features.length > 0) {
      headers['GraphQL-Features'] = features.join(',');
    }

    return this.withRetry(
      () =>
        this.octokit.graphql<T>(query, {
          ...variables,
          owner: this.owner,
          repo: this.repo,
          headers,
        }),
      `executing GraphQL query with features: ${features.join(',')}`
    );
  }

  /**
   * Resolve an issue number to its GitHub node ID
   *
   * GraphQL mutations require node IDs (e.g., 'I_kwDO...'), not issue numbers.
   * This method queries the issue by number and returns its node ID.
   *
   * @param issueNumber - The issue number
   * @returns The node ID of the issue
   * @throws Error if the issue is not found
   */
  protected async resolveIssueNodeId(issueNumber: number): Promise<string> {
    const query = `
      query GetIssueNodeId($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;

    interface IssueNodeIdResponse {
      repository: {
        issue: {
          id: string;
        } | null;
      };
    }

    const response = await this.graphql<IssueNodeIdResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      number: issueNumber,
    });

    if (!response.repository.issue) {
      throw new Error(`Issue #${issueNumber} not found in ${this.owner}/${this.repo}`);
    }

    return response.repository.issue.id;
  }

  /**
   * Resolve an owner login (user or organization) to its GitHub node ID
   *
   * GraphQL mutations like createProjectV2 require the owner's node ID
   * (e.g. 'U_kgDO...' or 'O_kgDO...'), not the login. Resolves users first,
   * then falls back to organizations.
   *
   * @param login - The owner login (e.g. 'octocat' or 'github')
   * @returns The node ID of the user or organization
   * @throws Error if neither a user nor an organization resolves
   */
  protected async resolveOwnerNodeId(login: string): Promise<string> {
    const userQuery = `
      query GetUserNodeId($login: String!) {
        user(login: $login) {
          id
        }
      }
    `;

    interface OwnerNodeIdResponse {
      user?: { id: string } | null;
      organization?: { id: string } | null;
    }

    const userResponse = await this.graphql<OwnerNodeIdResponse>(userQuery, { login });
    if (userResponse.user?.id) {
      return userResponse.user.id;
    }

    const orgQuery = `
      query GetOrganizationNodeId($login: String!) {
        organization(login: $login) {
          id
        }
      }
    `;

    const orgResponse = await this.graphql<OwnerNodeIdResponse>(orgQuery, { login });
    if (orgResponse.organization?.id) {
      return orgResponse.organization.id;
    }

    throw new Error(`Could not resolve owner '${login}' to a GitHub user or organization`);
  }

  /**
   * Resolve a repository name to its GitHub node ID
   *
   * GraphQL mutations like createProjectV2 require the repository's node ID
   * (e.g. 'R_kgDO...'), not its name.
   *
   * @param owner - The repository owner login
   * @param repo - The repository name
   * @returns The node ID of the repository
   * @throws Error if the repository is not found
   */
  protected async resolveRepositoryNodeId(owner: string, repo: string): Promise<string> {
    const query = `
      query GetRepositoryNodeId($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
        }
      }
    `;

    interface RepositoryNodeIdResponse {
      repository: {
        id: string;
      } | null;
    }

    const response = await this.graphql<RepositoryNodeIdResponse>(query, {
      owner,
      repo,
    });

    if (!response.repository) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }

    return response.repository.id;
  }

  /**
   * Resolve label names to their GitHub node IDs.
   *
   * The createIssue/updateIssue mutations accept `labelIds` (node IDs), but
   * callers pass label *names* (e.g. 'bug', 'priority:high'). This resolves
   * each name against the repository's labels and silently skips labels that
   * don't exist (e.g. a default 'priority:medium' label on a repo that has no
   * such label).
   *
   * @param names - Label names to resolve
   * @returns Array of label node IDs (only those that exist)
   */
  protected async resolveLabelNodeIds(names: string[] = []): Promise<string[]> {
    if (names.length === 0) return [];

    const query = `
      query($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          labels(first: $first) {
            nodes {
              id
              name
            }
          }
        }
      }
    `;

    interface LabelsResponse {
      repository: {
        labels: {
          nodes: Array<{ id: string; name: string }>;
        };
      } | null;
    }

    const response = await this.graphql<LabelsResponse>(query, {
      owner: this.owner,
      repo: this.repo,
      first: 100,
    });

    const nameToId = new Map(
      (response.repository?.labels.nodes ?? []).map((label) => [label.name, label.id]),
    );

    return names
      .map((name) => nameToId.get(name))
      .filter((id): id is string => id != null);
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