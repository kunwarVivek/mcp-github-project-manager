import { BaseGitHubRepository } from "./BaseRepository";
import {
  SubIssueListItem,
  SubIssueListResult,
  SubIssueResult,
  ParentIssueResult,
} from "./types";

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface AddSubIssueResponse {
  addSubIssue: {
    issue: {
      id: string;
      title: string;
    };
    subIssue: {
      id: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED';
      url: string;
    };
  };
}

interface RemoveSubIssueResponse {
  removeSubIssue: {
    issue: {
      id: string;
    };
    subIssue: {
      id: string;
    };
  };
}

interface ReprioritizeSubIssueResponse {
  reprioritizeSubIssue: {
    issue: {
      id: string;
      title: string;
    };
    subIssue: {
      id: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED';
      url: string;
    };
  };
}

interface ListSubIssuesResponse {
  node: {
    subIssues: {
      nodes: Array<{
        id: string;
        number: number;
        title: string;
        state: 'OPEN' | 'CLOSED';
        url: string;
      }>;
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      totalCount: number;
    };
    subIssuesSummary: {
      total: number;
      completed: number;
      percentCompleted: number;
    };
  } | null;
}

interface GetParentIssueResponse {
  node: {
    parent: {
      id: string;
      number: number;
      title: string;
      state: 'OPEN' | 'CLOSED';
      url: string;
    } | null;
  } | null;
}

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const ADD_SUB_ISSUE_MUTATION = `
  mutation AddSubIssue($input: AddSubIssueInput!) {
    addSubIssue(input: $input) {
      issue {
        id
        title
      }
      subIssue {
        id
        number
        title
        state
        url
      }
    }
  }
`;

const REMOVE_SUB_ISSUE_MUTATION = `
  mutation RemoveSubIssue($input: RemoveSubIssueInput!) {
    removeSubIssue(input: $input) {
      issue {
        id
      }
      subIssue {
        id
      }
    }
  }
`;

const REPRIORITIZE_SUB_ISSUE_MUTATION = `
  mutation ReprioritizeSubIssue($input: ReprioritizeSubIssueInput!) {
    reprioritizeSubIssue(input: $input) {
      issue {
        id
        title
      }
      subIssue {
        id
        number
        title
        state
        url
      }
    }
  }
`;

const LIST_SUB_ISSUES_QUERY = `
  query ListSubIssues($issueId: ID!, $first: Int!, $after: String) {
    node(id: $issueId) {
      ... on Issue {
        subIssues(first: $first, after: $after) {
          nodes {
            id
            number
            title
            state
            url
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
        subIssuesSummary {
          total
          completed
          percentCompleted
        }
      }
    }
  }
`;

const GET_PARENT_ISSUE_QUERY = `
  query GetParentIssue($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        parent {
          id
          number
          title
          state
          url
        }
      }
    }
  }
`;

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Repository for managing GitHub sub-issue relationships.
 *
 * Sub-issues allow creating parent-child hierarchies between issues.
 * GitHub enforces a maximum depth of 8 levels and 100 sub-issues per parent.
 *
 * Note: All operations require the 'sub_issues' GraphQL feature flag.
 */
export class GitHubSubIssueRepository extends BaseGitHubRepository {
  private static readonly SUB_ISSUES_FEATURE = ['sub_issues'];

  /**
   * Add an existing issue as a sub-issue of a parent issue.
   *
   * @param parentIssueId - Node ID of the parent issue (e.g., 'I_kwDO...')
   * @param subIssueId - Node ID of the issue to add as sub-issue
   * @param replaceParent - If true, replaces existing parent; if false (default), fails if issue already has a parent
   * @returns The created sub-issue relationship
   * @throws Error if the issue already has a parent and replaceParent is false
   * @throws Error if max depth (8 levels) would be exceeded
   * @throws Error if parent already has 100 sub-issues
   */
  async addSubIssue(
    parentIssueId: string,
    subIssueId: string,
    replaceParent: boolean = false
  ): Promise<SubIssueResult> {
    const response = await this.graphqlWithFeatures<AddSubIssueResponse>(
      ADD_SUB_ISSUE_MUTATION,
      {
        input: {
          issueId: parentIssueId,
          subIssueId: subIssueId,
          replaceParent,
        },
      },
      GitHubSubIssueRepository.SUB_ISSUES_FEATURE
    );

    return {
      issue: {
        id: response.addSubIssue.issue.id,
        title: response.addSubIssue.issue.title,
      },
      subIssue: {
        id: response.addSubIssue.subIssue.id,
        number: response.addSubIssue.subIssue.number,
        title: response.addSubIssue.subIssue.title,
        state: response.addSubIssue.subIssue.state,
        url: response.addSubIssue.subIssue.url,
      },
    };
  }

  /**
   * List sub-issues of a parent issue.
   *
   * @param issueId - Node ID of the parent issue
   * @param first - Number of sub-issues to return (default: 50, max: 100)
   * @param after - Cursor for pagination
   * @returns List of sub-issues with summary and pagination info
   */
  async listSubIssues(
    issueId: string,
    first: number = 50,
    after?: string
  ): Promise<SubIssueListResult> {
    const response = await this.graphqlWithFeatures<ListSubIssuesResponse>(
      LIST_SUB_ISSUES_QUERY,
      {
        issueId,
        first: Math.min(first, 100),
        after: after || null,
      },
      GitHubSubIssueRepository.SUB_ISSUES_FEATURE
    );

    if (!response.node) {
      throw new Error(`Issue with ID ${issueId} not found`);
    }

    const subIssues: SubIssueListItem[] = response.node.subIssues.nodes.map(
      (node, index) => ({
        id: node.id,
        number: node.number,
        title: node.title,
        state: node.state,
        url: node.url,
        position: index,
      })
    );

    return {
      subIssues,
      summary: {
        total: response.node.subIssuesSummary.total,
        completed: response.node.subIssuesSummary.completed,
        percentCompleted: response.node.subIssuesSummary.percentCompleted,
      },
      pageInfo: {
        hasNextPage: response.node.subIssues.pageInfo.hasNextPage,
        endCursor: response.node.subIssues.pageInfo.endCursor ?? undefined,
      },
      totalCount: response.node.subIssues.totalCount,
    };
  }

  /**
   * Get the parent issue of an issue.
   *
   * @param issueId - Node ID of the issue to check
   * @returns The parent issue if it exists, null otherwise
   */
  async getParentIssue(issueId: string): Promise<ParentIssueResult | null> {
    const response = await this.graphqlWithFeatures<GetParentIssueResponse>(
      GET_PARENT_ISSUE_QUERY,
      {
        issueId,
      },
      GitHubSubIssueRepository.SUB_ISSUES_FEATURE
    );

    if (!response.node) {
      throw new Error(`Issue with ID ${issueId} not found`);
    }

    if (!response.node.parent) {
      return null;
    }

    return {
      id: response.node.parent.id,
      number: response.node.parent.number,
      title: response.node.parent.title,
      state: response.node.parent.state,
      url: response.node.parent.url,
    };
  }

  /**
   * Reprioritize (reorder) a sub-issue within its parent's sub-issue list.
   *
   * @param parentIssueId - Node ID of the parent issue
   * @param subIssueId - Node ID of the sub-issue to move
   * @param afterId - Node ID of the sub-issue to place after, or null/undefined to move to beginning
   * @returns The reprioritized sub-issue relationship
   */
  async reprioritizeSubIssue(
    parentIssueId: string,
    subIssueId: string,
    afterId?: string
  ): Promise<SubIssueResult> {
    const response = await this.graphqlWithFeatures<ReprioritizeSubIssueResponse>(
      REPRIORITIZE_SUB_ISSUE_MUTATION,
      {
        input: {
          issueId: parentIssueId,
          subIssueId: subIssueId,
          afterId: afterId || null,
        },
      },
      GitHubSubIssueRepository.SUB_ISSUES_FEATURE
    );

    return {
      issue: {
        id: response.reprioritizeSubIssue.issue.id,
        title: response.reprioritizeSubIssue.issue.title,
      },
      subIssue: {
        id: response.reprioritizeSubIssue.subIssue.id,
        number: response.reprioritizeSubIssue.subIssue.number,
        title: response.reprioritizeSubIssue.subIssue.title,
        state: response.reprioritizeSubIssue.subIssue.state,
        url: response.reprioritizeSubIssue.subIssue.url,
      },
    };
  }

  /**
   * Remove a sub-issue from its parent.
   *
   * This removes the parent-child relationship but does not delete the issue.
   *
   * @param parentIssueId - Node ID of the parent issue
   * @param subIssueId - Node ID of the sub-issue to remove
   */
  async removeSubIssue(
    parentIssueId: string,
    subIssueId: string
  ): Promise<void> {
    await this.graphqlWithFeatures<RemoveSubIssueResponse>(
      REMOVE_SUB_ISSUE_MUTATION,
      {
        input: {
          issueId: parentIssueId,
          subIssueId: subIssueId,
        },
      },
      GitHubSubIssueRepository.SUB_ISSUES_FEATURE
    );
  }
}
