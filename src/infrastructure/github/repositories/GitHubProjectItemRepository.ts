import { BaseGitHubRepository } from "./BaseRepository";

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

const CONVERT_DRAFT_ISSUE_MUTATION = `
  mutation ConvertProjectV2DraftIssueItemToIssue($input: ConvertProjectV2DraftIssueItemToIssueInput!) {
    convertProjectV2DraftIssueItemToIssue(input: $input) {
      item {
        id
        content {
          ... on Issue {
            id
            number
            title
            url
            repository {
              nameWithOwner
            }
          }
        }
      }
    }
  }
`;

// `$repoOwner`/`$repoName` rather than `$owner`/`$repo`: the base repository
// injects its own configured owner and repo under those two names, which would
// silently overwrite the target repository's.
const RESOLVE_REPOSITORY_ID_QUERY = `
  query ResolveRepositoryId($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      id
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

/** The issue a draft was converted into, and the project item that now wraps it. */
export interface ConvertedDraftIssue {
  itemId: string;
  issueId: string;
  issueNumber: number;
  title: string;
  url: string;
  /** Repository in owner/repo format. */
  repository: string;
}

interface ConvertDraftIssueResponse {
  convertProjectV2DraftIssueItemToIssue: {
    item: {
      id: string;
      content: {
        id: string;
        number: number;
        title: string;
        url: string;
        repository: { nameWithOwner: string };
      } | null;
    };
  };
}

interface ResolveRepositoryIdResponse {
  repository: { id: string } | null;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Repository for GitHub Project V2 item mutations that are addressed by node
 * ID: converting a draft issue to a real issue and reordering an item.
 */
export class GitHubProjectItemRepository extends BaseGitHubRepository {
  /**
   * Resolve a repository's owner/name to its GraphQL node ID.
   *
   * @throws Error if the repository does not exist.
   */
  async resolveRepositoryId(owner: string, name: string): Promise<string> {
    const response = await this.graphql<ResolveRepositoryIdResponse>(RESOLVE_REPOSITORY_ID_QUERY, {
      repoOwner: owner,
      repoName: name,
    });

    if (!response.repository) {
      throw new Error(`Repository '${owner}/${name}' not found`);
    }

    return response.repository.id;
  }

  /**
   * Convert a draft issue project item into an issue of the given repository.
   *
   * @param itemId - ProjectV2Item node ID of the draft issue
   * @param repositoryId - Node ID of the target repository
   */
  async convertDraftIssue(itemId: string, repositoryId: string): Promise<ConvertedDraftIssue> {
    const response = await this.graphql<ConvertDraftIssueResponse>(CONVERT_DRAFT_ISSUE_MUTATION, {
      input: { itemId, repositoryId },
    });

    const item = response.convertProjectV2DraftIssueItemToIssue.item;
    const issue = item.content;
    if (!issue) {
      throw new Error(`Item '${itemId}' was not converted to an issue (is it a draft issue?)`);
    }

    return {
      itemId: item.id,
      issueId: issue.id,
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url,
      repository: issue.repository.nameWithOwner,
    };
  }

  /**
   * Move an item within a project.
   *
   * @param afterId - Item to place the moved item after; omit for first position
   */
  async updateItemPosition(projectId: string, itemId: string, afterId?: string): Promise<void> {
    const input: { projectId: string; itemId: string; afterId?: string } = { projectId, itemId };
    if (afterId) {
      input.afterId = afterId;
    }

    await this.graphql(UPDATE_ITEM_POSITION_MUTATION, { input });
  }
}
