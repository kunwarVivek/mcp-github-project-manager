import { z } from "zod";
import { ResourceType } from "./resource-types";

// Content Types
export enum MCPContentType {
  JSON = "application/json",
  TEXT = "text/plain",
  MARKDOWN = "text/markdown",
  HTML = "text/html",
}

/**
 * MCP Error Codes following JSON-RPC 2.0 standard.
 *
 * Standard JSON-RPC 2.0 codes: -32700 to -32600
 * MCP-specific codes: -32000 to -32099
 * Application-specific codes: -31000 to -31999 (custom GitHub errors)
 *
 * Legacy string codes (MCP-001, etc.) are preserved for backward compatibility.
 */
export enum MCPErrorCode {
  // JSON-RPC 2.0 Standard Errors (numeric)
  PARSE_ERROR = -32700,          // Invalid JSON
  INVALID_REQUEST = -32600,      // Malformed JSON-RPC
  METHOD_NOT_FOUND = -32601,     // Unknown method/tool
  INVALID_PARAMS = -32602,       // Parameter validation failed
  INTERNAL_ERROR = -32603,       // Server-side error

  // MCP-Specific Errors (-32000 to -32099)
  TOOL_EXECUTION_FAILED = -32000,
  RESOURCE_NOT_FOUND = -32001,
  PERMISSION_DENIED = -32002,

  // GitHub API Errors (Application-specific: -31000 to -31999)
  GITHUB_RATE_LIMITED = -31001,
  GITHUB_NOT_FOUND = -31002,
  GITHUB_UNAUTHORIZED = -31003,
  GITHUB_FORBIDDEN = -31004,
  GITHUB_VALIDATION_ERROR = -31005,
  GITHUB_SERVER_ERROR = -31006,

  // Protocol Errors
  PROTOCOL_VERSION_MISMATCH = -31100,

  // Legacy aliases for backward compatibility
  VALIDATION_ERROR = -32602,     // Alias for INVALID_PARAMS
  UNAUTHORIZED = -31003,         // Alias for GITHUB_UNAUTHORIZED
  RATE_LIMITED = -31001,         // Alias for GITHUB_RATE_LIMITED
}

/**
 * Legacy string error codes mapping.
 * Maps old string codes to new numeric codes.
 */
export const LegacyErrorCodeMap: Record<string, MCPErrorCode> = {
  "MCP-001": MCPErrorCode.INTERNAL_ERROR,
  "MCP-002": MCPErrorCode.VALIDATION_ERROR,
  "MCP-003": MCPErrorCode.RESOURCE_NOT_FOUND,
  "MCP-004": MCPErrorCode.INVALID_REQUEST,
  "MCP-005": MCPErrorCode.UNAUTHORIZED,
  "MCP-006": MCPErrorCode.RATE_LIMITED,
};

/**
 * Error data payload structure for rich error context.
 */
export interface MCPErrorData {
  /** Tool name that caused the error, if applicable */
  tool?: string;
  /** Affected resource type and ID */
  resource?: {
    type: "project" | "issue" | "milestone" | "sprint" | "field" | "view" | "item" | "pr";
    id?: string;
  };
  /** GitHub-specific error details */
  github?: {
    status?: number;
    message?: string;
    documentation_url?: string;
  };
  /** Rate limit information if applicable */
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;  // Unix timestamp
    retryAfter?: number;  // Seconds until retry
  };
  /** Validation error details */
  validation?: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  /** Protocol version information for version mismatch errors */
  protocol?: {
    requested: string;
    supported: string[];
  };
  /** Stack trace for debugging (only in development) */
  stack?: string;
  /** Additional context */
  [key: string]: unknown;
}

// Response Content Interface
export interface MCPContent {
  type: "text" | "json" | "markdown" | "html";
  text: string;
  contentType: MCPContentType;
}

// Base MCP Error Schema (supports both numeric codes and legacy string codes)
export const MCPErrorSchema = z.object({
  code: z.union([z.number(), z.string()]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
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
  code: string | number;
  message: string;
  target?: string;
  details?: MCPErrorDetail[];
  innerError?: Record<string, any>;
  data?: MCPErrorData;
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
  code: string | number,
  message: string,
  correlationId?: string,
  details?: MCPErrorDetail[],
  version: string = "1.0",
  data?: MCPErrorData
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
      data,
    },
  };
}
