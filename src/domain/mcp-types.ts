import { z } from "zod";

// Content Types
export enum MCPContentType {
  JSON = "application/json",
  TEXT = "text/plain",
  MARKDOWN = "text/markdown",
  HTML = "text/html",
}

// MCP Error Codes
export enum MCPErrorCode {
  INTERNAL_ERROR = "MCP-001",
  VALIDATION_ERROR = "MCP-002",
  RESOURCE_NOT_FOUND = "MCP-003",
  INVALID_REQUEST = "MCP-004",
  UNAUTHORIZED = "MCP-005",
  RATE_LIMITED = "MCP-006",
}

// Response Content Interface
export interface MCPContent {
  type: "text" | "json" | "markdown" | "html";
  text: string;
  contentType: MCPContentType;
}

// Base MCP Error Schema
export const MCPErrorSchema = z.object({
  code: z.nativeEnum(MCPErrorCode),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// Base MCP Response Schema
export const MCPResponseSchema = z.object({
  content: z.array(z.object({
    type: z.enum(["text", "json", "markdown", "html"]),
    text: z.string(),
    contentType: z.nativeEnum(MCPContentType),
  })),
  metadata: z.object({
    timestamp: z.string(),
    status: z.number(),
    pagination: z.object({
      page: z.number(),
      totalPages: z.number(),
    }).optional(),
    requestId: z.string().optional(),
  }),
});

// Type definitions from schemas
export type MCPResponse = z.infer<typeof MCPResponseSchema>;
export type MCPError = z.infer<typeof MCPErrorSchema>;