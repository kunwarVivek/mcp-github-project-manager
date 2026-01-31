/**
 * MCP tools for managing GitHub Project V2 lifecycle operations.
 *
 * Provides 3 tools (GHAPI-19 to GHAPI-21):
 * - close_project: Closes a GitHub ProjectV2 (hidden but retains data)
 * - reopen_project: Reopens a previously closed ProjectV2
 * - convert_draft_issue: Converts a draft issue to a real GitHub issue
 *
 * These tools enable users to manage project lifecycle states and convert
 * draft issues to real issues in specified repositories.
 */

import { ToolDefinition, ToolSchema } from "./ToolValidator.js";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations.js";
import { GitHubRepositoryFactory } from "../github/GitHubRepositoryFactory.js";
import {
  CloseProjectInputSchema,
  CloseProjectInput,
  ReopenProjectInputSchema,
  ReopenProjectInput,
  ConvertDraftIssueInputSchema,
  ConvertDraftIssueInput,
  ProjectLifecycleOutputSchema,
  ProjectLifecycleOutput,
  ConvertedIssueOutputSchema,
  ConvertedIssueOutput,
} from "./schemas/project-lifecycle-schemas.js";

// ============================================================================
// GraphQL Queries and Mutations
// ============================================================================

const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProjectV2($input: UpdateProjectV2Input!) {
    updateProjectV2(input: $input) {
      projectV2 {
        id
        title
        closed
        url
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

const RESOLVE_REPOSITORY_ID_QUERY = `
  query ResolveRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a GitHubRepositoryFactory from environment variables.
 *
 * Lifecycle operations work at the project level (via projectId), so owner/repo
 * are only needed for factory initialization. We use placeholders since lifecycle
 * operations don't actually require a specific repo context.
 */
function createFactory(): GitHubRepositoryFactory {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  // Owner/repo are required by factory but not used for lifecycle operations
  // which work purely with project node IDs
  return new GitHubRepositoryFactory(token, "placeholder", "placeholder");
}

/**
 * Resolves a repository owner/name to its GitHub node ID.
 *
 * This is needed because convertProjectV2DraftIssueItemToIssue requires
 * the repository's node ID, but users provide owner/name for convenience.
 */
async function resolveRepositoryId(
  factory: GitHubRepositoryFactory,
  owner: string,
  name: string
): Promise<string> {
  interface RepositoryIdResponse {
    repository: {
      id: string;
    } | null;
  }

  const response = await factory.graphql<RepositoryIdResponse>(
    RESOLVE_REPOSITORY_ID_QUERY,
    {
      owner,
      name,
    }
  );

  if (!response.repository) {
    throw new Error(`Repository '${owner}/${name}' not found`);
  }

  return response.repository.id;
}

// ============================================================================
// GraphQL Response Types
// ============================================================================

interface UpdateProjectV2Response {
  updateProjectV2: {
    projectV2: {
      id: string;
      title: string;
      closed: boolean;
      url: string;
    };
  };
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
        repository: {
          nameWithOwner: string;
        };
      };
    };
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * close_project tool (GHAPI-19)
 *
 * Closes a GitHub ProjectV2. Closed projects are hidden from default views
 * but retain all their data and can be reopened at any time.
 */
export const closeProjectTool: ToolDefinition<
  CloseProjectInput,
  ProjectLifecycleOutput
> = {
  name: "close_project",
  title: "Close Project",
  description:
    "Closes a GitHub ProjectV2. Closed projects are hidden from default views but retain all data and can be reopened.",
  schema: CloseProjectInputSchema as unknown as ToolSchema<CloseProjectInput>,
  outputSchema: ProjectLifecycleOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Close a project",
      description: "Close a project by its ID",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

/**
 * reopen_project tool (GHAPI-20)
 *
 * Reopens a previously closed GitHub ProjectV2. The project becomes visible
 * in default views again with all its data intact.
 */
export const reopenProjectTool: ToolDefinition<
  ReopenProjectInput,
  ProjectLifecycleOutput
> = {
  name: "reopen_project",
  title: "Reopen Project",
  description:
    "Reopens a previously closed GitHub ProjectV2. The project becomes visible in default views again.",
  schema: ReopenProjectInputSchema as unknown as ToolSchema<ReopenProjectInput>,
  outputSchema: ProjectLifecycleOutputSchema,
  annotations: ANNOTATION_PATTERNS.updateIdempotent,
  examples: [
    {
      name: "Reopen a closed project",
      description: "Reopen a previously closed project",
      args: {
        projectId: "PVT_kwDOLhQ7gc4AOEbH",
      },
    },
  ],
};

/**
 * convert_draft_issue tool (GHAPI-21)
 *
 * Converts a draft issue in a project to a real GitHub issue in the specified
 * repository. The draft's title and body are preserved in the new issue.
 */
export const convertDraftIssueTool: ToolDefinition<
  ConvertDraftIssueInput,
  ConvertedIssueOutput
> = {
  name: "convert_draft_issue",
  title: "Convert Draft Issue to Real Issue",
  description:
    "Converts a draft issue in a project to a real GitHub issue in the specified repository. The draft's title and body are preserved.",
  schema: ConvertDraftIssueInputSchema as unknown as ToolSchema<ConvertDraftIssueInput>,
  outputSchema: ConvertedIssueOutputSchema,
  annotations: ANNOTATION_PATTERNS.create,
  examples: [
    {
      name: "Convert draft to issue",
      description: "Convert a draft issue to a real issue in a repository",
      args: {
        itemId: "PVTI_lADOLhQ7gc4AOEbHzgGF9PM",
        owner: "my-org",
        repo: "my-repo",
      },
    },
  ],
};

// ============================================================================
// Executor Functions
// ============================================================================

/**
 * Execute the close_project tool.
 *
 * Closes a project by setting closed=true via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The closed project details
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeCloseProject(
  args: CloseProjectInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ProjectLifecycleOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<UpdateProjectV2Response>(
    UPDATE_PROJECT_MUTATION,
    {
      input: {
        projectId: args.projectId,
        closed: true,
      },
    }
  );

  const project = response.updateProjectV2.projectV2;

  const result: ProjectLifecycleOutput = {
    id: project.id,
    title: project.title,
    closed: project.closed,
    url: project.url,
  };

  return {
    content: [
      {
        type: "text",
        text: `Closed project "${result.title}"`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the reopen_project tool.
 *
 * Reopens a project by setting closed=false via the GraphQL API.
 *
 * @param args - Validated input arguments
 * @returns The reopened project details
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeReopenProject(
  args: ReopenProjectInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ProjectLifecycleOutput;
}> {
  const factory = createFactory();

  const response = await factory.graphql<UpdateProjectV2Response>(
    UPDATE_PROJECT_MUTATION,
    {
      input: {
        projectId: args.projectId,
        closed: false,
      },
    }
  );

  const project = response.updateProjectV2.projectV2;

  const result: ProjectLifecycleOutput = {
    id: project.id,
    title: project.title,
    closed: project.closed,
    url: project.url,
  };

  return {
    content: [
      {
        type: "text",
        text: `Reopened project "${result.title}"`,
      },
    ],
    structuredContent: result,
  };
}

/**
 * Execute the convert_draft_issue tool.
 *
 * Converts a draft issue to a real GitHub issue in the specified repository.
 *
 * @param args - Validated input arguments
 * @returns The converted issue details
 * @throws Error if GITHUB_TOKEN is not set, repository not found, or API call fails
 */
export async function executeConvertDraftIssue(
  args: ConvertDraftIssueInput
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ConvertedIssueOutput;
}> {
  const factory = createFactory();

  // Resolve the repository owner/name to its node ID
  const repositoryId = await resolveRepositoryId(factory, args.owner, args.repo);

  const response = await factory.graphql<ConvertDraftIssueResponse>(
    CONVERT_DRAFT_ISSUE_MUTATION,
    {
      input: {
        itemId: args.itemId,
        repositoryId: repositoryId,
      },
    }
  );

  const item = response.convertProjectV2DraftIssueItemToIssue.item;
  const issue = item.content;

  const result: ConvertedIssueOutput = {
    itemId: item.id,
    issueId: issue.id,
    issueNumber: issue.number,
    title: issue.title,
    url: issue.url,
    repository: issue.repository.nameWithOwner,
  };

  return {
    content: [
      {
        type: "text",
        text: `Converted draft to issue #${result.issueNumber} "${result.title}" in ${result.repository}`,
      },
    ],
    structuredContent: result,
  };
}
