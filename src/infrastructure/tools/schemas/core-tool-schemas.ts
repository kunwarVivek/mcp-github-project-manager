import { z } from "zod";
import { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  ProjectOutputSchema,
  ProjectListOutputSchema,
  ProjectReadmeOutputSchema,
  ProjectFieldOutputSchema,
  ProjectFieldListOutputSchema,
  ProjectViewOutputSchema,
  ProjectViewListOutputSchema,
  ProjectItemListOutputSchema,
  ProjectItemAddOutputSchema,
  FieldValueOutputSchema,
  SuccessOutputSchema,
  DeleteOutputSchema,
} from "./project-schemas";

// ============================================================================
// Project CRUD Schemas
// ============================================================================

export const createProjectSchema = z.object({
  title: z.string().min(1, "Project title is required"),
  shortDescription: z.string().optional(),
  owner: z.string().min(1, "Project owner is required"),
  visibility: z.enum(["private", "public"]).default("private"),
});

export type CreateProjectArgs = z.infer<typeof createProjectSchema>;

export const listProjectsSchema = z.object({
  status: z.enum(["active", "closed", "all"]).default("active"),
  limit: z.number().int().positive().default(10).optional(),
});

export type ListProjectsArgs = z.infer<typeof listProjectsSchema>;

export const getProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type GetProjectArgs = z.infer<typeof getProjectSchema>;

export const updateProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  status: z.enum(["active", "closed"]).optional(),
});

export type UpdateProjectArgs = z.infer<typeof updateProjectSchema>;

export const deleteProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type DeleteProjectArgs = z.infer<typeof deleteProjectSchema>;

// ============================================================================
// Project README Schemas
// ============================================================================

export const getProjectReadmeSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type GetProjectReadmeArgs = z.infer<typeof getProjectReadmeSchema>;

export const updateProjectReadmeSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  readme: z.string().min(1, "README content is required"),
});

export type UpdateProjectReadmeArgs = z.infer<typeof updateProjectReadmeSchema>;

// ============================================================================
// Project Field Schemas
// ============================================================================

export const createProjectFieldSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "Field name is required"),
  type: z.enum([
    "text",
    "number",
    "date",
    "single_select",
    "iteration",
    "milestone",
    "assignees",
    "labels"
  ]),
  options: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional(),
    })
  ).optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export type CreateProjectFieldArgs = z.infer<typeof createProjectFieldSchema>;

export const listProjectFieldsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type ListProjectFieldsArgs = z.infer<typeof listProjectFieldsSchema>;

export const updateProjectFieldSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().optional(),
    })
  ).optional(),
  required: z.boolean().optional(),
});

export type UpdateProjectFieldArgs = z.infer<typeof updateProjectFieldSchema>;

// ============================================================================
// Project View Schemas
// ============================================================================

export const createProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "View name is required"),
  layout: z.enum(["board", "table", "timeline", "roadmap"]),
});

export type CreateProjectViewArgs = z.infer<typeof createProjectViewSchema>;

export const listProjectViewsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type ListProjectViewsArgs = z.infer<typeof listProjectViewsSchema>;

export const updateProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  viewId: z.string().min(1, "View ID is required"),
  name: z.string().optional(),
  layout: z.enum(["board", "table", "timeline", "roadmap"]).optional(),
});

export type UpdateProjectViewArgs = z.infer<typeof updateProjectViewSchema>;

export const deleteProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  viewId: z.string().min(1, "View ID is required"),
});

export type DeleteProjectViewArgs = z.infer<typeof deleteProjectViewSchema>;

// ============================================================================
// Project Item Schemas
// ============================================================================

export const addProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  contentId: z.string().min(1, "Content ID is required"),
  contentType: z.enum(["issue", "pull_request"]),
});

export type AddProjectItemArgs = z.infer<typeof addProjectItemSchema>;

export const removeProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type RemoveProjectItemArgs = z.infer<typeof removeProjectItemSchema>;

export const listProjectItemsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  limit: z.number().int().positive().default(50).optional(),
});

export type ListProjectItemsArgs = z.infer<typeof listProjectItemsSchema>;

export const archiveProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type ArchiveProjectItemArgs = z.infer<typeof archiveProjectItemSchema>;

export const unarchiveProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type UnarchiveProjectItemArgs = z.infer<typeof unarchiveProjectItemSchema>;

// ============================================================================
// Field Value Schemas
// ============================================================================

export const setFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
  value: z.any(),
});

export type SetFieldValueArgs = z.infer<typeof setFieldValueSchema>;

export const getFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
});

export type GetFieldValueArgs = z.infer<typeof getFieldValueSchema>;

export const clearFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
});

export type ClearFieldValueArgs = z.infer<typeof clearFieldValueSchema>;

// ============================================================================
// Project CRUD Tool Definitions
// ============================================================================

export const createProjectTool: ToolDefinition<CreateProjectArgs, z.infer<typeof ProjectOutputSchema>> = {
  name: "create_project",
  title: "Create Project",
  description: "Create a new GitHub project",
  schema: createProjectSchema as unknown as ToolSchema<CreateProjectArgs>,
  outputSchema: ProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create private project",
      description: "Create a new private GitHub project",
      args: {
        title: "Backend API Development",
        shortDescription: "Project for tracking backend API development tasks",
        owner: "example-owner",
        visibility: "private"
      }
    }
  ]
};

export const listProjectsTool: ToolDefinition<ListProjectsArgs, z.infer<typeof ProjectListOutputSchema>> = {
  name: "list_projects",
  title: "List Projects",
  description: "List GitHub projects",
  schema: listProjectsSchema as unknown as ToolSchema<ListProjectsArgs>,
  outputSchema: ProjectListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List active projects",
      description: "List all active GitHub projects",
      args: {
        status: "active",
        limit: 5
      }
    }
  ]
};

export const getProjectTool: ToolDefinition<GetProjectArgs, z.infer<typeof ProjectOutputSchema>> = {
  name: "get_project",
  title: "Get Project",
  description: "Get details of a specific GitHub project",
  schema: getProjectSchema as unknown as ToolSchema<GetProjectArgs>,
  outputSchema: ProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get project details",
      description: "Get details for a specific project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const updateProjectTool: ToolDefinition<UpdateProjectArgs, z.infer<typeof ProjectOutputSchema>> = {
  name: "update_project",
  title: "Update Project",
  description: "Update an existing GitHub project",
  schema: updateProjectSchema as unknown as ToolSchema<UpdateProjectArgs>,
  outputSchema: ProjectOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update project title and visibility",
      description: "Change a project's title and make it public",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        title: "Updated API Development",
        visibility: "public"
      }
    },
    {
      name: "Close a project",
      description: "Mark a project as closed",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        status: "closed"
      }
    }
  ]
};

export const deleteProjectTool: ToolDefinition<DeleteProjectArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_project",
  title: "Delete Project",
  description: "Delete a GitHub project",
  schema: deleteProjectSchema as unknown as ToolSchema<DeleteProjectArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Delete project",
      description: "Delete a GitHub project by ID",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

// ============================================================================
// README Tool Definitions
// ============================================================================

export const getProjectReadmeTool: ToolDefinition<GetProjectReadmeArgs, z.infer<typeof ProjectReadmeOutputSchema>> = {
  name: "get_project_readme",
  title: "Get Project README",
  description: "Get the README content of a GitHub project",
  schema: getProjectReadmeSchema as unknown as ToolSchema<GetProjectReadmeArgs>,
  outputSchema: ProjectReadmeOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get project README",
      description: "Retrieve the README for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const updateProjectReadmeTool: ToolDefinition<UpdateProjectReadmeArgs, z.infer<typeof ProjectReadmeOutputSchema>> = {
  name: "update_project_readme",
  title: "Update Project README",
  description: "Update the README content of a GitHub project",
  schema: updateProjectReadmeSchema as unknown as ToolSchema<UpdateProjectReadmeArgs>,
  outputSchema: ProjectReadmeOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Set project README",
      description: "Update the project README with documentation",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        readme: "# Project Overview\n\nThis project tracks our development roadmap..."
      }
    }
  ]
};

// ============================================================================
// Project Field Tool Definitions
// ============================================================================

export const createProjectFieldTool: ToolDefinition<CreateProjectFieldArgs, z.infer<typeof ProjectFieldOutputSchema>> = {
  name: "create_project_field",
  title: "Create Project Field",
  description: "Create a custom field for a GitHub project",
  schema: createProjectFieldSchema as unknown as ToolSchema<CreateProjectFieldArgs>,
  outputSchema: ProjectFieldOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create status field",
      description: "Create a status dropdown field for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "Status",
        type: "single_select",
        options: [
          { name: "To Do", color: "red" },
          { name: "In Progress", color: "yellow" },
          { name: "Done", color: "green" }
        ],
        description: "Current status of the task",
        required: true
      }
    }
  ]
};

export const listProjectFieldsTool: ToolDefinition<ListProjectFieldsArgs, z.infer<typeof ProjectFieldListOutputSchema>> = {
  name: "list_project_fields",
  title: "List Project Fields",
  description: "List all fields in a GitHub project",
  schema: listProjectFieldsSchema as unknown as ToolSchema<ListProjectFieldsArgs>,
  outputSchema: ProjectFieldListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List project fields",
      description: "Get all fields for a specific project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const updateProjectFieldTool: ToolDefinition<UpdateProjectFieldArgs, z.infer<typeof ProjectFieldOutputSchema>> = {
  name: "update_project_field",
  title: "Update Project Field",
  description: "Update a custom field in a GitHub project",
  schema: updateProjectFieldSchema as unknown as ToolSchema<UpdateProjectFieldArgs>,
  outputSchema: ProjectFieldOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update field options",
      description: "Update options for a single-select field",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1",
        name: "Updated Status",
        options: [
          { name: "Not Started", color: "red" },
          { name: "In Progress", color: "yellow" },
          { name: "Review", color: "blue" },
          { name: "Complete", color: "green" }
        ]
      }
    }
  ]
};

// ============================================================================
// Project View Tool Definitions
// ============================================================================

export const createProjectViewTool: ToolDefinition<CreateProjectViewArgs, z.infer<typeof ProjectViewOutputSchema>> = {
  name: "create_project_view",
  title: "Create Project View",
  description: "Create a new view for a GitHub project",
  schema: createProjectViewSchema as unknown as ToolSchema<CreateProjectViewArgs>,
  outputSchema: ProjectViewOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create kanban board view",
      description: "Create a board view for a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        name: "Development Board",
        layout: "board"
      }
    }
  ]
};

export const listProjectViewsTool: ToolDefinition<ListProjectViewsArgs, z.infer<typeof ProjectViewListOutputSchema>> = {
  name: "list_project_views",
  title: "List Project Views",
  description: "List all views in a GitHub project",
  schema: listProjectViewsSchema as unknown as ToolSchema<ListProjectViewsArgs>,
  outputSchema: ProjectViewListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List project views",
      description: "Get all views for a specific project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH"
      }
    }
  ]
};

export const updateProjectViewTool: ToolDefinition<UpdateProjectViewArgs, z.infer<typeof ProjectViewOutputSchema>> = {
  name: "update_project_view",
  title: "Update Project View",
  description: "Update a view in a GitHub project",
  schema: updateProjectViewSchema as unknown as ToolSchema<UpdateProjectViewArgs>,
  outputSchema: ProjectViewOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update view to timeline",
      description: "Change a view's name and layout to timeline",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        viewId: "PVV_lADOLhQ7gc4AOEbHzM4AOAL9",
        name: "Development Timeline",
        layout: "timeline"
      }
    }
  ]
};

export const deleteProjectViewTool: ToolDefinition<DeleteProjectViewArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_project_view",
  title: "Delete Project View",
  description: "Delete a view from a GitHub project",
  schema: deleteProjectViewSchema as unknown as ToolSchema<DeleteProjectViewArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Delete project view",
      description: "Delete a specific view from a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        viewId: "PVV_lADOLhQ7gc4AOEbHzM4AOAL9"
      }
    }
  ]
};

// ============================================================================
// Project Item Tool Definitions
// ============================================================================

export const addProjectItemTool: ToolDefinition<AddProjectItemArgs, z.infer<typeof ProjectItemAddOutputSchema>> = {
  name: "add_project_item",
  title: "Add Project Item",
  description: "Add an item to a GitHub project",
  schema: addProjectItemSchema as unknown as ToolSchema<AddProjectItemArgs>,
  outputSchema: ProjectItemAddOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Add issue to project",
      description: "Add an existing issue to a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        contentId: "I_kwDOJrIzLs5eGXAT",
        contentType: "issue"
      }
    }
  ]
};

export const removeProjectItemTool: ToolDefinition<RemoveProjectItemArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "remove_project_item",
  title: "Remove Project Item",
  description: "Remove an item from a GitHub project",
  schema: removeProjectItemSchema as unknown as ToolSchema<RemoveProjectItemArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Remove item from project",
      description: "Remove an item from a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7"
      }
    }
  ]
};

export const listProjectItemsTool: ToolDefinition<ListProjectItemsArgs, z.infer<typeof ProjectItemListOutputSchema>> = {
  name: "list_project_items",
  title: "List Project Items",
  description: "List all items in a GitHub project",
  schema: listProjectItemsSchema as unknown as ToolSchema<ListProjectItemsArgs>,
  outputSchema: ProjectItemListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List project items",
      description: "Get all items in a project with limit",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        limit: 20
      }
    }
  ]
};

export const archiveProjectItemTool: ToolDefinition<ArchiveProjectItemArgs, z.infer<typeof SuccessOutputSchema>> = {
  name: "archive_project_item",
  title: "Archive Project Item",
  description: "Archive an item in a GitHub project. Archived items are hidden from views but not deleted.",
  schema: archiveProjectItemSchema as unknown as ToolSchema<ArchiveProjectItemArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Archive completed task",
      description: "Archive a project item that is complete",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7"
      }
    }
  ]
};

export const unarchiveProjectItemTool: ToolDefinition<UnarchiveProjectItemArgs, z.infer<typeof SuccessOutputSchema>> = {
  name: "unarchive_project_item",
  title: "Unarchive Project Item",
  description: "Unarchive an item in a GitHub project. Brings back a previously archived item.",
  schema: unarchiveProjectItemSchema as unknown as ToolSchema<UnarchiveProjectItemArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Unarchive task",
      description: "Restore an archived project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7"
      }
    }
  ]
};

// ============================================================================
// Field Value Tool Definitions
// ============================================================================

export const setFieldValueTool: ToolDefinition<SetFieldValueArgs, z.infer<typeof FieldValueOutputSchema>> = {
  name: "set_field_value",
  title: "Set Field Value",
  description: "Set a field value for a GitHub project item. Supports all field types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, MILESTONE, ASSIGNEES, LABELS",
  schema: setFieldValueSchema as unknown as ToolSchema<SetFieldValueArgs>,
  outputSchema: FieldValueOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Set text field value",
      description: "Set a text field value for a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1",
        value: "Updated task description"
      }
    },
    {
      name: "Set number field value",
      description: "Set a number field (e.g., story points) for a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI2",
        value: 8
      }
    },
    {
      name: "Set date field value",
      description: "Set a date field for a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI3",
        value: "2025-06-15"
      }
    },
    {
      name: "Set single select field value",
      description: "Set status field value for a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI4",
        value: "In Progress"
      }
    },
    {
      name: "Set iteration field value",
      description: "Assign a project item to a specific iteration/sprint",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI5",
        value: "PVTI_kwDOLhQ7gc4AOEbHzM4AOAIter1"
      }
    },
    {
      name: "Set milestone field value",
      description: "Assign a project item to a specific milestone",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI6",
        value: "MI_kwDOLhQ7gc4AOEbHzM4AOAMile1"
      }
    },
    {
      name: "Set assignees field value",
      description: "Assign multiple users to a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI7",
        value: ["MDQ6VXNlcjEyMzQ1Njc4", "MDQ6VXNlcjg3NjU0MzIx"]
      }
    },
    {
      name: "Set single assignee field value",
      description: "Assign a single user to a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI7",
        value: "MDQ6VXNlcjEyMzQ1Njc4"
      }
    },
    {
      name: "Set labels field value",
      description: "Assign multiple labels to a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI8",
        value: ["LA_kwDOLhQ7gc4AOEbHzM4AOAL1", "LA_kwDOLhQ7gc4AOEbHzM4AOAL2"]
      }
    },
    {
      name: "Set single label field value",
      description: "Assign a single label to a project item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI8",
        value: "LA_kwDOLhQ7gc4AOEbHzM4AOAL1"
      }
    }
  ]
};

export const getFieldValueTool: ToolDefinition<GetFieldValueArgs, z.infer<typeof FieldValueOutputSchema>> = {
  name: "get_field_value",
  title: "Get Field Value",
  description: "Get a field value for a GitHub project item. Supports reading all field types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, MILESTONE, ASSIGNEES, LABELS",
  schema: getFieldValueSchema as unknown as ToolSchema<GetFieldValueArgs>,
  outputSchema: FieldValueOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get text field value",
      description: "Get the current text value for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1"
      }
    },
    {
      name: "Get status field value",
      description: "Get the current status (single select) value for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI2"
      }
    },
    {
      name: "Get iteration field value",
      description: "Get the current iteration/sprint assignment for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI3"
      }
    },
    {
      name: "Get milestone field value",
      description: "Get the current milestone assignment for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI4"
      }
    },
    {
      name: "Get assignees field value",
      description: "Get the current assignees for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI5"
      }
    },
    {
      name: "Get labels field value",
      description: "Get the current labels for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI6"
      }
    }
  ]
};

export const clearFieldValueTool: ToolDefinition<ClearFieldValueArgs, z.infer<typeof SuccessOutputSchema>> = {
  name: "clear_field_value",
  title: "Clear Field Value",
  description: "Clear a field value for a GitHub project item. This removes/clears the value for any field type.",
  schema: clearFieldValueSchema as unknown as ToolSchema<ClearFieldValueArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Clear status field",
      description: "Clear the status field for an item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI1"
      }
    },
    {
      name: "Clear iteration assignment",
      description: "Remove an item from its current iteration/sprint",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzM4AOAJ7",
        fieldId: "PVTF_lADOLhQ7gc4AOEbHzM4AOAI2"
      }
    }
  ]
};
