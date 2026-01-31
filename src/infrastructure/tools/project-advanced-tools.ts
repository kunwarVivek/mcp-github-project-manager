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

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  UpdateItemPositionInputSchema,
  UpdateItemPositionInput,
  SearchIssuesAdvancedInputSchema,
  SearchIssuesAdvancedInput,
  FilterProjectItemsInputSchema,
  FilterProjectItemsInput,
  ProjectItemFilter,
  ItemPositionOutputSchema,
  ItemPositionOutput,
  SearchIssuesOutputSchema,
  SearchIssuesOutput,
  SearchIssueItem,
  FilterProjectItemsOutputSchema,
  FilterProjectItemsOutput,
  ProjectItem,
} from "./schemas/project-lifecycle-schemas.js";

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const UPDATE_ITEM_POSITION_MUTATION = `
  mutation UpdateProjectV2ItemPosition($input: UpdateProjectV2ItemPositionInput!) {
    updateProjectV2ItemPosition(input: $input) {
      items(first: 5) {
        nodes {
          id
        }
      }
    }
  }
`;

const SEARCH_ISSUES_ADVANCED_QUERY = `
  query SearchIssuesAdvanced($query: String!, $first: Int!, $after: String) {
    search(query: $query, type: ISSUE, first: $first, after: $after) {
      issueCount
      nodes {
        ... on Issue {
          id
          number
          title
          state
          url
          labels(first: 10) {
            nodes { name }
          }
          assignees(first: 5) {
            nodes { login }
          }
          repository {
            nameWithOwner
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const LIST_PROJECT_ITEMS_QUERY = `
  query ListProjectItems($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          totalCount
          nodes {
            id
            content {
              __typename
              ... on Issue {
                id
                title
                state
                labels(first: 10) { nodes { name } }
                assignees(first: 5) { nodes { login } }
              }
              ... on PullRequest {
                id
                title
                state
              }
              ... on DraftIssue {
                id
                title
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ... on ProjectV2Field { name } }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GitHubRepositoryFactory from environment variables.
 *
 * Advanced operations work at the project level (via projectId), so owner/repo
 * are only needed for factory initialization. We use placeholders since these
 * operations don't actually require a specific repo context.
 */
function createFactory(): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Owner/repo are required by factory but not used for advanced operations
  // which work purely with project node IDs
  const owner = process.env.GITHUB_OWNER || "placeholder";
  const repo = process.env.GITHUB_REPO || "placeholder";

  return new GitHubRepositoryFactory(token, owner, repo);
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface UpdateItemPositionResponse {
  updateProjectV2ItemPosition: {
    items: {
      nodes: Array<{
        id: string;
      }>;
    };
  };
}

interface SearchIssueNode {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  url: string;
  labels: {
    nodes: Array<{ name: string }>;
  };
  assignees: {
    nodes: Array<{ login: string }>;
  };
  repository: {
    nameWithOwner: string;
  };
}

interface SearchIssuesResponse {
  search: {
    issueCount: number;
    nodes: Array<SearchIssueNode | Record<string, never>>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

interface FieldValueNode {
  name?: string;
  text?: string;
  field?: {
    name: string;
  };
}

interface ProjectItemContentNode {
  __typename: "Issue" | "PullRequest" | "DraftIssue";
  id?: string;
  title?: string;
  state?: string;
  labels?: {
    nodes: Array<{ name: string }>;
  };
  assignees?: {
    nodes: Array<{ login: string }>;
  };
}

interface ProjectItemNode {
  id: string;
  content: ProjectItemContentNode | null;
  fieldValues: {
    nodes: FieldValueNode[];
  };
}

interface ListProjectItemsResponse {
  node: {
    items: {
      totalCount: number;
      nodes: ProjectItemNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
}

/**
 * Client-side filtering helper for project items.
 *
 * IMPORTANT: GitHub API has no server-side filtering for project items,
 * so we fetch all items and filter client-side.
 *
 * @param item - The project item to check
 * @param filter - The filter criteria to apply
 * @returns true if the item matches all filter criteria
 */
function matchesFilter(item: ProjectItemNode, filter: ProjectItemFilter): boolean {
  // Filter by content type
  if (filter.type && item.content?.__typename !== filter.type) {
    return false;
  }

  // Filter by status (single select field value)
  if (filter.status) {
    const statusField = item.fieldValues.nodes.find(
      (fv) => fv.field?.name === "Status"
    );
    if (!statusField || statusField.name !== filter.status) {
      return false;
    }
  }

  // Filter by labels (item must have at least one of the specified labels)
  if (filter.labels?.length) {
    const itemLabels = item.content?.labels?.nodes.map((l) => l.name) || [];
    if (!filter.labels.some((l) => itemLabels.includes(l))) {
      return false;
    }
  }

  // Filter by assignee
  if (filter.assignee) {
    const itemAssignees = item.content?.assignees?.nodes.map((a) => a.login) || [];
    if (!itemAssignees.includes(filter.assignee)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * update_item_position tool (GHAPI-22)
 *
 * Reorders an item within a GitHub ProjectV2. If afterId is omitted,
 * the item moves to the first position. Position changes persist across views.
 */
export const updateItemPositionTool: ToolDefinition<
  UpdateItemPositionInput,
  ItemPositionOutput
> = {
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
 * Moves an item to a new position within a project via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns Success status and position description
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeUpdateItemPosition(
  args: UpdateItemPositionInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ItemPositionOutput;
}> {
  const factory = createFactory();

  const input: {
    projectId: string;
    itemId: string;
    afterId?: string;
  } = {
    projectId: args.projectId,
    itemId: args.itemId,
  };

  // Only include afterId if provided (omit for first position)
  if (args.afterId) {
    input.afterId = args.afterId;
  }

  await factory.graphql<UpdateItemPositionResponse>(
    UPDATE_ITEM_POSITION_MUTATION,
    { input }
  );

  const position = args.afterId ? `after ${args.afterId}` : "first";

  const result: ItemPositionOutput = {
    success: true,
    itemId: args.itemId,
    position: position,
  };

  return {
    content: [
      {
        type: "text",
        text: `Moved item ${args.itemId} to ${position} position`,
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
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeSearchIssuesAdvanced(
  args: SearchIssuesAdvancedInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: SearchIssuesOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<SearchIssuesResponse>(
    SEARCH_ISSUES_ADVANCED_QUERY,
    {
      query: args.query,
      first: args.first ?? 20,
      after: args.after,
    }
  );

  const { search } = response;

  // Filter out non-issue nodes (search can return empty objects for deleted items)
  const issues: SearchIssueItem[] = search.nodes
    .filter((node): node is SearchIssueNode =>
      "id" in node && typeof node.id === "string" && node.id.length > 0
    )
    .map((node) => ({
      id: node.id,
      number: node.number,
      title: node.title,
      state: node.state,
      url: node.url,
      labels: node.labels.nodes.map((l) => l.name),
      assignees: node.assignees.nodes.map((a) => a.login),
      repository: node.repository.nameWithOwner,
    }));

  const result: SearchIssuesOutput = {
    totalCount: search.issueCount,
    issues: issues,
    pageInfo: {
      hasNextPage: search.pageInfo.hasNextPage,
      endCursor: search.pageInfo.endCursor,
    },
  };

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
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeFilterProjectItems(
  args: FilterProjectItemsInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: FilterProjectItemsOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<ListProjectItemsResponse>(
    LIST_PROJECT_ITEMS_QUERY,
    {
      projectId: args.projectId,
      first: args.first ?? 50,
      after: args.after,
    }
  );

  if (!response.node) {
    throw new Error(`Project '${args.projectId}' not found`);
  }

  const { items } = response.node;

  // Apply client-side filtering
  const filteredNodes = items.nodes.filter((node) =>
    matchesFilter(node, args.filter)
  );

  // Transform to output format
  const projectItems: ProjectItem[] = filteredNodes.map((node) => {
    // Build field values map
    const fieldValues: Record<string, string | null> = {};
    for (const fv of node.fieldValues.nodes) {
      if (fv.field?.name) {
        fieldValues[fv.field.name] = fv.name ?? fv.text ?? null;
      }
    }

    return {
      id: node.id,
      type: node.content?.__typename || "DraftIssue",
      contentId: node.content?.id || null,
      title: node.content?.title || "Untitled",
      state: node.content?.state || null,
      labels: node.content?.labels?.nodes.map((l) => l.name) || [],
      fieldValues: fieldValues,
    };
  });

  const result: FilterProjectItemsOutput = {
    totalCount: items.totalCount,
    filteredCount: filteredNodes.length,
    items: projectItems,
    pageInfo: {
      hasNextPage: items.pageInfo.hasNextPage,
      endCursor: items.pageInfo.endCursor,
    },
  };

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
