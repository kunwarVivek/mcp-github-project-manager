import { describe, expect, it } from "vitest";
import {
  agentManageSchema,
  agentWorkSchema,
} from "../../../../infrastructure/tools/compound/compound-schemas";
import { ToolRegistry } from "../../../../infrastructure/tools/ToolRegistry";

/**
 * Regression guard for a silent, total breakage.
 *
 * `zod-to-json-schema` does not support zod 4: given a zod 4 type it returns
 * `{ type: "object" }` with NO `properties` and throws nothing. After the
 * zod 3 -> 4 upgrade every tool therefore advertised a parameterless input
 * schema over `tools/list`, so no MCP client could discover a single argument —
 * while startup still reported "17 tools registered".
 *
 * These assertions fail loudly if schema generation ever degrades that way
 * again, whatever the cause.
 */
describe("MCP tool schema generation", () => {
  const tools = ToolRegistry.getInstance().getToolsForMCP();

  it("registers tools at all", () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it("every tool advertises a non-empty input schema", () => {
    const empty = tools
      .filter(
        (t) => Object.keys((t.inputSchema as { properties?: object }).properties ?? {}).length === 0
      )
      .map((t) => t.name);

    expect(empty, `tools with an empty inputSchema: ${empty.join(", ")}`).toEqual([]);
  });

  it("every input schema is a JSON Schema object", () => {
    for (const tool of tools) {
      expect(tool.inputSchema, tool.name).toMatchObject({ type: "object" });
    }
  });

  it("preserves enums and required fields", () => {
    const project = tools.find((t) => t.name === "manage_project");
    expect(project).toBeDefined();

    const schema = project!.inputSchema as {
      required?: string[];
      properties: Record<string, { enum?: unknown[] }>;
    };
    // `action` is the discriminator on every compound tool — if it survives as
    // a required enum, the converter is doing real work.
    expect(schema.required).toContain("action");
    expect(schema.properties.action.enum?.length).toBeGreaterThan(1);
  });

  it("emits self-contained schemas (no $ref a client must resolve)", () => {
    for (const tool of tools) {
      expect(JSON.stringify(tool.inputSchema), tool.name).not.toContain('"$ref"');
    }
  });

  it("does not mark defaulted fields as required", () => {
    for (const tool of tools) {
      const schema = tool.inputSchema as {
        required?: string[];
        properties: Record<string, { default?: unknown }>;
      };
      const defaulted = Object.entries(schema.properties ?? {})
        .filter(([, v]) => v?.default !== undefined)
        .map(([k]) => k);
      const wrong = defaulted.filter((k) => (schema.required ?? []).includes(k));
      expect(wrong, `${tool.name}: defaulted-but-required`).toEqual([]);
    }
  });
});

describe("agent compound schemas", () => {
  it("requires action-specific agent_work arguments before execution", () => {
    expect(() => agentWorkSchema.parse({ action: "complete_task", agentId: "agent-1" })).toThrow();

    expect(agentWorkSchema.parse({ action: "checkout_task", agentId: "agent-1" })).toMatchObject({
      action: "checkout_task",
      agentId: "agent-1",
      strategy: "highest_priority",
    });
  });

  it("requires action-specific agent_manage arguments and preserves budget aliases", () => {
    expect(() => agentManageSchema.parse({ action: "smart_assign" })).toThrow();

    expect(
      agentManageSchema.parse({
        action: "set_budget",
        agentId: "agent-1",
        totalTokens: 1000,
        warningThreshold: 0.75,
      })
    ).toMatchObject({
      action: "set_budget",
      agentId: "agent-1",
      totalTokens: 1000,
      warningThreshold: 0.75,
      hardStop: true,
    });
  });

  it("advertises action-specific MCP validation for agent compound tools", () => {
    const tools = ToolRegistry.getInstance().getToolsForMCP();
    for (const name of ["agent_work", "agent_manage"]) {
      const schema = tools.find((tool) => tool.name === name)?.inputSchema as {
        type?: string;
        oneOf?: Array<{ required?: string[] }>;
        properties?: Record<string, { enum?: string[] }>;
      };

      expect(schema.type).toBe("object");
      expect(schema.properties?.action.enum?.length).toBeGreaterThan(1);
      expect(schema.oneOf?.some((variant) => variant.required?.includes("agentId"))).toBe(true);
    }
  });
});
