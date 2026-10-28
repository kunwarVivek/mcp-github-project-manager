import { BaseGitHubRepository } from "./BaseRepository";

// ============================================================================
// GraphQL Queries and Mutations
//
// The native "blocked by" edges of GitHub's issue graph. The schema was
// verified against the live API (2026-10-21):
//
//   Issue.blockedBy(orderBy, after, before, first, last): IssueConnection!
//   Issue.blocking(orderBy, after, before, first, last): IssueConnection!
//   Mutation.addBlockedBy(input: AddBlockedByInput!): AddBlockedByPayload
//   Mutation.removeBlockedBy(input: RemoveBlockedByInput!): RemoveBlockedByPayload
//
//   AddBlockedByInput    { issueId: ID!, blockingIssueId: ID! }
//   RemoveBlockedByInput { issueId: ID!, blockingIssueId: ID! }
//
// `issueId` is the blocked issue, `blockingIssueId` is the issue that blocks
// it.
// ============================================================================

const LIST_BLOCKERS_QUERY = `
  query ListBlockers($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        number
        labels(first: 100) {
          nodes {
            name
          }
        }
        blockedBy(first: 100) {
          nodes {
            id
            number
            title
            state
          }
        }
      }
    }
  }
`;

const LIST_BLOCKING_QUERY = `
  query ListBlocking($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        number
        blocking(first: 100) {
          nodes {
            id
            number
            title
            state
          }
        }
      }
    }
  }
`;

const ADD_BLOCKED_BY_MUTATION = `
  mutation AddBlockedBy($input: AddBlockedByInput!) {
    addBlockedBy(input: $input) {
      issue {
        id
        number
      }
      blockingIssue {
        id
        number
        title
        state
      }
    }
  }
`;

const REMOVE_BLOCKED_BY_MUTATION = `
  mutation RemoveBlockedBy($input: RemoveBlockedByInput!) {
    removeBlockedBy(input: $input) {
      issue {
        id
        number
      }
      blockingIssue {
        id
        number
      }
    }
  }
`;

// ============================================================================
// Response Types
// ============================================================================

/** One end of a native issue edge. */
export interface IssueEdgeNode {
  id: string;
  number: number;
  title: string;
  state: string;
}

interface ListBlockersResponse {
  node: {
    id: string;
    number: number;
    labels: { nodes: Array<{ name: string }> };
    blockedBy: { nodes: IssueEdgeNode[] } | null;
  } | null;
}

interface ListBlockingResponse {
  node: {
    id: string;
    number: number;
    blocking: { nodes: IssueEdgeNode[] } | null;
  } | null;
}

interface AddBlockedByResponse {
  addBlockedBy: {
    issue: { id: string; number: number };
    blockingIssue: IssueEdgeNode | null;
  } | null;
}

interface RemoveBlockedByResponse {
  removeBlockedBy: {
    issue: { id: string; number: number };
    blockingIssue: { id: string; number: number } | null;
  } | null;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Repository for GitHub's native issue dependency edges ("blocked by").
 *
 * These edges are the platform's replacement for the `blocked-by:#123`
 * label emulation. The repository only speaks the native API; the decision
 * to fall back to the label emulation lives in `GitHubIssueRepository`,
 * which owns the labels.
 */
export class GitHubIssueDependencyRepository extends BaseGitHubRepository {
  /**
   * The issues that block the given issue.
   *
   * The issue's labels come back with the edges so the caller can merge the
   * legacy `blocked-by:#123` emulation into the result.
   */
  async listBlockers(issueNodeId: string): Promise<{
    edges: IssueEdgeNode[];
    labels: string[];
  }> {
    const response = await this.graphql<ListBlockersResponse>(LIST_BLOCKERS_QUERY, {
      issueId: issueNodeId,
    });

    if (!response.node) {
      throw new Error(`Issue with ID ${issueNodeId} not found`);
    }

    return {
      edges: response.node.blockedBy?.nodes ?? [],
      labels: response.node.labels?.nodes?.map((node) => node.name) ?? [],
    };
  }

  /** The issues the given issue blocks. */
  async listBlocking(issueNodeId: string): Promise<IssueEdgeNode[]> {
    const response = await this.graphql<ListBlockingResponse>(LIST_BLOCKING_QUERY, {
      issueId: issueNodeId,
    });

    if (!response.node) {
      throw new Error(`Issue with ID ${issueNodeId} not found`);
    }

    return response.node.blocking?.nodes ?? [];
  }

  /**
   * Makes an issue blocked by another one.
   *
   * @param issueNodeId - Node id of the blocked issue
   * @param blockingNodeId - Node id of the issue that blocks it
   */
  async addBlocker(issueNodeId: string, blockingNodeId: string): Promise<IssueEdgeNode> {
    const response = await this.graphql<AddBlockedByResponse>(ADD_BLOCKED_BY_MUTATION, {
      input: {
        issueId: issueNodeId,
        blockingIssueId: blockingNodeId,
      },
    });

    const payload = response.addBlockedBy;
    if (!payload?.blockingIssue) {
      throw new Error(
        `Could not add "blocked by" edge: issue ${issueNodeId} is not blocked by ${blockingNodeId}`
      );
    }

    return payload.blockingIssue;
  }

  /**
   * Removes a "blocked by" edge.
   *
   * @param issueNodeId - Node id of the blocked issue
   * @param blockingNodeId - Node id of the issue that blocks it
   */
  async removeBlocker(issueNodeId: string, blockingNodeId: string): Promise<void> {
    await this.graphql<RemoveBlockedByResponse>(REMOVE_BLOCKED_BY_MUTATION, {
      input: {
        issueId: issueNodeId,
        blockingIssueId: blockingNodeId,
      },
    });
  }
}
