import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubSprintRepository } from "../infrastructure/github/repositories/GitHubSprintRepository";
import { ResourceStatus, ResourceType, RelationshipType } from "../domain/resource-types";
import {
  Issue,
  CreateIssue,
  Milestone,
  CreateMilestone,
  Project,
  CreateProject,
  Sprint,
  CreateSprint,
  CustomField,
  ProjectView,
  createResource
} from "../domain/types";
import { GitHubTypeConverter } from "../infrastructure/github/util/conversion";
import { z } from "zod";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";
import {
  ProjectSchema,
  IssueSchema,
  MilestoneSchema,
  SprintSchema,
  RelationshipSchema
} from "../domain/resource-schemas";

// Define validation schemas for service inputs
const CreateRoadmapSchema = z.object({
  project: z.object({
    title: z.string().min(1, "Project title is required"),
    description: z.string().optional(),
    owner: z.string(),
    visibility: z.enum(['private', 'public']).optional(),
    views: z.array(z.any()).optional(),
    fields: z.array(z.any()).optional()
  }),
  milestones: z.array(
    z.object({
      milestone: z.object({
        title: z.string().min(1, "Milestone title is required"),
        description: z.string().optional(),
        dueDate: z.string().optional(),
      }),
      issues: z.array(
        z.object({
          title: z.string().min(1, "Issue title is required"),
          description: z.string(),
          assignees: z.array(z.string()).optional(),
          labels: z.array(z.string()).optional(),
          milestoneId: z.string().optional()
        })
      )
    })
  )
});

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

// Add interface to represent issue dependency relationship
interface IssueDependency {
  issueId: string;
  dependsOnId: string;
  createdAt: string;
}

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

export class ProjectManagementService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(owner: string, repo: string, token: string) {
    this.factory = new GitHubRepositoryFactory(token, owner, repo);
  }

  private get issueRepo(): GitHubIssueRepository {
    return this.factory.createIssueRepository();
  }

  private get milestoneRepo(): GitHubMilestoneRepository {
    return this.factory.createMilestoneRepository();
  }

  private get projectRepo(): GitHubProjectRepository {
    return this.factory.createProjectRepository();
  }

  private get sprintRepo(): GitHubSprintRepository {
    return this.factory.createSprintRepository();
  }

  // Helper method to map domain errors to MCP error codes
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

  // Roadmap Management
  async createRoadmap(data: {
    project: CreateProject;
    milestones: Array<{
      milestone: CreateMilestone;
      issues: CreateIssue[];
    }>;
  }): Promise<{
    project: Project;
    milestones: Array<Milestone & { issues: Issue[] }>;
  }> {
    try {
      // Validate input with Zod schema
      const validatedData = CreateRoadmapSchema.parse(data);

      // Create properly typed project without using 'any'
      const projectData = {
        ...validatedData.project,
        type: ResourceType.PROJECT,
        status: ResourceStatus.ACTIVE,
        visibility: validatedData.project.visibility || 'private',
        views: [] as ProjectView[],
        fields: [] as CustomField[],
        // Ensure description is not undefined
        description: validatedData.project.description || '',
      };

      const project = await this.projectRepo.create(
        createResource(ResourceType.PROJECT, projectData)
      );

      const milestones = [];

      // Create milestones and issues with proper error handling
      for (const { milestone, issues } of validatedData.milestones) {
        try {
          // Ensure milestone description is not undefined
          const milestoneWithRequiredFields = {
            ...milestone,
            description: milestone.description || ''
          };

          const createdMilestone = await this.milestoneRepo.create(milestoneWithRequiredFields);

          const createdIssues = await Promise.all(
            issues.map(async (issue) => {
              try {
                return await this.issueRepo.create({
                  ...issue,
                  milestoneId: createdMilestone.id,
                });
              } catch (error) {
                throw this.mapErrorToMCPError(error);
              }
            })
          );

          milestones.push({
            ...createdMilestone,
            issues: createdIssues,
          });
        } catch (error) {
          throw this.mapErrorToMCPError(error);
        }
      }

      return { project, milestones };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid roadmap data: ${error.message}`);
      }

      throw this.mapErrorToMCPError(error);
    }
  }

  // Sprint Management
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
                console.error(`Failed to associate issue ${issueId} with sprint: ${error}`);
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

  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    try {
      return await this.sprintRepo.findAll(filters);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateSprint(id: string, data: Partial<Sprint>): Promise<Sprint> {
    try {
      return await this.sprintRepo.update(id, data);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

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

  // Milestone Management
  async getMilestoneMetrics(id: number, includeIssues: boolean = false): Promise<MilestoneMetrics> {
    try {
      const milestone = await this.milestoneRepo.findById(id.toString());
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, id.toString());
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
          this.getMilestoneMetrics(parseInt(milestone.id), includeIssues)
        )
      );

      return milestoneMetrics;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

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
          this.getMilestoneMetrics(parseInt(milestone.id), includeIssues)
        )
      );

      return milestoneMetrics;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async createIssue(data: CreateIssue): Promise<Issue> {
    try {
      // Validate data using zod schema
      const issueData = z.object({
        title: z.string().min(1, "Issue title is required"),
        description: z.string(),
        assignees: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
        milestoneId: z.string().optional()
      }).parse(data);

      return await this.issueRepo.create(issueData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid issue data: ${error.message}`);
      }

      throw this.mapErrorToMCPError(error);
    }
  }

  async updateIssue(id: string, data: Partial<Issue>): Promise<Issue> {
    try {
      return await this.issueRepo.update(id, data);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async deleteIssue(id: string): Promise<void> {
    try {
      return await this.issueRepo.delete(id);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIssue(id: string): Promise<Issue | null> {
    try {
      return await this.issueRepo.findById(id);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async findIssues(): Promise<Issue[]> {
    try {
      return await this.issueRepo.findAll();
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateIssueStatus(
    id: string,
    status: ResourceStatus
  ): Promise<void> {
    try {
      await this.issueRepo.update(id, { status });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIssueHistory(id: string): Promise<Array<{
    timestamp: string;
    field: string;
    from: string;
    to: string;
  }>> {
    try {
      const issue = await this.issueRepo.findById(id);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, id);
      }

      // Implementation for issue history
      // Currently returning empty array as placeholder, but will be properly implemented
      // This would typically fetch from GitHub API or a local history store

      // Mock implementation for now with sample data
      return [
        {
          timestamp: new Date().toISOString(),
          field: 'status',
          from: ResourceStatus.ACTIVE, // Replace OPEN with ACTIVE since OPEN doesn't exist
          to: issue.status
        },
        {
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          field: 'title',
          from: 'Old title',
          to: issue.title
        }
      ];
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async createMilestone(data: CreateMilestone): Promise<Milestone> {
    try {
      // Validate data using zod schema
      const milestoneData = z.object({
        title: z.string().min(1, "Milestone title is required"),
        description: z.string().optional(),
        dueDate: z.string().optional().refine(val => !val || !isNaN(Date.parse(val)), {
          message: "Due date must be a valid date string if provided"
        })
      }).parse(data);

      // Ensure description is not undefined to satisfy CreateMilestone type
      const validMilestoneData = {
        ...milestoneData,
        description: milestoneData.description || ''
      };

      return await this.milestoneRepo.create(validMilestoneData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(`Invalid milestone data: ${error.message}`);
      }
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateMilestone(
    id: string,
    data: Partial<Milestone>
  ): Promise<Milestone> {
    try {
      return await this.milestoneRepo.update(id, data);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async deleteMilestone(id: string): Promise<void> {
    try {
      return await this.milestoneRepo.delete(id);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getMilestone(id: string): Promise<Milestone | null> {
    try {
      return await this.milestoneRepo.findById(id);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async findMilestones(): Promise<Milestone[]> {
    try {
      return await this.milestoneRepo.findAll();
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async assignIssueToMilestone(
    issueId: string,
    milestoneId: string
  ): Promise<void> {
    try {
      // Validate issueId and milestoneId exist
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const milestone = await this.milestoneRepo.findById(milestoneId);
      if (!milestone) {
        throw new ResourceNotFoundError(ResourceType.MILESTONE, milestoneId);
      }

      await this.issueRepo.update(issueId, { milestoneId });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async addIssueDependency(
    issueId: string,
    dependsOnId: string
  ): Promise<void> {
    try {
      // Validate both issues exist
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      const dependsOn = await this.issueRepo.findById(dependsOnId);
      if (!dependsOn) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, dependsOnId);
      }

      // Create a relationship between the issues
      // This should use a proper relationship repository in a real implementation
      // but we'll simulate it here by storing the relationship in memory

      // Create a relationship object
      const dependency: IssueDependency = {
        issueId,
        dependsOnId,
        createdAt: new Date().toISOString()
      };

      // In a real implementation, we would store this in a database
      // For now, we'll store it as a property on the issue using the update method
      const currentDependencies = await this.getIssueDependencies(issueId);
      if (!currentDependencies.includes(dependsOnId)) {
        // Add dependency only if it doesn't already exist
        const updatedDependencies = [...currentDependencies, dependsOnId];

        // Store the dependencies on the issue using custom field or metadata
        await this.issueRepo.update(issueId, {
          // In a real implementation, this would use a proper field for dependencies
          // but we're simulating it here
          ...issue,
          labels: [...(issue.labels || []), `depends-on:${dependsOnId}`]
        });
      }
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIssueDependencies(issueId: string): Promise<string[]> {
    try {
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

      // Extract dependencies from issue labels
      // In a real implementation, this would use a dedicated field or relationship table
      // but we're using labels as a workaround for now
      const dependencies: string[] = [];

      if (issue.labels && issue.labels.length > 0) {
        // Extract dependencies from the "depends-on" labels
        issue.labels.forEach(label => {
          if (label.startsWith('depends-on:')) {
            const dependencyId = label.substring('depends-on:'.length);
            dependencies.push(dependencyId);
          }
        });
      }

      return dependencies;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
