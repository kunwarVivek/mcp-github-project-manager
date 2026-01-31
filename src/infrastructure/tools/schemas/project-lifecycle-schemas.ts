/**
 * Zod schemas for project lifecycle and advanced MCP tools.
 *
 * This module defines input and output schemas for:
 *
 * Project Lifecycle Operations (GHAPI-19 to GHAPI-20):
 * - close_project (GHAPI-19)
 * - reopen_project (GHAPI-20)
 *
 * Draft Issue Operations (GHAPI-21):
 * - convert_draft_issue_to_issue (GHAPI-21)
 *
 * Item Position Operations (GHAPI-22):
 * - update_item_position (GHAPI-22)
 *
 * Advanced Search and Filter (GHAPI-23 to GHAPI-24):
 * - search_issues_advanced (GHAPI-23)
 * - filter_project_items (GHAPI-24)
 */

import { z } from "zod";

// ============================================================================
// Project Lifecycle Input Schemas
// ============================================================================

/**
 * Input schema for close_project tool (GHAPI-19).
 *
 * Closes a project. Closed projects are hidden from default views but
 * retain all their data and can be reopened.
 */
export const CloseProjectInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
});

export type CloseProjectInput = z.infer<typeof CloseProjectInputSchema>;

/**
 * Input schema for reopen_project tool (GHAPI-20).
 *
 * Reopens a previously closed project, making it visible in default views again.
 */
export const ReopenProjectInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
});

export type ReopenProjectInput = z.infer<typeof ReopenProjectInputSchema>;

// ============================================================================
// Draft Issue Conversion Input Schema
// ============================================================================

/**
 * Input schema for convert_draft_issue_to_issue tool (GHAPI-21).
 *
 * Converts a draft issue in a project to a real GitHub issue in a repository.
 * The draft issue must be a ProjectV2Item with DraftIssue content.
 */
export const ConvertDraftIssueInputSchema = z.object({
  /** ProjectV2Item ID of the draft issue (e.g., 'PVTI_...') */
  itemId: z.string().min(1, "Item ID is required").describe("ProjectV2Item ID of the draft issue"),
  /** Target repository owner (username or organization) */
  owner: z.string().min(1, "Owner is required").describe("Target repository owner"),
  /** Target repository name */
  repo: z.string().min(1, "Repository name is required").describe("Target repository name"),
});

export type ConvertDraftIssueInput = z.infer<typeof ConvertDraftIssueInputSchema>;

// ============================================================================
// Item Position Input Schema
// ============================================================================

/**
 * Input schema for update_item_position tool (GHAPI-22).
 *
 * Changes the position of an item within a project. Items can be moved
 * to the top (first position) or placed after another item.
 */
export const UpdateItemPositionInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** ProjectV2Item ID to move (e.g., 'PVTI_...') */
  itemId: z.string().min(1, "Item ID is required").describe("ProjectV2Item ID to move"),
  /** Item ID to place after (omit to move to first position) */
  afterId: z.string().optional().describe("Item ID to place after (omit for first position)"),
});

export type UpdateItemPositionInput = z.infer<typeof UpdateItemPositionInputSchema>;

// ============================================================================
// Advanced Search Input Schema
// ============================================================================

/**
 * Input schema for search_issues_advanced tool (GHAPI-23).
 *
 * Searches issues using GitHub's advanced query syntax with support for
 * AND/OR operators, grouping with parentheses, and exclusion with - or NOT.
 *
 * Example queries:
 * - "is:issue AND repo:owner/repo AND label:bug"
 * - "is:issue AND (label:critical OR label:urgent) AND state:open"
 * - "is:issue AND assignee:@me AND -label:wontfix"
 */
export const SearchIssuesAdvancedInputSchema = z.object({
  /** GitHub search query with AND/OR support */
  query: z.string().min(1, "Query is required").describe("GitHub search query with AND/OR support"),
  /** Number of results to return (default: 20, max: 100) */
  first: z.number().int().positive().max(100).optional().default(20).describe("Number of results to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type SearchIssuesAdvancedInput = z.infer<typeof SearchIssuesAdvancedInputSchema>;

// ============================================================================
// Filter Project Items Input Schema
// ============================================================================

/**
 * Filter criteria for project items.
 *
 * All filter fields are optional and combined with AND logic.
 * Note: GitHub API does not support server-side filtering; filtering is done client-side.
 */
export const ProjectItemFilterSchema = z.object({
  /** Single select field value (e.g., status value like 'In Progress') */
  status: z.string().optional().describe("Single select field value to match"),
  /** Label names to match (item must have all specified labels) */
  labels: z.array(z.string()).optional().describe("Label names to match"),
  /** Assignee login to match */
  assignee: z.string().optional().describe("Assignee login to match"),
  /** Item content type to match */
  type: z.enum(["Issue", "PullRequest", "DraftIssue"]).optional().describe("Item content type"),
});

export type ProjectItemFilter = z.infer<typeof ProjectItemFilterSchema>;

/**
 * Input schema for filter_project_items tool (GHAPI-24).
 *
 * Filters items within a project based on various criteria.
 * Note: GitHub API does not support server-side filtering, so all items
 * are fetched and filtered client-side.
 */
export const FilterProjectItemsInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required").describe("Project node ID"),
  /** Filter criteria (all conditions combined with AND) */
  filter: ProjectItemFilterSchema.describe("Filter criteria"),
  /** Number of items to return (default: 50, max: 100) */
  first: z.number().int().positive().max(100).optional().default(50).describe("Number of items to return"),
  /** Cursor for pagination */
  after: z.string().optional().describe("Pagination cursor"),
});

export type FilterProjectItemsInput = z.infer<typeof FilterProjectItemsInputSchema>;

// ============================================================================
// Project Lifecycle Output Schemas
// ============================================================================

/**
 * Output schema for project lifecycle operations (close/reopen).
 *
 * Returns the updated project state after closing or reopening.
 */
export const ProjectLifecycleOutputSchema = z.object({
  /** Project node ID */
  id: z.string(),
  /** Project title */
  title: z.string(),
  /** Whether the project is currently closed */
  closed: z.boolean(),
  /** URL to the project */
  url: z.string(),
});

export type ProjectLifecycleOutput = z.infer<typeof ProjectLifecycleOutputSchema>;

// ============================================================================
// Draft Issue Conversion Output Schema
// ============================================================================

/**
 * Output schema for convert_draft_issue_to_issue tool.
 *
 * Returns information about the newly created issue and updated project item.
 */
export const ConvertedIssueOutputSchema = z.object({
  /** Updated ProjectV2Item ID */
  itemId: z.string(),
  /** Created issue node ID */
  issueId: z.string(),
  /** Created issue number */
  issueNumber: z.number(),
  /** Issue title (preserved from draft) */
  title: z.string(),
  /** URL to the created issue */
  url: z.string(),
  /** Repository in owner/repo format */
  repository: z.string(),
});

export type ConvertedIssueOutput = z.infer<typeof ConvertedIssueOutputSchema>;

// ============================================================================
// Item Position Output Schema
// ============================================================================

/**
 * Output schema for update_item_position tool.
 *
 * Confirms the item was moved to the specified position.
 */
export const ItemPositionOutputSchema = z.object({
  /** Whether the position update succeeded */
  success: z.boolean(),
  /** ID of the moved item */
  itemId: z.string(),
  /** New position description ('first' or 'after {id}') */
  position: z.string(),
});

export type ItemPositionOutput = z.infer<typeof ItemPositionOutputSchema>;

// ============================================================================
// Advanced Search Output Schemas
// ============================================================================

/**
 * Schema for pagination info in list responses.
 */
export const PageInfoSchema = z.object({
  /** Whether there are more results available */
  hasNextPage: z.boolean(),
  /** Cursor to use for fetching the next page (null if no more pages) */
  endCursor: z.string().nullable(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;

/**
 * Schema for an individual issue in search results.
 */
export const SearchIssueItemSchema = z.object({
  /** Issue node ID */
  id: z.string(),
  /** Issue number within the repository */
  number: z.number(),
  /** Issue title */
  title: z.string(),
  /** Issue state (OPEN or CLOSED) */
  state: z.enum(["OPEN", "CLOSED"]),
  /** URL to the issue */
  url: z.string(),
  /** Label names attached to the issue */
  labels: z.array(z.string()),
  /** Assignee logins */
  assignees: z.array(z.string()),
  /** Repository in owner/repo format */
  repository: z.string(),
});

export type SearchIssueItem = z.infer<typeof SearchIssueItemSchema>;

/**
 * Output schema for search_issues_advanced tool.
 *
 * Returns a paginated list of issues matching the search query.
 */
export const SearchIssuesOutputSchema = z.object({
  /** Total number of issues matching the query */
  totalCount: z.number(),
  /** Array of matching issues */
  issues: z.array(SearchIssueItemSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
});

export type SearchIssuesOutput = z.infer<typeof SearchIssuesOutputSchema>;

// ============================================================================
// Filter Project Items Output Schemas
// ============================================================================

/**
 * Schema for a project item in filter results.
 *
 * Includes item metadata, content information, and field values.
 */
export const ProjectItemSchema = z.object({
  /** ProjectV2Item ID */
  id: z.string(),
  /** Content type (Issue, PullRequest, or DraftIssue) */
  type: z.enum(["Issue", "PullRequest", "DraftIssue"]),
  /** Content node ID (null for draft issues without content) */
  contentId: z.string().nullable(),
  /** Item title */
  title: z.string(),
  /** Item state (OPEN, CLOSED, MERGED, null for drafts) */
  state: z.string().nullable(),
  /** Label names (empty array for drafts and PRs without labels) */
  labels: z.array(z.string()),
  /** Field values as name-value pairs (null values for unset fields) */
  fieldValues: z.record(z.string(), z.string().nullable()),
});

export type ProjectItem = z.infer<typeof ProjectItemSchema>;

/**
 * Output schema for filter_project_items tool.
 *
 * Returns items matching the filter criteria along with counts.
 */
export const FilterProjectItemsOutputSchema = z.object({
  /** Total number of items in the project (before filtering) */
  totalCount: z.number(),
  /** Number of items after applying filters */
  filteredCount: z.number(),
  /** Array of items matching the filter criteria */
  items: z.array(ProjectItemSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
});

export type FilterProjectItemsOutput = z.infer<typeof FilterProjectItemsOutputSchema>;
