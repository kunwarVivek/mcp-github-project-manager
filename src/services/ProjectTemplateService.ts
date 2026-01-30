import { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { CustomField, ProjectView } from "../domain/types";
import { MCPErrorCode } from "../domain/mcp-types";
import {
  DomainError,
  ResourceNotFoundError,
  ValidationError,
  RateLimitError,
  UnauthorizedError,
  GitHubAPIError
} from "../domain/errors";
import { ResourceType } from "../domain/resource-types";

/**
 * ProjectTemplateService handles project customization operations:
 * - Project README management
 * - Custom field operations
 * - View CRUD operations
 *
 * Extracted from ProjectManagementService for better separation of concerns.
 */
export class ProjectTemplateService {
  private readonly factory: GitHubRepositoryFactory;

  constructor(factory: GitHubRepositoryFactory) {
    this.factory = factory;
  }

  private get projectRepo(): GitHubProjectRepository {
    return this.factory.createProjectRepository();
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

  // Project README Management
  async getProjectReadme(data: {
    projectId: string;
  }): Promise<{ readme: string }> {
    try {
      const query = `
        query($projectId: ID!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              readme
            }
          }
        }
      `;

      interface GetReadmeResponse {
        node: {
          readme: string | null;
        };
      }

      const response = await this.factory.graphql<GetReadmeResponse>(query, {
        projectId: data.projectId
      });

      return {
        readme: response.node?.readme || ''
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }

  async updateProjectReadme(data: {
    projectId: string;
    readme: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const mutation = `
        mutation($input: UpdateProjectV2Input!) {
          updateProjectV2(input: $input) {
            projectV2 {
              id
              readme
            }
          }
        }
      `;

      interface UpdateReadmeResponse {
        updateProjectV2: {
          projectV2: {
            id: string;
            readme: string;
          };
        };
      }

      await this.factory.graphql<UpdateReadmeResponse>(mutation, {
        input: {
          projectId: data.projectId,
          readme: data.readme
        }
      });

      return {
        success: true,
        message: `Project README updated successfully`
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

  async deleteProjectView(data: {
    projectId: string;
    viewId: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      await this.projectRepo.deleteView(data.projectId, data.viewId);

      return {
        success: true,
        message: `View ${data.viewId} deleted successfully from project ${data.projectId}`
      };
    } catch (error) {
      throw this.mapErrorToMCPError(error);
    }
  }
}
