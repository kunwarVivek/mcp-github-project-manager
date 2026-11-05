import type { McpServer } from "@modelcontextprotocol/server";
import { INTERNAL_ERROR, ProtocolError } from "@modelcontextprotocol/server";
import { GITHUB_OWNER, GITHUB_REPO } from "../../env";
import type { AIServiceFactory } from "../../services/ai/AIServiceFactory";
import type { ProjectManagementService } from "../../services/ProjectManagementService";
import type { AgentStore } from "../agent/AgentStore";
import { GitHubAuthUnavailableError } from "../github/auth/GitHubAuth";
import { resolveGitHubAuth } from "../github/auth/resolveGitHubAuth";
import type { ILogger } from "../logger/index";
import type { ToolRegistry } from "../tools/ToolRegistry";

/** v2 SDK: `McpError` is `ProtocolError`; error codes are plain numeric constants. */
const McpError = ProtocolError;
const ErrorCode = { InternalError: INTERNAL_ERROR } as const;

/** Dependencies the resource read callbacks need. */
export interface RegisterResourcesDeps {
  service: ProjectManagementService;
  toolRegistry: ToolRegistry;
  agentStore: AgentStore;
  aiFactory: AIServiceFactory;
  logger: ILogger;
  serverVersion: string;
}

function jsonResource(uri: URL, data: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data),
      },
    ],
  };
}

/**
 * How the server currently authenticates to GitHub: mode and source only, never
 * any token material. `configured: false` when no credential is available.
 */
function describeGitHubAuth():
  | { configured: true; mode: string; source: string }
  | { configured: false } {
  try {
    const { mode, source } = resolveGitHubAuth();
    return { configured: true, mode, source };
  } catch (error) {
    if (error instanceof GitHubAuthUnavailableError) return { configured: false };
    throw error;
  }
}

/**
 * Registers the six `github://…` MCP resources.
 *
 * Resources are read-only, addressable state snapshots — unlike tools, a
 * client lists and reads them directly for "what's the current state"
 * queries instead of shaping a tool call. Read failures are logged and
 * re-thrown as a McpError so the client sees a clean message instead of a
 * raw stack trace.
 */
export function registerResources(server: McpServer, deps: RegisterResourcesDeps): void {
  const { service, toolRegistry, agentStore, aiFactory, logger, serverVersion } = deps;

  server.registerResource(
    "config",
    "github://config",
    {
      title: "Server Configuration",
      description: "Target repository, GitHub auth mode, and AI provider availability.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const ai = aiFactory.validateConfiguration();
        return jsonResource(uri, {
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          auth: describeGitHubAuth(),
          serverVersion,
          ai: {
            available: ai.hasAnyProvider,
            providers: ai.available,
            availableModels: ai.availableModels,
            missing: ai.missing,
          },
        });
      } catch (error) {
        logger.error("Failed to read github://config resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read server configuration: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  server.registerResource(
    "projects",
    "github://projects",
    {
      title: "Active Projects",
      description: "Active GitHub Projects (v2) for the configured repository.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const projects = await service.projects.listProjects();
        return jsonResource(uri, projects);
      } catch (error) {
        logger.error("Failed to read github://projects resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  server.registerResource(
    "current-sprint",
    "github://sprints/current",
    {
      title: "Current Sprint",
      description: "The currently active sprint, or null when none is active.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const sprint = await service.sprints.getCurrentSprint();
        return jsonResource(uri, sprint);
      } catch (error) {
        logger.error("Failed to read github://sprints/current resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read current sprint: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  server.registerResource(
    "milestones",
    "github://milestones",
    {
      title: "Open Milestones",
      description: "Open milestones for the configured repository.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const milestones = await service.milestones.listMilestones("open", "due_on", "asc");
        return jsonResource(uri, milestones);
      } catch (error) {
        logger.error("Failed to read github://milestones resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list milestones: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  server.registerResource(
    "agents",
    "github://agents",
    {
      title: "Registered Agents",
      description: "Agents registered in the orchestration swarm registry.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const agents = await agentStore.listAgents();
        return jsonResource(uri, agents);
      } catch (error) {
        logger.error("Failed to read github://agents resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );

  server.registerResource(
    "tools",
    "github://tools",
    {
      title: "Tool Catalog",
      description: "Catalog of registered MCP tools, keyed by name.",
      mimeType: "application/json",
    },
    async (uri) => {
      logger.debug(`Resource read: ${uri.href}`);
      try {
        const tools = toolRegistry.getToolsForMCP().map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          annotations: tool.annotations,
        }));
        return jsonResource(uri, { count: tools.length, tools });
      } catch (error) {
        logger.error("Failed to read github://tools resource", error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to read tool catalog: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}
