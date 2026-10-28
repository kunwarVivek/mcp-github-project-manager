import type { Tool } from "@modelcontextprotocol/client";

/**
 * Narrowing helpers for the untyped JSON that crosses the MCP boundary.
 *
 * Tool payloads are parsed JSON, so their static type is `unknown`; a suite
 * that reads a field narrows first instead of casting.
 */

export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow to a JSON object or fail the test with a message naming `what`. */
export function asRecord(value: unknown, what = "value"): JsonObject {
  if (!isRecord(value)) {
    throw new Error(`Expected ${what} to be an object, got ${JSON.stringify(value)}`);
  }
  return value;
}

/** Narrow to an array or fail the test with a message naming `what`. */
export function asArray(value: unknown, what = "value"): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${what} to be an array, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * A JSON-RPC 2.0 message as read off the server's stdout. Every member is
 * optional because the stdio suites classify messages (response, notification,
 * error) by which members are present.
 */
export interface WireMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  result?: { capabilities?: Record<string, unknown>; tools?: Tool[] };
  error?: { code?: number; message?: string };
}
