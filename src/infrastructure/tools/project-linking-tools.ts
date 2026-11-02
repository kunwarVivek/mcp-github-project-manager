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
 * All tools delegate to ProjectLinkingService.
 */

import { ProjectLinkingService } from "../../services/ProjectLinkingService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import {
  type LinkedRepositoriesListOutput,
  LinkedRepositoriesListOutputSchema,
  type LinkedRepositoryOutput,
  LinkedRepositoryOutputSchema,
  type LinkedTeamOutput,
  LinkedTeamOutputSchema,
  type LinkedTeamsListOutput,
  LinkedTeamsListOutputSchema,
  type LinkOperationOutput,
  LinkOperationOutputSchema,
  type LinkProjectToRepositoryInput,
  LinkProjectToRepositoryInputSchema,
  type LinkProjectToTeamInput,
  LinkProjectToTeamInputSchema,
  type ListLinkedRepositoriesInput,
  ListLinkedRepositoriesInputSchema,
  type ListLinkedTeamsInput,
  ListLinkedTeamsInputSchema,
  type UnlinkProjectFromRepositoryInput,
  UnlinkProjectFromRepositoryInputSchema,
  type UnlinkProjectFromTeamInput,
  UnlinkProjectFromTeamInputSchema,
} from "./schemas/project-template-linking-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";
import { createGitHubFactory } from "./tool-factory";

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
  schema:
    UnlinkProjectFromRepositoryInputSchema as unknown as ToolSchema<UnlinkProjectFromRepositoryInput>,
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
export const linkProjectToTeamTool: ToolDefinition<LinkProjectToTeamInput, LinkedTeamOutput> = {
  name: "link_project_to_team",
  title: "Link Project to Team",
  description: "Links a GitHub project to a team. Team members will have access to the project.",
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
export const listLinkedTeamsTool: ToolDefinition<ListLinkedTeamsInput, LinkedTeamsListOutput> = {
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

function createLinkingService(): ProjectLinkingService {
  return new ProjectLinkingService(createGitHubFactory());
}

/** Execute link_project_to_repository tool. */
export async function executeLinkProjectToRepository(args: LinkProjectToRepositoryInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkedRepositoryOutput;
}> {
  const repo = await createLinkingService().linkProjectToRepository({
    projectId: args.projectId,
    owner: args.owner,
    repo: args.repo,
  });

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

/** Execute unlink_project_from_repository tool. */
export async function executeUnlinkProjectFromRepository(
  args: UnlinkProjectFromRepositoryInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkOperationOutput;
}> {
  const result: LinkOperationOutput = await createLinkingService().unlinkProjectFromRepository({
    projectId: args.projectId,
    owner: args.owner,
    repo: args.repo,
  });

  return {
    content: [{ type: "text", text: result.message }],
    structuredContent: result,
  };
}

/** Execute link_project_to_team tool. */
export async function executeLinkProjectToTeam(args: LinkProjectToTeamInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkedTeamOutput;
}> {
  const team = await createLinkingService().linkProjectToTeam({
    projectId: args.projectId,
    org: args.org,
    teamSlug: args.teamSlug,
  });

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

/** Execute unlink_project_from_team tool. */
export async function executeUnlinkProjectFromTeam(args: UnlinkProjectFromTeamInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkOperationOutput;
}> {
  const result: LinkOperationOutput = await createLinkingService().unlinkProjectFromTeam({
    projectId: args.projectId,
    org: args.org,
    teamSlug: args.teamSlug,
  });

  return {
    content: [{ type: "text", text: result.message }],
    structuredContent: result,
  };
}

/** Execute list_linked_repositories tool. */
export async function executeListLinkedRepositories(args: ListLinkedRepositoriesInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkedRepositoriesListOutput;
}> {
  const result: LinkedRepositoriesListOutput = await createLinkingService().listLinkedRepositories({
    projectId: args.projectId,
    first: args.first,
    after: args.after,
  });

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

/** Execute list_linked_teams tool. */
export async function executeListLinkedTeams(args: ListLinkedTeamsInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: LinkedTeamsListOutput;
}> {
  const result: LinkedTeamsListOutput = await createLinkingService().listLinkedTeams({
    projectId: args.projectId,
    first: args.first,
    after: args.after,
  });

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
