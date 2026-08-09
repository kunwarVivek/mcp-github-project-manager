import { injectable, inject } from "tsyringe";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import type { Project, CreateProject } from "../domain/types";
import type { ResourceStatus } from "../domain/resource-types";
import { safeCall } from './utils/safeCall';
import { parseResourceStatus, filterByStatus } from '../domain/utils/StatusParser';

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
    return safeCall(async () => {
      const projectData: CreateProject = {
        title: data.title,
        shortDescription: data.shortDescription,
        owner: this.factory.getConfig().owner,
        visibility: data.visibility || 'private',
      };

      const project = await this.projectRepo.create(projectData);
      // Return plain object for MCP compatibility
      return project;
    });
  }

  /**
   * List projects with optional status filtering.
   *
   * @param status - Filter by status: 'active', 'closed', or 'all'
   * @param limit - Maximum number of projects to return
   * @returns Array of projects
   */
  async listProjects(status: string = 'active', limit: number = 10): Promise<Project[]> {
    return safeCall(async () => {
      const projects = await this.projectRepo.findAll();

      // Filter by status if needed
      let filteredProjects = projects;
      if (status !== 'all') {
        filteredProjects = filterByStatus(projects, status, 'project');
      }

      // Return plain objects for MCP compatibility
      return filteredProjects.slice(0, limit);
    });
  }

  /**
   * Get a single project by ID.
   *
   * @param projectId - The project ID
   * @returns The project or null if not found
   */
  async getProject(projectId: string): Promise<Project | null> {
    return safeCall(async () => {
      const project = await this.projectRepo.findById(projectId);
      // Return plain object for MCP compatibility
      return project;
    });
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
    return safeCall(async () => {
      // Convert the status string to ResourceStatus enum
      let resourceStatus: ResourceStatus | undefined;
      if (data.status) {
        resourceStatus = parseResourceStatus(data.status, 'project');
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

      const updatedProject = await this.projectRepo.update(data.projectId, projectData);
      // Return plain object for MCP compatibility
      return updatedProject;
    });
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
    return safeCall(async () => {
      await this.projectRepo.delete(data.projectId);
      return {
        success: true,
        message: `Project ${data.projectId} has been deleted`,
      };
    });
  }
}
