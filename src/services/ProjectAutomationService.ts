import { inject, injectable } from "tsyringe";
import type { ProjectWorkflow, ProjectWorkflowRepository } from "../domain/automation-types";
import { ResourceNotFoundError, ValidationError } from "../domain/errors";
import { ResourceType } from "../domain/resource-types";
import type { CustomField, FieldId, ProjectId, ProjectRepository } from "../domain/types";
import type { ILogger } from "../infrastructure/logger";
import { safeCall } from "./utils/safeCall";

/** Serializable workflow shape returned to tool callers (no Date fields). */
export interface ProjectWorkflowDTO {
  id: string;
  name: string;
  number: number;
  enabled: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

/** Maps a domain workflow onto its tool-facing DTO. */
function workflowToDTO(workflow: ProjectWorkflow): ProjectWorkflowDTO {
  return {
    id: workflow.id,
    name: workflow.name,
    number: workflow.number,
    enabled: workflow.enabled,
    projectId: workflow.projectId,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  };
}

/**
 * Service for managing project automations.
 *
 * Handles:
 * - Reading the automation workflows attached to a project
 * - Deleting an automation workflow
 * - Managing custom fields for projects
 * - Tool-facing adapters with string-typed input and DTO output
 *
 * Project automations are GitHub `ProjectV2Workflow` objects. The API exposes
 * them read-only apart from deletion - they are authored in the GitHub UI - so
 * this service deliberately offers no create/update/enable/disable operation.
 */
@injectable()
export class ProjectAutomationService {
  constructor(
    @inject("ProjectWorkflowRepository") private workflowRepo: ProjectWorkflowRepository,
    @inject("ProjectRepository") private projectRepo: ProjectRepository,
    @inject("ILogger") private logger: ILogger
  ) {}

  /**
   * Gets all automation workflows for a project
   */
  async listWorkflows(projectId: ProjectId): Promise<ProjectWorkflow[]> {
    if (!projectId) {
      throw new ValidationError("Project ID is required");
    }

    return safeCall(async () => {
      // Verify project exists
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
      }

      return await this.workflowRepo.findByProject(projectId);
    });
  }

  /**
   * Gets a specific automation workflow by ID
   */
  async getWorkflowById(id: string): Promise<ProjectWorkflow> {
    if (!id) {
      throw new ValidationError("Workflow ID is required");
    }

    const workflow = await this.workflowRepo.findById(id);
    if (!workflow) {
      throw new ResourceNotFoundError(ResourceType.WORKFLOW, id);
    }

    return workflow;
  }

  /**
   * Deletes an automation workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    if (!id) {
      throw new ValidationError("Workflow ID is required");
    }

    return safeCall(async () => {
      await this.workflowRepo.delete(id);
      this.logger.info(`Deleted project workflow ${id}`);
    });
  }

  /**
   * Creates a custom field for a project
   */
  async createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField> {
    return safeCall(async () => {
      // Verify project exists
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
      }

      return await this.projectRepo.createField(projectId, field);
    });
  }

  /**
   * Updates a custom field
   */
  async updateField(
    projectId: ProjectId,
    fieldId: FieldId,
    data: Partial<CustomField>
  ): Promise<CustomField> {
    return safeCall(async () => {
      // Verify project exists
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
      }

      // Check if field exists in the project
      const fieldExists = project.fields.some((f: CustomField) => f.id === fieldId);
      if (!fieldExists) {
        throw new ResourceNotFoundError(ResourceType.FIELD, fieldId);
      }

      // Use the repository method to update the field
      return await this.projectRepo.updateField(projectId, fieldId, data);
    });
  }

  /**
   * Deletes a custom field
   */
  async deleteField(projectId: ProjectId, fieldId: FieldId): Promise<void> {
    return safeCall(async () => {
      // Verify project exists
      const project = await this.projectRepo.findById(projectId);
      if (!project) {
        throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
      }

      // Check if field exists in the project
      const fieldExists: boolean = project.fields.some((f: CustomField) => f.id === fieldId);
      if (!fieldExists) {
        throw new ResourceNotFoundError(ResourceType.FIELD, fieldId);
      }

      // Use the repository method to delete the field
      await this.projectRepo.deleteField(projectId, fieldId);
    });
  }

  // ========================================================================
  // Tool-facing adapter methods (string-typed input, DTO output)
  // ========================================================================

  async getWorkflowDTO(workflowId: string): Promise<ProjectWorkflowDTO> {
    return workflowToDTO(await this.getWorkflowById(workflowId));
  }

  async listWorkflowDTOs(projectId: string): Promise<ProjectWorkflowDTO[]> {
    const workflows = await this.listWorkflows(projectId);
    return workflows.map(workflowToDTO);
  }
}
