import { z } from "zod";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { GitHubMilestoneRepository } from "../infrastructure/github/repositories/GitHubMilestoneRepository";
import { GitHubIssueRepository } from "../infrastructure/github/repositories/GitHubIssueRepository";
import { ResourceStatus, ResourceType } from "../domain/resource-types";
import {
  Project,
  Milestone,
  Issue,
  CreateProject,
  CreateMilestone,
  CreateIssue,
  ProjectView,
  CustomField,
  createResource,
} from "../domain/types";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError,
} from "../domain/errors";

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

/**
 * RoadmapService builds a full project roadmap in one operation: it creates the
 * project, then each milestone with its issues, wiring issues to their milestone.
 *
 * Extracted from ProjectManagementService (which now delegates to it). It
 * orchestrates the project, milestone, and issue repositories, so it takes the
 * GitHubRepositoryFactory directly.
 */
export class RoadmapService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get projectRepo(): GitHubProjectRepository {
    return this.factory.createProjectRepository();
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
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
  }

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
      const validatedData = CreateRoadmapSchema.parse(data);

      const projectData = {
        ...validatedData.project,
        type: ResourceType.PROJECT,
        status: ResourceStatus.ACTIVE,
        visibility: validatedData.project.visibility || 'private',
        views: [] as ProjectView[],
        fields: [] as CustomField[],
        shortDescription: validatedData.project.shortDescription,
      };

      const project = await this.projectRepo.create(
        createResource(ResourceType.PROJECT, projectData)
      );

      const milestones = [];

      for (const { milestone, issues } of validatedData.milestones) {
        try {
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
}
