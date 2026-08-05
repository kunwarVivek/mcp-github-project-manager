import { z } from "zod";
import { ToolDefinition, ToolSchema } from "../ToolValidator";
import { ANNOTATION_PATTERNS } from "../annotations/tool-annotations";
import {
  PullRequestOutputSchema,
  PullRequestListOutputSchema,
  PullRequestReviewOutputSchema,
  PullRequestReviewListOutputSchema,
  MergeResultOutputSchema,
} from "./project-schemas";

// ============================================================================
// Pull Request Schemas
// ============================================================================

export const createPullRequestSchema = z.object({
  title: z.string().min(1, "Pull request title is required"),
  body: z.string().optional(),
  head: z.string().min(1, "Head branch is required"),
  base: z.string().min(1, "Base branch is required"),
  draft: z.boolean().optional(),
});

export type CreatePullRequestArgs = z.infer<typeof createPullRequestSchema>;

export const getPullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
});

export type GetPullRequestArgs = z.infer<typeof getPullRequestSchema>;

export const listPullRequestsSchema = z.object({
  state: z.enum(["open", "closed", "all"]).default("open").optional(),
  perPage: z.number().int().positive().max(100).default(30).optional(),
});

export type ListPullRequestsArgs = z.infer<typeof listPullRequestsSchema>;

export const updatePullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
});

export type UpdatePullRequestArgs = z.infer<typeof updatePullRequestSchema>;

export const mergePullRequestSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
  commitTitle: z.string().optional(),
  commitMessage: z.string().optional(),
  mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge").optional(),
});

export type MergePullRequestArgs = z.infer<typeof mergePullRequestSchema>;

export const listPullRequestReviewsSchema = z.object({
  pullNumber: z.number().int().positive("Pull request number must be a positive integer"),
});

export type ListPullRequestReviewsArgs = z.infer<typeof listPullRequestReviewsSchema>;

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

// ============================================================================
// Pull Request Tool Definitions
// ============================================================================

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
