import { injectable, inject } from "tsyringe";
import { z } from "zod";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
import type { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import type { Sprint, CreateSprint, Issue } from "../domain/types";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import {
  ResourceNotFoundError,
} from "../domain/errors";
import { safeCall } from './utils/safeCall';
import { SprintEntity } from '../domain/entities/SprintEntity';
import { parseResourceStatus, toStatusString } from '../domain/utils/StatusParser';
import { SprintMetrics as SprintMetricsVO } from '../domain/value-objects/SprintMetrics';

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
 * @deprecated Use SprintMetrics from value-objects instead
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
    return safeCall(async () => {
      // Validate input with Zod schema
      const validatedData = PlanSprintSchema.parse(data);

      const stringIssueIds = validatedData.issueIds.map(id => id.toString());

      // Create sprint with proper error handling
      const sprintData = await this.sprintRepo.create({
        ...validatedData.sprint,
        issues: stringIssueIds,
        status: validatedData.sprint.status || ResourceStatus.PLANNED
      });

      // Create relationship between issues and sprint
      if (stringIssueIds.length > 0) {
        await Promise.all(
          stringIssueIds.map(async (issueId) => {
            await this.issueRepo.update(issueId, { milestoneId: sprintData.id });
          })
        );
      }

      // Return plain object for MCP compatibility
      return sprintData;
    });
  }

  /**
   * Find sprints by filter criteria.
   *
   * @param filters - Optional filters (e.g., by status)
   * @returns Array of matching sprints
   */
  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    return safeCall(async () => {
      const sprints = await this.sprintRepo.findAll(filters);
      // Return plain objects for MCP compatibility
      return sprints;
    });
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
    return safeCall(async () => {
      // Convert status string to ResourceStatus enum if provided
      let resourceStatus: ResourceStatus | undefined;
      if (data.status) {
        resourceStatus = parseResourceStatus(data.status, 'sprint');
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

      const updatedData = await this.sprintRepo.update(data.sprintId, sprintData);
      // Return plain object for MCP compatibility
      return updatedData;
    });
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
    return safeCall(async () => {
      let addedCount = 0;

      // Add each issue to the sprint
      for (const issueId of data.issueIds) {
        try {
          await this.sprintRepo.addIssue(data.sprintId, issueId);
          addedCount++;
        } catch {
          // Continue with other issues on failure
        }
      }

      return {
        success: addedCount > 0,
        addedIssues: addedCount,
        message: `Added ${addedCount} issue(s) to sprint ${data.sprintId}`
      };
    });
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
    return safeCall(async () => {
      let removedCount = 0;

      // Remove each issue from the sprint
      for (const issueId of data.issueIds) {
        try {
          await this.sprintRepo.removeIssue(data.sprintId, issueId);
          removedCount++;
        } catch {
          // Continue with other issues on failure
        }
      }

      return {
        success: removedCount > 0,
        removedIssues: removedCount,
        message: `Removed ${removedCount} issue(s) from sprint ${data.sprintId}`
      };
    });
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
    return safeCall(async () => {
      const sprintData = await this.sprintRepo.findById(id);
      if (!sprintData) {
        throw new ResourceNotFoundError(ResourceType.SPRINT, id);
      }

      // Wrap in domain entity for business logic
      const sprint = SprintEntity.fromData(sprintData);

      const issuePromises = sprint.issues.map((issueId: string) => this.issueRepo.findById(issueId));
      const issuesResult = await Promise.all(issuePromises);
      const issues = issuesResult.filter((issue: Issue | null) => issue !== null) as Issue[];

      // Use entity business logic for metrics
      const totalIssues = issues.length;
      const completedIssues = issues.filter(
        issue => issue.status === ResourceStatus.CLOSED || issue.status === ResourceStatus.COMPLETED
      ).length;

      // Create immutable value object
      const metrics = SprintMetricsVO.create({
        sprintId: sprint.id,
        title: sprint.title,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        totalIssues,
        completedIssues,
        status: sprint.status,
        issues: includeIssues ? issues : undefined,
      });

      // Return the value object data (maintains backward compatibility)
      return {
        id: metrics.sprintId,
        title: metrics.title,
        startDate: metrics.startDate,
        endDate: metrics.endDate,
        totalIssues: metrics.totalIssues,
        completedIssues: metrics.completedIssues,
        remainingIssues: metrics.remainingIssues,
        completionPercentage: metrics.completionPercentage,
        status: metrics.status,
        issues: includeIssues ? issues : undefined,
        daysRemaining: metrics.daysRemaining,
        isActive: metrics.isActive
      };
    });
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
    return safeCall(async () => {
      // Create data object that matches the expected type
      const sprintData: Omit<Sprint, "id" | "createdAt" | "updatedAt"> = {
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        status: ResourceStatus.PLANNED,
        issues: data.issueIds?.map(id => id.toString()) || []
      };

      const createdSprint = await this.sprintRepo.create(sprintData);
      // Return plain object for MCP compatibility (not SprintEntity class instance)
      return createdSprint;
    });
  }

  /**
   * List all sprints, optionally filtered by status.
   *
   * @param status - Filter by status: 'planned', 'active', 'completed', or 'all'
   * @returns Array of sprints
   */
  async listSprints(status: string = 'all'): Promise<Sprint[]> {
    return safeCall(async () => {
      const sprints = await this.sprintRepo.findAll();

      // Filter by status if needed.
      // Compare on the sprint-facing status STRING, not a parsed enum:
      // parseResourceStatus('completed', 'sprint') yields ResourceStatus.CLOSED
      // (documented in StatusParser.test.ts), while the sprint repository
      // produces ResourceStatus.COMPLETED — so an enum comparison never matched
      // and status='completed' always returned an empty list.
      if (status !== 'all') {
        const wanted = status.toLowerCase();
        return sprints.filter(
          sprint => toStatusString(sprint.status, 'sprint') === wanted
        );
      }

      // Return plain objects for MCP compatibility
      return sprints;
    });
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
    return safeCall(async () => {
      const currentSprintData = await this.sprintRepo.findCurrent();

      if (!currentSprintData) {
        return null;
      }

      if (includeIssues) {
        // `get_current_sprint` advertises includeIssues (default true), so the
        // resolved issues have to come back with the sprint.
        const issues = await this.sprintRepo.getIssues(currentSprintData.id);
        return {
          ...currentSprintData,
          issueDetails: issues
        } as Sprint & { issueDetails?: Issue[] };
      }

      // Return plain object for MCP compatibility
      return currentSprintData;
    });
  }
}
