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

import type { Project } from "../../domain/types";
import { ProjectItemService } from "../../services/ProjectItemService";
import { ProjectStatusService } from "../../services/ProjectStatusService";
import { ANNOTATION_PATTERNS } from "./annotations/tool-annotations";
import {
  type CloseProjectInput,
  CloseProjectInputSchema,
  type ConvertDraftIssueInput,
  ConvertDraftIssueInputSchema,
  type ConvertedIssueOutput,
  ConvertedIssueOutputSchema,
  type ProjectLifecycleOutput,
  ProjectLifecycleOutputSchema,
  type ReopenProjectInput,
  ReopenProjectInputSchema,
} from "./schemas/project-lifecycle-schemas";
import type { ToolDefinition, ToolSchema } from "./ToolValidator";
import { createGitHubFactory } from "./tool-factory";

function toLifecycleOutput(project: Project): ProjectLifecycleOutput {
  return {
    id: project.id,
    title: project.title,
    closed: project.closed,
    url: project.url,
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
export const closeProjectTool: ToolDefinition<CloseProjectInput, ProjectLifecycleOutput> = {
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
export const reopenProjectTool: ToolDefinition<ReopenProjectInput, ProjectLifecycleOutput> = {
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
export const convertDraftIssueTool: ToolDefinition<ConvertDraftIssueInput, ConvertedIssueOutput> = {
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
 * Closes a project via ProjectStatusService.
 *
 * @param args - Validated input arguments
 * @returns The closed project details
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeCloseProject(args: CloseProjectInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ProjectLifecycleOutput;
}> {
  const project = await new ProjectStatusService(createGitHubFactory()).closeProject(
    args.projectId
  );
  const result = toLifecycleOutput(project);

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
 * @param args - Validated input arguments
 * @returns The reopened project details
 * @throws Error if GITHUB_TOKEN is not set or API call fails
 */
export async function executeReopenProject(args: ReopenProjectInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ProjectLifecycleOutput;
}> {
  const project = await new ProjectStatusService(createGitHubFactory()).reopenProject(
    args.projectId
  );
  const result = toLifecycleOutput(project);

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
export async function executeConvertDraftIssue(args: ConvertDraftIssueInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: ConvertedIssueOutput;
}> {
  const result: ConvertedIssueOutput = await new ProjectItemService(
    createGitHubFactory()
  ).convertDraftIssue(args);

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
