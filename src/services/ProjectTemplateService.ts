import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import type { CustomField, ProjectView } from "../domain/types";
import {
  ResourceNotFoundError,
} from "../domain/errors";
import { ResourceType } from "../domain/resource-types";
import { safeCall } from './utils/safeCall';

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


  // Project README Management
  async getProjectReadme(data: {
    projectId: string;
  }): Promise<{ readme: string }> {
    return safeCall(async () => {
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
    });
  }

  async updateProjectReadme(data: {
    projectId: string;
    readme: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
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
    });
  }

  async listProjectFields(data: {
    projectId: string;
  }): Promise<CustomField[]> {
    return safeCall(async () => {
      const project = await this.projectRepo.findById(data.projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, data.projectId);
      }
      return project.fields || [];
    });
  }

  async createProjectField(data: {
    projectId: string;
    name: string;
    type: string;
    options?: Array<{
      name: string;
      color?: string;
      description?: string;
    }>;
  }): Promise<CustomField> {
    return safeCall(async () => {
      return await this.projectRepo.createField(data.projectId, {
        name: data.name,
        type: data.type as CustomField['type'],
        options: data.options?.map(opt => ({
          id: '', // Will be assigned by GitHub
          name: opt.name,
          color: opt.color,
          description: opt.description
        }))
      });
    });
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
    return safeCall(async () => {
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
    });
  }

  // Project View Operations
  async createProjectView(data: {
    projectId: string;
    name: string;
    layout: 'board' | 'table' | 'timeline' | 'roadmap';
  }): Promise<ProjectView> {
    return safeCall(async () => {
      return await this.projectRepo.createView(
        data.projectId,
        data.name,
        data.layout
      );
    });
  }

  async listProjectViews(data: {
    projectId: string;
  }): Promise<ProjectView[]> {
    return safeCall(async () => {
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
    });
  }

  async updateProjectView(data: {
    projectId: string;
    viewId: string;
    name?: string;
    layout?: 'board' | 'table' | 'timeline' | 'roadmap';
  }): Promise<ProjectView> {
    return safeCall(async () => {
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
    });
  }

  async deleteProjectView(data: {
    projectId: string;
    viewId: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.projectRepo.deleteView(data.projectId, data.viewId);

      return {
        success: true,
        message: `View ${data.viewId} deleted successfully from project ${data.projectId}`
      };
    });
  }
}
