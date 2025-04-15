import { z } from "zod";
import { ToolDefinition, ToolSchema } from "./ToolValidator.js";

// Schema for create_roadmap tool
export const createRoadmapSchema = z.object({
  project: z.object({
    title: z.string().min(1, "Project title is required"),
    description: z.string().min(1, "Project description is required"),
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
  issueIds: z.array(z.number().int().positive("Issue IDs must be positive integers")),
});

export type PlanSprintArgs = z.infer<typeof planSprintSchema>;

// Schema for get_milestone_metrics tool
export const getMilestoneMetricsSchema = z.object({
  milestoneId: z.number().int().positive("Milestone ID must be a positive integer"),
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
          description: "Develop a new mobile application for our users",
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
        issueIds: [1, 2, 3, 5],
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
        milestoneId: 2,
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