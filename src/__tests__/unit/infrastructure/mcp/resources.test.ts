import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ProtocolError, INTERNAL_ERROR } from "@modelcontextprotocol/server";

/**
 * Unit tests for the six `github://…` MCP resource read callbacks registered
 * by `GitHubProjectManagerServer.registerResources()` in `src/index.ts`
 * (private method, ~line 633).
 *
 * `src/index.ts` cannot be imported in an isolated unit test: its module body
 * ends with an unguarded top-level bootstrap (`new
 * GitHubProjectManagerServer(); server.run()...`, src/index.ts:1435-1465,
 * no `require.main`-style guard) that builds the real DI container, arms the
 * agent reclaim scheduler, and wires stdio/webhook transports as a side
 * effect of import. Extracting `registerResources()` into a standalone
 * exported function (the way `registerPrompts()` already is — see
 * prompts.test.ts) would require editing `src/index.ts`, which sibling tasks
 * are concurrently appending tool wiring to in this same batch.
 *
 * Instead, this file mirrors the six callback bodies verbatim from
 * `registerResources()` (same field names, same `jsonResource` shape, same
 * error wrapping) and exercises them directly against injected mock
 * dependencies — exactly the shape (`this.logger`, `this.aiFactory`,
 * `this.service`, `this.agentStore`, `this.toolRegistry`) each closure reads
 * in the real implementation. `ProtocolError`/`INTERNAL_ERROR` are imported
 * for real from the MCP SDK so error-wrapping assertions check the actual
 * error class production code throws. Keep the reproduction in sync with
 * `src/index.ts` if `registerResources()` changes.
 */

const GITHUB_OWNER = "test-owner";
const GITHUB_REPO = "test-repo";
const GITHUB_TOKEN = "test-token";
const SERVER_VERSION = "0.0.0-test";

const McpError = ProtocolError;
const ErrorCode = { InternalError: INTERNAL_ERROR } as const;

interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}

function jsonResource(uri: URL, data: unknown): ResourceReadResult {
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

interface Logger {
  debug: Mock;
  info: Mock;
  warn: Mock;
  error: Mock;
}

function makeLogger(): Logger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** Asserts the standard MCP JSON-resource envelope and returns the parsed payload. */
function expectValidResourceResult(result: ResourceReadResult, uri: URL): unknown {
  expect(result.contents).toHaveLength(1);
  expect(result.contents[0].uri).toBe(uri.href);
  expect(result.contents[0].mimeType).toBe("application/json");
  expect(typeof result.contents[0].text).toBe("string");
  return JSON.parse(result.contents[0].text);
}

// ---- callback factories, mirroring GitHubProjectManagerServer.registerResources() in src/index.ts ----

interface AiValidation {
  hasAnyProvider: boolean;
  available: string[];
  availableModels: string[];
  missing: string[];
}

function createConfigCallback(deps: {
  logger: Logger;
  aiFactory: { validateConfiguration: () => AiValidation };
  owner?: string;
  repo?: string;
  token?: string;
  serverVersion?: string;
}) {
  const owner = deps.owner ?? GITHUB_OWNER;
  const repo = deps.repo ?? GITHUB_REPO;
  const token = deps.token ?? GITHUB_TOKEN;
  const serverVersion = deps.serverVersion ?? SERVER_VERSION;
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const ai = deps.aiFactory.validateConfiguration();
      return jsonResource(uri, {
        owner,
        repo,
        tokenConfigured: Boolean(token),
        serverVersion,
        ai: {
          available: ai.hasAnyProvider,
          providers: ai.available,
          availableModels: ai.availableModels,
          missing: ai.missing,
        },
      });
    } catch (error) {
      deps.logger.error("Failed to read github://config resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read server configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

function createProjectsCallback(deps: { logger: Logger; service: { listProjects: () => Promise<unknown> } }) {
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const projects = await deps.service.listProjects();
      return jsonResource(uri, projects);
    } catch (error) {
      deps.logger.error("Failed to read github://projects resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

function createCurrentSprintCallback(deps: {
  logger: Logger;
  service: { getCurrentSprint: () => Promise<unknown> };
}) {
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const sprint = await deps.service.getCurrentSprint();
      return jsonResource(uri, sprint);
    } catch (error) {
      deps.logger.error("Failed to read github://sprints/current resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read current sprint: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

function createMilestonesCallback(deps: {
  logger: Logger;
  service: { listMilestones: (status: string) => Promise<unknown> };
}) {
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const milestones = await deps.service.listMilestones("open");
      return jsonResource(uri, milestones);
    } catch (error) {
      deps.logger.error("Failed to read github://milestones resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list milestones: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

function createAgentsCallback(deps: { logger: Logger; agentStore: { listAgents: () => Promise<unknown> } }) {
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const agents = await deps.agentStore.listAgents();
      return jsonResource(uri, agents);
    } catch (error) {
      deps.logger.error("Failed to read github://agents resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

interface ToolCatalogEntry {
  name: string;
  title?: string;
  description?: string;
  annotations?: unknown;
  [extra: string]: unknown;
}

function createToolsCallback(deps: {
  logger: Logger;
  toolRegistry: { getToolsForMCP: () => ToolCatalogEntry[] };
}) {
  return async (uri: URL): Promise<ResourceReadResult> => {
    deps.logger.debug(`Resource read: ${uri.href}`);
    try {
      const tools = deps.toolRegistry.getToolsForMCP().map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        annotations: tool.annotations,
      }));
      return jsonResource(uri, { count: tools.length, tools });
    } catch (error) {
      deps.logger.error("Failed to read github://tools resource", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read tool catalog: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
}

// ---- tests ----

describe("MCP resources (github://…)", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
  });

  describe("github://config", () => {
    it("returns server config with owner/repo/version and AI availability", async () => {
      const aiFactory = {
        validateConfiguration: vi.fn().mockReturnValue({
          hasAnyProvider: true,
          available: ["anthropic"],
          availableModels: ["claude-opus-5"],
          missing: ["openai"],
        }),
      };
      const uri = new URL("github://config");
      const callback = createConfigCallback({ logger, aiFactory });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(data).toEqual({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        tokenConfigured: true,
        serverVersion: SERVER_VERSION,
        ai: {
          available: true,
          providers: ["anthropic"],
          availableModels: ["claude-opus-5"],
          missing: ["openai"],
        },
      });
    });

    it("reports tokenConfigured: false when no GitHub token is configured", async () => {
      const aiFactory = {
        validateConfiguration: vi.fn().mockReturnValue({
          hasAnyProvider: false,
          available: [],
          availableModels: [],
          missing: ["anthropic", "openai"],
        }),
      };
      const uri = new URL("github://config");
      const callback = createConfigCallback({ logger, aiFactory, token: "" });

      const data = (await callback(uri).then((r) => expectValidResourceResult(r, uri))) as { tokenConfigured: boolean };

      expect(data.tokenConfigured).toBe(false);
    });

    it("wraps a validateConfiguration failure in a ProtocolError and logs it", async () => {
      const aiFactory = {
        validateConfiguration: vi.fn().mockImplementation(() => {
          throw new Error("boom");
        }),
      };
      const callback = createConfigCallback({ logger, aiFactory });
      const promise = callback(new URL("github://config"));

      await expect(promise).rejects.toBeInstanceOf(ProtocolError);
      await expect(promise).rejects.toThrow(/Failed to read server configuration: boom/);
      expect(logger.error).toHaveBeenCalledWith("Failed to read github://config resource", expect.any(Error));
    });
  });

  describe("github://projects", () => {
    it("calls listProjects and returns a JSON array of projects", async () => {
      const projects = [
        { id: "1", title: "Roadmap" },
        { id: "2", title: "Backlog" },
      ];
      const service = { listProjects: vi.fn().mockResolvedValue(projects) };
      const uri = new URL("github://projects");
      const callback = createProjectsCallback({ logger, service });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(service.listProjects).toHaveBeenCalledTimes(1);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual(projects);
    });

    it("wraps a listProjects failure in a ProtocolError", async () => {
      const service = { listProjects: vi.fn().mockRejectedValue(new Error("api down")) };
      const callback = createProjectsCallback({ logger, service });

      await expect(callback(new URL("github://projects"))).rejects.toThrow(/Failed to list projects: api down/);
      expect(logger.error).toHaveBeenCalledWith("Failed to read github://projects resource", expect.any(Error));
    });
  });

  describe("github://sprints/current", () => {
    it("returns null when no sprint is active", async () => {
      const service = { getCurrentSprint: vi.fn().mockResolvedValue(null) };
      const uri = new URL("github://sprints/current");
      const callback = createCurrentSprintCallback({ logger, service });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(data).toBeNull();
    });

    it("returns the active sprint when one exists", async () => {
      const sprint = { id: "sprint-1", title: "Sprint 12", status: "active" };
      const service = { getCurrentSprint: vi.fn().mockResolvedValue(sprint) };
      const uri = new URL("github://sprints/current");
      const callback = createCurrentSprintCallback({ logger, service });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(data).toEqual(sprint);
    });

    it("wraps a getCurrentSprint failure in a ProtocolError", async () => {
      const service = { getCurrentSprint: vi.fn().mockRejectedValue(new Error("timeout")) };
      const callback = createCurrentSprintCallback({ logger, service });

      await expect(callback(new URL("github://sprints/current"))).rejects.toThrow(
        /Failed to read current sprint: timeout/
      );
    });
  });

  describe("github://milestones", () => {
    it("lists open milestones by calling listMilestones('open')", async () => {
      const milestones = [{ id: "m1", title: "v1.0", status: "open" }];
      const service = { listMilestones: vi.fn().mockResolvedValue(milestones) };
      const uri = new URL("github://milestones");
      const callback = createMilestonesCallback({ logger, service });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(service.listMilestones).toHaveBeenCalledWith("open");
      expect(data).toEqual(milestones);
    });

    it("wraps a listMilestones failure in a ProtocolError", async () => {
      const service = { listMilestones: vi.fn().mockRejectedValue(new Error("rate limited")) };
      const callback = createMilestonesCallback({ logger, service });

      await expect(callback(new URL("github://milestones"))).rejects.toThrow(
        /Failed to list milestones: rate limited/
      );
    });
  });

  describe("github://agents", () => {
    it("returns the agent list from the AgentStore", async () => {
      const agents = [{ agentId: "agent-1", status: "idle" }];
      const agentStore = { listAgents: vi.fn().mockResolvedValue(agents) };
      const uri = new URL("github://agents");
      const callback = createAgentsCallback({ logger, agentStore });

      const data = expectValidResourceResult(await callback(uri), uri);

      expect(agentStore.listAgents).toHaveBeenCalledTimes(1);
      expect(data).toEqual(agents);
    });

    it("wraps an AgentStore failure in a ProtocolError", async () => {
      const agentStore = { listAgents: vi.fn().mockRejectedValue(new Error("registry missing")) };
      const callback = createAgentsCallback({ logger, agentStore });

      await expect(callback(new URL("github://agents"))).rejects.toThrow(/Failed to list agents: registry missing/);
    });
  });

  describe("github://tools", () => {
    it("returns a {count, tools} catalog projected to name/title/description/annotations", async () => {
      const toolRegistry = {
        getToolsForMCP: vi.fn().mockReturnValue([
          {
            name: "create_issue",
            title: "Create Issue",
            description: "Creates an issue",
            annotations: { readOnlyHint: false },
            inputSchema: { type: "object" }, // must be stripped from the projection
          },
          {
            name: "list_issues",
            title: "List Issues",
            description: "Lists issues",
            annotations: { readOnlyHint: true },
            inputSchema: { type: "object" },
          },
        ]),
      };
      const uri = new URL("github://tools");
      const callback = createToolsCallback({ logger, toolRegistry });

      const data = (await callback(uri).then((r) => expectValidResourceResult(r, uri))) as {
        count: number;
        tools: ToolCatalogEntry[];
      };

      expect(data.count).toBe(2);
      expect(data.tools).toEqual([
        { name: "create_issue", title: "Create Issue", description: "Creates an issue", annotations: { readOnlyHint: false } },
        { name: "list_issues", title: "List Issues", description: "Lists issues", annotations: { readOnlyHint: true } },
      ]);
      expect(data.tools[0]).not.toHaveProperty("inputSchema");
    });

    it("wraps a getToolsForMCP failure in a ProtocolError", async () => {
      const toolRegistry = {
        getToolsForMCP: vi.fn().mockImplementation(() => {
          throw new Error("registry corrupt");
        }),
      };
      const callback = createToolsCallback({ logger, toolRegistry });

      await expect(callback(new URL("github://tools"))).rejects.toThrow(/Failed to read tool catalog: registry corrupt/);
    });
  });
});
