import { injectable, inject } from "tsyringe";
import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { Project, CreateProject } from "../domain/types";
import { ResourceStatus } from "../domain/resource-types";
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
 * Service for basic project CRUD operations.
 *
 * Handles:
 * - Create, read, update, delete operations for projects
 * - Listing projects with status filtering
 *
 * NOTE: More complex project operations (templates, linking, README management)
 * are handled by other specialized services.
 */
@injectable()
export class ProjectStatusService {
  constructor(
    @inject("GitHubRepositoryFactory") private factory: GitHubRepositoryFactory
  ) {}

  private get projectRepo(): GitHubProjectRepository {
    return this.factory.createProjectRepository();
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
   * Create a new project.
   *
   * @param data - Project configuration (title, description, visibility)
   * @returns The created project
   */
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

  /**
   * List projects with optional status filtering.
   *
   * @param status - Filter by status: 'active', 'closed', or 'all'
   * @param limit - Maximum number of projects to return
   * @returns Array of projects
   */
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

  /**
   * Get a single project by ID.
   *
   * @param projectId - The project ID
   * @returns The project or null if not found
   */
  async getProject(projectId: string): Promise<Project | null> {
    try {
      return await this.projectRepo.findById(projectId);
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  /**
   * Update an existing project.
   *
   * @param data - Project ID and fields to update
   * @returns The updated project
   */
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

  /**
   * Delete a project.
   *
   * @param data - Project ID to delete
   * @returns Success result with message
   */
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
}
