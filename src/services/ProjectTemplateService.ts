import { ResourceNotFoundError } from "../domain/errors";
import { ResourceType } from "../domain/resource-types";
import type { CustomField, FieldType, ProjectView, ViewLayout } from "../domain/types";
import type { GitHubRepositoryFactory } from "../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectRepository } from "../infrastructure/github/repositories/GitHubProjectRepository";
import { safeCall } from "./utils/safeCall";

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
  async getProjectReadme(data: { projectId: string }): Promise<{ readme: string }> {
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
        projectId: data.projectId,
      });

      return {
        readme: response.node?.readme || "",
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
          readme: data.readme,
        },
      });

      return {
        success: true,
        message: `Project README updated successfully`,
      };
    });
  }

  async listProjectFields(data: { projectId: string }): Promise<CustomField[]> {
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
    type: FieldType;
    options?: Array<{
      name: string;
      color?: string;
      description?: string;
    }>;
  }): Promise<CustomField> {
    return safeCall(async () => {
      return await this.projectRepo.createField(data.projectId, {
        name: data.name,
        type: data.type,
        options: data.options?.map((opt) => ({
          id: "", // Will be assigned by GitHub
          name: opt.name,
          color: opt.color,
          description: opt.description,
        })),
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
        updateData.options = data.options.map((option) => ({
          id: "", // This will be assigned by GitHub
          name: option.name,
          color: option.color,
        }));
      }

      return await this.projectRepo.updateField(data.projectId, data.fieldId, updateData);
    });
  }

  // Project View Operations
  async createProjectView(data: {
    projectId: string;
    name: string;
    layout: ViewLayout;
  }): Promise<ProjectView> {
    return safeCall(async () => {
      return await this.projectRepo.createView(data.projectId, data.name, data.layout);
    });
  }

  /**
   * The views of a project, with the configuration GitHub stores for them.
   *
   * `name` / `viewId` narrow the result down to a single view, so a caller
   * can pick the view it wants to use as a pool.
   */
  async listProjectViews(data: {
    projectId: string;
    name?: string;
    viewId?: string;
  }): Promise<ProjectView[]> {
    return safeCall(async () => {
      return this.projectRepo.listViews(data.projectId, {
        name: data.name,
        viewId: data.viewId,
      });
    });
  }

  async updateProjectView(data: {
    projectId: string;
    viewId: string;
    name?: string;
    layout?: ViewLayout;
  }): Promise<ProjectView> {
    return safeCall(async () => {
      // The repository owns this mutation: `UpdateProjectV2ViewInput` carries
      // the view id only (the project is implied by the view) and the layout
      // enum is BOARD_LAYOUT / TABLE_LAYOUT / ROADMAP_LAYOUT. This service
      // used to send `projectId` + `id` + a layout like "BOARD", which
      // GitHub rejects on every call.
      return this.projectRepo.updateView(data.projectId, data.viewId, {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.layout !== undefined ? { layout: data.layout } : {}),
      });
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
        message: `View ${data.viewId} deleted successfully from project ${data.projectId}`,
      };
    });
  }
}
