import { BaseGitHubRepository } from "./BaseRepository";
import {
  StatusUpdate,
  StatusUpdateOptions,
  StatusUpdateListResult,
  StatusUpdateStatus,
  StatusUpdateCreator,
} from "./types";

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface StatusUpdateNode {
  id: string;
  body: string;
  bodyHTML: string;
  status: StatusUpdateStatus;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  creator: {
    login: string;
  };
}

interface CreateStatusUpdateResponse {
  createProjectV2StatusUpdate: {
    statusUpdate: StatusUpdateNode;
  };
}

interface ListStatusUpdatesResponse {
  node: {
    statusUpdates: {
      nodes: StatusUpdateNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      totalCount: number;
    };
  } | null;
}

interface GetStatusUpdateResponse {
  node: StatusUpdateNode | null;
}

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const CREATE_STATUS_UPDATE_MUTATION = `
  mutation CreateProjectV2StatusUpdate($input: CreateProjectV2StatusUpdateInput!) {
    createProjectV2StatusUpdate(input: $input) {
      statusUpdate {
        id
        body
        bodyHTML
        status
        startDate
        targetDate
        createdAt
        creator {
          login
        }
      }
    }
  }
`;

const LIST_STATUS_UPDATES_QUERY = `
  query ListProjectStatusUpdates($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        statusUpdates(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            id
            body
            bodyHTML
            status
            startDate
            targetDate
            createdAt
            creator {
              login
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
          totalCount
        }
      }
    }
  }
`;

const GET_STATUS_UPDATE_QUERY = `
  query GetStatusUpdate($statusUpdateId: ID!) {
    node(id: $statusUpdateId) {
      ... on ProjectV2StatusUpdate {
        id
        body
        bodyHTML
        status
        startDate
        targetDate
        createdAt
        creator {
          login
        }
      }
    }
  }
`;

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Repository for managing GitHub Project V2 status updates.
 *
 * Status updates allow project managers to communicate project status
 * with predefined status values (ON_TRACK, AT_RISK, OFF_TRACK, COMPLETE, INACTIVE).
 */
export class GitHubStatusUpdateRepository extends BaseGitHubRepository {
  /**
   * Convert a GraphQL status update node to a StatusUpdate object.
   */
  private mapStatusUpdateNode(node: StatusUpdateNode): StatusUpdate {
    return {
      id: node.id,
      body: node.body,
      bodyHTML: node.bodyHTML,
      status: node.status,
      startDate: node.startDate ?? undefined,
      targetDate: node.targetDate ?? undefined,
      createdAt: node.createdAt,
      creator: {
        login: node.creator.login,
      },
    };
  }

  /**
   * Create a new status update for a project.
   *
   * @param projectId - Node ID of the project (e.g., 'PVT_kwDO...')
   * @param body - The status update message (supports Markdown)
   * @param options - Optional status, startDate, and targetDate
   * @returns The created status update
   */
  async createStatusUpdate(
    projectId: string,
    body: string,
    options?: StatusUpdateOptions
  ): Promise<StatusUpdate> {
    const input: Record<string, unknown> = {
      projectId,
      body,
    };

    if (options?.status) {
      input.status = options.status;
    }
    if (options?.startDate) {
      input.startDate = options.startDate;
    }
    if (options?.targetDate) {
      input.targetDate = options.targetDate;
    }

    const response = await this.graphql<CreateStatusUpdateResponse>(
      CREATE_STATUS_UPDATE_MUTATION,
      { input }
    );

    return this.mapStatusUpdateNode(response.createProjectV2StatusUpdate.statusUpdate);
  }

  /**
   * List status updates for a project.
   *
   * Status updates are returned in descending order by creation date.
   *
   * @param projectId - Node ID of the project
   * @param first - Number of status updates to return (default: 20, max: 100)
   * @param after - Cursor for pagination
   * @returns List of status updates with pagination info
   */
  async listStatusUpdates(
    projectId: string,
    first: number = 20,
    after?: string
  ): Promise<StatusUpdateListResult> {
    const response = await this.graphql<ListStatusUpdatesResponse>(
      LIST_STATUS_UPDATES_QUERY,
      {
        projectId,
        first: Math.min(first, 100),
        after: after || null,
      }
    );

    if (!response.node) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    const statusUpdates: StatusUpdate[] = response.node.statusUpdates.nodes.map(
      (node) => this.mapStatusUpdateNode(node)
    );

    return {
      statusUpdates,
      pageInfo: {
        hasNextPage: response.node.statusUpdates.pageInfo.hasNextPage,
        endCursor: response.node.statusUpdates.pageInfo.endCursor ?? undefined,
      },
      totalCount: response.node.statusUpdates.totalCount,
    };
  }

  /**
   * Get a single status update by ID.
   *
   * @param statusUpdateId - Node ID of the status update
   * @returns The status update if found, null otherwise
   */
  async getStatusUpdate(statusUpdateId: string): Promise<StatusUpdate | null> {
    const response = await this.graphql<GetStatusUpdateResponse>(
      GET_STATUS_UPDATE_QUERY,
      {
        statusUpdateId,
      }
    );

    if (!response.node) {
      return null;
    }

    return this.mapStatusUpdateNode(response.node);
  }
}
