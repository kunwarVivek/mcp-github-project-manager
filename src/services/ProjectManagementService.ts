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
  createResource,
  CreateField,
  UpdateField,
  FieldType,
  ProjectItem
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
    shortDescription: z.string().optional(),
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

  /**
   * Get the repository factory instance for sync service
   */
  getRepositoryFactory(): GitHubRepositoryFactory {
    return this.factory;
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
        // Ensure shortDescription is used (description is handled via separate update)
        shortDescription: validatedData.project.shortDescription,
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

  async findSprints(filters?: { status?: ResourceStatus }): Promise<Sprint[]> {
    try {
      return await this.sprintRepo.findAll(filters);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

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

  // Project Management
  async createProject(data: {
    title: string;
    shortDescription?: string;
    visibility?: 'private' | 'public';
  }): Promise<Project> {
    try {
      const projectData: CreateProject = {
        title: data.title,
        shortDescription: data.shortDescription,
        owner: this.factory.getConfig().owner,
        visibility: data.visibility || 'private',
      };

      return await this.projectRepo.create(projectData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listProjects(status: string = 'active', limit: number = 10): Promise<Project[]> {
    try {
      const projects = await this.projectRepo.findAll();

      // Filter by status if needed
      let filteredProjects = projects;
      if (status !== 'all') {
        const resourceStatus = status === 'active' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
        filteredProjects = projects.filter(project => project.status === resourceStatus);
      }

      // Apply limit
      return filteredProjects.slice(0, limit);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      return await this.projectRepo.findById(projectId);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Milestone Management
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
        let valueA, valueB;

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

  // Issue Management
  async createIssue(data: {
    title: string;
    description: string;
    milestoneId?: string;
    assignees?: string[];
    labels?: string[];
    priority?: string;
    type?: string;
  }): Promise<Issue> {
    try {
      // Create labels based on priority and type if provided
      const labels = data.labels || [];
      if (data.priority) {
        labels.push(`priority:${data.priority}`);
      }
      if (data.type) {
        labels.push(`type:${data.type}`);
      }

      const issueData: CreateIssue = {
        title: data.title,
        description: data.description,
        assignees: data.assignees || [],
        labels,
        milestoneId: data.milestoneId,
      };

      return await this.issueRepo.create(issueData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listIssues(options: {
    status?: string;
    milestone?: string;
    labels?: string[];
    assignee?: string;
    sort?: string;
    direction?: string;
    limit?: number;
  } = {}): Promise<Issue[]> {
    try {
      // Set default values
      const {
        status = 'open',
        milestone,
        labels = [],
        assignee,
        sort = 'created',
        direction = 'desc',
        limit = 30
      } = options;

      let issues: Issue[];

      if (milestone) {
        // If milestone is specified, get issues for that milestone
        issues = await this.issueRepo.findByMilestone(milestone);
      } else {
        // Otherwise get all issues
        issues = await this.issueRepo.findAll();
      }

      // Filter by status
      if (status !== 'all') {
        const resourceStatus = status === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
        issues = issues.filter(issue => issue.status === resourceStatus);
      }

      // Filter by labels if provided
      if (labels.length > 0) {
        issues = issues.filter(issue =>
          labels.every(label => issue.labels.includes(label))
        );
      }

      // Filter by assignee if provided
      if (assignee) {
        issues = issues.filter(issue =>
          issue.assignees.includes(assignee)
        );
      }

      // Sort the issues
      issues.sort((a, b) => {
        let valueA, valueB;

        switch(sort) {
          case 'updated':
            valueA = a.updatedAt;
            valueB = b.updatedAt;
            break;
          case 'comments':
            // Since we don't have comment count in our model, default to created
          case 'created':
          default:
            valueA = a.createdAt;
            valueB = b.createdAt;
        }

        const comparison = valueA.localeCompare(valueB);
        return direction === 'desc' ? -comparison : comparison;
      });

      // Apply limit
      return issues.slice(0, limit);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getIssue(issueId: string): Promise<Issue | null> {
    try {
      return await this.issueRepo.findById(issueId);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateIssue(
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      milestoneId?: string | null;
      assignees?: string[];
      labels?: string[];
    }
  ): Promise<Issue> {
    try {
      const data: Partial<Issue> = {};

      if (updates.title) data.title = updates.title;
      if (updates.description) data.description = updates.description;
      if (updates.status) {
        data.status = updates.status === 'open' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
      }
      if (updates.assignees) data.assignees = updates.assignees;
      if (updates.labels) data.labels = updates.labels;

      // Handle milestoneId explicitly
      if (updates.milestoneId === null) {
        data.milestoneId = undefined; // Remove milestone
      } else if (updates.milestoneId !== undefined) {
        data.milestoneId = updates.milestoneId;
      }

      return await this.issueRepo.update(issueId, data);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Sprint Management
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

  // Project Update and Delete Operations
  async updateProject(data: {
    projectId: string;
    title?: string;
    description?: string;
    visibility?: 'private' | 'public';
    status?: 'active' | 'closed';
  }): Promise<Project> {
    try {
      // Convert the status string to ResourceStatus enum
      let resourceStatus: ResourceStatus | undefined;
      if (data.status) {
        resourceStatus = data.status === 'active' ? ResourceStatus.ACTIVE : ResourceStatus.CLOSED;
      }

      // Map the data to the domain model
      const projectData: Partial<Project> = {
        title: data.title,
        description: data.description,
        visibility: data.visibility,
        status: resourceStatus,
      };

      // Clean up undefined values
      Object.keys(projectData).forEach((key) => {
        if (projectData[key as keyof Partial<Project>] === undefined) {
          delete projectData[key as keyof Partial<Project>];
        }
      });

      return await this.projectRepo.update(data.projectId, projectData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async deleteProject(data: {
    projectId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await this.projectRepo.delete(data.projectId);
      return {
        success: true,
        message: `Project ${data.projectId} has been deleted`,
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listProjectFields(data: {
    projectId: string;
  }): Promise<CustomField[]> {
    try {
      const project = await this.projectRepo.findById(data.projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, data.projectId);
      }
      return project.fields || [];
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateProjectField(data: {
    projectId: string;
    fieldId: string;
    name?: string;
    options?: Array<{
      name: string;
      color?: string;
    }>;
  }): Promise<CustomField> {
    try {
      const updateData: Partial<CustomField> = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.options !== undefined) {
        updateData.options = data.options.map(option => ({
          id: '', // This will be assigned by GitHub
          name: option.name,
          color: option.color
        }));
      }

      return await this.projectRepo.updateField(data.projectId, data.fieldId, updateData);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Project Item Operations
  async addProjectItem(data: {
    projectId: string;
    contentId: string;
    contentType: 'issue' | 'pull_request';
  }): Promise<ProjectItem> {
    try {
      // GraphQL mutation to add an item to a project
      const mutation = `
        mutation($input: AddProjectV2ItemByIdInput!) {
          addProjectV2ItemById(input: $input) {
            item {
              id
              content {
                ... on Issue {
                  id
                  title
                }
                ... on PullRequest {
                  id
                  title
                }
              }
            }
          }
        }
      `;

      interface AddProjectItemResponse {
        addProjectV2ItemById: {
          item: {
            id: string;
            content: {
              id: string;
              title: string;
            };
          };
        };
      }

      const response = await this.factory.graphql<AddProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          contentId: data.contentId
        }
      });

      const itemId = response.addProjectV2ItemById.item.id;
      const contentId = response.addProjectV2ItemById.item.content.id;

      const resourceType = data.contentType === 'issue' ? ResourceType.ISSUE : ResourceType.PULL_REQUEST;

      return {
        id: itemId,
        contentId,
        contentType: resourceType,
        projectId: data.projectId,
        fieldValues: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async removeProjectItem(data: {
    projectId: string;
    itemId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: DeleteProjectV2ItemInput!) {
          deleteProjectV2Item(input: $input) {
            deletedItemId
          }
        }
      `;

      interface DeleteProjectItemResponse {
        deleteProjectV2Item: {
          deletedItemId: string;
        };
      }

      await this.factory.graphql<DeleteProjectItemResponse>(mutation, {
        input: {
          projectId: data.projectId,
          itemId: data.itemId
        }
      });

      return {
        success: true,
        message: `Item ${data.itemId} has been removed from project ${data.projectId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listProjectItems(data: {
    projectId: string;
    limit?: number;
  }): Promise<ProjectItem[]> {
    try {
      const limit = data.limit || 50;
      const query = `
        query($projectId: ID!, $limit: Int!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: $limit) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      id
                      title
                      __typename
                    }
                    ... on PullRequest {
                      id
                      title
                      __typename
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldTextValue {
                        text
                        field {
                          ... on ProjectV2Field {
                            id
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        date
                        field {
                          ... on ProjectV2Field {
                            id
                            name
                          }
                        }
                      }
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        name
                        field {
                          ... on ProjectV2SingleSelectField {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      interface ListProjectItemsResponse {
        node: {
          items: {
            nodes: Array<{
              id: string;
              content?: {
                id: string;
                title: string;
                __typename: string;
              };
              fieldValues: {
                nodes: Array<{
                  text?: string;
                  date?: string;
                  name?: string;
                  field: {
                    id: string;
                    name: string;
                  }
                }>
              }
            }>
          }
        }
      }

      const response = await this.factory.graphql<ListProjectItemsResponse>(query, {
        projectId: data.projectId,
        limit
      });

      // If project doesn't exist or has no items
      if (!response.node || !response.node.items || !response.node.items.nodes) {
        return [];
      }

      return response.node.items.nodes.map((item) => {
        // Build field values map
        const fieldValues: Record<string, any> = {};
        if (item.fieldValues && item.fieldValues.nodes) {
          item.fieldValues.nodes.forEach((fieldValue: any) => {
            if (!fieldValue || !fieldValue.field) return;

            const fieldId = fieldValue.field.id;
            const fieldName = fieldValue.field.name;

            if ('text' in fieldValue) {
              fieldValues[fieldId] = fieldValue.text;
            } else if ('date' in fieldValue) {
              fieldValues[fieldId] = fieldValue.date;
            } else if ('name' in fieldValue) {
              fieldValues[fieldId] = fieldValue.name;
            }
          });
        }

        // Determine content type
        let contentType = ResourceType.ISSUE; // Default
        if (item.content && item.content.__typename) {
          contentType = item.content.__typename === 'Issue'
            ? ResourceType.ISSUE
            : ResourceType.PULL_REQUEST;
        }

        return {
          id: item.id,
          contentId: item.content?.id || '',
          contentType,
          projectId: data.projectId,
          fieldValues,
          createdAt: new Date().toISOString(), // GitHub API doesn't provide creation date for items
          updatedAt: new Date().toISOString()
        };
      });
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Field Value Operations
  async setFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
    value: any;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // First, get the field details to determine its type
      const fieldQuery = `
        query($projectId: ID!, $fieldId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              field(id: $fieldId) {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2IterationField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
                ... on ProjectV2MilestoneField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2AssigneesField {
                  id
                  name
                  dataType
                }
                ... on ProjectV2LabelsField {
                  id
                  name
                  dataType
                }
              }
            }
          }
        }
      `;

      interface FieldQueryResponse {
        node: {
          field: {
            id: string;
            name: string;
            dataType: string;
            options?: Array<{ id: string; name: string }>;
          }
        }
      }

      const fieldResponse = await this.factory.graphql<FieldQueryResponse>(fieldQuery, {
        projectId: data.projectId,
        fieldId: data.fieldId
      });

      if (!fieldResponse.node?.field) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldId);
      }

      const field = fieldResponse.node.field;
      let mutation = '';
      let variables: Record<string, any> = {
        projectId: data.projectId,
        itemId: data.itemId,
        fieldId: data.fieldId,
      };

      // Determine the correct mutation based on field type
      switch (field.dataType) {
        case 'TEXT':
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $text: String!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { text: $text }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.text = String(data.value);
          break;

        case 'NUMBER':
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $number: Float!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { number: $number }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.number = Number(data.value);
          break;

        case 'DATE':
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { date: $date }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.date = String(data.value);
          break;

        case 'SINGLE_SELECT':
          // For single select, we need to find the option ID that matches the provided value
          const optionId = field.options?.find(opt => opt.name === data.value)?.id;
          if (!optionId) {
            throw new ValidationError(`Invalid option value '${data.value}' for field '${field.name}'`);
          }

          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { singleSelectOptionId: $optionId }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.optionId = optionId;
          break;

        case 'ITERATION':
          // For iteration fields, the value should be an iteration ID
          if (!data.value || typeof data.value !== 'string') {
            throw new ValidationError(`Iteration field '${field.name}' requires a valid iteration ID string`);
          }
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $iterationId: ID!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { iterationId: $iterationId }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.iterationId = String(data.value);
          break;

        case 'MILESTONE':
          // For milestone fields, the value should be a milestone ID
          if (!data.value || typeof data.value !== 'string') {
            throw new ValidationError(`Milestone field '${field.name}' requires a valid milestone ID string`);
          }
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $milestoneId: ID!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { milestoneId: $milestoneId }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.milestoneId = String(data.value);
          break;

        case 'ASSIGNEES':
          // For user fields, the value should be an array of user IDs
          if (!data.value) {
            throw new ValidationError(`Assignees field '${field.name}' requires at least one user ID`);
          }
          const userIds = Array.isArray(data.value) ? data.value : [data.value];
          if (userIds.length === 0 || userIds.some(id => !id || typeof id !== 'string')) {
            throw new ValidationError(`Assignees field '${field.name}' requires valid user ID strings`);
          }
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $userIds: [ID!]!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { userIds: $userIds }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.userIds = userIds.map((id: any) => String(id));
          break;

        case 'LABELS':
          // For label fields, the value should be an array of label IDs
          if (!data.value) {
            throw new ValidationError(`Labels field '${field.name}' requires at least one label ID`);
          }
          const labelIds = Array.isArray(data.value) ? data.value : [data.value];
          if (labelIds.length === 0 || labelIds.some(id => !id || typeof id !== 'string')) {
            throw new ValidationError(`Labels field '${field.name}' requires valid label ID strings`);
          }
          mutation = `
            mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $labelIds: [ID!]!) {
              updateProjectV2ItemFieldValue(input: {
                projectId: $projectId
                itemId: $itemId
                fieldId: $fieldId
                value: { labelIds: $labelIds }
              }) {
                projectV2Item {
                  id
                }
              }
            }
          `;
          variables.labelIds = labelIds.map((id: any) => String(id));
          break;

        default:
          throw new ValidationError(`Unsupported field type: ${field.dataType}. Supported types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, MILESTONE, ASSIGNEES, LABELS`);
      }

      interface UpdateFieldValueResponse {
        updateProjectV2ItemFieldValue: {
          projectV2Item: {
            id: string;
          }
        }
      }

      await this.factory.graphql<UpdateFieldValueResponse>(mutation, variables);

      return {
        success: true,
        message: `Field value updated successfully for field '${field.name}'`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async getFieldValue(data: {
    projectId: string;
    itemId: string;
    fieldId: string;
  }): Promise<{ fieldName: string; value: any; fieldType: string }> {
    try {
      const query = `
        query($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              item(id: $itemId) {
                fieldValueByName(name: $fieldId) {
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field {
                      ... on ProjectV2Field {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldNumberValue {
                    number
                    field {
                      ... on ProjectV2Field {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2Field {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldIterationValue {
                    iterationId
                    title
                    field {
                      ... on ProjectV2IterationField {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldMilestoneValue {
                    milestoneId
                    title
                    field {
                      ... on ProjectV2MilestoneField {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldUserValue {
                    users {
                      nodes {
                        id
                        login
                      }
                    }
                    field {
                      ... on ProjectV2AssigneesField {
                        name
                        dataType
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldLabelValue {
                    labels {
                      nodes {
                        id
                        name
                      }
                    }
                    field {
                      ... on ProjectV2LabelsField {
                        name
                        dataType
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      interface FieldValueResponse {
        node: {
          item: {
            fieldValueByName: {
              text?: string;
              number?: number;
              date?: string;
              name?: string;
              iterationId?: string;
              title?: string;
              milestoneId?: string;
              users?: {
                nodes: Array<{
                  id: string;
                  login: string;
                }>;
              };
              labels?: {
                nodes: Array<{
                  id: string;
                  name: string;
                }>;
              };
              field: {
                name: string;
                dataType: string;
              }
            }
          }
        }
      }

      const response = await this.factory.graphql<FieldValueResponse>(query, {
        projectId: data.projectId,
        itemId: data.itemId,
        fieldId: data.fieldId
      });

      if (!response.node?.item?.fieldValueByName) {
        throw new ResourceNotFoundError(ResourceType.FIELD, data.fieldId);
      }

      const fieldValue = response.node.item.fieldValueByName;
      const field = fieldValue.field;
      let value = null;

      // Extract the value based on the field type
      if ('text' in fieldValue && fieldValue.text !== undefined) {
        value = fieldValue.text;
      } else if ('number' in fieldValue && fieldValue.number !== undefined) {
        value = fieldValue.number;
      } else if ('date' in fieldValue && fieldValue.date !== undefined) {
        value = fieldValue.date;
      } else if ('name' in fieldValue && fieldValue.name !== undefined) {
        value = fieldValue.name;
      } else if ('iterationId' in fieldValue && fieldValue.iterationId !== undefined) {
        value = {
          iterationId: fieldValue.iterationId,
          title: fieldValue.title
        };
      } else if ('milestoneId' in fieldValue && fieldValue.milestoneId !== undefined) {
        value = {
          milestoneId: fieldValue.milestoneId,
          title: fieldValue.title
        };
      } else if ('users' in fieldValue && fieldValue.users?.nodes) {
        value = fieldValue.users.nodes.map(user => ({
          id: user.id,
          login: user.login
        }));
      } else if ('labels' in fieldValue && fieldValue.labels?.nodes) {
        value = fieldValue.labels.nodes.map(label => ({
          id: label.id,
          name: label.name
        }));
      }

      return {
        fieldName: field.name,
        value,
        fieldType: field.dataType
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Project View Operations
  async createProjectView(data: {
    projectId: string;
    name: string;
    layout: 'board' | 'table' | 'timeline' | 'roadmap';
  }): Promise<ProjectView> {
    try {
      return await this.projectRepo.createView(
        data.projectId,
        data.name,
        data.layout
      );
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listProjectViews(data: {
    projectId: string;
  }): Promise<ProjectView[]> {
    try {
      const query = `
        query($projectId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              views(first: 20) {
                nodes {
                  id
                  name
                  layout
                }
              }
            }
          }
        }
      `;

      interface ListViewsResponse {
        node: {
          views: {
            nodes: Array<{
              id: string;
              name: string;
              layout: string;
            }>
          }
        }
      }

      const response = await this.factory.graphql<ListViewsResponse>(query, {
        projectId: data.projectId
      });

      if (!response.node?.views?.nodes) {
        return [];
      }

      return response.node.views.nodes.map(view => ({
        id: view.id,
        name: view.name,
        layout: view.layout.toLowerCase() as 'board' | 'table' | 'timeline' | 'roadmap',
        fields: [], // These would need to be fetched separately if needed
        sortBy: [],
        groupBy: undefined,
        filters: []
      }));
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateProjectView(data: {
    projectId: string;
    viewId: string;
    name?: string;
    layout?: 'board' | 'table' | 'timeline' | 'roadmap';
  }): Promise<ProjectView> {
    try {
      const mutation = `
        mutation($input: UpdateProjectV2ViewInput!) {
          updateProjectV2View(input: $input) {
            projectV2View {
              id
              name
              layout
            }
          }
        }
      `;

      interface UpdateViewResponse {
        updateProjectV2View: {
          projectV2View: {
            id: string;
            name: string;
            layout: string;
          }
        }
      }

      const input: Record<string, any> = {
        projectId: data.projectId,
        id: data.viewId
      };

      if (data.name) {
        input.name = data.name;
      }

      if (data.layout) {
        input.layout = data.layout.toUpperCase();
      }

      const response = await this.factory.graphql<UpdateViewResponse>(mutation, {
        input
      });

      const view = response.updateProjectV2View.projectV2View;

      return {
        id: view.id,
        name: view.name,
        layout: view.layout.toLowerCase() as 'board' | 'table' | 'timeline' | 'roadmap',
        fields: [],
        sortBy: [],
        groupBy: undefined,
        filters: []
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Milestone Management
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

  // Label Management
  async createLabel(data: {
    name: string;
    color: string;
    description?: string;
  }): Promise<{ id: string; name: string; color: string; description: string }> {
    try {
      const mutation = `
        mutation($input: CreateLabelInput!) {
          createLabel(input: $input) {
            label {
              id
              name
              color
              description
            }
          }
        }
      `;

      interface CreateLabelResponse {
        createLabel: {
          label: {
            id: string;
            name: string;
            color: string;
            description: string;
          }
        }
      }

      const response = await this.factory.graphql<CreateLabelResponse>(mutation, {
        input: {
          repositoryId: this.factory.getConfig().repo,
          name: data.name,
          color: data.color,
          description: data.description || ''
        }
      });

      return response.createLabel.label;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async listLabels(data: {
    limit?: number;
  }): Promise<Array<{ id: string; name: string; color: string; description: string }>> {
    try {
      const limit = data.limit || 100;

      const query = `
        query($owner: String!, $repo: String!, $limit: Int!) {
          repository(owner: $owner, name: $repo) {
            labels(first: $limit) {
              nodes {
                id
                name
                color
                description
              }
            }
          }
        }
      `;

      interface ListLabelsResponse {
        repository: {
          labels: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
              description: string;
            }>
          }
        }
      }

      const response = await this.factory.graphql<ListLabelsResponse>(query, {
        owner: this.factory.getConfig().owner,
        repo: this.factory.getConfig().repo,
        limit
      });

      if (!response.repository?.labels?.nodes) {
        return [];
      }

      return response.repository.labels.nodes;
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  // Additional Issue Management Methods
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

  async addIssueDependency(issueId: string, dependsOnId: string): Promise<void> {
    try {
      // In a real implementation, this would store the dependency relationship
      // For now, we'll use labels to track dependencies
      const issue = await this.issueRepo.findById(issueId);
      if (!issue) {
        throw new ResourceNotFoundError(ResourceType.ISSUE, issueId);
      }

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

  async getIssueHistory(issueId: string): Promise<any[]> {
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
