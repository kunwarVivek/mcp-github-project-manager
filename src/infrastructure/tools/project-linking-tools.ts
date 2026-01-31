/**
 * MCP tools for managing GitHub Project V2 linking operations.
 *
 * Provides 6 tools (GHAPI-13 to GHAPI-18):
 * - link_project_to_repository: Links a project to a repository
 * - unlink_project_from_repository: Removes project-repo linkage
 * - link_project_to_team: Links a project to a team
 * - unlink_project_from_team: Removes project-team linkage
 * - list_linked_repositories: Lists repositories linked to a project
 * - list_linked_teams: Lists teams linked to a project
 *
 * All tools use GraphQL mutations/queries directly via the factory.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  LinkProjectToRepositoryInputSchema,
  LinkProjectToRepositoryInput,
  UnlinkProjectFromRepositoryInputSchema,
  UnlinkProjectFromRepositoryInput,
  LinkProjectToTeamInputSchema,
  LinkProjectToTeamInput,
  UnlinkProjectFromTeamInputSchema,
  UnlinkProjectFromTeamInput,
  ListLinkedRepositoriesInputSchema,
  ListLinkedRepositoriesInput,
  ListLinkedTeamsInputSchema,
  ListLinkedTeamsInput,
  LinkedRepositoryOutputSchema,
  LinkedRepositoryOutput,
  LinkedTeamOutputSchema,
  LinkedTeamOutput,
  LinkedRepositoriesListOutputSchema,
  LinkedRepositoriesListOutput,
  LinkedTeamsListOutputSchema,
  LinkedTeamsListOutput,
  LinkOperationOutputSchema,
  LinkOperationOutput,
} from "./schemas/project-template-linking-schemas.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a repository factory with the given owner and repo.
 *
 * Linking operations use projectId directly, so owner/repo are placeholders
 * for factory initialization but required for repository/team resolution.
 */
function createFactory(owner: string, repo: string): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }
  return new GitHubRepositoryFactory(token, owner, repo);
}

/**
 * Resolves a repository owner/name to its GitHub node ID.
 *
 * Required because linking mutations need node IDs, not owner/repo strings.
 */
async function resolveRepositoryId(
  factory: GitHubRepositoryFactory,
  owner: string,
  repo: string
): Promise<string> {
  const query = `
    query ResolveRepositoryId($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
      }
    }
  `;

  interface RepositoryIdResponse {
    repository: {
      id: string;
    } | null;
  }

  const response = await factory.graphql<RepositoryIdResponse>(query, {
    owner,
    name: repo,
  });

  if (!response.repository) {
    throw new Error(`Repository ${owner}/${repo} not found`);
  }

  return response.repository.id;
}

/**
 * Resolves an organization and team slug to the team's GitHub node ID.
 *
 * Required because linking mutations need node IDs, not org/slug strings.
 */
async function resolveTeamId(
  factory: GitHubRepositoryFactory,
  orgLogin: string,
  teamSlug: string
): Promise<string> {
  const query = `
    query ResolveTeamId($orgLogin: String!, $teamSlug: String!) {
      organization(login: $orgLogin) {
        team(slug: $teamSlug) {
          id
        }
      }
    }
  `;

  interface TeamIdResponse {
    organization: {
      team: {
        id: string;
      } | null;
    } | null;
  }

  const response = await factory.graphql<TeamIdResponse>(query, {
    orgLogin,
    teamSlug,
  });

  if (!response.organization) {
    throw new Error(`Organization ${orgLogin} not found`);
  }

  if (!response.organization.team) {
    throw new Error(`Team ${teamSlug} not found in organization ${orgLogin}`);
  }

  return response.organization.team.id;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * link_project_to_repository tool (GHAPI-13)
 *
 * Links a GitHub project to a repository. Items from the repository
 * can be added to the project.
 */
export const linkProjectToRepositoryTool: ToolDefinition<
  LinkProjectToRepositoryInput,
  LinkedRepositoryOutput
> = {
  name: "link_project_to_repository",
  title: "Link Project to Repository",
  description:
    "Links a GitHub project to a repository. Items from the repository can be added to the project.",
  schema: LinkProjectToRepositoryInputSchema as unknown as ToolSchema<LinkProjectToRepositoryInput>,
  outputSchema: LinkedRepositoryOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Link repository to project",
      description: "Link the octocat/hello-world repository to a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        owner: "octocat",
        repo: "hello-world",
      },
    },
  ],
};

/**
 * unlink_project_from_repository tool (GHAPI-14)
 *
 * Removes a repository linkage from a project.
 */
export const unlinkProjectFromRepositoryTool: ToolDefinition<
  UnlinkProjectFromRepositoryInput,
  LinkOperationOutput
> = {
  name: "unlink_project_from_repository",
  title: "Unlink Project from Repository",
  description: "Removes a repository linkage from a project.",
  schema: UnlinkProjectFromRepositoryInputSchema as unknown as ToolSchema<UnlinkProjectFromRepositoryInput>,
  outputSchema: LinkOperationOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Unlink repository from project",
      description: "Remove the link between a project and octocat/hello-world",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        owner: "octocat",
        repo: "hello-world",
      },
    },
  ],
};

/**
 * link_project_to_team tool (GHAPI-15)
 *
 * Links a GitHub project to a team. Team members will have access to the project.
 */
export const linkProjectToTeamTool: ToolDefinition<
  LinkProjectToTeamInput,
  LinkedTeamOutput
> = {
  name: "link_project_to_team",
  title: "Link Project to Team",
  description:
    "Links a GitHub project to a team. Team members will have access to the project.",
  schema: LinkProjectToTeamInputSchema as unknown as ToolSchema<LinkProjectToTeamInput>,
  outputSchema: LinkedTeamOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Link team to project",
      description: "Link the engineering team to a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        org: "octocat-org",
        teamSlug: "engineering",
      },
    },
  ],
};

/**
 * unlink_project_from_team tool (GHAPI-16)
 *
 * Removes a team linkage from a project.
 */
export const unlinkProjectFromTeamTool: ToolDefinition<
  UnlinkProjectFromTeamInput,
  LinkOperationOutput
> = {
  name: "unlink_project_from_team",
  title: "Unlink Project from Team",
  description: "Removes a team linkage from a project.",
  schema: UnlinkProjectFromTeamInputSchema as unknown as ToolSchema<UnlinkProjectFromTeamInput>,
  outputSchema: LinkOperationOutputSchema,
  annotations: ANNOTATION_PATTERNS.delete,
  examples: [
    {
      name: "Unlink team from project",
      description: "Remove the link between a project and the engineering team",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        org: "octocat-org",
        teamSlug: "engineering",
      },
    },
  ],
};

/**
 * list_linked_repositories tool (GHAPI-17)
 *
 * Lists all repositories linked to a project.
 */
export const listLinkedRepositoriesTool: ToolDefinition<
  ListLinkedRepositoriesInput,
  LinkedRepositoriesListOutput
> = {
  name: "list_linked_repositories",
  title: "List Linked Repositories",
  description: "Lists all repositories linked to a project.",
  schema: ListLinkedRepositoriesInputSchema as unknown as ToolSchema<ListLinkedRepositoriesInput>,
  outputSchema: LinkedRepositoriesListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List linked repositories",
      description: "Get all repositories linked to a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        first: 20,
      },
    },
  ],
};

/**
 * list_linked_teams tool (GHAPI-18)
 *
 * Lists all teams linked to a project.
 */
export const listLinkedTeamsTool: ToolDefinition<
  ListLinkedTeamsInput,
  LinkedTeamsListOutput
> = {
  name: "list_linked_teams",
  title: "List Linked Teams",
  description: "Lists all teams linked to a project.",
  schema: ListLinkedTeamsInputSchema as unknown as ToolSchema<ListLinkedTeamsInput>,
  outputSchema: LinkedTeamsListOutputSchema,
  annotations: ANNOTATION_PATTERNS.readOnly,
  examples: [
    {
      name: "List linked teams",
      description: "Get all teams linked to a project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
        first: 20,
      },
    },
  ],
};

// ============================================================================
// Tool Executors
// ============================================================================

/**
 * Execute link_project_to_repository tool.
 *
 * Resolves repository to node ID and calls the GraphQL mutation.
 */
export async function executeLinkProjectToRepository(
  args: LinkProjectToRepositoryInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkedRepositoryOutput }> {
  const factory = createFactory(args.owner, args.repo);

  // Resolve repository to node ID
  const repositoryId = await resolveRepositoryId(factory, args.owner, args.repo);

  // Execute the mutation
  const mutation = `
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

  interface LinkRepositoryResponse {
    linkProjectV2ToRepository: {
      repository: {
        id: string;
        name: string;
        nameWithOwner: string;
        url: string;
        description: string | null;
      };
    };
  }

  const response = await factory.graphql<LinkRepositoryResponse>(mutation, {
    input: {
      projectId: args.projectId,
      repositoryId,
    },
  });

  const repo = response.linkProjectV2ToRepository.repository;
  const result: LinkedRepositoryOutput = {
    id: repo.id,
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    url: repo.url,
    description: repo.description,
  };

  return {
    content: [
      {
        type: "text",
        text: `Linked repository ${repo.nameWithOwner} to project ${args.projectId}`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute unlink_project_from_repository tool.
 *
 * Resolves repository to node ID and calls the GraphQL mutation.
 */
export async function executeUnlinkProjectFromRepository(
  args: UnlinkProjectFromRepositoryInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkOperationOutput }> {
  const factory = createFactory(args.owner, args.repo);

  // Resolve repository to node ID
  const repositoryId = await resolveRepositoryId(factory, args.owner, args.repo);

  // Execute the mutation
  const mutation = `
    mutation UnlinkProjectV2FromRepository($input: UnlinkProjectV2FromRepositoryInput!) {
      unlinkProjectV2FromRepository(input: $input) {
        repository {
          id
        }
      }
    }
  `;

  interface UnlinkRepositoryResponse {
    unlinkProjectV2FromRepository: {
      repository: {
        id: string;
      };
    };
  }

  await factory.graphql<UnlinkRepositoryResponse>(mutation, {
    input: {
      projectId: args.projectId,
      repositoryId,
    },
  });

  const result: LinkOperationOutput = {
    success: true,
    message: `Successfully unlinked repository ${args.owner}/${args.repo} from project`,
  };

  return {
    content: [
      {
        type: "text",
        text: result.message,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute link_project_to_team tool.
 *
 * Resolves team to node ID and calls the GraphQL mutation.
 */
export async function executeLinkProjectToTeam(
  args: LinkProjectToTeamInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkedTeamOutput }> {
  const factory = createFactory(args.org, "placeholder");

  // Resolve team to node ID
  const teamId = await resolveTeamId(factory, args.org, args.teamSlug);

  // Execute the mutation
  const mutation = `
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

  interface LinkTeamResponse {
    linkProjectV2ToTeam: {
      team: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
      };
    };
  }

  const response = await factory.graphql<LinkTeamResponse>(mutation, {
    input: {
      projectId: args.projectId,
      teamId,
    },
  });

  const team = response.linkProjectV2ToTeam.team;
  const result: LinkedTeamOutput = {
    id: team.id,
    name: team.name,
    slug: team.slug,
    description: team.description,
  };

  return {
    content: [
      {
        type: "text",
        text: `Linked team ${team.name} (${team.slug}) to project ${args.projectId}`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute unlink_project_from_team tool.
 *
 * Resolves team to node ID and calls the GraphQL mutation.
 */
export async function executeUnlinkProjectFromTeam(
  args: UnlinkProjectFromTeamInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkOperationOutput }> {
  const factory = createFactory(args.org, "placeholder");

  // Resolve team to node ID
  const teamId = await resolveTeamId(factory, args.org, args.teamSlug);

  // Execute the mutation
  const mutation = `
    mutation UnlinkProjectV2FromTeam($input: UnlinkProjectV2FromTeamInput!) {
      unlinkProjectV2FromTeam(input: $input) {
        team {
          id
        }
      }
    }
  `;

  interface UnlinkTeamResponse {
    unlinkProjectV2FromTeam: {
      team: {
        id: string;
      };
    };
  }

  await factory.graphql<UnlinkTeamResponse>(mutation, {
    input: {
      projectId: args.projectId,
      teamId,
    },
  });

  const result: LinkOperationOutput = {
    success: true,
    message: `Successfully unlinked team ${args.teamSlug} from project`,
  };

  return {
    content: [
      {
        type: "text",
        text: result.message,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute list_linked_repositories tool.
 *
 * Queries the project's repositories connection.
 */
export async function executeListLinkedRepositories(
  args: ListLinkedRepositoriesInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkedRepositoriesListOutput }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Use placeholder owner/repo since we query by project ID
  const factory = new GitHubRepositoryFactory(token, "placeholder", "placeholder");

  // Parse args with defaults
  const first = args.first ?? 20;
  const after = args.after;

  // Execute the query
  const query = `
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

  interface ListRepositoriesResponse {
    node: {
      repositories: {
        nodes: Array<{
          id: string;
          name: string;
          nameWithOwner: string;
          url: string;
          description: string | null;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        totalCount: number;
      };
    } | null;
  }

  const response = await factory.graphql<ListRepositoriesResponse>(query, {
    projectId: args.projectId,
    first,
    after,
  });

  if (!response.node) {
    throw new Error(`Project ${args.projectId} not found`);
  }

  const repos = response.node.repositories;
  const result: LinkedRepositoriesListOutput = {
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

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.totalCount} linked repositories, returning ${result.repositories.length}`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute list_linked_teams tool.
 *
 * Queries the project's teams connection.
 */
export async function executeListLinkedTeams(
  args: ListLinkedTeamsInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: LinkedTeamsListOutput }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Use placeholder owner/repo since we query by project ID
  const factory = new GitHubRepositoryFactory(token, "placeholder", "placeholder");

  // Parse args with defaults
  const first = args.first ?? 20;
  const after = args.after;

  // Execute the query
  const query = `
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

  interface ListTeamsResponse {
    node: {
      teams: {
        nodes: Array<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
        }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        totalCount: number;
      };
    } | null;
  }

  const response = await factory.graphql<ListTeamsResponse>(query, {
    projectId: args.projectId,
    first,
    after,
  });

  if (!response.node) {
    throw new Error(`Project ${args.projectId} not found`);
  }

  const teams = response.node.teams;
  const result: LinkedTeamsListOutput = {
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

  return {
    content: [
      {
        type: "text",
        text: `Found ${result.totalCount} linked teams, returning ${result.teams.length}`,
      },
    ],
    structuredContent: result,
  };
}
