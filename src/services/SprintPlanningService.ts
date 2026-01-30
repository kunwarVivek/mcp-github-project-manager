import { injectable, inject } from "tsyringe";
import { z } from "zod";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { Sprint, CreateSprint, Issue } from "../domain/types";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
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
 * Schema for validating sprint planning input
 */
const PlanSprintSchema = z.object({
  sprint: z.object({
    title: z.string().min(1, "Sprint title is required"),
    description: z.string(),
    startDate: z.string().refine(val => !isNaN(Date.parse(val)), {
      message: "Start date must be a valid date string"
    }),
    endDate: z.string().refine(val => !isNaN(Date.parse(val)), {
      message: "End date must be a valid date string"
    }),
    status: z.nativeEnum(ResourceStatus).optional(),
    issues: z.array(z.string()).optional()
  }),
  issueIds: z.array(z.number())
});

/**
 * Metrics for a sprint including completion status and timeline
 */
export interface SprintMetrics {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  totalIssues: number;
  completedIssues: number;
  remainingIssues: number;
  completionPercentage: number;
  status: ResourceStatus;
  issues?: Issue[];
  daysRemaining?: number;
  isActive: boolean;
}

/**
 * Service for sprint planning, lifecycle management, and metrics.
 *
 * Handles:
 * - Sprint CRUD operations (create, read, update)
 * - Issue-sprint associations (add/remove issues)
 * - Sprint metrics and status calculations
 * - Finding current/active sprints
 *
 * NOTE: `createSprint` and `planSprint` were consolidated into a unified implementation.
 * `createSprint` is the simpler factory method, while `planSprint` provides Zod validation
 * and automatic issue association. Both are retained for different use cases.
 */
@injectable()
export class SprintPlanningService {
  constructor(
    @inject("GitHubRepositoryFactory") private factory: GitHubRepositoryFactory
  ) {}

  private get sprintRepo(): GitHubSprintRepository {
    return this.factory.createSprintRepository();
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  /**
   * Maps domain errors to MCP error codes for consistent error handling
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

    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

  /**
   * Plan and create a sprint with associated issues.
   *
   * This method validates input with Zod schema, creates the sprint,
   * and associates the specified issues with the sprint.
   *
   * @param data - Sprint configuration and issue IDs to associate
   * @returns The created sprint
   * @throws ValidationError if input validation fails
   */
  async planSprint(data: {
    sprint: CreateSprint;
    issueIds: number[];
  }): Promise<Sprint> {
    try {
      // Validate input with Zod schema
      const validatedData = PlanSprintSchema.parse(data);

      const stringIssueIds = validatedData.issueIds.map(id => id.toString());

      // Create sprint with proper error handling
      const sprint = await this.sprintRepo.create({
        ...validatedData.sprint,
        issues: stringIssueIds,
        status: validatedData.sprint.status || ResourceStatus.PLANNED
      });

      // Create relationship between issues and sprint
      if (stringIssueIds.length > 0) {
        try {
          await Promise.all(
            stringIssueIds.map(async (issueId) => {
              try {
                await this.issueRepo.update(issueId, { milestoneId: sprint.id });
              } catch (error) {
                process.stderr.write(`Failed to associate issue ${issueId} with sprint: ${error}`);
                throw this.mapErrorToMCPError(error);
              }
            })
          );
        } catch (error) {
          throw this.mapErrorToMCPError(error);
        }
      }

      return sprint;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid sprint data: ${error.message}`);
      }

      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Find sprints by filter criteria.
   *
   * @param filters - Optional filters (e.g., by status)
   * @returns Array of matching sprints
   */
  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    try {
      return await this.sprintRepo.findAll(filters);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Update an existing sprint's properties.
   *
   * @param data - Sprint ID and fields to update
   * @returns The updated sprint
   */
  async updateSprint(data: {
    sprintId: string;
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: 'planned' | 'active' | 'completed';
    issues?: string[];
  }): Promise<Sprint> {
    try {
      // Convert status string to ResourceStatus enum if provided
      let resourceStatus: ResourceStatus | undefined;
      if (data.status) {
        switch (data.status) {
          case 'planned':
            resourceStatus = ResourceStatus.PLANNED;
            break;
          case 'active':
            resourceStatus = ResourceStatus.ACTIVE;
            break;
          case 'completed':
            resourceStatus = ResourceStatus.CLOSED;
            break;
        }
      }

      // Map input data to domain model
      const sprintData: Partial<Sprint> = {
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        status: resourceStatus,
        issues: data.issues
      };

      // Clean up undefined values
      Object.keys(sprintData).forEach(key => {
        if (sprintData[key as keyof Partial<Sprint>] === undefined) {
          delete sprintData[key as keyof Partial<Sprint>];
        }
      });

      return await this.sprintRepo.update(data.sprintId, sprintData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Add issues to an existing sprint.
   *
   * @param data - Sprint ID and issue IDs to add
   * @returns Result with count of added issues
   */
  async addIssuesToSprint(data: {
    sprintId: string;
    issueIds: string[];
  }): Promise<{ success: boolean; addedIssues: number; message: string }> {
    try {
      let addedCount = 0;
      const issues = [];

      // Add each issue to the sprint
      for (const issueId of data.issueIds) {
        try {
          await this.sprintRepo.addIssue(data.sprintId, issueId);
          addedCount++;
          issues.push(issueId);
        } catch (error) {
          process.stderr.write(`Failed to add issue ${issueId} to sprint: ${error}`);
        }
      }

      return {
        success: addedCount > 0,
        addedIssues: addedCount,
        message: `Added ${addedCount} issue(s) to sprint ${data.sprintId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Remove issues from an existing sprint.
   *
   * @param data - Sprint ID and issue IDs to remove
   * @returns Result with count of removed issues
   */
  async removeIssuesFromSprint(data: {
    sprintId: string;
    issueIds: string[];
  }): Promise<{ success: boolean; removedIssues: number; message: string }> {
    try {
      let removedCount = 0;
      const issues = [];

      // Remove each issue from the sprint
      for (const issueId of data.issueIds) {
        try {
          await this.sprintRepo.removeIssue(data.sprintId, issueId);
          removedCount++;
          issues.push(issueId);
        } catch (error) {
          process.stderr.write(`Failed to remove issue ${issueId} from sprint: ${error}`);
        }
      }

      return {
        success: removedCount > 0,
        removedIssues: removedCount,
        message: `Removed ${removedCount} issue(s) from sprint ${data.sprintId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Get comprehensive metrics for a sprint.
   *
   * Calculates completion percentage, days remaining, and active status.
   *
   * @param id - Sprint ID
   * @param includeIssues - Whether to include full issue details
   * @returns Sprint metrics
   * @throws ResourceNotFoundError if sprint not found
   */
  async getSprintMetrics(id: string, includeIssues: boolean = false): Promise<SprintMetrics> {
    try {
      const sprint = await this.sprintRepo.findById(id);
      if (!sprint) {
        throw new ResourceNotFoundError(ResourceType.SPRINT, id);
      }

      const issuePromises = sprint.issues.map((issueId: string) => this.issueRepo.findById(issueId));
      const issuesResult = await Promise.all(issuePromises);
      const issues = issuesResult.filter((issue: Issue | null) => issue !== null) as Issue[];

      const totalIssues = issues.length;
      const completedIssues = issues.filter(
        issue => issue.status === ResourceStatus.CLOSED || issue.status === ResourceStatus.COMPLETED
      ).length;
      const remainingIssues = totalIssues - completedIssues;
      const completionPercentage = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

      const now = new Date();
      const endDate = new Date(sprint.endDate);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isActive = now >= new Date(sprint.startDate) && now <= endDate;

      return {
        id: sprint.id,
        title: sprint.title,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        totalIssues,
        completedIssues,
        remainingIssues,
        completionPercentage,
        status: sprint.status,
        issues: includeIssues ? issues : undefined,
        daysRemaining,
        isActive
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Create a sprint without automatic issue association.
   *
   * This is a simpler factory method compared to planSprint.
   * Use this when you want to create a sprint and manage issue
   * associations separately.
   *
   * @param data - Sprint configuration
   * @returns The created sprint
   */
  async createSprint(data: {
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    issueIds?: string[];
  }): Promise<Sprint> {
    try {
      // Create data object that matches the expected type
      const sprintData: Omit<Sprint, "id" | "createdAt" | "updatedAt"> = {
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        status: ResourceStatus.PLANNED,
        issues: data.issueIds?.map(id => id.toString()) || []
      };

      return await this.sprintRepo.create(sprintData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * List all sprints, optionally filtered by status.
   *
   * @param status - Filter by status: 'planned', 'active', 'completed', or 'all'
   * @returns Array of sprints
   */
  async listSprints(status: string = 'all'): Promise<Sprint[]> {
    try {
      const sprints = await this.sprintRepo.findAll();

      // Filter by status if needed
      if (status !== 'all') {
        let resourceStatus;
        switch(status) {
          case 'planned':
            resourceStatus = ResourceStatus.PLANNED;
            break;
          case 'active':
            resourceStatus = ResourceStatus.ACTIVE;
            break;
          case 'completed':
            resourceStatus = ResourceStatus.COMPLETED;
            break;
          default:
            return sprints;
        }

        return sprints.filter(sprint => sprint.status === resourceStatus);
      }

      return sprints;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Get the currently active sprint.
   *
   * Returns the sprint that is currently in progress (active status
   * and current date is between start and end dates).
   *
   * @param includeIssues - Whether to include full issue details
   * @returns The current sprint or null if none active
   */
  async getCurrentSprint(includeIssues: boolean = true): Promise<Sprint | null> {
    try {
      const currentSprint = await this.sprintRepo.findCurrent();

      if (!currentSprint) {
        return null;
      }

      if (includeIssues) {
        // Add issues data to sprint
        const issues = await this.sprintRepo.getIssues(currentSprint.id);

        // We can't modify the sprint directly, so we create a new object
        return {
          ...currentSprint,
          // We're adding this property outside the type definition for convenience
          // in the response; it won't affect the actual sprint object
          issueDetails: issues
        } as Sprint & { issueDetails?: Issue[] };
      }

      return currentSprint;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
