import { z } from "zod";
import type { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  MilestoneOutputSchema,
  MilestoneListOutputSchema,
  MilestoneMetricsOutputSchema,
  SprintOutputSchema,
  SprintListOutputSchema,
  SprintMetricsOutputSchema,
  RoadmapOutputSchema,
  LabelOutputSchema,
  LabelListOutputSchema,
  DeleteOutputSchema,
} from "./project-schemas";

// ============================================================================
// Roadmap Schemas
// ============================================================================

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

// ============================================================================
// Sprint Schemas
// ============================================================================

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

export const createSprintSchema = z.object({
  title: z.string().min(1, "Sprint title is required"),
  description: z.string().min(1, "Sprint description is required"),
  startDate: z.string().datetime("Start date must be a valid ISO date string"),
  endDate: z.string().datetime("End date must be a valid ISO date string"),
  issueIds: z.array(z.string()).default([]),
});

export type CreateSprintArgs = z.infer<typeof createSprintSchema>;

export const listSprintsSchema = z.object({
  status: z.enum(["planned", "active", "completed", "all"]).default("all"),
});

export type ListSprintsArgs = z.infer<typeof listSprintsSchema>;

export const getCurrentSprintSchema = z.object({
  includeIssues: z.boolean().default(true),
});

export type GetCurrentSprintArgs = z.infer<typeof getCurrentSprintSchema>;

export const updateSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["planned", "active", "completed"]).optional(),
});

export type UpdateSprintArgs = z.infer<typeof updateSprintSchema>;

export const addIssuesToSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  issueIds: z.array(z.string()).min(1, "At least one issue ID is required"),
});

export type AddIssuesToSprintArgs = z.infer<typeof addIssuesToSprintSchema>;

export const removeIssuesFromSprintSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  issueIds: z.array(z.string()).min(1, "At least one issue ID is required"),
});

export type RemoveIssuesFromSprintArgs = z.infer<typeof removeIssuesFromSprintSchema>;

// ============================================================================
// Milestone Schemas
// ============================================================================

export const createMilestoneSchema = z.object({
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().min(1, "Milestone description is required"),
  dueDate: z.string().datetime("Due date must be a valid ISO date string").optional(),
});

export type CreateMilestoneArgs = z.infer<typeof createMilestoneSchema>;

export const listMilestonesSchema = z.object({
  status: z.enum(["open", "closed", "all"]).default("open"),
  sort: z.enum(["due_date", "title", "created_at"]).default("created_at").optional(),
  direction: z.enum(["asc", "desc"]).default("asc").optional(),
});

export type ListMilestonesArgs = z.infer<typeof listMilestonesSchema>;

export const updateMilestoneSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  state: z.enum(["open", "closed"]).optional(),
});

export type UpdateMilestoneArgs = z.infer<typeof updateMilestoneSchema>;

export const deleteMilestoneSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
});

export type DeleteMilestoneArgs = z.infer<typeof deleteMilestoneSchema>;

// ============================================================================
// Metrics Schemas
// ============================================================================

export const getMilestoneMetricsSchema = z.object({
  milestoneId: z.string().min(1, "Milestone ID is required"),
  includeIssues: z.boolean(),
});

export type GetMilestoneMetricsArgs = z.infer<typeof getMilestoneMetricsSchema>;

export const getSprintMetricsSchema = z.object({
  sprintId: z.string().min(1, "Sprint ID is required"),
  includeIssues: z.boolean(),
});

export type GetSprintMetricsArgs = z.infer<typeof getSprintMetricsSchema>;

export const getOverdueMilestonesSchema = z.object({
  limit: z.number().int().positive(),
  includeIssues: z.boolean(),
});

export type GetOverdueMilestonesArgs = z.infer<typeof getOverdueMilestonesSchema>;

export const getUpcomingMilestonesSchema = z.object({
  daysAhead: z.number().int().positive(),
  limit: z.number().int().positive(),
  includeIssues: z.boolean(),
});

export type GetUpcomingMilestonesArgs = z.infer<typeof getUpcomingMilestonesSchema>;

// ============================================================================
// Label Schemas
// ============================================================================

export const createLabelSchema = z.object({
  name: z.string().min(1, "Label name is required"),
  color: z.string().regex(/^[0-9a-fA-F]{6}$/, "Color must be a valid 6-digit hex color code without #"),
  description: z.string().optional(),
});

export type CreateLabelArgs = z.infer<typeof createLabelSchema>;

export const listLabelsSchema = z.object({
  limit: z.number().int().positive().default(100).optional(),
});

export type ListLabelsArgs = z.infer<typeof listLabelsSchema>;

// ============================================================================
// Milestone Tool Definitions
// ============================================================================

export const createMilestoneTool: ToolDefinition<CreateMilestoneArgs, z.infer<typeof MilestoneOutputSchema>> = {
  name: "create_milestone",
  title: "Create Milestone",
  description: "Create a new milestone",
  schema: createMilestoneSchema as unknown as ToolSchema<CreateMilestoneArgs>,
  outputSchema: MilestoneOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const listMilestonesTool: ToolDefinition<ListMilestonesArgs, z.infer<typeof MilestoneListOutputSchema>> = {
  name: "list_milestones",
  title: "List Milestones",
  description: "List milestones",
  schema: listMilestonesSchema as unknown as ToolSchema<ListMilestonesArgs>,
  outputSchema: MilestoneListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const updateMilestoneTool: ToolDefinition<UpdateMilestoneArgs, z.infer<typeof MilestoneOutputSchema>> = {
  name: "update_milestone",
  title: "Update Milestone",
  description: "Update a GitHub milestone",
  schema: updateMilestoneSchema as unknown as ToolSchema<UpdateMilestoneArgs>,
  outputSchema: MilestoneOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
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

export const deleteMilestoneTool: ToolDefinition<DeleteMilestoneArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_milestone",
  title: "Delete Milestone",
  description: "Delete a GitHub milestone",
  schema: deleteMilestoneSchema as unknown as ToolSchema<DeleteMilestoneArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
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

// ============================================================================
// Sprint Tool Definitions
// ============================================================================

export const createSprintTool: ToolDefinition<CreateSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "create_sprint",
  title: "Create Sprint",
  description: "Create a new development sprint",
  schema: createSprintSchema as unknown as ToolSchema<CreateSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const listSprintsTool: ToolDefinition<ListSprintsArgs, z.infer<typeof SprintListOutputSchema>> = {
  name: "list_sprints",
  title: "List Sprints",
  description: "List all sprints",
  schema: listSprintsSchema as unknown as ToolSchema<ListSprintsArgs>,
  outputSchema: SprintListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const getCurrentSprintTool: ToolDefinition<GetCurrentSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "get_current_sprint",
  title: "Get Current Sprint",
  description: "Get the currently active sprint",
  schema: getCurrentSprintSchema as unknown as ToolSchema<GetCurrentSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const updateSprintTool: ToolDefinition<UpdateSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "update_sprint",
  title: "Update Sprint",
  description: "Update a development sprint",
  schema: updateSprintSchema as unknown as ToolSchema<UpdateSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
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

export const addIssuesToSprintTool: ToolDefinition<AddIssuesToSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "add_issues_to_sprint",
  title: "Add Issues to Sprint",
  description: "Add issues to an existing sprint",
  schema: addIssuesToSprintSchema as unknown as ToolSchema<AddIssuesToSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
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

export const removeIssuesFromSprintTool: ToolDefinition<RemoveIssuesFromSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "remove_issues_from_sprint",
  title: "Remove Issues from Sprint",
  description: "Remove issues from a sprint",
  schema: removeIssuesFromSprintSchema as unknown as ToolSchema<RemoveIssuesFromSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
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

// ============================================================================
// Roadmap Tool Definitions
// ============================================================================

export const createRoadmapTool: ToolDefinition<CreateRoadmapArgs, z.infer<typeof RoadmapOutputSchema>> = {
  name: "create_roadmap",
  title: "Create Roadmap",
  description: "Create a project roadmap with milestones and tasks",
  schema: createRoadmapSchema as unknown as ToolSchema<CreateRoadmapArgs>,
  outputSchema: RoadmapOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const planSprintTool: ToolDefinition<PlanSprintArgs, z.infer<typeof SprintOutputSchema>> = {
  name: "plan_sprint",
  title: "Plan Sprint",
  description: "Plan a new sprint with selected issues",
  schema: planSprintSchema as unknown as ToolSchema<PlanSprintArgs>,
  outputSchema: SprintOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

// ============================================================================
// Metrics Tool Definitions
// ============================================================================

export const getMilestoneMetricsTool: ToolDefinition<GetMilestoneMetricsArgs, z.infer<typeof MilestoneMetricsOutputSchema>> = {
  name: "get_milestone_metrics",
  title: "Get Milestone Metrics",
  description: "Get progress metrics for a specific milestone",
  schema: getMilestoneMetricsSchema as unknown as ToolSchema<GetMilestoneMetricsArgs>,
  outputSchema: MilestoneMetricsOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const getSprintMetricsTool: ToolDefinition<GetSprintMetricsArgs, z.infer<typeof SprintMetricsOutputSchema>> = {
  name: "get_sprint_metrics",
  title: "Get Sprint Metrics",
  description: "Get progress metrics for a specific sprint",
  schema: getSprintMetricsSchema as unknown as ToolSchema<GetSprintMetricsArgs>,
  outputSchema: SprintMetricsOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const getOverdueMilestonesTool: ToolDefinition<GetOverdueMilestonesArgs, z.infer<typeof MilestoneListOutputSchema>> = {
  name: "get_overdue_milestones",
  title: "Get Overdue Milestones",
  description: "Get a list of overdue milestones",
  schema: getOverdueMilestonesSchema as unknown as ToolSchema<GetOverdueMilestonesArgs>,
  outputSchema: MilestoneListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const getUpcomingMilestonesTool: ToolDefinition<GetUpcomingMilestonesArgs, z.infer<typeof MilestoneListOutputSchema>> = {
  name: "get_upcoming_milestones",
  title: "Get Upcoming Milestones",
  description: "Get a list of upcoming milestones within a time frame",
  schema: getUpcomingMilestonesSchema as unknown as ToolSchema<GetUpcomingMilestonesArgs>,
  outputSchema: MilestoneListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

// ============================================================================
// Label Tool Definitions
// ============================================================================

export const createLabelTool: ToolDefinition<CreateLabelArgs, z.infer<typeof LabelOutputSchema>> = {
  name: "create_label",
  title: "Create Label",
  description: "Create a new GitHub label",
  schema: createLabelSchema as unknown as ToolSchema<CreateLabelArgs>,
  outputSchema: LabelOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const listLabelsTool: ToolDefinition<ListLabelsArgs, z.infer<typeof LabelListOutputSchema>> = {
  name: "list_labels",
  title: "List Labels",
  description: "List all GitHub labels",
  schema: listLabelsSchema as unknown as ToolSchema<ListLabelsArgs>,
  outputSchema: LabelListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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
