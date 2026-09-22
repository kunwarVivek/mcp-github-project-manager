import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ProtocolError } from "@modelcontextprotocol/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerResources } from "../../../../infrastructure/mcp/resources";
import type { RegisterResourcesDeps } from "../../../../infrastructure/mcp/resources";
import type { ProjectManagementService } from "../../../../services/ProjectManagementService";
import type { ToolRegistry } from "../../../../infrastructure/tools/ToolRegistry";
import type { AgentStore } from "../../../../infrastructure/agent/AgentStore";
import type { AIServiceFactory } from "../../../../services/ai/AIServiceFactory";
import type { ILogger } from "../../../../infrastructure/logger/index";

/**
 * Unit tests for the six `github://…` MCP resources registered by
 * `registerResources()` (`src/infrastructure/mcp/resources.ts`), the module
 * `GitHubProjectManagerServer.registerResources()` (`src/index.ts`)
 * delegates to.
 *
 * `registerResources()` is a plain, side-effect-free exported function that
 * only needs an `McpServer`-shaped object with a `registerResource` method,
 * so it is exercised directly against a lightweight capturing double
 * instead of a mocked SDK server — same approach as `prompts.test.ts`.
 */

const SERVER_VERSION = "0.0.0-test";

interface ResourceReadResult {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}

type ReadCallback = (uri: URL) => Promise<ResourceReadResult>;

interface CapturedResource {
  uri: string;
  metadata: { title?: string; description?: string; mimeType?: string };
  callback: ReadCallback;
}

function createCapturingServer(): { server: McpServer; resources: Record<string, CapturedResource> } {
  const resources: Record<string, CapturedResource> = {};
  const fakeServer = {
    registerResource: (
      name: string,
      uri: string,
      metadata: CapturedResource["metadata"],
      callback: ReadCallback
    ) => {
      resources[name] = { uri, metadata, callback };
    },
  };
  return { server: fakeServer as unknown as McpServer, resources };
}

function getCallback(resources: Record<string, CapturedResource>, name: string): ReadCallback {
  const resource = resources[name];
  if (!resource) throw new Error(`Resource "${name}" was never registered`);
  return resource.callback;
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

interface AiValidation {
  hasAnyProvider: boolean;
  available: string[];
  availableModels: string[];
  missing: string[];
}

/** Builds full `RegisterResourcesDeps`, overriding only the fakes a test cares about. */
function makeDeps(overrides: {
  logger?: Logger;
  aiFactory?: { validateConfiguration: Mock };
  service?: { listProjects?: Mock; getCurrentSprint?: Mock; listMilestones?: Mock };
  agentStore?: { listAgents: Mock };
  toolRegistry?: { getToolsForMCP: Mock };
} = {}): RegisterResourcesDeps {
  const logger = overrides.logger ?? makeLogger();
  const aiFactory = overrides.aiFactory ?? {
    validateConfiguration: vi.fn().mockReturnValue({
      hasAnyProvider: false,
      available: [],
      availableModels: [],
      missing: [],
    } satisfies AiValidation),
  };
  const service = {
    listProjects: vi.fn().mockResolvedValue([]),
    getCurrentSprint: vi.fn().mockResolvedValue(null),
    listMilestones: vi.fn().mockResolvedValue([]),
    ...overrides.service,
  };
  const agentStore = overrides.agentStore ?? { listAgents: vi.fn().mockResolvedValue([]) };
  const toolRegistry = overrides.toolRegistry ?? { getToolsForMCP: vi.fn().mockReturnValue([]) };

  return {
    service: service as unknown as ProjectManagementService,
    toolRegistry: toolRegistry as unknown as ToolRegistry,
    agentStore: agentStore as unknown as AgentStore,
    aiFactory: aiFactory as unknown as AIServiceFactory,
    logger: logger as unknown as ILogger,
    serverVersion: SERVER_VERSION,
  };
}

describe("registerResources", () => {
  it("registers all six github:// resources with the expected uris", () => {
    const { server, resources } = createCapturingServer();

    registerResources(server, makeDeps());

    expect(Object.keys(resources).sort()).toEqual(
      ["agents", "config", "current-sprint", "milestones", "projects", "tools"].sort()
    );
    expect(resources.config.uri).toBe("github://config");
    expect(resources.projects.uri).toBe("github://projects");
    expect(resources["current-sprint"].uri).toBe("github://sprints/current");
    expect(resources.milestones.uri).toBe("github://milestones");
    expect(resources.agents.uri).toBe("github://agents");
    expect(resources.tools.uri).toBe("github://tools");
  });

  describe("github://config", () => {
    it("returns server config with owner/repo/version and AI availability", async () => {
      const aiFactory = {
        validateConfiguration: vi.fn().mockReturnValue({
          hasAnyProvider: true,
          available: ["anthropic"],
          availableModels: ["claude-opus-5"],
          missing: ["openai"],
        } satisfies AiValidation),
      };
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ aiFactory }));
      const uri = new URL("github://config");

      const data = expectValidResourceResult(await getCallback(resources, "config")(uri), uri);

      expect(data).toMatchObject({
        serverVersion: SERVER_VERSION,
        ai: {
          available: true,
          providers: ["anthropic"],
          availableModels: ["claude-opus-5"],
          missing: ["openai"],
        },
      });
      if (data && typeof data === "object") {
        expect("owner" in data && typeof data.owner === "string").toBe(true);
        expect("repo" in data && typeof data.repo === "string").toBe(true);
        expect("tokenConfigured" in data && typeof data.tokenConfigured === "boolean").toBe(true);
      } else {
        throw new Error("expected config resource payload to be an object");
      }
    });

    it("wraps a validateConfiguration failure in a ProtocolError and logs it", async () => {
      const logger = makeLogger();
      const aiFactory = {
        validateConfiguration: vi.fn().mockImplementation(() => {
          throw new Error("boom");
        }),
      };
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ logger, aiFactory }));
      const promise = getCallback(resources, "config")(new URL("github://config"));

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
      const listProjects = vi.fn().mockResolvedValue(projects);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { listProjects } }));
      const uri = new URL("github://projects");

      const data = expectValidResourceResult(await getCallback(resources, "projects")(uri), uri);

      expect(listProjects).toHaveBeenCalledTimes(1);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual(projects);
    });

    it("wraps a listProjects failure in a ProtocolError", async () => {
      const listProjects = vi.fn().mockRejectedValue(new Error("api down"));
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { listProjects } }));

      await expect(getCallback(resources, "projects")(new URL("github://projects"))).rejects.toThrow(
        /Failed to list projects: api down/
      );
    });
  });

  describe("github://sprints/current", () => {
    it("returns null when no sprint is active", async () => {
      const getCurrentSprint = vi.fn().mockResolvedValue(null);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { getCurrentSprint } }));
      const uri = new URL("github://sprints/current");

      const data = expectValidResourceResult(await getCallback(resources, "current-sprint")(uri), uri);

      expect(data).toBeNull();
    });

    it("returns the active sprint when one exists", async () => {
      const sprint = { id: "sprint-1", title: "Sprint 12", status: "active" };
      const getCurrentSprint = vi.fn().mockResolvedValue(sprint);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { getCurrentSprint } }));
      const uri = new URL("github://sprints/current");

      const data = expectValidResourceResult(await getCallback(resources, "current-sprint")(uri), uri);

      expect(data).toEqual(sprint);
    });

    it("wraps a getCurrentSprint failure in a ProtocolError", async () => {
      const getCurrentSprint = vi.fn().mockRejectedValue(new Error("timeout"));
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { getCurrentSprint } }));

      await expect(
        getCallback(resources, "current-sprint")(new URL("github://sprints/current"))
      ).rejects.toThrow(/Failed to read current sprint: timeout/);
    });
  });

  describe("github://milestones", () => {
    it("lists open milestones by calling listMilestones('open')", async () => {
      const milestones = [{ id: "m1", title: "v1.0", status: "open" }];
      const listMilestones = vi.fn().mockResolvedValue(milestones);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { listMilestones } }));
      const uri = new URL("github://milestones");

      const data = expectValidResourceResult(await getCallback(resources, "milestones")(uri), uri);

      expect(listMilestones).toHaveBeenCalledWith("open");
      expect(data).toEqual(milestones);
    });

    it("wraps a listMilestones failure in a ProtocolError", async () => {
      const listMilestones = vi.fn().mockRejectedValue(new Error("rate limited"));
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ service: { listMilestones } }));

      await expect(getCallback(resources, "milestones")(new URL("github://milestones"))).rejects.toThrow(
        /Failed to list milestones: rate limited/
      );
    });
  });

  describe("github://agents", () => {
    it("returns the agent list from the AgentStore", async () => {
      const agents = [{ agentId: "agent-1", status: "idle" }];
      const listAgents = vi.fn().mockResolvedValue(agents);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ agentStore: { listAgents } }));
      const uri = new URL("github://agents");

      const data = expectValidResourceResult(await getCallback(resources, "agents")(uri), uri);

      expect(listAgents).toHaveBeenCalledTimes(1);
      expect(data).toEqual(agents);
    });

    it("wraps an AgentStore failure in a ProtocolError", async () => {
      const listAgents = vi.fn().mockRejectedValue(new Error("registry missing"));
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ agentStore: { listAgents } }));

      await expect(getCallback(resources, "agents")(new URL("github://agents"))).rejects.toThrow(
        /Failed to list agents: registry missing/
      );
    });
  });

  describe("github://tools", () => {
    it("returns a {count, tools} catalog projected to name/title/description/annotations", async () => {
      const getToolsForMCP = vi.fn().mockReturnValue([
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
      ]);
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ toolRegistry: { getToolsForMCP } }));
      const uri = new URL("github://tools");

      const rawData = expectValidResourceResult(await getCallback(resources, "tools")(uri), uri);
      if (!rawData || typeof rawData !== "object" || !("count" in rawData) || !("tools" in rawData)) {
        throw new Error("expected tools resource payload to be a {count, tools} object");
      }
      const { count, tools } = rawData;

      expect(count).toBe(2);
      expect(tools).toEqual([
        { name: "create_issue", title: "Create Issue", description: "Creates an issue", annotations: { readOnlyHint: false } },
        { name: "list_issues", title: "List Issues", description: "Lists issues", annotations: { readOnlyHint: true } },
      ]);
      if (!Array.isArray(tools)) throw new Error("expected tools resource payload to include an array");
      expect(tools[0]).not.toHaveProperty("inputSchema");
    });

    it("wraps a getToolsForMCP failure in a ProtocolError", async () => {
      const getToolsForMCP = vi.fn().mockImplementation(() => {
        throw new Error("registry corrupt");
      });
      const { server, resources } = createCapturingServer();
      registerResources(server, makeDeps({ toolRegistry: { getToolsForMCP } }));

      await expect(getCallback(resources, "tools")(new URL("github://tools"))).rejects.toThrow(
        /Failed to read tool catalog: registry corrupt/
      );
    });
  });
});
