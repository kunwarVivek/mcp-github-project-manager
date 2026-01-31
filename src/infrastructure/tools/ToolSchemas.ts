import { z } from "zod";
import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
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
  MilestoneOutputSchema,
  MilestoneListOutputSchema,
  MilestoneMetricsOutputSchema,
  SprintOutputSchema,
  SprintListOutputSchema,
  SprintMetricsOutputSchema,
  RoadmapOutputSchema,
  LabelOutputSchema,
  LabelListOutputSchema,
  IterationConfigOutputSchema,
  IterationOutputSchema,
  IterationItemsOutputSchema,
  AutomationRuleOutputSchema,
  AutomationRuleListOutputSchema,
  EventListOutputSchema,
  SubscriptionOutputSchema,
  IssueOutputSchema,
  IssueListOutputSchema,
  IssueCommentOutputSchema,
  IssueCommentListOutputSchema,
  DraftIssueOutputSchema,
  PullRequestOutputSchema,
  PullRequestListOutputSchema,
  PullRequestReviewOutputSchema,
  PullRequestReviewListOutputSchema,
  MergeResultOutputSchema,
  SuccessOutputSchema,
  DeleteOutputSchema,
  AIEnrichmentOutputSchema,
  AITriageOutputSchema,
  AIRoadmapOutputSchema,
  BulkOperationResultSchema,
} from "./schemas/project-schemas.js";

// Import AI tools
import { addFeatureTool, executeAddFeature } from "./ai-tasks/AddFeatureTool.js";
import { generatePRDTool, executeGeneratePRD } from "./ai-tasks/GeneratePRDTool.js";
import { parsePRDTool, executeParsePRD } from "./ai-tasks/ParsePRDTool.js";
import { getNextTaskTool, executeGetNextTask } from "./ai-tasks/GetNextTaskTool.js";
import { analyzeTaskComplexityTool, executeAnalyzeTaskComplexity } from "./ai-tasks/AnalyzeTaskComplexityTool.js";
import { expandTaskTool, executeExpandTask } from "./ai-tasks/ExpandTaskTool.js";
import { enhancePRDTool, executeEnhancePRD } from "./ai-tasks/EnhancePRDTool.js";
import { createTraceabilityMatrixTool, executeCreateTraceabilityMatrix } from "./ai-tasks/CreateTraceabilityMatrixTool.js";

// Import status update tools
import {
  createStatusUpdateTool,
  listStatusUpdatesTool,
  getStatusUpdateTool,
  executeCreateStatusUpdate,
  executeListStatusUpdates,
  executeGetStatusUpdate,
} from "./status-update-tools.js";

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

// Schema for create_issue_comment tool
export const createIssueCommentSchema = z.object({
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
  body: z.string().min(1, "Comment body is required"),
});

export type CreateIssueCommentArgs = z.infer<typeof createIssueCommentSchema>;

// Schema for update_issue_comment tool
export const updateIssueCommentSchema = z.object({
  commentId: z.number().int().positive("Comment ID must be a positive integer"),
  body: z.string().min(1, "Comment body is required"),
});

export type UpdateIssueCommentArgs = z.infer<typeof updateIssueCommentSchema>;

// Schema for delete_issue_comment tool
export const deleteIssueCommentSchema = z.object({
  commentId: z.number().int().positive("Comment ID must be a positive integer"),
});

export type DeleteIssueCommentArgs = z.infer<typeof deleteIssueCommentSchema>;

// Schema for list_issue_comments tool
export const listIssueCommentsSchema = z.object({
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
  perPage: z.number().int().positive().max(100).default(100).optional(),
});

export type ListIssueCommentsArgs = z.infer<typeof listIssueCommentsSchema>;

// Schema for create_draft_issue tool
export const createDraftIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(1, "Draft issue title is required"),
  body: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export type CreateDraftIssueArgs = z.infer<typeof createDraftIssueSchema>;

// Schema for update_draft_issue tool
export const updateDraftIssueSchema = z.object({
  draftIssueId: z.string().min(1, "Draft issue ID is required"),
  title: z.string().optional(),
  body: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export type UpdateDraftIssueArgs = z.infer<typeof updateDraftIssueSchema>;

// Schema for delete_draft_issue tool
export const deleteDraftIssueSchema = z.object({
  draftIssueId: z.string().min(1, "Draft issue ID is required"),
});

export type DeleteDraftIssueArgs = z.infer<typeof deleteDraftIssueSchema>;

// Schema for create_pull_request tool
export const createPullRequestSchema = z.object({
  title: z.string().min(1, "Pull request title is required"),
  body: z.string().optional(),
  head: z.string().min(1, "Head branch is required"),
  base: z.string().min(1, "Base branch is required"),
  draft: z.boolean().optional(),
});

export type CreatePullRequestArgs = z.infer<typeof createPullRequestSchema>;

// Schema for get_pull_request tool
export const getPullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
});

export type GetPullRequestArgs = z.infer<typeof getPullRequestSchema>;

// Schema for list_pull_requests tool
export const listPullRequestsSchema = z.object({
  state: z.enum(["open", "closed", "all"]).default("open").optional(),
  perPage: z.number().int().positive().max(100).default(30).optional(),
});

export type ListPullRequestsArgs = z.infer<typeof listPullRequestsSchema>;

// Schema for update_pull_request tool
export const updatePullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
});

export type UpdatePullRequestArgs = z.infer<typeof updatePullRequestSchema>;

// Schema for merge_pull_request tool
export const mergePullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
  commitTitle: z.string().optional(),
  commitMessage: z.string().optional(),
  mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge").optional(),
});

export type MergePullRequestArgs = z.infer<typeof mergePullRequestSchema>;

// Schema for list_pull_request_reviews tool
export const listPullRequestReviewsSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
});

export type ListPullRequestReviewsArgs = z.infer<typeof listPullRequestReviewsSchema>;

// Schema for create_pull_request_review tool
export const createPullRequestReviewSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
  body: z.string().optional(),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
  comments: z.array(z.object({
    path: z.string(),
    position: z.number().int().optional(),
    body: z.string(),
  })).optional(),
});

export type CreatePullRequestReviewArgs = z.infer<typeof createPullRequestReviewSchema>;

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

// Milestone tools
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

// Issue tools
export const createIssueTool: ToolDefinition<CreateIssueArgs, z.infer<typeof IssueOutputSchema>> = {
  name: "create_issue",
  title: "Create Issue",
  description: "Create a new GitHub issue",
  schema: createIssueSchema as unknown as ToolSchema<CreateIssueArgs>,
  outputSchema: IssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const listIssuesTool: ToolDefinition<ListIssuesArgs, z.infer<typeof IssueListOutputSchema>> = {
  name: "list_issues",
  title: "List Issues",
  description: "List GitHub issues",
  schema: listIssuesSchema as unknown as ToolSchema<ListIssuesArgs>,
  outputSchema: IssueListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const getIssueTool: ToolDefinition<GetIssueArgs, z.infer<typeof IssueOutputSchema>> = {
  name: "get_issue",
  title: "Get Issue",
  description: "Get details of a specific GitHub issue",
  schema: getIssueSchema as unknown as ToolSchema<GetIssueArgs>,
  outputSchema: IssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const updateIssueTool: ToolDefinition<UpdateIssueArgs, z.infer<typeof IssueOutputSchema>> = {
  name: "update_issue",
  title: "Update Issue",
  description: "Update a GitHub issue",
  schema: updateIssueSchema as unknown as ToolSchema<UpdateIssueArgs>,
  outputSchema: IssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
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

// Issue comment tools
export const createIssueCommentTool: ToolDefinition<CreateIssueCommentArgs, z.infer<typeof IssueCommentOutputSchema>> = {
  name: "create_issue_comment",
  title: "Create Issue Comment",
  description: "Add a comment to a GitHub issue",
  schema: createIssueCommentSchema as unknown as ToolSchema<CreateIssueCommentArgs>,
  outputSchema: IssueCommentOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateNonIdempotent,
  examples: [
    {
      name: "Add status update comment",
      description: "Post a comment to update the team on progress",
      args: {
        issueNumber: 42,
        body: "Working on this issue now. Should have a PR ready by EOD."
      }
    }
  ]
};

export const updateIssueCommentTool: ToolDefinition<UpdateIssueCommentArgs, z.infer<typeof IssueCommentOutputSchema>> = {
  name: "update_issue_comment",
  title: "Update Issue Comment",
  description: "Update an existing comment on a GitHub issue",
  schema: updateIssueCommentSchema as unknown as ToolSchema<UpdateIssueCommentArgs>,
  outputSchema: IssueCommentOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Correct a comment",
      description: "Edit a previously posted comment to fix information",
      args: {
        commentId: 123456,
        body: "Updated: PR is ready for review at #45"
      }
    }
  ]
};

export const deleteIssueCommentTool: ToolDefinition<DeleteIssueCommentArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_issue_comment",
  title: "Delete Issue Comment",
  description: "Delete a comment from a GitHub issue",
  schema: deleteIssueCommentSchema as unknown as ToolSchema<DeleteIssueCommentArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Remove outdated comment",
      description: "Delete a comment that is no longer relevant",
      args: {
        commentId: 123456
      }
    }
  ]
};

export const listIssueCommentsTool: ToolDefinition<ListIssueCommentsArgs, z.infer<typeof IssueCommentListOutputSchema>> = {
  name: "list_issue_comments",
  title: "List Issue Comments",
  description: "List all comments on a GitHub issue",
  schema: listIssueCommentsSchema as unknown as ToolSchema<ListIssueCommentsArgs>,
  outputSchema: IssueCommentListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get all comments",
      description: "Retrieve all comments for an issue",
      args: {
        issueNumber: 42
      }
    },
    {
      name: "Get recent comments",
      description: "Retrieve the 20 most recent comments",
      args: {
        issueNumber: 42,
        perPage: 20
      }
    }
  ]
};

// Draft issue tools
export const createDraftIssueTool: ToolDefinition<CreateDraftIssueArgs, z.infer<typeof DraftIssueOutputSchema>> = {
  name: "create_draft_issue",
  title: "Create Draft Issue",
  description: "Create a draft issue in a GitHub project. Draft issues are native to Projects v2 and don't require creating a repository issue first.",
  schema: createDraftIssueSchema as unknown as ToolSchema<CreateDraftIssueArgs>,
  outputSchema: DraftIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create draft task",
      description: "Create a draft issue for brainstorming without committing to the repository",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        title: "Explore new authentication options",
        body: "Research OAuth providers and compare features"
      }
    }
  ]
};

export const updateDraftIssueTool: ToolDefinition<UpdateDraftIssueArgs, z.infer<typeof DraftIssueOutputSchema>> = {
  name: "update_draft_issue",
  title: "Update Draft Issue",
  description: "Update an existing draft issue in a GitHub project",
  schema: updateDraftIssueSchema as unknown as ToolSchema<UpdateDraftIssueArgs>,
  outputSchema: DraftIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update draft details",
      description: "Refine a draft issue with more information",
      args: {
        draftIssueId: "DI_kwDOLhQ7gc4AABB",
        title: "Implement OAuth 2.0 authentication",
        body: "Use Auth0 as the provider. See research doc for details."
      }
    }
  ]
};

export const deleteDraftIssueTool: ToolDefinition<DeleteDraftIssueArgs, z.infer<typeof DeleteOutputSchema>> = {
  name: "delete_draft_issue",
  title: "Delete Draft Issue",
  description: "Delete a draft issue from a GitHub project",
  schema: deleteDraftIssueSchema as unknown as ToolSchema<DeleteDraftIssueArgs>,
  outputSchema: DeleteOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Remove draft",
      description: "Delete a draft issue that's no longer needed",
      args: {
        draftIssueId: "DI_kwDOLhQ7gc4AABB"
      }
    }
  ]
};

// Pull Request tools
export const createPullRequestTool: ToolDefinition<CreatePullRequestArgs, z.infer<typeof PullRequestOutputSchema>> = {
  name: "create_pull_request",
  title: "Create Pull Request",
  description: "Create a new pull request in a GitHub repository",
  schema: createPullRequestSchema as unknown as ToolSchema<CreatePullRequestArgs>,
  outputSchema: PullRequestOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Create feature PR",
      description: "Create a pull request for a new feature",
      args: {
        title: "Add user authentication",
        body: "Implements OAuth 2.0 authentication with Auth0",
        head: "feature/auth",
        base: "main"
      }
    }
  ]
};

export const getPullRequestTool: ToolDefinition<GetPullRequestArgs, z.infer<typeof PullRequestOutputSchema>> = {
  name: "get_pull_request",
  title: "Get Pull Request",
  description: "Get details of a specific pull request",
  schema: getPullRequestSchema as unknown as ToolSchema<GetPullRequestArgs>,
  outputSchema: PullRequestOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get PR details",
      description: "Retrieve information about PR #42",
      args: {
        pullNumber: 42
      }
    }
  ]
};

export const listPullRequestsTool: ToolDefinition<ListPullRequestsArgs, z.infer<typeof PullRequestListOutputSchema>> = {
  name: "list_pull_requests",
  title: "List Pull Requests",
  description: "List pull requests in a GitHub repository",
  schema: listPullRequestsSchema as unknown as ToolSchema<ListPullRequestsArgs>,
  outputSchema: PullRequestListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List open PRs",
      description: "Get all open pull requests",
      args: {
        state: "open"
      }
    }
  ]
};

export const updatePullRequestTool: ToolDefinition<UpdatePullRequestArgs, z.infer<typeof PullRequestOutputSchema>> = {
  name: "update_pull_request",
  title: "Update Pull Request",
  description: "Update a pull request's title, body, or state",
  schema: updatePullRequestSchema as unknown as ToolSchema<UpdatePullRequestArgs>,
  outputSchema: PullRequestOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Update PR title",
      description: "Update the title of a pull request",
      args: {
        pullNumber: 42,
        title: "feat: Add OAuth 2.0 authentication"
      }
    }
  ]
};

export const mergePullRequestTool: ToolDefinition<MergePullRequestArgs, z.infer<typeof MergeResultOutputSchema>> = {
  name: "merge_pull_request",
  title: "Merge Pull Request",
  description: "Merge a pull request using merge, squash, or rebase",
  schema: mergePullRequestSchema as unknown as ToolSchema<MergePullRequestArgs>,
  outputSchema: MergeResultOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateNonIdempotent,
  examples: [
    {
      name: "Squash and merge",
      description: "Merge a PR with squash strategy",
      args: {
        pullNumber: 42,
        mergeMethod: "squash",
        commitTitle: "feat: Add authentication"
      }
    }
  ]
};

export const listPullRequestReviewsTool: ToolDefinition<ListPullRequestReviewsArgs, z.infer<typeof PullRequestReviewListOutputSchema>> = {
  name: "list_pull_request_reviews",
  title: "List Pull Request Reviews",
  description: "List all reviews on a pull request",
  schema: listPullRequestReviewsSchema as unknown as ToolSchema<ListPullRequestReviewsArgs>,
  outputSchema: PullRequestReviewListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Get PR reviews",
      description: "List all reviews for PR #42",
      args: {
        pullNumber: 42
      }
    }
  ]
};

export const createPullRequestReviewTool: ToolDefinition<CreatePullRequestReviewArgs, z.infer<typeof PullRequestReviewOutputSchema>> = {
  name: "create_pull_request_review",
  title: "Create Pull Request Review",
  description: "Create a review on a pull request (approve, request changes, or comment)",
  schema: createPullRequestReviewSchema as unknown as ToolSchema<CreatePullRequestReviewArgs>,
  outputSchema: PullRequestReviewOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Approve PR",
      description: "Approve a pull request",
      args: {
        pullNumber: 42,
        event: "APPROVE",
        body: "LGTM! Great work on the authentication implementation."
      }
    },
    {
      name: "Request changes",
      description: "Request changes with inline comments",
      args: {
        pullNumber: 42,
        event: "REQUEST_CHANGES",
        body: "Please address the comments below",
        comments: [
          {
            path: "src/auth.ts",
            position: 15,
            body: "Consider using bcrypt for password hashing"
          }
        ]
      }
    }
  ]
};

// Sprint tools
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

// Project field tools
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

// Project view tools
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

// Tool definitions with schemas, descriptions, and examples
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

// Schema for get_project_readme tool
export const getProjectReadmeSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
});

export type GetProjectReadmeArgs = z.infer<typeof getProjectReadmeSchema>;

// Schema for update_project_readme tool
export const updateProjectReadmeSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  readme: z.string().min(1, "README content is required"),
});

export type UpdateProjectReadmeArgs = z.infer<typeof updateProjectReadmeSchema>;

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

// Schema for archive_project_item tool
export const archiveProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type ArchiveProjectItemArgs = z.infer<typeof archiveProjectItemSchema>;

// Schema for unarchive_project_item tool
export const unarchiveProjectItemSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
});

export type UnarchiveProjectItemArgs = z.infer<typeof unarchiveProjectItemSchema>;

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

// Schema for clear_field_value tool
export const clearFieldValueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemId: z.string().min(1, "Item ID is required"),
  fieldId: z.string().min(1, "Field ID is required"),
});

export type ClearFieldValueArgs = z.infer<typeof clearFieldValueSchema>;

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

// Schema for delete_project_view tool
export const deleteProjectViewSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  viewId: z.string().min(1, "View ID is required"),
});

export type DeleteProjectViewArgs = z.infer<typeof deleteProjectViewSchema>;

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

// ============================================================================
// Automation Service Tools
// ============================================================================

// Schema for create_automation_rule tool
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
    parameters: z.record(z.any())
  }))
});

export type CreateAutomationRuleArgs = z.infer<typeof createAutomationRuleSchema>;

// Schema for update_automation_rule tool
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
    parameters: z.record(z.any())
  })).optional()
});

export type UpdateAutomationRuleArgs = z.infer<typeof updateAutomationRuleSchema>;

// Schema for delete_automation_rule tool
export const deleteAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type DeleteAutomationRuleArgs = z.infer<typeof deleteAutomationRuleSchema>;

// Schema for get_automation_rule tool
export const getAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type GetAutomationRuleArgs = z.infer<typeof getAutomationRuleSchema>;

// Schema for list_automation_rules tool
export const listAutomationRulesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required")
});

export type ListAutomationRulesArgs = z.infer<typeof listAutomationRulesSchema>;

// Schema for enable_automation_rule tool
export const enableAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type EnableAutomationRuleArgs = z.infer<typeof enableAutomationRuleSchema>;

// Schema for disable_automation_rule tool
export const disableAutomationRuleSchema = z.object({
  ruleId: z.string().min(1, "Rule ID is required")
});

export type DisableAutomationRuleArgs = z.infer<typeof disableAutomationRuleSchema>;

// ============================================================================
// Iteration Management Tools
// ============================================================================

// Schema for get_iteration_configuration tool
export const getIterationConfigurationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional()
});

export type GetIterationConfigurationArgs = z.infer<typeof getIterationConfigurationSchema>;

// Schema for get_current_iteration tool
export const getCurrentIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  fieldName: z.string().optional()
});

export type GetCurrentIterationArgs = z.infer<typeof getCurrentIterationSchema>;

// Schema for get_iteration_items tool
export const getIterationItemsSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  limit: z.number().int().positive().default(50).optional()
});

export type GetIterationItemsArgs = z.infer<typeof getIterationItemsSchema>;

// Schema for get_iteration_by_date tool
export const getIterationByDateSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  date: z.string().datetime("Date must be a valid ISO date string"),
  fieldName: z.string().optional()
});

export type GetIterationByDateArgs = z.infer<typeof getIterationByDateSchema>;

// Schema for assign_items_to_iteration tool
export const assignItemsToIterationSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  itemIds: z.array(z.string()).min(1, "At least one item ID is required"),
  iterationId: z.string().min(1, "Iteration ID is required"),
  fieldName: z.string().optional()
});

export type AssignItemsToIterationArgs = z.infer<typeof assignItemsToIterationSchema>;

// ============================================================================
// AI-Powered Automation Tools
// ============================================================================

// Schema for generate_roadmap tool
export const generateRoadmapSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  projectTitle: z.string().min(1, "Project title is required"),
  projectDescription: z.string().optional(),
  sprintDurationWeeks: z.number().int().positive().default(2).optional(),
  targetMilestones: z.number().int().positive().default(4).optional(),
  autoCreate: z.boolean().default(false).optional()
});

export type GenerateRoadmapArgs = z.infer<typeof generateRoadmapSchema>;

// Schema for enrich_issue tool
export const enrichIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueId: z.string().min(1, "Issue ID is required"),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string().min(1, "Issue title is required"),
  issueDescription: z.string().optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type EnrichIssueArgs = z.infer<typeof enrichIssueSchema>;

// Schema for enrich_issues_bulk tool
export const enrichIssuesBulkSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueIds: z.array(z.string()).optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type EnrichIssuesBulkArgs = z.infer<typeof enrichIssuesBulkSchema>;

// Schema for triage_issue tool
export const triageIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  issueId: z.string().min(1, "Issue ID is required"),
  issueNumber: z.number().int().positive(),
  issueTitle: z.string().min(1, "Issue title is required"),
  issueDescription: z.string().optional(),
  projectContext: z.string().optional(),
  autoApply: z.boolean().default(false).optional()
});

export type TriageIssueArgs = z.infer<typeof triageIssueSchema>;

// Schema for triage_all_issues tool
export const triageAllIssuesSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  onlyUntriaged: z.boolean().default(true).optional(),
  autoApply: z.boolean().default(false).optional(),
  projectContext: z.string().optional()
});

export type TriageAllIssuesArgs = z.infer<typeof triageAllIssuesSchema>;

// Schema for schedule_triaging tool
export const scheduleTriagingSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  schedule: z.enum(['hourly', 'daily', 'weekly']),
  autoApply: z.boolean().default(false)
});

export type ScheduleTriagingArgs = z.infer<typeof scheduleTriagingSchema>;

// Project tools
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
export const subscribeToEventsTool: ToolDefinition<SubscribeToEventsArgs, z.infer<typeof SubscriptionOutputSchema>> = {
  name: "subscribe_to_events",
  title: "Subscribe to Events",
  description: "Subscribe to real-time events for GitHub resources",
  schema: subscribeToEventsSchema as unknown as ToolSchema<SubscribeToEventsArgs>,
  outputSchema: SubscriptionOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
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

export const getRecentEventsTool: ToolDefinition<GetRecentEventsArgs, z.infer<typeof EventListOutputSchema>> = {
  name: "get_recent_events",
  title: "Get Recent Events",
  description: "Get recent events for GitHub resources",
  schema: getRecentEventsSchema as unknown as ToolSchema<GetRecentEventsArgs>,
  outputSchema: EventListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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

export const replayEventsTool: ToolDefinition<ReplayEventsArgs, z.infer<typeof EventListOutputSchema>> = {
  name: "replay_events",
  title: "Replay Events",
  description: "Replay events from a specific timestamp",
  schema: replayEventsSchema as unknown as ToolSchema<ReplayEventsArgs>,
  outputSchema: EventListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
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
// Automation Service Tool Definitions
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

// ============================================================================
// AI-Powered Automation Tool Definitions
// ============================================================================

export const generateRoadmapTool: ToolDefinition<GenerateRoadmapArgs, z.infer<typeof AIRoadmapOutputSchema>> = {
  name: "generate_roadmap",
  title: "Generate Roadmap",
  description: "AI-powered roadmap generation from project issues. Creates milestones, sprints, and phases automatically.",
  schema: generateRoadmapSchema as unknown as ToolSchema<GenerateRoadmapArgs>,
  outputSchema: AIRoadmapOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Generate roadmap",
      description: "Create a comprehensive roadmap from existing issues",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        projectTitle: "API Platform Development",
        projectDescription: "Build a scalable REST API platform",
        sprintDurationWeeks: 2,
        targetMilestones: 4,
        autoCreate: true
      }
    }
  ]
};

export const enrichIssueTool: ToolDefinition<EnrichIssueArgs, z.infer<typeof AIEnrichmentOutputSchema>> = {
  name: "enrich_issue",
  title: "Enrich Issue",
  description: "AI-powered issue enrichment. Automatically adds labels, priority, type, complexity, and effort estimates.",
  schema: enrichIssueSchema as unknown as ToolSchema<EnrichIssueArgs>,
  outputSchema: AIEnrichmentOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Enrich issue",
      description: "Add tags and metadata to an issue",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        issueId: "I_kwDOJrIzLs5eGXAT",
        issueNumber: 42,
        issueTitle: "Add user authentication",
        issueDescription: "Implement OAuth 2.0 authentication",
        autoApply: true
      }
    }
  ]
};

export const enrichIssuesBulkTool: ToolDefinition<EnrichIssuesBulkArgs, z.infer<typeof BulkOperationResultSchema>> = {
  name: "enrich_issues_bulk",
  title: "Enrich Issues Bulk",
  description: "Bulk AI-powered issue enrichment for multiple issues at once.",
  schema: enrichIssuesBulkSchema as unknown as ToolSchema<EnrichIssuesBulkArgs>,
  outputSchema: BulkOperationResultSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Enrich all issues",
      description: "Enrich all issues in a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        projectContext: "E-commerce platform with React frontend and Node.js backend",
        autoApply: false
      }
    }
  ]
};

export const triageIssueTool: ToolDefinition<TriageIssueArgs, z.infer<typeof AITriageOutputSchema>> = {
  name: "triage_issue",
  title: "Triage Issue",
  description: "AI-powered issue triaging. Classifies issues, assigns priority, and recommends actions.",
  schema: triageIssueSchema as unknown as ToolSchema<TriageIssueArgs>,
  outputSchema: AITriageOutputSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Triage issue",
      description: "Classify and prioritize an issue",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        issueId: "I_kwDOJrIzLs5eGXAT",
        issueNumber: 42,
        issueTitle: "Application crashes on startup",
        issueDescription: "Users report app crashes immediately after launch",
        autoApply: true
      }
    }
  ]
};

export const triageAllIssuesTool: ToolDefinition<TriageAllIssuesArgs, z.infer<typeof BulkOperationResultSchema>> = {
  name: "triage_all_issues",
  title: "Triage All Issues",
  description: "Automatically triage all untriaged issues in a project.",
  schema: triageAllIssuesSchema as unknown as ToolSchema<TriageAllIssuesArgs>,
  outputSchema: BulkOperationResultSchema,
  annotations: ANNOTATION_PATTERNS.aiOperation,
  examples: [
    {
      name: "Triage all issues",
      description: "Triage all issues that don't have labels yet",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        onlyUntriaged: true,
        autoApply: false,
        projectContext: "Mobile app for task management"
      }
    }
  ]
};

export const scheduleTriagingTool: ToolDefinition<ScheduleTriagingArgs, z.infer<typeof SuccessOutputSchema>> = {
  name: "schedule_triaging",
  title: "Schedule Triaging",
  description: "Schedule automated issue triaging to run periodically.",
  schema: scheduleTriagingSchema as unknown as ToolSchema<ScheduleTriagingArgs>,
  outputSchema: SuccessOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Daily triage",
      description: "Set up daily automated triaging",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        schedule: "daily",
        autoApply: true
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

// ============================================================================
// Status Update Tools
// ============================================================================

// Re-export status update tools
export { createStatusUpdateTool, executeCreateStatusUpdate };
export { listStatusUpdatesTool, executeListStatusUpdates };
export { getStatusUpdateTool, executeGetStatusUpdate };
// ============================================================================
// Sub-Issue Management Tools
// ============================================================================

// Re-export sub-issue tools
export {
  addSubIssueTool,
  listSubIssuesTool,
  getParentIssueTool,
  reprioritizeSubIssueTool,
  removeSubIssueTool,
  executeAddSubIssue,
  executeListSubIssues,
  executeGetParentIssue,
  executeReprioritizeSubIssue,
  executeRemoveSubIssue,
} from "./sub-issue-tools.js";

// ============================================================================
// Project Template Tools
// ============================================================================

// Re-export project template tools
export {
  markProjectAsTemplateTool,
  unmarkProjectAsTemplateTool,
  copyProjectFromTemplateTool,
  listOrganizationTemplatesTool,
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
} from "./project-template-tools.js";

// ============================================================================
// Project Linking Tools
// ============================================================================

// Re-export project linking tools
export {
  linkProjectToRepositoryTool,
  unlinkProjectFromRepositoryTool,
  linkProjectToTeamTool,
  unlinkProjectFromTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  executeLinkProjectToRepository,
  executeUnlinkProjectFromRepository,
  executeLinkProjectToTeam,
  executeUnlinkProjectFromTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
} from "./project-linking-tools.js";

// ============================================================================
// Project Lifecycle Tools
// ============================================================================

// Re-export project lifecycle tools
export {
  closeProjectTool,
  reopenProjectTool,
  convertDraftIssueTool,
  executeCloseProject,
  executeReopenProject,
  executeConvertDraftIssue,
} from "./project-lifecycle-tools.js";

// ============================================================================
// Advanced Operations Tools
// ============================================================================

// Re-export advanced operations tools
export {
  updateItemPositionTool,
  searchIssuesAdvancedTool,
  filterProjectItemsTool,
  executeUpdateItemPosition,
  executeSearchIssuesAdvanced,
  executeFilterProjectItems,
} from "./project-advanced-tools.js";
