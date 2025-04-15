import { ResourceType } from "./resource-types";

export enum AutomationTriggerType {
  RESOURCE_CREATED = "resource_created",
  RESOURCE_UPDATED = "resource_updated",
  RESOURCE_DELETED = "resource_deleted",
  ISSUE_OPENED = "issue_opened",
  ISSUE_CLOSED = "issue_closed",
  ISSUE_LABELED = "issue_labeled",
  ISSUE_ASSIGNED = "issue_assigned",
  PR_OPENED = "pr_opened",
  PR_CLOSED = "pr_closed",
  PR_MERGED = "pr_merged",
  PR_APPROVED = "pr_approved",
  SPRINT_STARTED = "sprint_started",
  SPRINT_ENDED = "sprint_ended",
  MILESTONE_REACHED = "milestone_reached",
  SCHEDULE = "schedule"
}

export enum AutomationActionType {
  UPDATE_RESOURCE = "update_resource",
  CREATE_RESOURCE = "create_resource",
  DELETE_RESOURCE = "delete_resource",
  ADD_LABEL = "add_label",
  REMOVE_LABEL = "remove_label",
  ASSIGN_USER = "assign_user",
  UNASSIGN_USER = "unassign_user",
  CREATE_RELATIONSHIP = "create_relationship",
  DELETE_RELATIONSHIP = "delete_relationship",
  NOTIFY = "notify",
  WEBHOOK = "webhook",
  CUSTOM_SCRIPT = "custom_script"
}

export interface AutomationCondition {
  id: string;
  field: string;
  operator: string;
  value: any;
}

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  parameters: Record<string, any>;
}

export interface AutomationTrigger {
  id: string;
  type: AutomationTriggerType;
  resourceType?: ResourceType;
  conditions?: AutomationCondition[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt?: Date;
  triggers: AutomationTrigger[];
  actions: AutomationAction[];
}

export interface CreateAutomationRule {
  name: string;
  description?: string;
  projectId: string;
  enabled?: boolean;
  triggers: Omit<AutomationTrigger, "id">[];
  actions: Omit<AutomationAction, "id">[];
}

/**
 * Repository interface for automation rules
 */
export interface AutomationRuleRepository {
  findById(id: string): Promise<AutomationRule | null>;
  findByProject(projectId: string): Promise<AutomationRule[]>;
  create(data: CreateAutomationRule): Promise<AutomationRule>;
  update(id: string, data: Partial<AutomationRule>): Promise<AutomationRule>;
  delete(id: string): Promise<void>;
  enable(id: string): Promise<AutomationRule>;
  disable(id: string): Promise<AutomationRule>;
}