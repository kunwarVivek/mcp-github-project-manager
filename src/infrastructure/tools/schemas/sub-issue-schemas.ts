/**
 * Zod schemas for sub-issue MCP tools.
 *
 * Sub-issues allow creating parent-child hierarchies between GitHub issues.
 * This module defines input and output schemas for the 5 sub-issue tools:
 * - add_sub_issue (GHAPI-01)
 * - list_sub_issues (GHAPI-02)
 * - get_parent_issue (GHAPI-03)
 * - reprioritize_sub_issue (GHAPI-04)
 * - remove_sub_issue (GHAPI-05)
 */

import { z } from "zod";

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Input schema for add_sub_issue tool.
 *
 * Adds an existing issue as a sub-issue of a parent issue.
 */
export const AddSubIssueInputSchema = z.object({
  /** Repository owner (username or organization) */
  owner: z.string().describe("Repository owner"),
  /** Repository name */
  repo: z.string().describe("Repository name"),
  /** Issue number of the parent issue */
  parentIssueNumber: z.number().describe("Parent issue number"),
  /** Issue number of the issue to add as sub-issue */
  subIssueNumber: z.number().describe("Issue number to add as sub-issue"),
  /** If true, replaces existing parent if the issue already has one */
  replaceParent: z.boolean().optional().default(false).describe("Replace existing parent if any"),
});

export type AddSubIssueInput = z.infer<typeof AddSubIssueInputSchema>;

/**
 * Input schema for list_sub_issues tool.
 *
 * Lists all sub-issues for a parent issue with pagination.
 */
export const ListSubIssuesInputSchema = z.object({
  /** Repository owner (username or organization) */
  owner: z.string().describe("Repository owner"),
  /** Repository name */
  repo: z.string().describe("Repository name"),
  /** Issue number of the parent issue */
  issueNumber: z.number().describe("Parent issue number"),
  /** Number of sub-issues to return (default: 20, max: 100) */
  first: z.number().optional().default(20).describe("Number of sub-issues to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type ListSubIssuesInput = z.infer<typeof ListSubIssuesInputSchema>;

/**
 * Input schema for get_parent_issue tool.
 *
 * Gets the parent issue for a sub-issue, if any.
 */
export const GetParentIssueInputSchema = z.object({
  /** Repository owner (username or organization) */
  owner: z.string().describe("Repository owner"),
  /** Repository name */
  repo: z.string().describe("Repository name"),
  /** Issue number to find parent for */
  issueNumber: z.number().describe("Issue number to find parent for"),
});

export type GetParentIssueInput = z.infer<typeof GetParentIssueInputSchema>;

/**
 * Input schema for reprioritize_sub_issue tool.
 *
 * Changes the position of a sub-issue within its parent's sub-issue list.
 */
export const ReprioritizeSubIssueInputSchema = z.object({
  /** Repository owner (username or organization) */
  owner: z.string().describe("Repository owner"),
  /** Repository name */
  repo: z.string().describe("Repository name"),
  /** Issue number of the parent issue */
  parentIssueNumber: z.number().describe("Parent issue number"),
  /** Issue number of the sub-issue to move */
  subIssueNumber: z.number().describe("Sub-issue number to move"),
  /** Issue number to place after (omit to move to beginning) */
  afterIssueNumber: z.number().optional().describe("Issue number to place after (omit for beginning)"),
});

export type ReprioritizeSubIssueInput = z.infer<typeof ReprioritizeSubIssueInputSchema>;

/**
 * Input schema for remove_sub_issue tool.
 *
 * Removes a sub-issue from its parent (issue remains, just unlinked).
 */
export const RemoveSubIssueInputSchema = z.object({
  /** Repository owner (username or organization) */
  owner: z.string().describe("Repository owner"),
  /** Repository name */
  repo: z.string().describe("Repository name"),
  /** Issue number of the parent issue */
  parentIssueNumber: z.number().describe("Parent issue number"),
  /** Issue number of the sub-issue to remove */
  subIssueNumber: z.number().describe("Sub-issue number to remove"),
});

export type RemoveSubIssueInput = z.infer<typeof RemoveSubIssueInputSchema>;

// ============================================================================
// Output Schemas
// ============================================================================

/**
 * Schema for a single sub-issue item.
 */
export const SubIssueOutputSchema = z.object({
  /** GitHub node ID */
  id: z.string(),
  /** Issue number */
  number: z.number(),
  /** Issue title */
  title: z.string(),
  /** Issue state (open or closed) */
  state: z.enum(["open", "closed"]),
  /** Issue URL */
  url: z.string(),
});

export type SubIssueOutput = z.infer<typeof SubIssueOutputSchema>;

/**
 * Schema for a sub-issue item with position in the list.
 */
export const SubIssueWithPositionSchema = SubIssueOutputSchema.extend({
  /** Position in the parent's sub-issue list (0-indexed) */
  position: z.number(),
});

export type SubIssueWithPosition = z.infer<typeof SubIssueWithPositionSchema>;

/**
 * Schema for sub-issue list output with pagination.
 */
export const SubIssueListOutputSchema = z.object({
  /** List of sub-issues with positions */
  subIssues: z.array(SubIssueWithPositionSchema),
  /** Summary statistics */
  summary: z.object({
    /** Total number of sub-issues */
    total: z.number(),
    /** Number of completed (closed) sub-issues */
    completed: z.number(),
    /** Percentage of completed sub-issues (0-100) */
    percentCompleted: z.number(),
  }),
  /** Pagination info */
  pageInfo: z.object({
    /** Whether there are more results */
    hasNextPage: z.boolean(),
    /** Cursor for next page */
    endCursor: z.string().optional(),
  }),
  /** Total count of sub-issues */
  totalCount: z.number(),
});

export type SubIssueListOutput = z.infer<typeof SubIssueListOutputSchema>;

/**
 * Schema for parent issue output.
 */
export const ParentIssueOutputSchema = z.object({
  /** Parent issue, or null if none */
  parent: SubIssueOutputSchema.nullable(),
});

export type ParentIssueOutput = z.infer<typeof ParentIssueOutputSchema>;

/**
 * Schema for remove sub-issue output.
 */
export const RemoveSubIssueOutputSchema = z.object({
  /** Whether the operation succeeded */
  success: z.boolean(),
  /** Human-readable message */
  message: z.string(),
});

export type RemoveSubIssueOutput = z.infer<typeof RemoveSubIssueOutputSchema>;

/**
 * Schema for add/reprioritize sub-issue success output.
 *
 * This matches the SubIssueResult from the repository but with
 * MCP-friendly field names.
 */
export const SubIssueOperationOutputSchema = z.object({
  /** The parent issue info */
  parentIssue: z.object({
    id: z.string(),
    title: z.string(),
  }),
  /** The sub-issue that was added/moved */
  subIssue: SubIssueOutputSchema,
});

export type SubIssueOperationOutput = z.infer<typeof SubIssueOperationOutputSchema>;
