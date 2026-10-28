/**
 * Generate docs/api-reference/openapi.json from the tools the server advertises.
 *
 * The document is derived from the same public tool definitions and the same
 * `toMcpTool` conversion `ToolRegistry.getToolsForMCP()` uses - the exact list
 * (and the exact JSON Schemas) an MCP client receives from `tools/list` - so
 * it cannot drift from the server: input schemas come from
 * `z.toJSONSchema(schema, { io: "input" })`, output schemas from
 * `{ io: "output" }`, and the compound tools keep their hybrid
 * flat-properties + per-action `oneOf` shape.
 *
 * Usage: pnpm run docs:api
 * Needs no server configuration: it imports only the schema-producing module.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  compoundToolDefinitions,
  toMcpTool,
} from "../src/infrastructure/tools/compound/compound-tool-definitions.js";

const OUTPUT_PATH = "./docs/api-reference/openapi.json";

type JsonObject = Record<string, unknown>;

const errorResponse = (description: string): JsonObject => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

/** JSON Schema `$schema` markers are meaningless inside an OpenAPI 3.1 document. */
function withoutSchemaMarker(schema: JsonObject): JsonObject {
  const { $schema: _marker, ...rest } = schema;
  return rest;
}

function buildDocument(): JsonObject {
  const tools = compoundToolDefinitions.map(toMcpTool);
  const paths: Record<string, JsonObject> = {};

  for (const tool of tools) {
    const successContent: JsonObject = tool.outputSchema
      ? {
          "application/json": {
            schema: withoutSchemaMarker(tool.outputSchema),
          },
        }
      : {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                content: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { type: { type: "string" }, text: { type: "string" } },
                  },
                },
              },
            },
          },
        };

    paths[`/tools/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.title ?? tool.name,
        description: tool.description,
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: withoutSchemaMarker(tool.inputSchema) },
          },
        },
        responses: {
          "200": { description: "Successful operation", content: successContent },
          "400": errorResponse("Validation error"),
          "401": errorResponse("Unauthorized"),
          "404": errorResponse("Resource not found"),
          "429": errorResponse("Rate limited"),
          "500": errorResponse("Internal server error"),
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "GitHub Project Manager MCP API",
      version: "1.0.0",
      description: "API for managing GitHub Projects through the Model Context Protocol",
    },
    servers: [{ url: "/", description: "MCP Server" }],
    paths,
    components: {
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: { type: "string", description: "Error code" },
            message: { type: "string", description: "Error message" },
            details: {
              type: "array",
              items: {
                type: "object",
                properties: { code: { type: "string" }, message: { type: "string" } },
              },
            },
          },
        },
      },
    },
  };
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(buildDocument(), null, 2)}\n`);
process.stdout.write(`OpenAPI documentation written to ${OUTPUT_PATH}\n`);
