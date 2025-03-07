import { Octokit } from "@octokit/rest";
import { GitHubError, OctokitInstance } from "../types";
import { GitHubErrorHandler } from "../GitHubErrorHandler";
import { GitHubConfig } from "../config";
import { Resource, ResourceStatus } from "../../../domain/resource-types";

export interface IGitHubRepository {
  readonly octokit: OctokitInstance;
  readonly config: GitHubConfig;
}

export abstract class BaseGitHubRepository implements IGitHubRepository {
  private readonly errorHandler: GitHubErrorHandler;
  protected readonly retryAttempts: number = 3;

  constructor(
    public readonly octokit: OctokitInstance,
    public readonly config: GitHubConfig
  ) {
    this.errorHandler = new GitHubErrorHandler();
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

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: unknown;
    let error: unknown;

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
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