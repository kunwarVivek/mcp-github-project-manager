import { z } from "zod";
import { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  IssueOutputSchema,
  IssueListOutputSchema,
  IssueCommentOutputSchema,
  IssueCommentListOutputSchema,
  DraftIssueOutputSchema,
  DeleteOutputSchema,
} from "./project-schemas";

// ============================================================================
// Issue CRUD Schemas
// ============================================================================

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

export const getIssueSchema = z.object({
  issueId: z.string().min(1, "Issue ID is required"),
});

export type GetIssueArgs = z.infer<typeof getIssueSchema>;

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

// ============================================================================
// Issue Comment Schemas
// ============================================================================

export const createIssueCommentSchema = z.object({
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
  body: z.string().min(1, "Comment body is required"),
});

export type CreateIssueCommentArgs = z.infer<typeof createIssueCommentSchema>;

export const updateIssueCommentSchema = z.object({
  commentId: z.number().int().positive("Comment ID must be a positive integer"),
  body: z.string().min(1, "Comment body is required"),
});

export type UpdateIssueCommentArgs = z.infer<typeof updateIssueCommentSchema>;

export const deleteIssueCommentSchema = z.object({
  commentId: z.number().int().positive("Comment ID must be a positive integer"),
});

export type DeleteIssueCommentArgs = z.infer<typeof deleteIssueCommentSchema>;

export const listIssueCommentsSchema = z.object({
  issueNumber: z.number().int().positive("Issue number must be a positive integer"),
  perPage: z.number().int().positive().max(100).default(100).optional(),
});

export type ListIssueCommentsArgs = z.infer<typeof listIssueCommentsSchema>;

// ============================================================================
// Draft Issue Schemas
// ============================================================================

export const createDraftIssueSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(1, "Draft issue title is required"),
  body: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export type CreateDraftIssueArgs = z.infer<typeof createDraftIssueSchema>;

export const updateDraftIssueSchema = z.object({
  draftIssueId: z.string().min(1, "Draft issue ID is required"),
  title: z.string().optional(),
  body: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export type UpdateDraftIssueArgs = z.infer<typeof updateDraftIssueSchema>;

export const deleteDraftIssueSchema = z.object({
  draftIssueId: z.string().min(1, "Draft issue ID is required"),
});

export type DeleteDraftIssueArgs = z.infer<typeof deleteDraftIssueSchema>;

// ============================================================================
// Issue CRUD Tool Definitions
// ============================================================================

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

// ============================================================================
// Issue Comment Tool Definitions
// ============================================================================

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

// ============================================================================
// Draft Issue Tool Definitions
// ============================================================================

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
