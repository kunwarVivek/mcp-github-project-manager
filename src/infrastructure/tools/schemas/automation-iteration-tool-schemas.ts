import { z } from "zod";
import { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  AutomationRuleOutputSchema,
  AutomationRuleListOutputSchema,
  IterationConfigOutputSchema,
  IterationOutputSchema,
  IterationItemsOutputSchema,
  BulkOperationResultSchema,
  DeleteOutputSchema,
} from "./project-schemas";

// ============================================================================
// Automation Rule Schemas
// ============================================================================

export const createAutomationRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  projectId: z.string().min(1, "Project ID is required"),
  enabled: z.boolean().optional().default(true),
  triggers: z.array(z.object({
    type: z.enum([
      "resource_created", "resource_updated", "resource_deleted",
      "issue_opened", "issue_closed", "issue_labeled", "issue_assigned",
      "pr_opened", "pr_closed", "pr_merged", "pr_approved",
      "sprint_started", "sprint_ended", "milestone_reached", "schedule"
    ]),
    resourceType: z.string().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any()
    })).optional()
  })),
  actions: z.array(z.object({
    type: z.enum([
      "update_resource", "create_resource", "delete_resource",
      "add_label", "remove_label", "assign_user", "unassign_user",
      "create_relationship", "delete_relationship", "notify", "webhook", "custom_script"
    ]),
    parameters: z.record(z.string(), z.any())
  }))
});

export type CreateAutomationRuleArgs = z.infer<typeof createAutomationRuleSchema>;

export const updateAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  triggers: z.array(z.object({
    type: z.enum([
      "resource_created", "resource_updated", "resource_deleted",
      "issue_opened", "issue_closed", "issue_labeled", "issue_assigned",
      "pr_opened", "pr_closed", "pr_merged", "pr_approved",
      "sprint_started", "sprint_ended", "milestone_reached", "schedule"
    ]),
    resourceType: z.string().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.string(),
      value: z.any()
    })).optional()
  })).optional(),
  actions: z.array(z.object({
    type: z.enum([
      "update_resource", "create_resource", "delete_resource",
      "add_label", "remove_label", "assign_user", "unassign_user",
      "create_relationship", "delete_relationship", "notify", "webhook", "custom_script"
    ]),
    parameters: z.record(z.string(), z.any())
  })).optional()
});

export type UpdateAutomationRuleArgs = z.infer<typeof updateAutomationRuleSchema>;

export const deleteAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type DeleteAutomationRuleArgs = z.infer<typeof deleteAutomationRuleSchema>;

export const getAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type GetAutomationRuleArgs = z.infer<typeof getAutomationRuleSchema>;

export const listAutomationRulesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

export type ListAutomationRulesArgs = z.infer<typeof listAutomationRulesSchema>;

export const enableAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type EnableAutomationRuleArgs = z.infer<typeof enableAutomationRuleSchema>;

export const disableAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type DisableAutomationRuleArgs = z.infer<typeof disableAutomationRuleSchema>;

// ============================================================================
// Iteration Management Schemas
// ============================================================================

export const getIterationConfigurationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional()
});

export type GetIterationConfigurationArgs = z.infer<typeof getIterationConfigurationSchema>;

export const getCurrentIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional()
});

export type GetCurrentIterationArgs = z.infer<typeof getCurrentIterationSchema>;

export const getIterationItemsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  limit: z.number().int().positive().default(50).optional()
});

export type GetIterationItemsArgs = z.infer<typeof getIterationItemsSchema>;

export const getIterationByDateSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  date: z.string().datetime("Date must be a valid ISO date string"),
  fieldName: z.string().optional()
});

export type GetIterationByDateArgs = z.infer<typeof getIterationByDateSchema>;

export const assignItemsToIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  fieldName: z.string().optional()
});

export type AssignItemsToIterationArgs = z.infer<typeof assignItemsToIterationSchema>;

// ============================================================================
// Automation Rule Tool Definitions
// ============================================================================

export const createAutomationRuleTool: ToolDefinition<CreateAutomationRuleArgs, z.infer<typeof AutomationRuleOutputSchema>> = {
  name: "create_automation_rule",
  title: "Create Automation Rule",
  description: "Create a new automation rule for a GitHub project",
  schema: createAutomationRuleSchema as unknown as ToolSchema<CreateAutomationRuleArgs>,
  outputSchema: AutomationRuleOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Auto-label PRs",
      description: "Automatically add 'needs-review' label when PR is opened",
      args: {
        name: "Auto-label new PRs",
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        enabled: true,
        triggers: [{
          type: "pr_opened"
        }],
        actions: [{
          type: "add_label",
          parameters: { labelName: "needs-review" }
        }]
      }
    },
    {
      name: "Auto-assign issues",
      description: "Automatically assign issues with 'bug' label to maintainer",
      args: {
        name: "Auto-assign bugs",
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        enabled: true,
        triggers: [{
          type: "issue_labeled",
          conditions: [{
            field: "label",
            operator: "equals",
            value: "bug"
          }]
        }],
        actions: [{
          type: "assign_user",
          parameters: { username: "maintainer" }
        }]
      }
    }
  ]
};

export const updateAutomationRuleTool: ToolDefinition<UpdateAutomationRuleArgs, z.infer<typeof AutomationRuleOutputSchema>> = {
  name: "update_automation_rule",
  title: "Update Automation Rule",
  description: "Update an existing automation rule",
  schema: updateAutomationRuleSchema as unknown as ToolSchema<UpdateAutomationRuleArgs>,
  outputSchema: AutomationRuleOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update rule name",
      description: "Change the name of an automation rule",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH",
        name: "Updated rule name"
      }
    },
    {
      name: "Disable rule temporarily",
      description: "Disable an automation rule without deleting it",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH",
        enabled: false
      }
    }
  ]
};

export const deleteAutomationRuleTool: ToolDefinition<DeleteAutomationRuleArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_automation_rule",
  title: "Delete Automation Rule",
  description: "Delete an automation rule from a project",
  schema: deleteAutomationRuleSchema as unknown as ToolSchema<DeleteAutomationRuleArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Delete rule",
      description: "Remove an automation rule from a project",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const getAutomationRuleTool: ToolDefinition<GetAutomationRuleArgs, z.infer<typeof AutomationRuleOutputSchema>> = {
  name: "get_automation_rule",
  title: "Get Automation Rule",
  description: "Get details of a specific automation rule",
  schema: getAutomationRuleSchema as unknown as ToolSchema<GetAutomationRuleArgs>,
  outputSchema: AutomationRuleOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get rule details",
      description: "Retrieve details of an automation rule",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const listAutomationRulesTool: ToolDefinition<ListAutomationRulesArgs, z.infer<typeof AutomationRuleListOutputSchema>> = {
  name: "list_automation_rules",
  title: "List Automation Rules",
  description: "List all automation rules for a GitHub project",
  schema: listAutomationRulesSchema as unknown as ToolSchema<ListAutomationRulesArgs>,
  outputSchema: AutomationRuleListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List project rules",
      description: "Get all automation rules for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const enableAutomationRuleTool: ToolDefinition<EnableAutomationRuleArgs, z.infer<typeof AutomationRuleOutputSchema>> = {
  name: "enable_automation_rule",
  title: "Enable Automation Rule",
  description: "Enable a disabled automation rule",
  schema: enableAutomationRuleSchema as unknown as ToolSchema<EnableAutomationRuleArgs>,
  outputSchema: AutomationRuleOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Enable rule",
      description: "Re-enable a disabled automation rule",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const disableAutomationRuleTool: ToolDefinition<DisableAutomationRuleArgs, z.infer<typeof AutomationRuleOutputSchema>> = {
  name: "disable_automation_rule",
  title: "Disable Automation Rule",
  description: "Disable an automation rule without deleting it",
  schema: disableAutomationRuleSchema as unknown as ToolSchema<DisableAutomationRuleArgs>,
  outputSchema: AutomationRuleOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Disable rule",
      description: "Temporarily disable an automation rule",
      args: {
        ruleId: "AR_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

// ============================================================================
// Iteration Management Tool Definitions
// ============================================================================

export const getIterationConfigurationTool: ToolDefinition<GetIterationConfigurationArgs, z.infer<typeof IterationConfigOutputSchema>> = {
  name: "get_iteration_configuration",
  title: "Get Iteration Configuration",
  description: "Get iteration field configuration including duration, start date, and list of all iterations",
  schema: getIterationConfigurationSchema as unknown as ToolSchema<GetIterationConfigurationArgs>,
  outputSchema: IterationConfigOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get iteration config",
      description: "Get all iterations for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const getCurrentIterationTool: ToolDefinition<GetCurrentIterationArgs, z.infer<typeof IterationOutputSchema>> = {
  name: "get_current_iteration",
  title: "Get Current Iteration",
  description: "Get the currently active iteration based on today's date",
  schema: getCurrentIterationSchema as unknown as ToolSchema<GetCurrentIterationArgs>,
  outputSchema: IterationOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get current sprint",
      description: "Find which iteration is currently active",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const getIterationItemsTool: ToolDefinition<GetIterationItemsArgs, z.infer<typeof IterationItemsOutputSchema>> = {
  name: "get_iteration_items",
  title: "Get Iteration Items",
  description: "Get all items assigned to a specific iteration",
  schema: getIterationItemsSchema as unknown as ToolSchema<GetIterationItemsArgs>,
  outputSchema: IterationItemsOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get iteration items",
      description: "Get all issues/PRs in an iteration",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        iterationId: "PVTIF_lADOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const getIterationByDateTool: ToolDefinition<GetIterationByDateArgs, z.infer<typeof IterationOutputSchema>> = {
  name: "get_iteration_by_date",
  title: "Get Iteration by Date",
  description: "Find which iteration contains a specific date",
  schema: getIterationByDateSchema as unknown as ToolSchema<GetIterationByDateArgs>,
  outputSchema: IterationOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Find iteration",
      description: "Find which iteration contains a specific date",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        date: "2025-01-15T00:00:00Z"
      }
    }
  ]
};

export const assignItemsToIterationTool: ToolDefinition<AssignItemsToIterationArgs, z.infer<typeof BulkOperationResultSchema>> = {
  name: "assign_items_to_iteration",
  title: "Assign Items to Iteration",
  description: "Bulk assign multiple items to a specific iteration",
  schema: assignItemsToIterationSchema as unknown as ToolSchema<AssignItemsToIterationArgs>,
  outputSchema: BulkOperationResultSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Assign to sprint",
      description: "Add multiple issues to the current sprint",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemIds: ["PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7", "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ8"],
        iterationId: "PVTIF_lADOLhQ7gc4AOEbH"
      }
    }
  ]
};
