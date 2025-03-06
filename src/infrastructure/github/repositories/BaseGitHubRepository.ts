import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../GitHubConfig";
import { GitHubErrorHandler } from "../GitHubErrorHandler";
import { Resource } from "../../../domain/resource-types";
import { ValidationError } from "../../../domain/errors";

export abstract class BaseGitHubRepository<T extends Resource> {
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor(
    protected octokit: Octokit,
    protected config: GitHubConfig
  ) {}

  /**
   * Execute GitHub API operation with retry logic and error handling
   */
  protected async executeOperation<R>(
    operation: () => Promise<R>,
    context: string
  ): Promise<R> {
    let lastError: unknown;
    let attempt = 0;

    while (attempt < this.retryAttempts) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!GitHubErrorHandler.shouldRetry(error) || attempt === this.retryAttempts - 1) {
          throw GitHubErrorHandler.handleError(error, context);
        }

        const delay = error instanceof Error && (error as any).response?.headers
          ? GitHubErrorHandler.calculateRetryDelay((error as any).response.headers)
          : this.retryDelay * Math.pow(2, attempt);

        await this.delay(delay);
        attempt++;
      }
    }

    throw GitHubErrorHandler.handleError(lastError, context);
  }

  /**
   * Create a new resource
   */
  protected async createResource<D>(
    endpoint: string,
    data: D,
    mapFn: (response: any) => T
  ): Promise<T> {
    return this.executeOperation(
      async () => {
        const response = await this.octokit.request(`POST ${endpoint}`, {
          owner: this.config.owner,
          repo: this.config.repo,
          ...data,
        });
        return mapFn(response.data);
      },
      `Failed to create resource at ${endpoint}`
    );
  }

  /**
   * Get a resource by ID
   */
  protected async getResource<ID>(
    endpoint: string,
    id: ID,
    mapFn: (response: any) => T
  ): Promise<T | null> {
    try {
      return await this.executeOperation(
        async () => {
          const response = await this.octokit.request(`GET ${endpoint}`, {
            owner: this.config.owner,
            repo: this.config.repo,
            ...this.getIdParam(id),
          });
          return mapFn(response.data);
        },
        `Failed to get resource ${id} at ${endpoint}`
      );
    } catch (error) {
      if (error instanceof Error && (error as any).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a resource
   */
  protected async updateResource<ID, D>(
    endpoint: string,
    id: ID,
    data: D,
    mapFn: (response: any) => T
  ): Promise<T> {
    return this.executeOperation(
      async () => {
        const response = await this.octokit.request(`PATCH ${endpoint}`, {
          owner: this.config.owner,
          repo: this.config.repo,
          ...this.getIdParam(id),
          ...data,
        });
        return mapFn(response.data);
      },
      `Failed to update resource ${id} at ${endpoint}`
    );
  }

  /**
   * Delete a resource
   */
  protected async deleteResource<ID>(
    endpoint: string,
    id: ID
  ): Promise<void> {
    await this.executeOperation(
      async () => {
        await this.octokit.request(`DELETE ${endpoint}`, {
          owner: this.config.owner,
          repo: this.config.repo,
          ...this.getIdParam(id),
        });
      },
      `Failed to delete resource ${id} at ${endpoint}`
    );
  }

  /**
   * List resources with pagination
   */
  protected async listResources<P, R = T>(
    endpoint: string,
    params: P,
    mapFn: (response: any) => R[]
  ): Promise<R[]> {
    return this.executeOperation(
      async () => {
        const response = await this.octokit.request(`GET ${endpoint}`, {
          owner: this.config.owner,
          repo: this.config.repo,
          ...params,
        });
        return mapFn(response.data);
      },
      `Failed to list resources at ${endpoint}`
    );
  }

  /**
   * Validate required fields
   */
  protected validateRequiredFields(data: unknown, fields: string[]): void {
    const missing = fields.filter(field => {
      const value = (data as any)[field];
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      throw new ValidationError(`Missing required fields: ${missing.join(", ")}`, {
        fields: missing,
      });
    }
  }

  /**
   * Get ID parameter based on type
   */
  private getIdParam(id: unknown): Record<string, unknown> {
    if (typeof id === "number") {
      return { number: id };
    }
    if (typeof id === "string") {
      const numberId = parseInt(id);
      if (!isNaN(numberId)) {
        return { number: numberId };
      }
      return { ref: id };
    }
    throw new ValidationError("Invalid ID format", { id });
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}