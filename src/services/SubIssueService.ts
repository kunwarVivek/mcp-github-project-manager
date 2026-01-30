import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import { Issue } from "../domain/types";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";

/**
 * Represents a dependency relationship between issues.
 * The issue with issueId depends on the issue with dependsOnId.
 */
export interface IssueDependency {
  issueId: string;
  dependsOnId: string;
  createdAt: string;
}

/**
 * Represents a history entry for an issue.
 */
export interface IssueHistoryEntry {
  id: string;
  action: string;
  timestamp: string;
  actor: string;
  changes: Record<string, unknown>;
}

/**
 * SubIssueService handles issue dependencies, status updates, and milestone assignments.
 *
 * This service is extracted from ProjectManagementService to provide a focused,
 * testable interface for issue-related operations.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class SubIssueService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  /**
   * Maps domain errors to MCP error codes for consistent error handling.
   */
  private mapErrorToMCPError(error: unknown): Error {
    if (error instanceof ValidationError) {
      return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
    }

    if (error instanceof ResourceNotFoundError) {
      return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
    }

    if (error instanceof RateLimitError) {
      return new DomainError(`${MCPErrorCode.RATE_LIMITED}: ${error.message}`);
    }

    if (error instanceof UnauthorizedError) {
      return new DomainError(`${MCPErrorCode.UNAUTHORIZED}: ${error.message}`);
    }

    if (error instanceof GitHubAPIError) {
      return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - ${error.message}`);
    }

    // Default to internal error
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Updates the status of an issue.
   *
   * @param issueId - The ID of the issue to update
   * @param status - The new status to set
   * @returns The updated issue
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async updateIssueStatus(issueId: string, status: ResourceStatus): Promise<Issue> {
    try {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      return await this.issueRepo.update(issueId, { status });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Adds a dependency relationship between two issues.
   * The issue specified by issueId will depend on the issue specified by dependsOnId.
   *
   * Dependencies are tracked using labels in the format `depends-on:{dependsOnId}`.
   *
   * @param issueId - The ID of the dependent issue
   * @param dependsOnId - The ID of the issue that is depended upon
   * @throws ResourceNotFoundError if either issue doesn't exist
   */
  async addIssueDependency(issueId: string, dependsOnId: string): Promise<void> {
    try {
      // Verify the dependent issue exists
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // Verify the dependency target exists
      const dependentIssue = await this.issueRepo.findById(dependsOnId);
      if (!dependentIssue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, dependsOnId);
      }

      // Add a label to track the dependency
      const labels = [...issue.labels];
      if (!labels.includes(`depends-on:${dependsOnId}`)) {
        labels.push(`depends-on:${dependsOnId}`);
        await this.issueRepo.update(issueId, { labels });
      }
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Gets all dependency IDs for a given issue.
   *
   * @param issueId - The ID of the issue to get dependencies for
   * @returns An array of issue IDs that this issue depends on
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async getIssueDependencies(issueId: string): Promise<string[]> {
    try {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // Extract dependency IDs from labels
      const dependencies: string[] = [];
      issue.labels.forEach(label => {
        if (label.startsWith('depends-on:')) {
          dependencies.push(label.replace('depends-on:', ''));
        }
      });

      return dependencies;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Assigns an issue to a milestone.
   *
   * @param issueId - The ID of the issue to assign
   * @param milestoneId - The ID of the milestone to assign to
   * @returns The updated issue
   * @throws ResourceNotFoundError if either the issue or milestone doesn't exist
   */
  async assignIssueToMilestone(issueId: string, milestoneId: string): Promise<Issue> {
    try {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const milestone = await this.milestoneRepo.findById(milestoneId);
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, milestoneId);
      }

      return await this.issueRepo.update(issueId, { milestoneId });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Gets the history of changes for an issue.
   *
   * Note: This is a simplified implementation that returns basic history entries.
   * In a full implementation, this would query the GitHub timeline API.
   *
   * @param issueId - The ID of the issue to get history for
   * @returns An array of history entries
   * @throws ResourceNotFoundError if the issue doesn't exist
   */
  async getIssueHistory(issueId: string): Promise<IssueHistoryEntry[]> {
    try {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // For now, return a basic history entry
      // In a real implementation, this would query the GitHub timeline API
      return [
        {
          id: `history-${issueId}-${Date.now()}`,
          action: 'created',
          timestamp: issue.createdAt,
          actor: 'system',
          changes: {
            status: { from: null, to: issue.status },
            title: issue.title
          }
        },
        {
          id: `history-${issueId}-${Date.now() + 1}`,
          action: 'updated',
          timestamp: issue.updatedAt,
          actor: 'system',
          changes: {
            status: { from: ResourceStatus.ACTIVE, to: issue.status }
          }
        }
      ];
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
