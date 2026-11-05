import { ResourceStatus } from "../../../domain/resource-types";
import { getLogger, type ILogger } from "../../logger";
import type { GitHubConfig } from "../GitHubConfig"; // Fixed import path
import { GitHubErrorHandler } from "../GitHubErrorHandler";
import { GitHubRequestExecutor } from "../GitHubRequestExecutor";
import type { OctokitInstance } from "../types";
import { type ConnectionPage, collectConnection } from "../util/paginate";

/** Parameters every repository-scoped REST endpoint takes; `rest()` fills them in. */
type RepoScopedParams = { owner: string; repo: string };

export interface IGitHubRepository {
  readonly octokit: OctokitInstance;
  readonly config: GitHubConfig;
}

export abstract class BaseGitHubRepository implements IGitHubRepository {
  private readonly errorHandler: GitHubErrorHandler;
  /** Shared with every other repository (and the factory) built on the same Octokit. */
  protected readonly executor: GitHubRequestExecutor;
  protected readonly logger: ILogger;

  constructor(
    public readonly octokit: OctokitInstance,
    public readonly config: GitHubConfig
  ) {
    this.errorHandler = new GitHubErrorHandler();
    this.executor = GitHubRequestExecutor.for(octokit);
    this.logger = getLogger(this.constructor.name);
  }

  protected get owner(): string {
    return this.config.owner;
  }

  protected get repo(): string {
    return this.config.repo;
  }

  /**
   * Execute GraphQL query through the shared throttle/retry path
   */
  protected async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.executor.graphql<T>(
      this.octokit,
      query,
      { owner: this.owner, repo: this.repo, ...variables },
      "executing GraphQL query"
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
      headers["GraphQL-Features"] = features.join(",");
    }

    return this.executor.graphql<T>(
      this.octokit,
      query,
      { owner: this.owner, repo: this.repo, ...variables, headers },
      `executing GraphQL query with features: ${features.join(",")}`
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
      query($owner: String!, $repo: String!, $first: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          labels(first: $first, after: $after) {
            nodes {
              id
              name
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    `;

    interface LabelsResponse {
      repository: {
        labels: ConnectionPage<{ id: string; name: string }>;
      } | null;
    }

    const labels = await collectConnection<{ id: string; name: string }>(
      async (after) => {
        const response = await this.graphql<LabelsResponse>(query, {
          owner: this.owner,
          repo: this.repo,
          first: 100,
          after,
        });
        return response.repository?.labels;
      },
      this.logger,
      `Labels of ${this.owner}/${this.repo}`
    );

    const nameToId = new Map(labels.map((label) => [label.name, label.id]));

    return names.map((name) => nameToId.get(name)).filter((id): id is string => id != null);
  }

  /**
   * Resolve user logins to their GitHub node IDs.
   *
   * `assigneeIds` on createIssue/updateIssue takes user node IDs, but callers
   * pass logins (e.g. 'octocat'). Values that already look like user node IDs
   * (`U_…`, `BOT_…`, or legacy base64 `04:User<n>` / `03:Bot<n>`) are passed through untouched. Logins
   * are looked up with `user(login:)` (one query each, in parallel).
   *
   * Unlike labels, an unknown login is an error, not a skip: labels are
   * frequently defaulted by the server (e.g. 'priority:medium'), whereas an
   * assignee is always an explicit caller choice, and silently creating an
   * issue with nobody assigned hides the typo.
   *
   * @param logins - Logins (or node IDs) to resolve
   * @returns Node IDs in the caller's order
   * @throws Error naming every login that does not exist
   */
  protected async resolveUserNodeIds(logins: string[] = []): Promise<string[]> {
    if (logins.length === 0) return [];

    const query = `
      query GetUserNodeId($login: String!) {
        user(login: $login) {
          id
        }
      }
    `;

    interface UserNodeIdResponse {
      user: { id: string } | null;
    }

    // Legacy IDs are base64("04:User<n>") / base64("03:Bot<n>"); bare "MDQ6" is not
    // distinctive enough, since it could be a real login.
    const nodeIdPattern =
      /^(?:(?:U_|BOT_)[A-Za-z0-9_-]+|MDQ6VXNlcj[A-Za-z0-9+/=]+|MDM6Qm90[A-Za-z0-9+/=]*)$/;
    const missing: string[] = [];

    const ids = await Promise.all(
      logins.map(async (login) => {
        if (nodeIdPattern.test(login)) return login;
        const response = await this.graphql<UserNodeIdResponse>(query, { login });
        if (!response.user) missing.push(login);
        return response.user?.id;
      })
    );

    if (missing.length > 0) {
      throw new Error(`GitHub user(s) not found: ${missing.join(", ")}`);
    }

    return ids.filter((id): id is string => id !== undefined);
  }

  /**
   * Handle GraphQL errors consistently
   */
  protected handleGraphQLError(error: unknown): Error {
    this.logger.error("GraphQL operation failed", error);
    return this.errorHandler.handleError(error, "GraphQL operation");
  }

  /**
   * Execute REST API call with rate limiting support
   */
  protected async rest<T, P extends RepoScopedParams>(
    operation: (params: P) => Promise<{ data: T }>,
    params?: Omit<P, keyof RepoScopedParams>
  ): Promise<T> {
    const scoped = { owner: this.owner, repo: this.repo, ...params } as P;
    const result = await this.executor.run(
      "rest",
      () => operation(scoped),
      "executing REST API call"
    );
    return result.data;
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
