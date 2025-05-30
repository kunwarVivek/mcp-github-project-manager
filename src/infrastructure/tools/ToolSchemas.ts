import { z } from "zod";
import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
// Import AI tools
import { addFeatureTool, executeAddFeature } from "./ai-tasks/AddFeatureTool.js";
import { generatePRDTool, executeGeneratePRD } from "./ai-tasks/GeneratePRDTool.js";
import { parsePRDTool, executeParsePRD } from "./ai-tasks/ParsePRDTool.js";
import { getNextTaskTool, executeGetNextTask } from "./ai-tasks/GetNextTaskTool.js";
import { analyzeTaskComplexityTool, executeAnalyzeTaskComplexity } from "./ai-tasks/AnalyzeTaskComplexityTool.js";
import { expandTaskTool, executeExpandTask } from "./ai-tasks/ExpandTaskTool.js";
import { enhancePRDTool, executeEnhancePRD } from "./ai-tasks/EnhancePRDTool.js";
import { createTraceabilityMatrixTool, executeCreateTraceabilityMatrix } from "./ai-tasks/CreateTraceabilityMatrixTool.js";

// Schema for create_roadmap tool
export const createRoadmapSchema = z.object({
  project: z.object({
    title: z.string().min(1, "Project title is required"),
    shortDescription: z.string().optional(),
    visibility: z.enum(["private", "public"]),
  }),
  milestones: z.array(
    z.object({
      milestone: z.object({
        title: z.string().min(1, "Milestone title is required"),
        description: z.string().min(1, "Milestone description is required"),
        dueDate: z.string().datetime("Due date must be a valid ISO date string").optional(),
      }),
      issues: z.array(
        z.object({
          title: z.string().min(1, "Issue title is required"),
          description: z.string().min(1, "Issue description is required"),
          priority: z.enum(["high", "medium", "low"]).default("medium"),
          type: z.enum(["bug", "feature", "enhancement", "documentation"]).default("feature"),
          assignees: z.array(z.string()),
          labels: z.array(z.string()),
        })
      ).optional().default([]),
    })
  ),
});

export type CreateRoadmapArgs = z.infer<typeof createRoadmapSchema>;

// Schema for plan_sprint tool
export const planSprintSchema = z.object({
  sprint: z.object({
    title: z.string().min(1, "Sprint title is required"),
    startDate: z.string().datetime("Start date must be a valid ISO date string"),
    endDate: z.string().datetime("End date must be a valid ISO date string"),
    goals: z.array(z.string()),
  }),
  issueIds: z.array(z.string()),
});

export type PlanSprintArgs = z.infer<typeof planSprintSchema>;

// Schema for get_milestone_metrics tool
export const getMilestoneMetricsSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
  includeIssues: z.boolean(),
});

export type GetMilestoneMetricsArgs = z.infer<typeof getMilestoneMetricsSchema>;

// Schema for get_sprint_metrics tool
export const getSprintMetricsSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  includeIssues: z.boolean(),
});

export type GetSprintMetricsArgs = z.infer<typeof getSprintMetricsSchema>;

// Schema for get_overdue_milestones tool
export const getOverdueMilestonesSchema = z.object({
  limit: z.number().int().positive(),
  includeIssues: z.boolean(),
});

export type GetOverdueMilestonesArgs = z.infer<typeof getOverdueMilestonesSchema>;

// Schema for get_upcoming_milestones tool
export const getUpcomingMilestonesSchema = z.object({
  daysAhead: z.number().int().positive(),
  limit: z.number().int().positive(),
  includeIssues: z.boolean(),
});

export type GetUpcomingMilestonesArgs = z.infer<typeof getUpcomingMilestonesSchema>;

// Schema for create_project tool
export const createProjectSchema = z.object({
  title: z.string().min(1, "Project title is required"),
  shortDescription: z.string().optional(),
  owner: z.string().min(1, "Project owner is required"),
  visibility: z.enum(["private", "public"]).default("private"),
});

export type CreateProjectArgs = z.infer<typeof createProjectSchema>;

// Schema for list_projects tool
export const listProjectsSchema = z.object({
  status: z.enum(["active", "closed", "all"]).default("active"),
  limit: z.number().int().positive().default(10).optional(),
});

export type ListProjectsArgs = z.infer<typeof listProjectsSchema>;

// Schema for get_project tool
export const getProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type GetProjectArgs = z.infer<typeof getProjectSchema>;

// Schema for create_milestone tool
export const createMilestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().min(1, "Milestone description is required"),
  dueDate: z.string().datetime("Due date must be a valid ISO date string").optional(),
});

export type CreateMilestoneArgs = z.infer<typeof createMilestoneSchema>;

// Schema for list_milestones tool
export const listMilestonesSchema = z.object({
  status: z.enum(["open", "closed", "all"]).default("open"),
  sort: z.enum(["due_date", "title", "created_at"]).default("created_at").optional(),
  direction: z.enum(["asc", "desc"]).default("asc").optional(),
});

export type ListMilestonesArgs = z.infer<typeof listMilestonesSchema>;

// Schema for create_issue tool
export const createIssueSchema = z.object({
  title: z.string().min(1, "Issue title is required"),
  description: z.string().min(1, "Issue description is required"),
  milestoneId: z.string().optional(),
  assignees: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  priority: z.enum(["high", "medium", "low"]).default("medium").optional(),
  type: z.enum(["bug", "feature", "enhancement", "documentation"]).default("feature").optional(),
});

export type CreateIssueArgs = z.infer<typeof createIssueSchema>;

// Schema for list_issues tool
export const listIssuesSchema = z.object({
  status: z.enum(["open", "closed", "all"]).default("open"),
  milestone: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  sort: z.enum(["created", "updated", "comments"]).default("created").optional(),
  direction: z.enum(["asc", "desc"]).default("desc").optional(),
  limit: z.number().int().positive().default(30).optional(),
});

export type ListIssuesArgs = z.infer<typeof listIssuesSchema>;

// Schema for get_issue tool
export const getIssueSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
});

export type GetIssueArgs = z.infer<typeof getIssueSchema>;

// Schema for update_issue tool
export const updateIssueSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["open", "closed"]).optional(),
  milestoneId: z.string().optional().nullable(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
});

export type UpdateIssueArgs = z.infer<typeof updateIssueSchema>;

// Schema for create_sprint tool
export const createSprintSchema = z.object({
  title: z.string().min(1, "Sprint title is required"),
  description: z.string().min(1, "Sprint description is required"),
  startDate: z.string().datetime("Start date must be a valid ISO date string"),
  endDate: z.string().datetime("End date must be a valid ISO date string"),
  issueIds: z.array(z.string()).default([]),
});

export type CreateSprintArgs = z.infer<typeof createSprintSchema>;

// Schema for list_sprints tool
export const listSprintsSchema = z.object({
  status: z.enum(["planned", "active", "completed", "all"]).default("all"),
});

export type ListSprintsArgs = z.infer<typeof listSprintsSchema>;

// Schema for get_current_sprint tool
export const getCurrentSprintSchema = z.object({
  includeIssues: z.boolean().default(true),
});

export type GetCurrentSprintArgs = z.infer<typeof getCurrentSprintSchema>;

// Schema for create_project_field tool
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

// Schema for create_project_view tool
export const createProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  name: z.string().min(1, "View name is required"),
  layout: z.enum(["board", "table", "timeline", "roadmap"]),
});

export type CreateProjectViewArgs = z.infer<typeof createProjectViewSchema>;

// Tool definitions with schemas, descriptions, and examples
// Project tools
export const createProjectTool: ToolDefinition<CreateProjectArgs> = {
  name: "create_project",
  description: "Create a new GitHub project",
  schema: createProjectSchema as unknown as ToolSchema<CreateProjectArgs>,
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

export const listProjectsTool: ToolDefinition<ListProjectsArgs> = {
  name: "list_projects",
  description: "List GitHub projects",
  schema: listProjectsSchema as unknown as ToolSchema<ListProjectsArgs>,
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

export const getProjectTool: ToolDefinition<GetProjectArgs> = {
  name: "get_project",
  description: "Get details of a specific GitHub project",
  schema: getProjectSchema as unknown as ToolSchema<GetProjectArgs>,
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

// Milestone tools
export const createMilestoneTool: ToolDefinition<CreateMilestoneArgs> = {
  name: "create_milestone",
  description: "Create a new milestone",
  schema: createMilestoneSchema as unknown as ToolSchema<CreateMilestoneArgs>,
  examples: [
    {
      name: "Create milestone with due date",
      description: "Create a milestone with title, description and due date",
      args: {
        title: "Beta Release",
        description: "Complete all features for beta release",
        dueDate: "2025-06-30T00:00:00Z"
      }
    }
  ]
};

export const listMilestonesTool: ToolDefinition<ListMilestonesArgs> = {
  name: "list_milestones",
  description: "List milestones",
  schema: listMilestonesSchema as unknown as ToolSchema<ListMilestonesArgs>,
  examples: [
    {
      name: "List open milestones",
      description: "List all open milestones sorted by due date",
      args: {
        status: "open",
        sort: "due_date",
        direction: "asc"
      }
    }
  ]
};

// Issue tools
export const createIssueTool: ToolDefinition<CreateIssueArgs> = {
  name: "create_issue",
  description: "Create a new GitHub issue",
  schema: createIssueSchema as unknown as ToolSchema<CreateIssueArgs>,
  examples: [
    {
      name: "Create bug issue",
      description: "Create a bug issue with high priority",
      args: {
        title: "Fix authentication bug",
        description: "Users cannot log in with social media accounts",
        priority: "high",
        type: "bug",
        assignees: ["developer1"],
        labels: ["bug", "authentication"]
      }
    }
  ]
};

export const listIssuesTool: ToolDefinition<ListIssuesArgs> = {
  name: "list_issues",
  description: "List GitHub issues",
  schema: listIssuesSchema as unknown as ToolSchema<ListIssuesArgs>,
  examples: [
    {
      name: "List open issues for milestone",
      description: "List open issues assigned to a specific milestone",
      args: {
        status: "open",
        milestone: "1",
        sort: "updated",
        direction: "desc",
        limit: 10
      }
    }
  ]
};

export const getIssueTool: ToolDefinition<GetIssueArgs> = {
  name: "get_issue",
  description: "Get details of a specific GitHub issue",
  schema: getIssueSchema as unknown as ToolSchema<GetIssueArgs>,
  examples: [
    {
      name: "Get issue details",
      description: "Get detailed information about an issue",
      args: {
        issueId: "42"
      }
    }
  ]
};

export const updateIssueTool: ToolDefinition<UpdateIssueArgs> = {
  name: "update_issue",
  description: "Update a GitHub issue",
  schema: updateIssueSchema as unknown as ToolSchema<UpdateIssueArgs>,
  examples: [
    {
      name: "Update issue status and milestone",
      description: "Close an issue and assign it to a milestone",
      args: {
        issueId: "42",
        status: "closed",
        milestoneId: "3"
      }
    }
  ]
};

// Sprint tools
export const createSprintTool: ToolDefinition<CreateSprintArgs> = {
  name: "create_sprint",
  description: "Create a new development sprint",
  schema: createSprintSchema as unknown as ToolSchema<CreateSprintArgs>,
  examples: [
    {
      name: "Create two-week sprint",
      description: "Create a two-week sprint with initial issues",
      args: {
        title: "Sprint 1: User Authentication",
        description: "First sprint focused on user authentication features",
        startDate: "2025-06-01T00:00:00Z",
        endDate: "2025-06-15T00:00:00Z",
        issueIds: ["101", "102", "103"]
      }
    }
  ]
};

export const listSprintsTool: ToolDefinition<ListSprintsArgs> = {
  name: "list_sprints",
  description: "List all sprints",
  schema: listSprintsSchema as unknown as ToolSchema<ListSprintsArgs>,
  examples: [
    {
      name: "List active sprints",
      description: "List all currently active sprints",
      args: {
        status: "active"
      }
    }
  ]
};

export const getCurrentSprintTool: ToolDefinition<GetCurrentSprintArgs> = {
  name: "get_current_sprint",
  description: "Get the currently active sprint",
  schema: getCurrentSprintSchema as unknown as ToolSchema<GetCurrentSprintArgs>,
  examples: [
    {
      name: "Get current sprint with issues",
      description: "Get details of the current sprint including assigned issues",
      args: {
        includeIssues: true
      }
    }
  ]
};

// Project field tools
export const createProjectFieldTool: ToolDefinition<CreateProjectFieldArgs> = {
  name: "create_project_field",
  description: "Create a custom field for a GitHub project",
  schema: createProjectFieldSchema as unknown as ToolSchema<CreateProjectFieldArgs>,
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

// Project view tools
export const createProjectViewTool: ToolDefinition<CreateProjectViewArgs> = {
  name: "create_project_view",
  description: "Create a new view for a GitHub project",
  schema: createProjectViewSchema as unknown as ToolSchema<CreateProjectViewArgs>,
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

// Tool definitions with schemas, descriptions, and examples
export const createRoadmapTool: ToolDefinition<CreateRoadmapArgs> = {
  name: "create_roadmap",
  description: "Create a project roadmap with milestones and tasks",
  schema: createRoadmapSchema as unknown as ToolSchema<CreateRoadmapArgs>,
  examples: [
    {
      name: "Simple project roadmap",
      description: "Create a basic project with two milestones",
      args: {
        project: {
          title: "New Mobile App",
          shortDescription: "Develop a new mobile application for our users",
          visibility: "private",
        },
        milestones: [
          {
            milestone: {
              title: "Design Phase",
              description: "Complete all design work for the mobile app",
              dueDate: "2025-05-01T00:00:00Z",
            },
            issues: [
              {
                title: "Create wireframes",
                description: "Create wireframes for all app screens",
                priority: "high",
                type: "feature",
                assignees: ["designer1"],
                labels: ["design", "ui"],
              },
              {
                title: "Design system",
                description: "Develop a consistent design system",
                priority: "medium",
                type: "feature",
                assignees: [],
                labels: ["design"],
              },
            ],
          },
          {
            milestone: {
              title: "Development Phase",
              description: "Implement the designed features",
              dueDate: "2025-06-15T00:00:00Z",
            },
            issues: [
              {
                title: "User authentication",
                description: "Implement user login and registration",
                priority: "high",
                type: "feature",
                assignees: ["developer1"],
                labels: ["auth", "backend"],
              },
            ],
          },
        ],
      },
    },
  ],
};

export const planSprintTool: ToolDefinition<PlanSprintArgs> = {
  name: "plan_sprint",
  description: "Plan a new sprint with selected issues",
  schema: planSprintSchema as unknown as ToolSchema<PlanSprintArgs>,
  examples: [
    {
      name: "Two-week sprint",
      description: "Plan a two-week sprint with specific issues",
      args: {
        sprint: {
          title: "Sprint 1: Authentication and Onboarding",
          startDate: "2025-05-01T00:00:00Z",
          endDate: "2025-05-15T00:00:00Z",
          goals: [
            "Complete user authentication flow",
            "Implement onboarding screens",
          ],
        },
        issueIds: ["1", "2", "3", "5"],
      },
    },
  ],
};

export const getMilestoneMetricsTool: ToolDefinition<GetMilestoneMetricsArgs> = {
  name: "get_milestone_metrics",
  description: "Get progress metrics for a specific milestone",
  schema: getMilestoneMetricsSchema as unknown as ToolSchema<GetMilestoneMetricsArgs>,
  examples: [
    {
      name: "Get milestone progress",
      description: "Get progress metrics for milestone #2",
      args: {
        milestoneId: "2",
        includeIssues: true,
      },
    },
  ],
};

export const getSprintMetricsTool: ToolDefinition<GetSprintMetricsArgs> = {
  name: "get_sprint_metrics",
  description: "Get progress metrics for a specific sprint",
  schema: getSprintMetricsSchema as unknown as ToolSchema<GetSprintMetricsArgs>,
  examples: [
    {
      name: "Get sprint progress",
      description: "Get progress metrics for sprint 'sprint_1'",
      args: {
        sprintId: "sprint_1",
        includeIssues: true,
      },
    },
  ],
};

export const getOverdueMilestonesTool: ToolDefinition<GetOverdueMilestonesArgs> = {
  name: "get_overdue_milestones",
  description: "Get a list of overdue milestones",
  schema: getOverdueMilestonesSchema as unknown as ToolSchema<GetOverdueMilestonesArgs>,
  examples: [
    {
      name: "List overdue milestones",
      description: "Get the top 5 overdue milestones",
      args: {
        limit: 5,
        includeIssues: false,
      },
    },
  ],
};

export const getUpcomingMilestonesTool: ToolDefinition<GetUpcomingMilestonesArgs> = {
  name: "get_upcoming_milestones",
  description: "Get a list of upcoming milestones within a time frame",
  schema: getUpcomingMilestonesSchema as unknown as ToolSchema<GetUpcomingMilestonesArgs>,
  examples: [
    {
      name: "List upcoming milestones",
      description: "Get milestones due in the next 14 days",
      args: {
        daysAhead: 14,
        limit: 10,
        includeIssues: true,
      },
    },
  ],
};

// Schema for update_project tool
export const updateProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
  status: z.enum(["active", "closed"]).optional(),
});

export type UpdateProjectArgs = z.infer<typeof updateProjectSchema>;

// Schema for delete_project tool
export const deleteProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type DeleteProjectArgs = z.infer<typeof deleteProjectSchema>;

// Schema for list_project_fields tool
export const listProjectFieldsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type ListProjectFieldsArgs = z.infer<typeof listProjectFieldsSchema>;

// Schema for update_project_field tool
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

// Schema for add_project_item tool
export const addProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  contentId: z.string().min(1, "Content ID is required"),
  contentType: z.enum(["issue", "pull_request"]),
});

export type AddProjectItemArgs = z.infer<typeof addProjectItemSchema>;

// Schema for remove_project_item tool
export const removeProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type RemoveProjectItemArgs = z.infer<typeof removeProjectItemSchema>;

// Schema for list_project_items tool
export const listProjectItemsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  limit: z.number().int().positive().default(50).optional(),
});

export type ListProjectItemsArgs = z.infer<typeof listProjectItemsSchema>;

// Schema for set_field_value tool
export const setFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
  value: z.any(),
});

export type SetFieldValueArgs = z.infer<typeof setFieldValueSchema>;

// Schema for get_field_value tool
export const getFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
});

export type GetFieldValueArgs = z.infer<typeof getFieldValueSchema>;

// Schema for list_project_views tool
export const listProjectViewsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type ListProjectViewsArgs = z.infer<typeof listProjectViewsSchema>;

// Schema for update_project_view tool
export const updateProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  viewId: z.string().min(1, "View ID is required"),
  name: z.string().optional(),
  layout: z.enum(["board", "table", "timeline", "roadmap"]).optional(),
});

export type UpdateProjectViewArgs = z.infer<typeof updateProjectViewSchema>;

// Schema for update_milestone tool
export const updateMilestoneSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  state: z.enum(["open", "closed"]).optional(),
});

export type UpdateMilestoneArgs = z.infer<typeof updateMilestoneSchema>;

// Schema for delete_milestone tool
export const deleteMilestoneSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
});

export type DeleteMilestoneArgs = z.infer<typeof deleteMilestoneSchema>;

// Schema for update_sprint tool
export const updateSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["planned", "active", "completed"]).optional(),
});

export type UpdateSprintArgs = z.infer<typeof updateSprintSchema>;

// Schema for add_issues_to_sprint tool
export const addIssuesToSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  issueIds: z.array(z.string()).min(1, "At least one issue ID is required"),
});

export type AddIssuesToSprintArgs = z.infer<typeof addIssuesToSprintSchema>;

// Schema for remove_issues_from_sprint tool
export const removeIssuesFromSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  issueIds: z.array(z.string()).min(1, "At least one issue ID is required"),
});

export type RemoveIssuesFromSprintArgs = z.infer<typeof removeIssuesFromSprintSchema>;

// Schema for create_label tool
export const createLabelSchema = z.object({
  name: z.string().min(1, "Label name is required"),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/, "Color must be a valid 6-digit hex color code without #"),
  description: z.string().optional(),
});

export type CreateLabelArgs = z.infer<typeof createLabelSchema>;

// Schema for list_labels tool
export const listLabelsSchema = z.object({
  limit: z.number().int().positive().default(100).optional(),
});

export type ListLabelsArgs = z.infer<typeof listLabelsSchema>;

// Project tools
export const updateProjectTool: ToolDefinition<UpdateProjectArgs> = {
  name: "update_project",
  description: "Update an existing GitHub project",
  schema: updateProjectSchema as unknown as ToolSchema<UpdateProjectArgs>,
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

export const deleteProjectTool: ToolDefinition<DeleteProjectArgs> = {
  name: "delete_project",
  description: "Delete a GitHub project",
  schema: deleteProjectSchema as unknown as ToolSchema<DeleteProjectArgs>,
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

export const listProjectFieldsTool: ToolDefinition<ListProjectFieldsArgs> = {
  name: "list_project_fields",
  description: "List all fields in a GitHub project",
  schema: listProjectFieldsSchema as unknown as ToolSchema<ListProjectFieldsArgs>,
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

export const updateProjectFieldTool: ToolDefinition<UpdateProjectFieldArgs> = {
  name: "update_project_field",
  description: "Update a custom field in a GitHub project",
  schema: updateProjectFieldSchema as unknown as ToolSchema<UpdateProjectFieldArgs>,
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

export const addProjectItemTool: ToolDefinition<AddProjectItemArgs> = {
  name: "add_project_item",
  description: "Add an item to a GitHub project",
  schema: addProjectItemSchema as unknown as ToolSchema<AddProjectItemArgs>,
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

export const removeProjectItemTool: ToolDefinition<RemoveProjectItemArgs> = {
  name: "remove_project_item",
  description: "Remove an item from a GitHub project",
  schema: removeProjectItemSchema as unknown as ToolSchema<RemoveProjectItemArgs>,
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

export const listProjectItemsTool: ToolDefinition<ListProjectItemsArgs> = {
  name: "list_project_items",
  description: "List all items in a GitHub project",
  schema: listProjectItemsSchema as unknown as ToolSchema<ListProjectItemsArgs>,
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

export const setFieldValueTool: ToolDefinition<SetFieldValueArgs> = {
  name: "set_field_value",
  description: "Set a field value for a GitHub project item. Supports all field types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, MILESTONE, ASSIGNEES, LABELS",
  schema: setFieldValueSchema as unknown as ToolSchema<SetFieldValueArgs>,
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

export const getFieldValueTool: ToolDefinition<GetFieldValueArgs> = {
  name: "get_field_value",
  description: "Get a field value for a GitHub project item. Supports reading all field types: TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, MILESTONE, ASSIGNEES, LABELS",
  schema: getFieldValueSchema as unknown as ToolSchema<GetFieldValueArgs>,
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

export const listProjectViewsTool: ToolDefinition<ListProjectViewsArgs> = {
  name: "list_project_views",
  description: "List all views in a GitHub project",
  schema: listProjectViewsSchema as unknown as ToolSchema<ListProjectViewsArgs>,
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

export const updateProjectViewTool: ToolDefinition<UpdateProjectViewArgs> = {
  name: "update_project_view",
  description: "Update a view in a GitHub project",
  schema: updateProjectViewSchema as unknown as ToolSchema<UpdateProjectViewArgs>,
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

export const updateMilestoneTool: ToolDefinition<UpdateMilestoneArgs> = {
  name: "update_milestone",
  description: "Update a GitHub milestone",
  schema: updateMilestoneSchema as unknown as ToolSchema<UpdateMilestoneArgs>,
  examples: [
    {
      name: "Update milestone due date",
      description: "Change a milestone's title and due date",
      args: {
        milestoneId: "42",
        title: "Updated Release",
        dueDate: "2025-08-15T00:00:00Z"
      }
    },
    {
      name: "Close milestone",
      description: "Mark a milestone as closed",
      args: {
        milestoneId: "42",
        state: "closed"
      }
    }
  ]
};

export const deleteMilestoneTool: ToolDefinition<DeleteMilestoneArgs> = {
  name: "delete_milestone",
  description: "Delete a GitHub milestone",
  schema: deleteMilestoneSchema as unknown as ToolSchema<DeleteMilestoneArgs>,
  examples: [
    {
      name: "Delete milestone",
      description: "Delete a milestone by ID",
      args: {
        milestoneId: "42"
      }
    }
  ]
};

export const updateSprintTool: ToolDefinition<UpdateSprintArgs> = {
  name: "update_sprint",
  description: "Update a development sprint",
  schema: updateSprintSchema as unknown as ToolSchema<UpdateSprintArgs>,
  examples: [
    {
      name: "Update sprint dates",
      description: "Update sprint dates and status",
      args: {
        sprintId: "sprint_1",
        startDate: "2025-07-01T00:00:00Z",
        endDate: "2025-07-15T00:00:00Z",
        status: "active"
      }
    }
  ]
};

export const addIssuesToSprintTool: ToolDefinition<AddIssuesToSprintArgs> = {
  name: "add_issues_to_sprint",
  description: "Add issues to an existing sprint",
  schema: addIssuesToSprintSchema as unknown as ToolSchema<AddIssuesToSprintArgs>,
  examples: [
    {
      name: "Add issues to sprint",
      description: "Add multiple issues to an existing sprint",
      args: {
        sprintId: "sprint_1",
        issueIds: ["123", "124", "125"]
      }
    }
  ]
};

export const removeIssuesFromSprintTool: ToolDefinition<RemoveIssuesFromSprintArgs> = {
  name: "remove_issues_from_sprint",
  description: "Remove issues from a sprint",
  schema: removeIssuesFromSprintSchema as unknown as ToolSchema<RemoveIssuesFromSprintArgs>,
  examples: [
    {
      name: "Remove issues from sprint",
      description: "Remove issues that are no longer in scope for the sprint",
      args: {
        sprintId: "sprint_1",
        issueIds: ["124", "125"]
      }
    }
  ]
};

export const createLabelTool: ToolDefinition<CreateLabelArgs> = {
  name: "create_label",
  description: "Create a new GitHub label",
  schema: createLabelSchema as unknown as ToolSchema<CreateLabelArgs>,
  examples: [
    {
      name: "Create bug label",
      description: "Create a red bug label",
      args: {
        name: "bug",
        color: "ff0000",
        description: "Something isn't working"
      }
    }
  ]
};

export const listLabelsTool: ToolDefinition<ListLabelsArgs> = {
  name: "list_labels",
  description: "List all GitHub labels",
  schema: listLabelsSchema as unknown as ToolSchema<ListLabelsArgs>,
  examples: [
    {
      name: "List all labels",
      description: "Get all repository labels",
      args: {
        limit: 50
      }
    }
  ]
};

// Event management schemas
export const subscribeToEventsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  filters: z.array(
    z.object({
      resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
      eventType: z.enum(["created", "updated", "deleted", "closed", "reopened"]).optional(),
      resourceId: z.string().optional(),
      source: z.enum(["github", "api"]).optional(),
      tags: z.array(z.string()).optional(),
    })
  ).default([]),
  transport: z.enum(["sse", "webhook", "internal"]).default("sse"),
  endpoint: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type SubscribeToEventsArgs = z.infer<typeof subscribeToEventsSchema>;

export const getRecentEventsSchema = z.object({
  resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
  resourceId: z.string().optional(),
  eventType: z.enum(["created", "updated", "deleted", "closed", "reopened"]).optional(),
  limit: z.number().int().positive().default(100).optional(),
});

export type GetRecentEventsArgs = z.infer<typeof getRecentEventsSchema>;

export const replayEventsSchema = z.object({
  fromTimestamp: z.string().datetime("From timestamp must be a valid ISO date string"),
  toTimestamp: z.string().datetime().optional(),
  resourceType: z.enum(["PROJECT", "MILESTONE", "ISSUE", "SPRINT"]).optional(),
  resourceId: z.string().optional(),
  limit: z.number().int().positive().default(1000).optional(),
});

export type ReplayEventsArgs = z.infer<typeof replayEventsSchema>;

// Event management tool definitions
export const subscribeToEventsTool: ToolDefinition<SubscribeToEventsArgs> = {
  name: "subscribe_to_events",
  description: "Subscribe to real-time events for GitHub resources",
  schema: subscribeToEventsSchema as unknown as ToolSchema<SubscribeToEventsArgs>,
  examples: [
    {
      name: "Subscribe to all project events",
      description: "Subscribe to all events for projects",
      args: {
        clientId: "my-client",
        filters: [{ resourceType: "PROJECT" }],
        transport: "sse"
      }
    },
    {
      name: "Subscribe to issue updates",
      description: "Subscribe to update events for a specific issue",
      args: {
        clientId: "my-client",
        filters: [{ resourceType: "ISSUE", eventType: "updated", resourceId: "123" }],
        transport: "sse"
      }
    }
  ]
};

export const getRecentEventsTool: ToolDefinition<GetRecentEventsArgs> = {
  name: "get_recent_events",
  description: "Get recent events for GitHub resources",
  schema: getRecentEventsSchema as unknown as ToolSchema<GetRecentEventsArgs>,
  examples: [
    {
      name: "Get recent project events",
      description: "Get the last 50 events for projects",
      args: {
        resourceType: "PROJECT",
        limit: 50
      }
    },
    {
      name: "Get recent events for specific issue",
      description: "Get recent events for a specific issue",
      args: {
        resourceType: "ISSUE",
        resourceId: "123",
        limit: 20
      }
    }
  ]
};

export const replayEventsTool: ToolDefinition<ReplayEventsArgs> = {
  name: "replay_events",
  description: "Replay events from a specific timestamp",
  schema: replayEventsSchema as unknown as ToolSchema<ReplayEventsArgs>,
  examples: [
    {
      name: "Replay events from yesterday",
      description: "Replay all events from yesterday",
      args: {
        fromTimestamp: "2025-01-01T00:00:00Z",
        limit: 500
      }
    },
    {
      name: "Replay project events from specific time",
      description: "Replay project events from a specific timestamp",
      args: {
        fromTimestamp: "2025-01-01T12:00:00Z",
        resourceType: "PROJECT",
        limit: 100
      }
    }
  ]
};

// ============================================================================
// AI Task Management Tools
// ============================================================================

// Re-export AI tools
export { addFeatureTool, executeAddFeature };
export { generatePRDTool, executeGeneratePRD };
export { parsePRDTool, executeParsePRD };
export { getNextTaskTool, executeGetNextTask };
export { analyzeTaskComplexityTool, executeAnalyzeTaskComplexity };
export { expandTaskTool, executeExpandTask };
export { enhancePRDTool, executeEnhancePRD };
export { createTraceabilityMatrixTool, executeCreateTraceabilityMatrix };