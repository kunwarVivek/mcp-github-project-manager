import { 
  AutomationTriggerType, 
  AutomationActionType,
  AutomationCondition,
  AutomationAction,
  AutomationTrigger 
} from '../../domain/automation-types';

// GitHub GraphQL automation types
export type GitHubProjectRuleTriggerType = 
  | 'ISSUE_ADDED' 
  | 'ISSUE_EDITED' 
  | 'PULL_REQUEST_OPENED' 
  | 'PULL_REQUEST_MERGED' 
  | 'PULL_REQUEST_APPROVED' 
  | 'FIELD_VALUE_CHANGED';

export type GitHubProjectRuleActionType = 
  | 'SET_FIELD_VALUE'
  | 'ADD_TO_PROJECT'
  | 'REMOVE_FROM_PROJECT'
  | 'COPY_FIELD_VALUE'
  | 'ADD_LABEL'
  | 'REMOVE_LABEL'
  | 'SET_MILESTONE';

export interface GitHubProjectRuleNode {
  id: string;
  databaseId: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  name: string;
  ruleTrigger: {
    type: GitHubProjectRuleTriggerType;
    whenStateEquals?: string;
    whenStateWas?: string;
    whenFieldValueEquals?: string;
    whenFieldId?: string;
  };
  ruleActions: Array<{
    type: GitHubProjectRuleActionType;
    fieldId?: string;
    value?: string;
    projectItemId?: string;
    sourceFieldId?: string;
    targetFieldId?: string;
    labelName?: string;
    milestoneId?: string;
  }>;
}

export interface CreateProjectRuleResponse {
  createProjectV2Rule: {
    projectRule: GitHubProjectRuleNode;
  };
}

export interface UpdateProjectRuleResponse {
  updateProjectV2Rule: {
    projectRule: GitHubProjectRuleNode;
  };
}

export interface DeleteProjectRuleResponse {
  deleteProjectV2Rule: {
    projectRule: {
      id: string;
    };
  };
}

export interface GetProjectRuleResponse {
  node: GitHubProjectRuleNode;
}

export interface ListProjectRulesResponse {
  node: {
    projectRules: {
      nodes: GitHubProjectRuleNode[];
    };
  };
}

/**
 * Maps between domain and GitHub GraphQL automation types
 */

export function mapToGitHubTriggerType(type: AutomationTriggerType): GitHubProjectRuleTriggerType | undefined {
  const mappings: Partial<Record<AutomationTriggerType, GitHubProjectRuleTriggerType>> = {
    // Use the actual enum values from AutomationTriggerType
    [AutomationTriggerType.ISSUE_OPENED]: 'ISSUE_ADDED',
    [AutomationTriggerType.ISSUE_CLOSED]: 'ISSUE_EDITED',
    [AutomationTriggerType.ISSUE_LABELED]: 'ISSUE_EDITED',
    [AutomationTriggerType.ISSUE_ASSIGNED]: 'ISSUE_EDITED',
    [AutomationTriggerType.PR_OPENED]: 'PULL_REQUEST_OPENED',
    [AutomationTriggerType.PR_CLOSED]: 'PULL_REQUEST_OPENED',
    [AutomationTriggerType.PR_MERGED]: 'PULL_REQUEST_MERGED',
    [AutomationTriggerType.PR_APPROVED]: 'PULL_REQUEST_APPROVED',
    [AutomationTriggerType.RESOURCE_UPDATED]: 'FIELD_VALUE_CHANGED'
  };
  return mappings[type];
}

export function mapFromGitHubTriggerType(type: GitHubProjectRuleTriggerType): AutomationTriggerType {
  const mappings: Record<GitHubProjectRuleTriggerType, AutomationTriggerType> = {
    // Map from GitHub trigger types to actual domain enum values 
    'ISSUE_ADDED': AutomationTriggerType.ISSUE_OPENED,
    'ISSUE_EDITED': AutomationTriggerType.RESOURCE_UPDATED, // Changed from non-existent ISSUE_UPDATED
    'PULL_REQUEST_OPENED': AutomationTriggerType.PR_OPENED,
    'PULL_REQUEST_MERGED': AutomationTriggerType.PR_MERGED,
    'PULL_REQUEST_APPROVED': AutomationTriggerType.PR_APPROVED,
    'FIELD_VALUE_CHANGED': AutomationTriggerType.RESOURCE_UPDATED
  };
  return mappings[type];
}

export function mapToGitHubActionType(type: AutomationActionType): GitHubProjectRuleActionType | undefined {
  const mappings: Partial<Record<AutomationActionType, GitHubProjectRuleActionType>> = {
    // Map using the correct enum values
    [AutomationActionType.UPDATE_RESOURCE]: 'SET_FIELD_VALUE',
    [AutomationActionType.CREATE_RESOURCE]: 'ADD_TO_PROJECT',
    [AutomationActionType.DELETE_RESOURCE]: 'REMOVE_FROM_PROJECT',
    [AutomationActionType.ADD_LABEL]: 'ADD_LABEL',
    [AutomationActionType.REMOVE_LABEL]: 'REMOVE_LABEL',
    [AutomationActionType.CUSTOM_SCRIPT]: 'COPY_FIELD_VALUE' // Best match
  };
  return mappings[type];
}

export function mapFromGitHubActionType(type: GitHubProjectRuleActionType): AutomationActionType {
  const mappings: Record<GitHubProjectRuleActionType, AutomationActionType> = {
    // Map from GitHub action types to actual domain enum values
    'SET_FIELD_VALUE': AutomationActionType.UPDATE_RESOURCE,
    'ADD_TO_PROJECT': AutomationActionType.CREATE_RESOURCE,
    'REMOVE_FROM_PROJECT': AutomationActionType.DELETE_RESOURCE,
    'COPY_FIELD_VALUE': AutomationActionType.CUSTOM_SCRIPT,
    'ADD_LABEL': AutomationActionType.ADD_LABEL,
    'REMOVE_LABEL': AutomationActionType.REMOVE_LABEL,
    'SET_MILESTONE': AutomationActionType.UPDATE_RESOURCE
  };
  return mappings[type];
}