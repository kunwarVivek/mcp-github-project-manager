import { z } from "zod";
import { ResourceType } from "./resource-types";

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
export type MCPResponseSchema = z.infer<typeof MCPResponseSchema>;
export type MCPError = z.infer<typeof MCPErrorSchema>;

// Model Context Protocol (MCP) types for GitHub Project Manager
export interface MCPRequest {
  version: string;
  correlationId?: string;
  requestId: string;
  inputs: {
    parameters: Record<string, any>;
    content?: string;
    context?: Record<string, any>;
  };
}

export interface MCPResponseFormat {
  type: string;
  schema?: Record<string, any>;
}

export interface MCPResource {
  type: ResourceType;
  id: string;
  properties: Record<string, any>;
  links?: Record<string, string>;
}

export interface MCPSuccessResponse {
  version: string;
  correlationId?: string;
  requestId: string;
  status: "success";
  output: {
    content?: string;
    format?: MCPResponseFormat;
    resources?: MCPResource[];
    context?: Record<string, any>;
  };
}

export interface MCPErrorDetail {
  code: string;
  message: string;
  target?: string;
  details?: MCPErrorDetail[];
  innerError?: Record<string, any>;
}

export interface MCPErrorResponse {
  version: string;
  correlationId?: string;
  requestId: string;
  status: "error";
  error: MCPErrorDetail;
}

export type MCPResponse = MCPSuccessResponse | MCPErrorResponse;

export interface MCPHandler {
  handle(request: MCPRequest): Promise<MCPResponse>;
}

export interface MCPResourceMapper<T> {
  toMCPResource(entity: T): MCPResource;
  fromMCPResource(resource: MCPResource): T;
}

export interface MCPSerializer<T> {
  serialize(entity: T): MCPResource;
  deserialize(resource: MCPResource): T;
}

export function createSuccessResponse(
  requestId: string,
  content?: string,
  resources?: MCPResource[],
  correlationId?: string,
  version: string = "1.0"
): MCPSuccessResponse {
  return {
    version,
    correlationId,
    requestId,
    status: "success",
    output: {
      content,
      resources,
    },
  };
}

export function createErrorResponse(
  requestId: string,
  code: string,
  message: string,
  correlationId?: string,
  details?: MCPErrorDetail[],
  version: string = "1.0"
): MCPErrorResponse {
  return {
    version,
    correlationId,
    requestId,
    status: "error",
    error: {
      code,
      message,
      details,
    },
  };
}