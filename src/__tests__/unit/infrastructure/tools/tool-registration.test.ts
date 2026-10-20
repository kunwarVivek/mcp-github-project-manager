import { describe, expect, it, vi } from "vitest";
import { executeDiscoverTools } from "../../../../infrastructure/tools/compound/compound-executors";
import { ToolRegistry } from "../../../../infrastructure/tools/ToolRegistry";

/**
 * Guards the tool-registration surface.
 *
 * Two defects motivated this file, and both were silent:
 *
 * 1. `enrich_issue` and `generate_roadmap` were each defined twice — once by
 *    the ai-automation schemas and once by the issue-intelligence / roadmap-ai
 *    modules. `registerTool` overwrote the first entry with the second and only
 *    logged to stderr, so the loser became unreachable code while the survivor
 *    advertised a schema its executor did not implement. The registry must
 *    never contain two definitions under one name.
 *
 * 2. `discover_tools` advertises the action list clients are told to call.
 *    If that catalog drifts from the tool's own zod schema, agents call
 *    actions the server rejects. The catalog and the schema must agree
 *    exactly.
 */
describe("tool registration surface", () => {
  it("registers no duplicate tool names", () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      // Fresh instance: the constructor registers every built-in and compound
      // tool and logs a warning for each duplicate name.
      // biome-ignore lint/complexity/noVoid: the instance is the side effect under test
      void new ToolRegistry();
    } finally {
      stderr.mockRestore();
    }

    const messages = stderr.mock.calls.map((call) => String(call[0]));
    const duplicates = messages.filter((m) => /already registered/.test(m));

    expect(duplicates, `duplicate tool names:\n${duplicates.join("\n")}`).toEqual([]);
  });

  it("exposes a stable compound tool surface", () => {
    const tools = ToolRegistry.getInstance().getToolsForMCP();

    expect(tools.length).toBe(20);

    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("discover_tools advertises exactly the actions each tool accepts", async () => {
    const tools = ToolRegistry.getInstance().getToolsForMCP();
    const catalog = (await executeDiscoverTools({})) as Record<
      string,
      { tool?: string; actions?: string[] }
    >;

    for (const [domain, entry] of Object.entries(catalog)) {
      if (!entry.tool || !entry.actions) continue; // e.g. the aiStatus block

      // One domain can span several compound tools ("agent_work / agent_manage");
      // its action list is the union of their actions.
      const toolNames = entry.tool.split("/").map((n) => n.trim());
      const accepted = new Set<string>();

      for (const toolName of toolNames) {
        const tool = tools.find((t) => t.name === toolName);
        expect(tool, `catalog domain ${domain} references unknown tool ${toolName}`).toBeDefined();

        const properties = (
          tool?.inputSchema as { properties?: Record<string, { enum?: string[] }> }
        )?.properties;
        const actionEnum = properties?.action?.enum;

        if (!actionEnum) {
          // discover_tools itself has no action discriminator.
          expect(entry.actions).toEqual([]);
          continue;
        }

        for (const action of actionEnum) accepted.add(action);
      }

      for (const action of entry.actions) {
        expect(
          accepted.has(action),
          `discover_tools catalog advertises ${action}, which ${entry.tool} does not accept`
        ).toBe(true);
      }
      for (const action of accepted) {
        expect(
          entry.actions.includes(action),
          `discover_tools catalog does not advertise ${action} of ${entry.tool}`
        ).toBe(true);
      }
    }
  });

  it("every compound tool is reachable through discover_tools", async () => {
    const tools = ToolRegistry.getInstance().getToolsForMCP();
    const catalog = (await executeDiscoverTools({})) as Record<string, { tool?: string }>;

    const catalogued = new Set(
      Object.values(catalog)
        .filter((e) => e.tool)
        .flatMap((e) => (e.tool as string).split("/").map((n) => n.trim()))
    );

    // discover_tools cannot list itself, and every other compound tool must be
    // discoverable — otherwise agents relying on progressive disclosure never
    // learn that the tool exists.
    const missing = tools
      .map((t) => t.name)
      .filter((name) => name !== "discover_tools" && !catalogued.has(name));

    expect(missing, `tools missing from the discover_tools catalog: ${missing.join(", ")}`).toEqual(
      []
    );
  });

  it("exposes the AI-17 structured enrichment under its own action", async () => {
    const tools = ToolRegistry.getInstance().getToolsForMCP();
    const aiAnalyze = tools.find((t) => t.name === "ai_analyze");
    const actions = (aiAnalyze?.inputSchema as { properties?: { action?: { enum: string[] } } })
      ?.properties?.action?.enum;

    expect(actions).toContain("enrich_issue_sections");
    expect(actions).toContain("enrich_issue");

    const catalog = (await executeDiscoverTools({ domain: "ai_analysis" })) as {
      actions: string[];
    };
    expect(catalog.actions).toContain("enrich_issue_sections");
  });
});
