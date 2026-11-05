/**
 * MCP tools for advanced GitHub Project V2 operations.
 *
 * Provides 3 tools (GHAPI-22 to GHAPI-24):
 * - update_item_position: Reorders an item within a project
 * - search_issues_advanced: Searches issues using AND/OR query syntax
 * - filter_project_items: Filters project items by status/labels/assignee/type
 *
 * Note: filter_project_items performs client-side filtering as GitHub's API
 * does not support server-side filtering for project items.
 */

import { ProjectItemService } from "../../services/ProjectItemService";
import { ProjectSearchService } from "../../services/ProjectSearchService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import {
  type FilterProjectItemsInput,
  FilterProjectItemsInputSchema,
  type FilterProjectItemsOutput,
  FilterProjectItemsOutputSchema,
  type ItemPositionOutput,
  ItemPositionOutputSchema,
  type SearchIssuesAdvancedInput,
  SearchIssuesAdvancedInputSchema,
  type SearchIssuesOutput,
  SearchIssuesOutputSchema,
  type UpdateItemPositionInput,
  UpdateItemPositionInputSchema,
} from "./schemas/project-lifecycle-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";
import { createGitHubFactory } from "./tool-factory";

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * update_item_position tool (GHAPI-22)
 *
 * Reorders an item within a GitHub ProjectV2. If afterId is omitted,
 * the item moves to the first position. Position changes persist across views.
 */
export const updateItemPositionTool: ToolDefinition<UpdateItemPositionInput, ItemPositionOutput> = {
  name: "update_item_position",
  title: "Update Item Position",
  description:
    "Reorders an item within a GitHub ProjectV2. If afterId is omitted, the item moves to the first position. Position changes persist across views.",
  schema: UpdateItemPositionInputSchema as unknown as ToolSchema<UpdateItemPositionInput>,
  outputSchema: ItemPositionOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Move item to top",
      description: "Move an item to the first position",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzgPYx2Y",
      },
    },
    {
      name: "Move item after another",
      description: "Move an item after a specific item",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        itemId: "PVTI_lADOLhQ7gc4AOEbHzgPYx2Y",
        afterId: "PVTI_lADOLhQ7gc4AOEbHzgPYx2Z",
      },
    },
  ],
};

/**
 * search_issues_advanced tool (GHAPI-23)
 *
 * Searches GitHub issues using advanced query syntax with AND/OR operators.
 * Use explicit 'AND' and 'OR' keywords for complex queries.
 */
export const searchIssuesAdvancedTool: ToolDefinition<
  SearchIssuesAdvancedInput,
  SearchIssuesOutput
> = {
  name: "search_issues_advanced",
  title: "Search Issues with Advanced Query",
  description:
    "Searches GitHub issues using advanced query syntax with AND/OR operators. Use explicit 'AND' and 'OR' keywords for complex queries. Example: 'is:issue AND repo:owner/repo AND (label:bug OR label:critical)'.",
  schema: SearchIssuesAdvancedInputSchema as unknown as ToolSchema<SearchIssuesAdvancedInput>,
  outputSchema: SearchIssuesOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Search with AND",
      description: "Search for open bugs in a specific repo",
      args: {
        query: "is:issue AND repo:owner/repo AND label:bug AND state:open",
        first: 20,
      },
    },
    {
      name: "Search with OR grouping",
      description: "Search for critical or high priority issues",
      args: {
        query: "is:issue AND repo:owner/repo AND (label:critical OR label:high-priority)",
        first: 50,
      },
    },
  ],
};

/**
 * filter_project_items tool (GHAPI-24)
 *
 * Filters items in a GitHub ProjectV2 by status, labels, assignee, or type.
 * Note: Filtering is performed client-side as GitHub's API does not support
 * server-side filtering for project items.
 */
export const filterProjectItemsTool: ToolDefinition<
  FilterProjectItemsInput,
  FilterProjectItemsOutput
> = {
  name: "filter_project_items",
  title: "Filter Project Items",
  description:
    "Filters items in a GitHub ProjectV2 by status, labels, assignee, or type. Note: Filtering is performed client-side as GitHub's API does not support server-side filtering for project items.",
  schema: FilterProjectItemsInputSchema as unknown as ToolSchema<FilterProjectItemsInput>,
  outputSchema: FilterProjectItemsOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "Filter by status",
      description: "Get all items with 'In Progress' status",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        filter: {
          status: "In Progress",
        },
        first: 50,
      },
    },
    {
      name: "Filter by labels",
      description: "Get items with bug or critical labels",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        filter: {
          labels: ["bug", "critical"],
        },
        first: 50,
      },
    },
    {
      name: "Filter by type",
      description: "Get only draft issues",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        filter: {
          type: "DraftIssue",
        },
        first: 50,
      },
    },
    {
      name: "Combined filters",
      description: "Get issues assigned to a user with specific status",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        filter: {
          type: "Issue",
          status: "In Review",
          assignee: "octocat",
        },
        first: 50,
      },
    },
  ],
};

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Execute the update_item_position tool.
 *
 * Moves an item to a new position within a project.
 *
 * @param args - Validated input arguments
 * @returns Success status and position description
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeUpdateItemPosition(args: UpdateItemPositionInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ItemPositionOutput;
}> {
  const result: ItemPositionOutput = await new ProjectItemService(
    createGitHubFactory()
  ).updateItemPosition(args);

  return {
    content: [
      {
        type: "text",
        text: `Moved item ${result.itemId} to ${result.position} position`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the search_issues_advanced tool.
 *
 * Searches issues using GitHub's search API with advanced query support.
 *
 * @param args - Validated input arguments
 * @returns Paginated list of matching issues
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeSearchIssuesAdvanced(args: SearchIssuesAdvancedInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: SearchIssuesOutput;
}> {
  const result: SearchIssuesOutput = await new ProjectSearchService(
    createGitHubFactory()
  ).searchIssues(args);

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.totalCount} issue(s) matching query`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the filter_project_items tool.
 *
 * Fetches all items from a project and applies client-side filtering.
 *
 * @param args - Validated input arguments
 * @returns Filtered list of project items with counts
 * @throws Error if no GitHub credential is available or the API call fails
 */
export async function executeFilterProjectItems(args: FilterProjectItemsInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: FilterProjectItemsOutput;
}> {
  const result: FilterProjectItemsOutput = await new ProjectSearchService(
    createGitHubFactory()
  ).filterProjectItems(args);

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.filteredCount} item(s) matching filter (${result.totalCount} total in project)`,
      },
    ],
    structuredContent: result,
  };
}
