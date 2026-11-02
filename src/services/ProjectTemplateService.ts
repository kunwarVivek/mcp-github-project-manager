import { ResourceNotFoundError } from "../domain/errors";
import type {
  CopiedProject,
  OrganizationTemplatePage,
  ProjectTemplateRepository,
  TemplateProject,
} from "../domain/project-template-linking-types";
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

  private get templateRepo(): ProjectTemplateRepository {
    return this.factory.createProjectTemplateRepository();
  }

  // Project README Management
  async getProjectReadme(data: { projectId: string }): Promise<{ readme: string }> {
    return safeCall(async () => ({
      readme: await this.templateRepo.getReadme(data.projectId),
    }));
  }

  async updateProjectReadme(data: {
    projectId: string;
    readme: string;
  }): Promise<{ success: boolean; message: string }> {
    return safeCall(async () => {
      await this.templateRepo.updateReadme(data.projectId, data.readme);
      return {
        success: true,
        message: "Project README updated successfully",
      };
    });
  }

  // Project Template Operations
  async markProjectAsTemplate(data: { projectId: string }): Promise<TemplateProject> {
    return safeCall(() => this.templateRepo.markAsTemplate(data.projectId));
  }

  async unmarkProjectAsTemplate(data: { projectId: string }): Promise<TemplateProject> {
    return safeCall(() => this.templateRepo.unmarkAsTemplate(data.projectId));
  }

  async copyProjectFromTemplate(data: {
    projectId: string;
    targetOwner: string;
    title: string;
    includeDraftIssues?: boolean;
  }): Promise<CopiedProject> {
    return safeCall(() =>
      this.templateRepo.copyFromTemplate({
        projectId: data.projectId,
        targetOwner: data.targetOwner,
        title: data.title,
        includeDraftIssues: data.includeDraftIssues ?? false,
      })
    );
  }

  /** One page of an organization's projects, filtered to those flagged as templates. */
  async listOrganizationTemplates(data: {
    org: string;
    first?: number;
    after?: string;
  }): Promise<OrganizationTemplatePage> {
    return safeCall(() =>
      this.templateRepo.listOrganizationTemplates({
        org: data.org,
        first: data.first ?? 20,
        after: data.after,
      })
    );
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
