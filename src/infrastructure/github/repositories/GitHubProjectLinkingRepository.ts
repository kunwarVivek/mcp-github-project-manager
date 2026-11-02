import type {
  LinkedRepositoriesPage,
  LinkedRepository,
  LinkedTeam,
  LinkedTeamsPage,
  ProjectLinkingRepository,
} from "../../../domain/project-template-linking-types";
import { ResourceType } from "../../../domain/resource-types";
import type { ProjectItem } from "../../../domain/types";
import { BaseGitHubRepository } from "./BaseRepository";

const ADD_ITEM_MUTATION = `
  mutation($input: AddProjectV2ItemByIdInput!) {
    addProjectV2ItemById(input: $input) {
      item {
        id
        content {
          ... on Issue {
            id
            title
          }
          ... on PullRequest {
            id
            title
          }
        }
      }
    }
  }
`;

const REMOVE_ITEM_MUTATION = `
  mutation($input: DeleteProjectV2ItemInput!) {
    deleteProjectV2Item(input: $input) {
      deletedItemId
    }
  }
`;

const ARCHIVE_ITEM_MUTATION = `
  mutation($input: ArchiveProjectV2ItemInput!) {
    archiveProjectV2Item(input: $input) {
      item {
        id
        isArchived
      }
    }
  }
`;

const UNARCHIVE_ITEM_MUTATION = `
  mutation($input: UnarchiveProjectV2ItemInput!) {
    unarchiveProjectV2Item(input: $input) {
      item {
        id
        isArchived
      }
    }
  }
`;

const LIST_ITEMS_QUERY = `
  query($projectId: ID!, $limit: Int!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $limit) {
          nodes {
            id
            content {
              ... on Issue {
                id
                title
                __typename
              }
              ... on PullRequest {
                id
                title
                __typename
              }
            }
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2Field {
                      id
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldDateValue {
                  date
                  field {
                    ... on ProjectV2Field {
                      id
                      name
                    }
                  }
                }
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      id
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// The repository variables are deliberately not named `owner`/`repo`: the base
// class overwrites those two with the factory's configured repository.
const RESOLVE_REPOSITORY_ID_QUERY = `
  query ResolveRepositoryId($repoOwner: String!, $repoName: String!) {
    repository(owner: $repoOwner, name: $repoName) {
      id
    }
  }
`;

const RESOLVE_TEAM_ID_QUERY = `
  query ResolveTeamId($orgLogin: String!, $teamSlug: String!) {
    organization(login: $orgLogin) {
      team(slug: $teamSlug) {
        id
      }
    }
  }
`;

const LINK_REPOSITORY_MUTATION = `
  mutation LinkProjectV2ToRepository($input: LinkProjectV2ToRepositoryInput!) {
    linkProjectV2ToRepository(input: $input) {
      repository {
        id
        name
        nameWithOwner
        url
        description
      }
    }
  }
`;

const UNLINK_REPOSITORY_MUTATION = `
  mutation UnlinkProjectV2FromRepository($input: UnlinkProjectV2FromRepositoryInput!) {
    unlinkProjectV2FromRepository(input: $input) {
      repository {
        id
      }
    }
  }
`;

const LINK_TEAM_MUTATION = `
  mutation LinkProjectV2ToTeam($input: LinkProjectV2ToTeamInput!) {
    linkProjectV2ToTeam(input: $input) {
      team {
        id
        name
        slug
        description
      }
    }
  }
`;

const UNLINK_TEAM_MUTATION = `
  mutation UnlinkProjectV2FromTeam($input: UnlinkProjectV2FromTeamInput!) {
    unlinkProjectV2FromTeam(input: $input) {
      team {
        id
      }
    }
  }
`;

const LIST_LINKED_REPOSITORIES_QUERY = `
  query ListLinkedRepositories($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        repositories(first: $first, after: $after) {
          nodes {
            id
            name
            nameWithOwner
            url
            description
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

const LIST_LINKED_TEAMS_QUERY = `
  query ListLinkedTeams($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        teams(first: $first, after: $after) {
          nodes {
            id
            name
            slug
            description
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

interface ConnectionResponse<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount: number;
}

interface ListItemsResponse {
  node: {
    items: {
      nodes: Array<{
        id: string;
        content?: { id: string; title: string; __typename: string };
        fieldValues: {
          nodes: Array<{
            text?: string;
            date?: string;
            name?: string;
            field: { id: string; name: string };
          }>;
        };
      }>;
    };
  } | null;
}

/** Attempts for `addProjectV2ItemById` when GitHub reports a transient conflict. */
const ADD_ITEM_ATTEMPTS = 3;

/**
 * GraphQL access to project items and project <-> repository/team links. Runs
 * on the shared throttle/retry path of {@link BaseGitHubRepository}.
 */
export class GitHubProjectLinkingRepository
  extends BaseGitHubRepository
  implements ProjectLinkingRepository
{
  /**
   * GitHub intermittently answers "temporary conflict" when concurrent project
   * mutations race (an item being added/updated by the auto-reclaim scheduler
   * or another client). Retry briefly before surfacing the error.
   */
  async addItem(
    projectId: string,
    contentId: string
  ): Promise<{ itemId: string; contentId: string }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < ADD_ITEM_ATTEMPTS; attempt++) {
      try {
        const response = await this.graphql<{
          addProjectV2ItemById: { item: { id: string; content: { id: string; title: string } } };
        }>(ADD_ITEM_MUTATION, { input: { projectId, contentId } });
        const item = response.addProjectV2ItemById.item;
        return { itemId: item.id, contentId: item.content.id };
      } catch (error) {
        lastError = error;
        const message = String((error as Error)?.message ?? error);
        if (!/temporary conflict/i.test(message) && !/try again/i.test(message)) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    throw lastError;
  }

  async removeItem(projectId: string, itemId: string): Promise<void> {
    await this.graphql(REMOVE_ITEM_MUTATION, { input: { projectId, itemId } });
  }

  async archiveItem(projectId: string, itemId: string): Promise<void> {
    await this.graphql(ARCHIVE_ITEM_MUTATION, { input: { projectId, itemId } });
  }

  async unarchiveItem(projectId: string, itemId: string): Promise<void> {
    await this.graphql(UNARCHIVE_ITEM_MUTATION, { input: { projectId, itemId } });
  }

  async listItems(projectId: string, limit: number): Promise<ProjectItem[]> {
    const response = await this.graphql<ListItemsResponse>(LIST_ITEMS_QUERY, { projectId, limit });

    // Unknown project or no items.
    if (!response.node?.items?.nodes) {
      return [];
    }

    return response.node.items.nodes.map((item) => {
      const fieldValues: Record<string, unknown> = {};
      for (const fieldValue of item.fieldValues?.nodes ?? []) {
        if (!fieldValue?.field) continue;
        const fieldId = fieldValue.field.id;
        if ("text" in fieldValue) {
          fieldValues[fieldId] = fieldValue.text;
        } else if ("date" in fieldValue) {
          fieldValues[fieldId] = fieldValue.date;
        } else if ("name" in fieldValue) {
          fieldValues[fieldId] = fieldValue.name;
        }
      }

      let contentType = ResourceType.ISSUE;
      if (item.content?.__typename) {
        contentType =
          item.content.__typename === "Issue" ? ResourceType.ISSUE : ResourceType.PULL_REQUEST;
      }

      return {
        id: item.id,
        contentId: item.content?.id || "",
        title: item.content?.title,
        contentType,
        projectId,
        fieldValues,
        // GitHub's API doesn't expose item timestamps here.
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async linkRepository(projectId: string, owner: string, repo: string): Promise<LinkedRepository> {
    const repositoryId = await this.resolveRepositoryId(owner, repo);
    const response = await this.graphql<{
      linkProjectV2ToRepository: { repository: LinkedRepository };
    }>(LINK_REPOSITORY_MUTATION, { input: { projectId, repositoryId } });
    const linked = response.linkProjectV2ToRepository.repository;
    return {
      id: linked.id,
      name: linked.name,
      nameWithOwner: linked.nameWithOwner,
      url: linked.url,
      description: linked.description,
    };
  }

  async unlinkRepository(projectId: string, owner: string, repo: string): Promise<void> {
    const repositoryId = await this.resolveRepositoryId(owner, repo);
    await this.graphql(UNLINK_REPOSITORY_MUTATION, { input: { projectId, repositoryId } });
  }

  async linkTeam(projectId: string, org: string, teamSlug: string): Promise<LinkedTeam> {
    const teamId = await this.resolveTeamId(org, teamSlug);
    const response = await this.graphql<{ linkProjectV2ToTeam: { team: LinkedTeam } }>(
      LINK_TEAM_MUTATION,
      { input: { projectId, teamId } }
    );
    const team = response.linkProjectV2ToTeam.team;
    return { id: team.id, name: team.name, slug: team.slug, description: team.description };
  }

  async unlinkTeam(projectId: string, org: string, teamSlug: string): Promise<void> {
    const teamId = await this.resolveTeamId(org, teamSlug);
    await this.graphql(UNLINK_TEAM_MUTATION, { input: { projectId, teamId } });
  }

  async listRepositories(params: {
    projectId: string;
    first: number;
    after?: string;
  }): Promise<LinkedRepositoriesPage> {
    const response = await this.graphql<{
      node: { repositories: ConnectionResponse<LinkedRepository> } | null;
    }>(LIST_LINKED_REPOSITORIES_QUERY, params);

    if (!response.node) {
      throw new Error(`Project ${params.projectId} not found`);
    }

    const repos = response.node.repositories;
    return {
      repositories: repos.nodes.map((repo) => ({
        id: repo.id,
        name: repo.name,
        nameWithOwner: repo.nameWithOwner,
        url: repo.url,
        description: repo.description,
      })),
      pageInfo: {
        hasNextPage: repos.pageInfo.hasNextPage,
        endCursor: repos.pageInfo.endCursor,
      },
      totalCount: repos.totalCount,
    };
  }

  async listTeams(params: {
    projectId: string;
    first: number;
    after?: string;
  }): Promise<LinkedTeamsPage> {
    const response = await this.graphql<{
      node: { teams: ConnectionResponse<LinkedTeam> } | null;
    }>(LIST_LINKED_TEAMS_QUERY, params);

    if (!response.node) {
      throw new Error(`Project ${params.projectId} not found`);
    }

    const teams = response.node.teams;
    return {
      teams: teams.nodes.map((team) => ({
        id: team.id,
        name: team.name,
        slug: team.slug,
        description: team.description,
      })),
      pageInfo: {
        hasNextPage: teams.pageInfo.hasNextPage,
        endCursor: teams.pageInfo.endCursor,
      },
      totalCount: teams.totalCount,
    };
  }

  /** Linking mutations need node IDs, not owner/name strings. */
  private async resolveRepositoryId(owner: string, repo: string): Promise<string> {
    const response = await this.graphql<{ repository: { id: string } | null }>(
      RESOLVE_REPOSITORY_ID_QUERY,
      { repoOwner: owner, repoName: repo }
    );
    if (!response.repository) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }
    return response.repository.id;
  }

  /** Linking mutations need node IDs, not org/slug strings. */
  private async resolveTeamId(orgLogin: string, teamSlug: string): Promise<string> {
    const response = await this.graphql<{
      organization: { team: { id: string } | null } | null;
    }>(RESOLVE_TEAM_ID_QUERY, { orgLogin, teamSlug });
    if (!response.organization) {
      throw new Error(`Organization ${orgLogin} not found`);
    }
    if (!response.organization.team) {
      throw new Error(`Team ${teamSlug} not found in organization ${orgLogin}`);
    }
    return response.organization.team.id;
  }
}
