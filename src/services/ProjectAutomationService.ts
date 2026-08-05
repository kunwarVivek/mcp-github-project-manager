import { injectable, inject } from "tsyringe";
import { 
  AutomationRule, 
  AutomationRuleRepository, 
  AutomationTrigger,
  AutomationAction,
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationRule
} from "../domain/automation-types";

/** Tool-shaped input for creating an automation rule (string-typed enums). */
export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  projectId: string;
  enabled?: boolean;
  triggers: Array<{ type: string; resourceType?: string; conditions?: Array<{ field: string; operator: string; value: unknown }> }>;
  actions: Array<{ type: string; parameters: Record<string, unknown> }>;
}

/** Tool-shaped input for updating an automation rule. */
export interface UpdateAutomationRuleInput {
  ruleId: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  triggers?: Array<{ type: string; resourceType?: string; conditions?: Array<{ field: string; operator: string; value: unknown }> }>;
  actions?: Array<{ type: string; parameters: Record<string, unknown> }>;
}

/** Serializable rule shape returned to tool callers (no Date fields). */
export interface AutomationRuleDTO {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  enabled: boolean;
  triggers: unknown[];
  actions: unknown[];
}

/** Compact summary for list operations. */
export interface AutomationRuleSummary {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggersCount: number;
  actionsCount: number;
}

function ruleToDTO(rule: AutomationRule): AutomationRuleDTO {
  return { id: rule.id, name: rule.name, description: rule.description, projectId: rule.projectId, enabled: rule.enabled, triggers: rule.triggers, actions: rule.actions };
}

function mapTriggersForCreate(triggers: CreateAutomationRuleInput['triggers']): Omit<AutomationTrigger, 'id'>[] {
  return triggers.map(t => ({
    type: t.type as AutomationTriggerType,
    resourceType: t.resourceType as ResourceType | undefined,
    conditions: t.conditions?.map(c => ({ id: '', field: c.field, operator: c.operator, value: c.value }))
  }));
}

function mapTriggersForUpdate(triggers?: UpdateAutomationRuleInput['triggers']): AutomationTrigger[] | undefined {
  return triggers?.map(t => ({
    id: '',
    type: t.type as AutomationTriggerType,
    resourceType: t.resourceType as ResourceType | undefined,
    conditions: t.conditions?.map(c => ({ id: '', field: c.field, operator: c.operator, value: c.value }))
  }));
}

function mapActions(actions: Array<{ type: string; parameters: Record<string, unknown> }>): Omit<AutomationAction, 'id'>[] {
  return actions.map(a => ({ type: a.type as AutomationActionType, parameters: a.parameters }));
}

function mapActionsForUpdate(actions?: Array<{ type: string; parameters: Record<string, unknown> }>): AutomationAction[] | undefined {
  return actions?.map(a => ({ id: '', type: a.type as AutomationActionType, parameters: a.parameters }));
}
import { 
  CustomField, 
  FieldId, 
  ProjectId, 
  ProjectRepository 
} from "../domain/types";
import { ResourceNotFoundError } from "../domain/errors";
import { Logger } from "../infrastructure/logger";
import { ResourceType } from "../domain/resource-types";

@injectable()
export class ProjectAutomationService {
  constructor(
    @inject("AutomationRuleRepository") private automationRepo: AutomationRuleRepository,
    @inject("ProjectRepository") private projectRepo: ProjectRepository,
    @inject("Logger") private logger: Logger
  ) {}

  /**
   * Creates a new automation rule for a project
   */
  async createRule(data: CreateAutomationRule): Promise<AutomationRule> {
    // Verify project exists
    const project = await this.projectRepo.findById(data.projectId);
    if (!project) {
      throw new ResourceNotFoundError(ResourceType.PROJECT, data.projectId);
    }

    try {
      return await this.automationRepo.create(data);
    } catch (error) {
      this.logger.error(`Failed to create automation rule for project ${data.projectId}`, error);
      throw error;
    }
  }

  /**
   * Updates an existing automation rule
   */
  async updateRule(id: string, data: Partial<AutomationRule>): Promise<AutomationRule> {
    // Verify rule exists
    const rule = await this.automationRepo.findById(id);
    if (!rule) {
      throw new ResourceNotFoundError(ResourceType.RELATIONSHIP, id);
    }

    try {
      return await this.automationRepo.update(id, data);
    } catch (error) {
      this.logger.error(`Failed to update automation rule ${id}`, error);
      throw error;
    }
  }

  /**
   * Deletes an automation rule
   */
  async deleteRule(id: string): Promise<void> {
    // Verify rule exists
    const rule = await this.automationRepo.findById(id);
    if (!rule) {
      throw new ResourceNotFoundError(ResourceType.RELATIONSHIP, id);
    }

    try {
      await this.automationRepo.delete(id);
    } catch (error) {
      this.logger.error(`Failed to delete automation rule ${id}`, error);
      throw error;
    }
  }

  /**
   * Gets all automation rules for a project
   */
  async getRulesByProject(projectId: ProjectId): Promise<AutomationRule[]> {
    // Verify project exists
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
    }

    try {
      return await this.automationRepo.findByProject(projectId);
    } catch (error) {
      this.logger.error(`Failed to get automation rules for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Gets a specific automation rule by ID
   */
  async getRuleById(id: string): Promise<AutomationRule> {
    const rule = await this.automationRepo.findById(id);
    if (!rule) {
      throw new ResourceNotFoundError(ResourceType.RELATIONSHIP, id);
    }

    return rule;
  }

  /**
   * Enables an automation rule
   */
  async enableRule(id: string): Promise<AutomationRule> {
    const rule = await this.automationRepo.findById(id);
    if (!rule) {
      throw new ResourceNotFoundError(ResourceType.RELATIONSHIP, id);
    }

    return await this.automationRepo.enable(id);
  }

  /**
   * Disables an automation rule
   */
  async disableRule(id: string): Promise<AutomationRule> {
    const rule = await this.automationRepo.findById(id);
    if (!rule) {
      throw new ResourceNotFoundError(ResourceType.RELATIONSHIP, id);
    }

    return await this.automationRepo.disable(id);
  }

  /**
   * Creates a custom field for a project
   */
  async createField(projectId: ProjectId, field: Omit<CustomField, "id">): Promise<CustomField> {
    // Verify project exists
    const project = await this.projectRepo.findById(projectId);
    if (!project) {
      throw new ResourceNotFoundError(ResourceType.PROJECT, projectId);
    }

    try {
      return await this.projectRepo.createField(projectId, field);
    } catch (error) {
      this.logger.error(`Failed to create field for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Updates a custom field
   */
  async updateField(projectId: ProjectId, fieldId: FieldId, data: Partial<CustomField>): Promise<CustomField> {
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
    // This assumes an updateField method has been added to ProjectRepository
    try {
      return await this.projectRepo.updateField(projectId, fieldId, data);
    } catch (error) {
      this.logger.error(`Failed to update field ${fieldId} for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Deletes a custom field
   */
  async deleteField(projectId: ProjectId, fieldId: FieldId): Promise<void> {
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
    // This assumes a deleteField method has been added to ProjectRepository
    try {
      await this.projectRepo.deleteField(projectId, fieldId);
    } catch (error) {
      this.logger.error(`Failed to delete field ${fieldId} from project ${projectId}`, error);
      throw error;
    }
  }

  // ========================================================================
  // Tool-facing adapter methods (string-typed input, DTO output)
  // ========================================================================

  async createRuleFromInput(data: CreateAutomationRuleInput): Promise<AutomationRuleDTO> {
    const rule = await this.createRule({
      name: data.name,
      description: data.description,
      projectId: data.projectId,
      enabled: data.enabled !== false,
      triggers: mapTriggersForCreate(data.triggers),
      actions: mapActions(data.actions)
    } as CreateAutomationRule);
    return ruleToDTO(rule);
  }

  async updateRuleFromInput(data: UpdateAutomationRuleInput): Promise<AutomationRuleDTO> {
    const updated = await this.updateRule(data.ruleId, {
      name: data.name,
      description: data.description,
      enabled: data.enabled,
      triggers: mapTriggersForUpdate(data.triggers),
      actions: mapActionsForUpdate(data.actions)
    });
    return ruleToDTO(updated);
  }

  async getRuleDTO(ruleId: string): Promise<AutomationRuleDTO> {
    return ruleToDTO(await this.getRuleById(ruleId));
  }

  async listRuleSummaries(projectId: string): Promise<AutomationRuleSummary[]> {
    const rules = await this.getRulesByProject(projectId);
    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled,
      triggersCount: rule.triggers.length,
      actionsCount: rule.actions.length
    }));
  }
}