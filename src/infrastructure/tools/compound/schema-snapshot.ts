import { createHash } from "node:crypto";
import { compoundToolDefinitions, toJsonSchema } from "./compound-tool-definitions";
import { TOOL_SCHEMA_VERSIONS } from "./schema-version";

export interface SchemaSnapshotEntry {
  version: string;
  hash: string;
}

export type SchemaSnapshot = Record<string, SchemaSnapshotEntry>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const body = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${body.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** sha256 of the canonical (key-sorted) JSON of a tool's input JSON schema. */
export function hashSchema(schema: unknown): string {
  return createHash("sha256").update(canonical(schema)).digest("hex");
}

/** Current `{tool: {version, hash}}` for every compound tool. */
export function buildSchemaSnapshot(): SchemaSnapshot {
  const snapshot: SchemaSnapshot = {};
  for (const tool of compoundToolDefinitions) {
    snapshot[tool.name] = {
      version: TOOL_SCHEMA_VERSIONS[tool.name] ?? "<unversioned>",
      hash: hashSchema(toJsonSchema(tool.schema, "input")),
    };
  }
  return snapshot;
}
