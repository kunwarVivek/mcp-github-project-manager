import type { IssueTypeDefinition } from "../../../domain/types";
import { BaseGitHubRepository } from "./BaseRepository";

// ============================================================================
// GraphQL Queries and Mutations
//
// GitHub's native issue types. The schema was verified against the live
// API (2026-10-21):
//
//   Issue.issueType: IssueType
//   IssueType { id: ID!, name: String!, color: IssueTypeColor!,
//                description: String, isEnabled: Boolean! }
//   Organization.issueTypes(first, after, ...): IssueTypeConnection
//   Mutation.updateIssueIssueType(input: UpdateIssueIssueTypeInput!)
//     : UpdateIssueIssueTypePayload
//
//   UpdateIssueIssueTypeInput { issueId: ID!, issueTypeId: ID }
//
// The issue type catalogue belongs to the organization — it is read from
// `Organization.issueTypes`, the same place the platform reads the rest of
// the organization-level metadata from.
// ============================================================================

const LIST_ISSUE_TYPES_QUERY = `
  query ListIssueTypes($owner: String!, $repo: String!, $first: Int!) {
    repository(owner: $owner, name: $repo) {
      owner {
        ... on Organization {
          login
          issueTypes(first: $first) {
            nodes {
              id
              name
              color
              description
              isEnabled
            }
          }
        }
      }
    }
  }
`;

const GET_ISSUE_TYPE_QUERY = `
  query GetIssueType($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        number
        labels(first: 100) {
          nodes {
            name
          }
        }
        issueType {
          id
          name
          color
          description
          isEnabled
        }
      }
    }
  }
`;

const UPDATE_ISSUE_TYPE_MUTATION = `
  mutation UpdateIssueIssueType($input: UpdateIssueIssueTypeInput!) {
    updateIssueIssueType(input: $input) {
      issue {
        id
        number
        issueType {
          id
          name
          color
          description
          isEnabled
        }
      }
    }
  }
`;

// ============================================================================
// Response Types
// ============================================================================

interface GitHubIssueType {
  id: string;
  name: string;
  color: string;
  description: string | null;
  isEnabled: boolean;
}

interface ListIssueTypesResponse {
  repository: {
    owner: {
      login?: string;
      issueTypes?: { nodes: GitHubIssueType[] } | null;
    } | null;
  } | null;
}

interface GetIssueTypeResponse {
  node: {
    id: string;
    number: number;
    labels: { nodes: Array<{ name: string }> };
    issueType: GitHubIssueType | null;
  } | null;
}

interface UpdateIssueTypeResponse {
  updateIssueIssueType: {
    issue: {
      id: string;
      number: number;
      issueType: GitHubIssueType | null;
    } | null;
  } | null;
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Repository for GitHub's native issue types.
 *
 * Native issue types replace the platform's `type:bug` label emulation. The
 * repository only speaks the native API; the decision to fall back to the
 * label emulation lives in `GitHubIssueRepository`, which owns the labels.
 */
export class GitHubIssueTypeRepository extends BaseGitHubRepository {
  /**
   * The issue type catalogue of the organization that owns the repository.
   *
   * Issue types are an organization-level feature, so a repository owned by
   * a user account has no catalogue.
   */
  async listIssueTypes(): Promise<IssueTypeDefinition[]> {
    const response = await this.graphql<ListIssueTypesResponse>(LIST_ISSUE_TYPES_QUERY, {
      owner: this.owner,
      repo: this.repo,
      first: 100,
    });

    const nodes = response.repository?.owner?.issueTypes?.nodes ?? [];
    return nodes.map((node) => this.mapIssueType(node));
  }

  /**
   * The native issue type of an issue.
   *
   * The issue's labels come back with the type so the caller can fall back
   * to the `type:` label emulation.
   */
  async getIssueType(issueNodeId: string): Promise<{
    type: IssueTypeDefinition | null;
    labels: string[];
  }> {
    const response = await this.graphql<GetIssueTypeResponse>(GET_ISSUE_TYPE_QUERY, {
      issueId: issueNodeId,
    });

    if (!response.node) {
      throw new Error(`Issue with ID ${issueNodeId} not found`);
    }

    return {
      type: response.node.issueType ? this.mapIssueType(response.node.issueType) : null,
      labels: response.node.labels?.nodes?.map((node) => node.name) ?? [],
    };
  }

  /**
   * Sets the native issue type of an issue.
   *
   * @param issueNodeId - Node id of the issue
   * @param issueTypeId - Node id of the issue type (`IT_...`); `null` clears it
   */
  async setIssueType(
    issueNodeId: string,
    issueTypeId: string | null
  ): Promise<IssueTypeDefinition | null> {
    const response = await this.graphql<UpdateIssueTypeResponse>(UPDATE_ISSUE_TYPE_MUTATION, {
      input: {
        issueId: issueNodeId,
        issueTypeId,
      },
    });

    const issue = response.updateIssueIssueType?.issue;
    if (!issue) {
      throw new Error(`Issue with ID ${issueNodeId} not found`);
    }

    return issue.issueType ? this.mapIssueType(issue.issueType) : null;
  }

  /** Map GitHub's issue type onto the domain type. */
  private mapIssueType(githubType: GitHubIssueType): IssueTypeDefinition {
    return {
      id: githubType.id,
      name: githubType.name,
      color: githubType.color,
      description: githubType.description ?? undefined,
      isEnabled: githubType.isEnabled,
      source: "native",
    };
  }
}
