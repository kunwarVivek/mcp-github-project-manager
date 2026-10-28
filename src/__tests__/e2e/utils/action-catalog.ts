import { ToolRegistry } from "../../../infrastructure/tools/ToolRegistry";

/**
 * The catalog of the public MCP surface, derived at RUNTIME.
 *
 * The numbers the README and the docs publish (20 tools, 169 actions) are
 * only worth anything if they are checked against the code that serves the
 * requests - so nothing here is hand-written. The registry is the single
 * source of truth: `getToolsForMCP()` returns exactly the tools an MCP
 * client can call, and each compound tool's JSON Schema carries the `action`
 * enum it accepts.
 */

export interface ActionEntry {
  tool: string;
  action: string;
}

export interface ToolEntry {
  tool: string;
  /** The tool's actions; empty for meta tools such as `discover_tools`. */
  actions: string[];
}

function actionEnumOf(tool: { name: string; inputSchema: unknown }): string[] {
  const properties = (tool.inputSchema as { properties?: Record<string, { enum?: string[] }> })
    ?.properties;
  const actions = properties?.action?.enum;
  return Array.isArray(actions) ? [...actions] : [];
}

/**
 * Every (tool, action) pair the server claims to support.
 *
 * `discover_tools` has no `action` discriminator - it takes a `domain` or a
 * `query` - so it is reported as a tool with no actions rather than being
 * dropped.
 */
export function getActionCatalog(): ActionEntry[] {
  const tools = ToolRegistry.getInstance().getToolsForMCP();
  const catalog: ActionEntry[] = [];

  for (const tool of tools) {
    for (const action of actionEnumOf(tool)) {
      catalog.push({ tool: tool.name, action });
    }
  }

  return catalog;
}

/** The tools themselves, with the actions each one accepts. */
export function getToolCatalog(): ToolEntry[] {
  return ToolRegistry.getInstance()
    .getToolsForMCP()
    .map((tool) => ({ tool: tool.name, actions: actionEnumOf(tool) }));
}

/**
 * The numbers the docs publish. Kept as a constant so the test can assert
 * the docs are still true, not so the test can pass by construction: the
 * catalog itself is derived from the registry.
 */
export const PUBLISHED_SURFACE = {
  tools: 20,
  actions: 169,
} as const;
