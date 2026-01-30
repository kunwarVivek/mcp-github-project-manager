import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import { Issue, Milestone, CreateMilestone } from "../domain/types";
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
 * Metrics for a milestone including completion status and issue counts.
 */
export interface MilestoneMetrics {
  id: string;
  title: string;
  dueDate?: string | null;
  openIssues: number;
  closedIssues: number;
  totalIssues: number;
  completionPercentage: number;
  status: ResourceStatus;
  issues?: Issue[];
  isOverdue: boolean;
  daysRemaining?: number;
}

/**
 * MilestoneService handles milestone CRUD operations and metrics calculations.
 *
 * This service is extracted from ProjectManagementService to provide a focused,
 * testable interface for milestone-related operations.
 *
 * Can be instantiated directly with a GitHubRepositoryFactory or via dependency injection.
 */
export class MilestoneService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
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
   * Gets metrics for a specific milestone including issue counts and completion percentage.
   *
   * @param id - The milestone ID
   * @param includeIssues - Whether to include the full issue list in the response
   * @returns Milestone metrics including completion percentage and overdue status
   * @throws ResourceNotFoundError if the milestone doesn't exist
   */
  async getMilestoneMetrics(id: string, includeIssues: boolean = false): Promise<MilestoneMetrics> {
    try {
      const milestone = await this.milestoneRepo.findById(id);
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, id);
      }

      const allIssues = await this.issueRepo.findAll();
      const issues = allIssues.filter(issue => issue.milestoneId === milestone.id);

      const totalIssues = issues.length;
      const closedIssues = issues.filter(
        issue => issue.status === ResourceStatus.CLOSED || issue.status === ResourceStatus.COMPLETED
      ).length;
      const openIssues = totalIssues - closedIssues;
      const completionPercentage = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;

      const now = new Date();
      let isOverdue = false;
      let daysRemaining: number | undefined = undefined;

      if (milestone.dueDate) {
        const dueDate = new Date(milestone.dueDate);
        isOverdue = now > dueDate;
        daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return {
        id: milestone.id,
        title: milestone.title,
        dueDate: milestone.dueDate,
        openIssues,
        closedIssues,
        totalIssues,
        completionPercentage,
        status: milestone.status,
        issues: includeIssues ? issues : undefined,
        isOverdue,
        daysRemaining: daysRemaining && daysRemaining > 0 ? daysRemaining : undefined
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Gets all overdue milestones (past due date and not completed/closed).
   *
   * @param limit - Maximum number of milestones to return
   * @param includeIssues - Whether to include the full issue list for each milestone
   * @returns Array of overdue milestone metrics, sorted by due date (oldest first)
   */
  async getOverdueMilestones(limit: number = 10, includeIssues: boolean = false): Promise<MilestoneMetrics[]> {
    try {
      const milestones = await this.milestoneRepo.findAll();
      const now = new Date();

      const overdueMilestones = milestones.filter(milestone => {
        if (!milestone.dueDate) return false;
        const dueDate = new Date(milestone.dueDate);
        return now > dueDate && milestone.status !== ResourceStatus.COMPLETED && milestone.status !== ResourceStatus.CLOSED;
      });

      overdueMilestones.sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      const limitedMilestones = overdueMilestones.slice(0, limit);

      const milestoneMetrics = await Promise.all(
        limitedMilestones.map(milestone =>
          this.getMilestoneMetrics(milestone.id, includeIssues)
        )
      );

      return milestoneMetrics;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Gets milestones that are due within the specified number of days.
   *
   * @param daysAhead - Number of days to look ahead
   * @param limit - Maximum number of milestones to return
   * @param includeIssues - Whether to include the full issue list for each milestone
   * @returns Array of upcoming milestone metrics, sorted by due date (soonest first)
   */
  async getUpcomingMilestones(daysAhead: number = 30, limit: number = 10, includeIssues: boolean = false): Promise<MilestoneMetrics[]> {
    try {
      const milestones = await this.milestoneRepo.findAll();
      const now = new Date();
      const futureDate = new Date(now);
      futureDate.setDate(now.getDate() + daysAhead);

      const upcomingMilestones = milestones.filter(milestone => {
        if (!milestone.dueDate) return false;
        const dueDate = new Date(milestone.dueDate);
        return dueDate > now && dueDate <= futureDate &&
               milestone.status !== ResourceStatus.COMPLETED &&
               milestone.status !== ResourceStatus.CLOSED;
      });

      upcomingMilestones.sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      const limitedMilestones = upcomingMilestones.slice(0, limit);

      const milestoneMetrics = await Promise.all(
        limitedMilestones.map(milestone =>
          this.getMilestoneMetrics(milestone.id, includeIssues)
        )
      );

      return milestoneMetrics;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Creates a new milestone.
   *
   * @param data - Milestone creation data
   * @returns The created milestone
   */
  async createMilestone(data: {
    title: string;
    description: string;
    dueDate?: string;
  }): Promise<Milestone> {
    try {
      const milestoneData: CreateMilestone = {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
      };

      return await this.milestoneRepo.create(milestoneData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Lists milestones with optional filtering and sorting.
   *
   * @param status - Filter by status: 'open', 'closed', or 'all'
   * @param sort - Sort field: 'due_date', 'title', or 'created_at'
   * @param direction - Sort direction: 'asc' or 'desc'
   * @returns Array of milestones matching the criteria
   */
  async listMilestones(
    status: string = 'open',
    sort: string = 'created_at',
    direction: string = 'asc'
  ): Promise<Milestone[]> {
    try {
      // Get all milestones
      const milestones = await this.milestoneRepo.findAll();

      // Filter by status if needed
      let filteredMilestones = milestones;
      if (status !== 'all') {
        const resourceStatus = status === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
        filteredMilestones = milestones.filter(milestone => milestone.status === resourceStatus);
      }

      // Sort the milestones
      filteredMilestones.sort((a, b) => {
        let valueA: string, valueB: string;

        switch(sort) {
          case 'due_date':
            valueA = a.dueDate || '';
            valueB = b.dueDate || '';
            break;
          case 'title':
            valueA = a.title;
            valueB = b.title;
            break;
          case 'created_at':
          default:
            valueA = a.createdAt;
            valueB = b.createdAt;
        }

        const comparison = valueA.localeCompare(valueB);
        return direction === 'asc' ? comparison : -comparison;
      });

      return filteredMilestones;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Updates an existing milestone.
   *
   * @param data - Milestone update data including the milestone ID
   * @returns The updated milestone
   * @throws ResourceNotFoundError if the milestone doesn't exist
   */
  async updateMilestone(data: {
    milestoneId: string;
    title?: string;
    description?: string;
    dueDate?: string | null;
    state?: 'open' | 'closed';
  }): Promise<Milestone> {
    try {
      // Convert state to ResourceStatus if provided
      let status: ResourceStatus | undefined;
      if (data.state) {
        status = data.state === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
      }

      // Map input data to domain model
      const milestoneData: Partial<Milestone> = {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate === null ? undefined : data.dueDate,
        status
      };

      // Clean up undefined values
      Object.keys(milestoneData).forEach(key => {
        if (milestoneData[key as keyof Partial<Milestone>] === undefined) {
          delete milestoneData[key as keyof Partial<Milestone>];
        }
      });

      return await this.milestoneRepo.update(data.milestoneId, milestoneData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Deletes a milestone.
   *
   * @param data - Object containing the milestone ID to delete
   * @returns Success confirmation with message
   * @throws ResourceNotFoundError if the milestone doesn't exist
   */
  async deleteMilestone(data: {
    milestoneId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await this.milestoneRepo.delete(data.milestoneId);

      return {
        success: true,
        message: `Milestone ${data.milestoneId} has been deleted`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
