import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../../../../infrastructure/tools/ToolRegistry';

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
describe('MCP tool schema generation', () => {
  const tools = ToolRegistry.getInstance().getToolsForMCP();

  it('registers tools at all', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it('every tool advertises a non-empty input schema', () => {
    const empty = tools
      .filter((t) => Object.keys((t.inputSchema as { properties?: object }).properties ?? {}).length === 0)
      .map((t) => t.name);

    expect(empty, `tools with an empty inputSchema: ${empty.join(', ')}`).toEqual([]);
  });

  it('every input schema is a JSON Schema object', () => {
    for (const tool of tools) {
      expect(tool.inputSchema, tool.name).toMatchObject({ type: 'object' });
    }
  });

  it('preserves enums and required fields', () => {
    const project = tools.find((t) => t.name === 'manage_project');
    expect(project).toBeDefined();

    const schema = project!.inputSchema as {
      required?: string[];
      properties: Record<string, { enum?: unknown[] }>;
    };
    // `action` is the discriminator on every compound tool — if it survives as
    // a required enum, the converter is doing real work.
    expect(schema.required).toContain('action');
    expect(schema.properties.action.enum?.length).toBeGreaterThan(1);
  });

  it('emits self-contained schemas (no $ref a client must resolve)', () => {
    for (const tool of tools) {
      expect(JSON.stringify(tool.inputSchema), tool.name).not.toContain('"$ref"');
    }
  });

  it('does not mark defaulted fields as required', () => {
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
