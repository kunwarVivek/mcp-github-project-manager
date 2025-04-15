import { BaseGitHubRepository } from "./BaseRepository";
import { 
  AutomationAction, 
  AutomationCondition, 
  AutomationRule, 
  AutomationRuleRepository, 
  AutomationTrigger,
  CreateAutomationRule,
  AutomationTriggerType,
  AutomationActionType
} from "../../../domain/automation-types";
import { 
  CreateProjectRuleResponse, 
  DeleteProjectRuleResponse, 
  GetProjectRuleResponse, 
  GitHubProjectRuleNode, 
  ListProjectRulesResponse, 
  UpdateProjectRuleResponse, 
  mapFromGitHubActionType, 
  mapFromGitHubTriggerType, 
  mapToGitHubActionType, 
  mapToGitHubTriggerType 
} from "../automation-types";
import { ProjectId } from "../../../domain/types";

export class GitHubAutomationRuleRepository extends BaseGitHubRepository implements AutomationRuleRepository {
  
  async create(data: CreateAutomationRule): Promise<AutomationRule> {
    const mutation = `
      mutation($input: CreateProjectV2RuleInput!) {
        createProjectV2Rule(input: $input) {
          projectRule {
            id
            databaseId
            createdAt
            updatedAt
            isActive
            name
            ruleTrigger {
              type
              whenStateEquals
              whenStateWas
              whenFieldValueEquals
              whenFieldId
            }
            ruleActions {
              type
              fieldId
              value
              projectItemId
              sourceFieldId
              targetFieldId
              labelName
              milestoneId
            }
          }
        }
      }
    `;

    try {
      const variables = this.prepareCreateRuleVariables(data);
      const response = await this.graphql<CreateProjectRuleResponse>(mutation, variables);
      return this.mapGitHubRuleToAutomationRule(response.createProjectV2Rule.projectRule, data.projectId);
    } catch (error) {
      this.logger.error(`Failed to create automation rule for project ${data.projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async update(id: string, data: Partial<AutomationRule>): Promise<AutomationRule> {
    const mutation = `
      mutation($input: UpdateProjectV2RuleInput!) {
        updateProjectV2Rule(input: $input) {
          projectRule {
            id
            databaseId
            createdAt
            updatedAt
            isActive
            name
            ruleTrigger {
              type
              whenStateEquals
              whenStateWas
              whenFieldValueEquals
              whenFieldId
            }
            ruleActions {
              type
              fieldId
              value
              projectItemId
              sourceFieldId
              targetFieldId
              labelName
              milestoneId
            }
          }
        }
      }
    `;

    try {
      const variables = {
        input: {
          ruleId: id,
          name: data.name,
          isActive: data.enabled,
        }
      };

      const response = await this.graphql<UpdateProjectRuleResponse>(mutation, variables);
      return this.mapGitHubRuleToAutomationRule(
        response.updateProjectV2Rule.projectRule, 
        data.projectId || ""
      );
    } catch (error) {
      this.logger.error(`Failed to update automation rule ${id}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async delete(id: string): Promise<void> {
    const mutation = `
      mutation($input: DeleteProjectV2RuleInput!) {
        deleteProjectV2Rule(input: $input) {
          projectRule {
            id
          }
        }
      }
    `;

    try {
      await this.graphql<DeleteProjectRuleResponse>(mutation, {
        input: {
          ruleId: id
        }
      });
    } catch (error) {
      this.logger.error(`Failed to delete automation rule ${id}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async findById(id: string): Promise<AutomationRule | null> {
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on ProjectV2Rule {
            id
            databaseId
            createdAt
            updatedAt
            isActive
            name
            ruleTrigger {
              type
              whenStateEquals
              whenStateWas
              whenFieldValueEquals
              whenFieldId
            }
            ruleActions {
              type
              fieldId
              value
              projectItemId
              sourceFieldId
              targetFieldId
              labelName
              milestoneId
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<GetProjectRuleResponse>(query, { id });
      if (!response.node) return null;

      // We need to determine the projectId
      const projectId = await this.getProjectIdForRule(id);
      return this.mapGitHubRuleToAutomationRule(response.node, projectId);
    } catch (error) {
      this.logger.error(`Failed to fetch automation rule ${id}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async findByProject(projectId: ProjectId): Promise<AutomationRule[]> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            projectRules(first: 100) {
              nodes {
                id
                databaseId
                createdAt
                updatedAt
                isActive
                name
                ruleTrigger {
                  type
                  whenStateEquals
                  whenStateWas
                  whenFieldValueEquals
                  whenFieldId
                }
                ruleActions {
                  type
                  fieldId
                  value
                  projectItemId
                  sourceFieldId
                  targetFieldId
                  labelName
                  milestoneId
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<ListProjectRulesResponse>(query, { projectId });
      if (!response.node?.projectRules?.nodes) return [];

      return response.node.projectRules.nodes.map(rule => 
        this.mapGitHubRuleToAutomationRule(rule, projectId)
      );
    } catch (error) {
      this.logger.error(`Failed to fetch automation rules for project ${projectId}`, error);
      throw this.handleGraphQLError(error);
    }
  }

  async enable(id: string): Promise<AutomationRule> {
    const rule = await this.findById(id);
    if (!rule) throw new Error(`Automation rule with ID ${id} not found`);

    return await this.update(id, { enabled: true });
  }

  async disable(id: string): Promise<AutomationRule> {
    const rule = await this.findById(id);
    if (!rule) throw new Error(`Automation rule with ID ${id} not found`);

    return await this.update(id, { enabled: false });
  }

  private async getProjectIdForRule(ruleId: string): Promise<string> {
    // This is a simplified implementation. In real-world scenarios,
    // we'd need to query the API to determine which project the rule belongs to
    // or maintain a local cache mapping rules to projects
    const query = `
      query($ruleId: ID!) {
        node(id: $ruleId) {
          ... on ProjectV2Rule {
            project {
              id
            }
          }
        }
      }
    `;

    try {
      const response = await this.graphql<any>(query, { ruleId });
      return response.node?.project?.id || "";
    } catch (error) {
      this.logger.error(`Failed to determine project ID for rule ${ruleId}`, error);
      return "";
    }
  }

  private prepareCreateRuleVariables(data: CreateAutomationRule): any {
    const variables: any = {
      input: {
        projectId: data.projectId,
        name: data.name,
        isActive: data.enabled === undefined ? true : data.enabled
      }
    };

    // Map trigger - use the first trigger from the triggers array
    if (data.triggers && data.triggers.length > 0) {
      const trigger = data.triggers[0]; // GitHub API allows one trigger per rule
      variables.input.triggerType = mapToGitHubTriggerType(trigger.type);
      
      // Map conditions
      if (trigger.conditions && trigger.conditions.length > 0) {
        const condition = trigger.conditions[0]; // GitHub only supports one condition per rule
        
        if (trigger.type === AutomationTriggerType.RESOURCE_UPDATED && condition.field) {
          variables.input.whenFieldId = condition.field;
          
          if (condition.operator === 'equals' && condition.value) {
            variables.input.whenFieldValueEquals = String(condition.value);
          }
        }
      }
    }

    // Map actions
    if (data.actions && data.actions.length > 0) {
      const action = data.actions[0]; // GitHub API expects actions to be passed one at a time
      variables.input.actionType = mapToGitHubActionType(action.type);
      
      // Get action parameters
      const params = action.parameters || {};
      
      if (action.type === AutomationActionType.UPDATE_RESOURCE) {
        variables.input.fieldId = params.fieldId;
        variables.input.value = String(params.value);
      } else if (action.type === AutomationActionType.CUSTOM_SCRIPT) {
        variables.input.sourceFieldId = params.sourceFieldId;
        variables.input.targetFieldId = params.targetFieldId;
      } else if ((action.type === AutomationActionType.ADD_LABEL || action.type === AutomationActionType.REMOVE_LABEL) && params.labelName) {
        variables.input.labelName = params.labelName;
      } else if (params.milestoneId) {
        // Handle milestone separately from the type check to avoid type errors
        variables.input.milestoneId = params.milestoneId;
      }
    }

    return variables;
  }

  private mapGitHubRuleToAutomationRule(rule: GitHubProjectRuleNode, projectId: string): AutomationRule {
    // Map trigger and conditions
    const trigger: AutomationTrigger = {
      id: `trigger_${Date.now()}`, // Generate a unique ID
      type: mapFromGitHubTriggerType(rule.ruleTrigger.type),
      conditions: [] // Initialize with empty array to avoid undefined conditions
    };

    // Add condition if available
    if (rule.ruleTrigger.whenFieldId || rule.ruleTrigger.whenFieldValueEquals || 
        rule.ruleTrigger.whenStateEquals || rule.ruleTrigger.whenStateWas) {
      
      const condition: AutomationCondition = {
        id: `condition_${Date.now()}`, // Generate a unique ID
        field: rule.ruleTrigger.whenFieldId || '',
        operator: 'equals', // Default operator
        value: rule.ruleTrigger.whenFieldValueEquals || rule.ruleTrigger.whenStateEquals || null
      };

      // Safe to push now that we know conditions is an array
      if (trigger.conditions) {
        trigger.conditions.push(condition);
      }
    }

    // Map actions
    const actions: AutomationAction[] = rule.ruleActions.map(action => {
      // Create a base action with required properties
      const domainAction: AutomationAction = {
        id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // Generate a unique ID
        type: mapFromGitHubActionType(action.type),
        parameters: {} // Initialize empty parameters object
      };

      // Add parameters based on available properties
      if (action.fieldId) domainAction.parameters.fieldId = action.fieldId;
      if (action.value) domainAction.parameters.value = action.value;
      if (action.sourceFieldId) domainAction.parameters.sourceFieldId = action.sourceFieldId;
      if (action.targetFieldId) domainAction.parameters.targetFieldId = action.targetFieldId;
      if (action.labelName) domainAction.parameters.labelName = action.labelName;
      if (action.milestoneId) domainAction.parameters.milestoneId = action.milestoneId;

      return domainAction;
    });

    return {
      id: rule.id,
      projectId,
      name: rule.name,
      description: `Rule created from GitHub Project Rule ${rule.id}`,
      enabled: rule.isActive,
      createdAt: new Date(rule.createdAt), // Convert string to Date
      updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : undefined, // Convert string to Date
      triggers: [trigger], // Use the triggers array instead of a single trigger
      actions
    };
  }
}