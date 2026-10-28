import { z } from "zod";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import type { ToolDefinition, ToolSchema } from "../ToolValidator";
import {
  BulkOperationResultSchema,
  DeleteOutputSchema,
  IterationConfigOutputSchema,
  IterationItemsOutputSchema,
  IterationOutputSchema,
  ProjectWorkflowListOutputSchema,
  ProjectWorkflowOutputSchema,
} from "./project-schemas";

// ============================================================================
// Project Automation Workflow Schemas
// ============================================================================

export const listProjectWorkflowsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type ListProjectWorkflowsArgs = z.infer<typeof listProjectWorkflowsSchema>;

export const getProjectWorkflowSchema = z.object({
  workflowId: z.string().min(1, "Workflow ID is required"),
});

export type GetProjectWorkflowArgs = z.infer<typeof getProjectWorkflowSchema>;

export const deleteProjectWorkflowSchema = z.object({
  workflowId: z.string().min(1, "Workflow ID is required"),
});

export type DeleteProjectWorkflowArgs = z.infer<typeof deleteProjectWorkflowSchema>;

// ============================================================================
// Iteration Management Schemas
// ============================================================================

export const getIterationConfigurationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional(),
});

export type GetIterationConfigurationArgs = z.infer<typeof getIterationConfigurationSchema>;

export const getCurrentIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional(),
});

export type GetCurrentIterationArgs = z.infer<typeof getCurrentIterationSchema>;

export const getIterationItemsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  limit: z.number().int().positive().default(50).optional(),
});

export type GetIterationItemsArgs = z.infer<typeof getIterationItemsSchema>;

export const getIterationByDateSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  date: z.string().datetime("Date must be a valid ISO date string"),
  fieldName: z.string().optional(),
});

export type GetIterationByDateArgs = z.infer<typeof getIterationByDateSchema>;

export const assignItemsToIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  fieldName: z.string().optional(),
});

export type AssignItemsToIterationArgs = z.infer<typeof assignItemsToIterationSchema>;

// ============================================================================
// Project Automation Workflow Tool Definitions
// ============================================================================

export const listProjectWorkflowsTool: ToolDefinition<
  ListProjectWorkflowsArgs,
  z.infer<typeof ProjectWorkflowListOutputSchema>
> = {
  name: "list_project_workflows",
  title: "List Project Workflows",
  description: "List the automation workflows attached to a GitHub project",
  schema: listProjectWorkflowsSchema as unknown as ToolSchema<ListProjectWorkflowsArgs>,
  outputSchema: ProjectWorkflowListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List project workflows",
      description: "Get every automation workflow configured on a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

export const getProjectWorkflowTool: ToolDefinition<
  GetProjectWorkflowArgs,
  z.infer<typeof ProjectWorkflowOutputSchema>
> = {
  name: "get_project_workflow",
  title: "Get Project Workflow",
  description: "Get details of a single project automation workflow",
  schema: getProjectWorkflowSchema as unknown as ToolSchema<GetProjectWorkflowArgs>,
  outputSchema: ProjectWorkflowOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get workflow details",
      description: "Retrieve the name, number and enabled state of a workflow",
      args: {
        workflowId: "PVW_lADOLhQ7gc4AOEbH",
      },
    },
  ],
};

export const deleteProjectWorkflowTool: ToolDefinition<
  DeleteProjectWorkflowArgs,
  z.infer<typeof DeleteOutputSchema>
> = {
  name: "delete_project_workflow",
  title: "Delete Project Workflow",
  description: "Delete an automation workflow from a project",
  schema: deleteProjectWorkflowSchema as unknown as ToolSchema<DeleteProjectWorkflowArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Delete workflow",
      description: "Remove an automation workflow from a project",
      args: {
        workflowId: "PVW_lADOLhQ7gc4AOEbH",
      },
    },
  ],
};

// ============================================================================
// Iteration Management Tool Definitions
// ============================================================================

export const getIterationConfigurationTool: ToolDefinition<
  GetIterationConfigurationArgs,
  z.infer<typeof IterationConfigOutputSchema>
> = {
  name: "get_iteration_configuration",
  title: "Get Iteration Configuration",
  description:
    "Get iteration field configuration including duration, start date, and list of all iterations",
  schema: getIterationConfigurationSchema as unknown as ToolSchema<GetIterationConfigurationArgs>,
  outputSchema: IterationConfigOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get iteration config",
      description: "Get all iterations for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

export const getCurrentIterationTool: ToolDefinition<
  GetCurrentIterationArgs,
  z.infer<typeof IterationOutputSchema>
> = {
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
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

export const getIterationItemsTool: ToolDefinition<
  GetIterationItemsArgs,
  z.infer<typeof IterationItemsOutputSchema>
> = {
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
        iterationId: "PVTIF_lADOLhQ7gc4AOEbH",
      },
    },
  ],
};

export const getIterationByDateTool: ToolDefinition<
  GetIterationByDateArgs,
  z.infer<typeof IterationOutputSchema>
> = {
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
        date: "2025-01-15T00:00:00Z",
      },
    },
  ],
};

export const assignItemsToIterationTool: ToolDefinition<
  AssignItemsToIterationArgs,
  z.infer<typeof BulkOperationResultSchema>
> = {
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
        iterationId: "PVTIF_lADOLhQ7gc4AOEbH",
      },
    },
  ],
};
