import { projectFieldUnionSelection } from "../project-field-fragments";
import { BaseGitHubRepository } from "./BaseRepository";

// ============================================================================
// GraphQL Queries
// ============================================================================

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

/**
 * The selection of the `ProjectV2FieldConfiguration` union.
 *
 * The union has four members (text/number/date/..., single select, multi
 * select, iteration) and a selection that omits one of them makes GitHub
 * reject the whole query with "Could not resolve to a
 * Unions::ProjectV2FieldConfiguration". Every field value therefore selects
 * the union in full - see `projectFieldUnionSelection`.
 */
const PROJECT_FIELD_SELECTION = projectFieldUnionSelection();

/**
 * Reads the field values of a project item.
 *
 * `ProjectV2ItemFieldValue` is a union of thirteen members; the reader selects
 * all of them, so every value kind a project item can carry - not just the
 * single-select and text ones - is visible to a client.
 */
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
                __typename
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldIterationValue {
                  title
                  iterationId
                  startDate
                  duration
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldLabelValue {
                  labels(first: 20) { nodes { name } }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldMilestoneValue {
                  milestone { title }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldMultiSelectValue {
                  options { name }
                  value
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldPullRequestValue {
                  pullRequests(first: 20) { nodes { number } }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldRepositoryValue {
                  repository { nameWithOwner }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldReviewerValue {
                  reviewers(first: 20) {
                    nodes {
                      ... on Bot { login }
                      ... on EnterpriseTeam { name }
                      ... on Mannequin { login }
                      ... on Team { name }
                      ... on User { login }
                    }
                  }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  optionId
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemFieldUserValue {
                  users(first: 20) { nodes { login } }
                  field { ${PROJECT_FIELD_SELECTION} }
                }
                ... on ProjectV2ItemIssueFieldValue {
                  issueFieldValue {
                    __typename
                    ... on IssueFieldDateValue { value }
                    ... on IssueFieldMultiSelectValue { value options { name } }
                    ... on IssueFieldNumberValue { value }
                    ... on IssueFieldSingleSelectValue { value name }
                    ... on IssueFieldTextValue { value }
                  }
                  field { ${PROJECT_FIELD_SELECTION} }
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
// Types
// ============================================================================

export interface SearchPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

/** An issue as returned by GitHub's search connection. */
export interface SearchIssueNode {
  id: string;
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  url: string;
  labels: { nodes: Array<{ name: string }> };
  assignees: { nodes: Array<{ login: string }> };
  repository: { nameWithOwner: string };
}

/** A page of issue search results; non-issue/deleted nodes are already dropped. */
export interface IssueSearchPage {
  totalCount: number;
  issues: SearchIssueNode[];
  pageInfo: SearchPageInfo;
}

interface SearchIssuesResponse {
  search: {
    issueCount: number;
    nodes: Array<SearchIssueNode | Record<string, never>>;
    pageInfo: SearchPageInfo;
  };
}

/**
 * The value of an issue field (the `issueFieldValue` of an item field value).
 *
 * `ProjectV2IssueFieldValues` is a union of five members whose `value` has a
 * different type each (float for the number one, string for the rest), so the
 * reader selects them member by member and discriminates on `__typename`.
 */
export interface IssueFieldValueNode {
  __typename?: string;
  value?: string | number | null;
  name?: string | null;
  options?: Array<{ name: string }> | null;
}

/**
 * A field value of a project item.
 *
 * `ProjectV2ItemFieldValue` is a union of thirteen members; the reader selects
 * all of them and discriminates on `__typename`.
 */
export interface ProjectItemFieldValueNode {
  __typename?: string;
  /** The name of the selected option (single select). */
  name?: string | null;
  optionId?: string | null;
  /** The text of a text field. */
  text?: string | null;
  /** The date of a date field, e.g. "2024-01-01". */
  date?: string | null;
  /** The number of a number field. */
  number?: number | null;
  /** The title of an iteration field. */
  title?: string | null;
  iterationId?: string | null;
  milestone?: { title?: string | null } | null;
  repository?: { nameWithOwner?: string | null } | null;
  labels?: { nodes: Array<{ name: string }> } | null;
  users?: { nodes: Array<{ login: string }> } | null;
  pullRequests?: { nodes: Array<{ number: number }> } | null;
  reviewers?: { nodes: Array<{ login?: string | null; name?: string | null }> } | null;
  /** The selected options of a multi select field. */
  options?: Array<{ name: string }> | null;
  issueFieldValue?: IssueFieldValueNode | null;
  field?: { name?: string | null } | null;
}

export interface ProjectItemContentNode {
  __typename: "Issue" | "PullRequest" | "DraftIssue";
  id?: string;
  title?: string;
  state?: string;
  labels?: { nodes: Array<{ name: string }> };
  assignees?: { nodes: Array<{ login: string }> };
}

export interface ProjectItemNode {
  id: string;
  content: ProjectItemContentNode | null;
  fieldValues: { nodes: ProjectItemFieldValueNode[] };
}

/** One page of a project's items with their field values. */
export interface ProjectItemsPage {
  totalCount: number;
  items: ProjectItemNode[];
  pageInfo: SearchPageInfo;
}

interface ListProjectItemsResponse {
  node: {
    items: {
      totalCount: number;
      nodes: ProjectItemNode[];
      pageInfo: SearchPageInfo;
    };
  } | null;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Read-only repository for GitHub-side search: issue search and the items of a
 * project with every field value kind.
 */
export class GitHubProjectSearchRepository extends BaseGitHubRepository {
  /**
   * Search issues with GitHub's search syntax (AND/OR supported).
   *
   * Nodes that are not issues (the search connection yields empty objects for
   * deleted items) are dropped.
   */
  async searchIssues(query: string, first: number, after?: string): Promise<IssueSearchPage> {
    const response = await this.graphql<SearchIssuesResponse>(SEARCH_ISSUES_ADVANCED_QUERY, {
      query,
      first,
      after,
    });

    const { search } = response;

    return {
      totalCount: search.issueCount,
      issues: search.nodes.filter(
        (node): node is SearchIssueNode =>
          "id" in node && typeof node.id === "string" && node.id.length > 0
      ),
      pageInfo: search.pageInfo,
    };
  }

  /**
   * Fetch one page of the items of a project.
   *
   * @throws Error if the project does not exist.
   */
  async listProjectItems(
    projectId: string,
    first: number,
    after?: string
  ): Promise<ProjectItemsPage> {
    const response = await this.graphql<ListProjectItemsResponse>(LIST_PROJECT_ITEMS_QUERY, {
      projectId,
      first,
      after,
    });

    if (!response.node) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const { items } = response.node;
    return { totalCount: items.totalCount, items: items.nodes, pageInfo: items.pageInfo };
  }
}
