#!/usr/bin/env tsx

/**
 * Fail when the docs publish a different tool/action count than the code serves.
 *
 * The truth is derived at runtime from the ToolRegistry (the same source the
 * MCP `tools/list` response uses): every tool counts as a tool; every member of
 * a tool's `action` enum counts as an action.
 *
 * Docs state the numbers in marker spans so the check never guesses at prose:
 *
 *   <!-- count:tools -->21<!-- /count -->
 *   <!-- count:actions -->175<!-- /count -->
 *
 * TOOLS.md additionally lists `[name](#name) (N actions)` per tool; those are
 * checked against the registry too. package.json cannot hold comments, so its
 * `description` is checked against the "N tools (M actions)" phrase.
 *
 * Usage: npm run check:docs
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
await import("reflect-metadata");
// Building the registry loads config, which requires these; no GitHub call is made.
process.env.GITHUB_TOKEN ??= "check-doc-counts";
process.env.GITHUB_OWNER ??= "check-doc-counts";
process.env.GITHUB_REPO ??= "check-doc-counts";

const registryUrl = pathToFileURL(path.join(root, "src/infrastructure/tools/ToolRegistry.ts")).href;
const { ToolRegistry } = await import(registryUrl);

const tools = ToolRegistry.getInstance()
  .getToolsForMCP()
  .map((tool) => {
    const actions = tool.inputSchema?.properties?.action?.enum;
    return { name: tool.name, actions: Array.isArray(actions) ? actions.length : 0 };
  });

const expected = {
  tools: tools.length,
  actions: tools.reduce((sum, tool) => sum + tool.actions, 0),
};

/** Files that must carry marker spans, with the marker kinds each must have. */
const MARKED_DOCS = [
  { file: "README.md", kinds: ["tools", "actions"] },
  { file: "docs/TOOLS.md", kinds: ["tools", "actions"] },
  { file: "docs/architecture.md", kinds: ["tools", "actions"] },
  { file: "AGENTS.md", kinds: ["tools", "actions"] },
  { file: "CLAUDE.md", kinds: ["tools", "actions"] },
];

const errors = [];
const MARKER = /<!-- count:(tools|actions) -->(\d+)<!-- \/count -->/g;

for (const { file, kinds } of MARKED_DOCS) {
  const text = readFileSync(path.join(root, file), "utf8");
  const found = new Set();
  for (const match of text.matchAll(MARKER)) {
    const [, kind, value] = match;
    found.add(kind);
    if (Number(value) !== expected[kind]) {
      errors.push(`${file}: count:${kind} says ${value}, registry has ${expected[kind]}`);
    }
  }
  for (const kind of kinds) {
    if (!found.has(kind)) errors.push(`${file}: no <!-- count:${kind} --> marker found`);
  }
}

// docs/TOOLS.md per-tool action counts.
const toolsDoc = readFileSync(path.join(root, "docs/TOOLS.md"), "utf8");
const byName = new Map(tools.map((tool) => [tool.name, tool.actions]));
for (const match of toolsDoc.matchAll(/^\d+\. \[(\w+)\]\(#\w+\) \((\d+) actions\)/gm)) {
  const [, name, value] = match;
  if (!byName.has(name)) {
    errors.push(`docs/TOOLS.md: lists unknown tool ${name}`);
  } else if (Number(value) !== byName.get(name)) {
    errors.push(`docs/TOOLS.md: ${name} says ${value} actions, registry has ${byName.get(name)}`);
  }
}

// package.json description.
const description = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).description;
const phrase = /(\d+) tools \((\d+) actions\)/.exec(description);
if (!phrase) {
  errors.push('package.json: description has no "N tools (M actions)" phrase');
} else {
  if (Number(phrase[1]) !== expected.tools) {
    errors.push(
      `package.json: description says ${phrase[1]} tools, registry has ${expected.tools}`
    );
  }
  if (Number(phrase[2]) !== expected.actions) {
    errors.push(
      `package.json: description says ${phrase[2]} actions, registry has ${expected.actions}`
    );
  }
}

if (errors.length > 0) {
  console.error(
    `Doc counts are out of sync (registry: ${expected.tools} tools, ${expected.actions} actions):`
  );
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Doc counts match the registry: ${expected.tools} tools, ${expected.actions} actions.`);
