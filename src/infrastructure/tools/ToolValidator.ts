import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { MCPResponseFormatter } from "../mcp/MCPResponseFormatter.js";
import { MCPErrorCode, MCPErrorData } from "../../domain/mcp-types.js";
import { ParameterCoercion } from "./ParameterCoercion.js";

export type ToolSchema<T> = z.ZodType<T>;

/**
 * Tool behavior annotations per MCP specification 2025-11-25.
 * These hints help clients understand tool behavior and make informed decisions.
 */
export interface ToolAnnotations {
  /** Human-readable title for the tool */
  title?: string;
  /** If true, tool only reads data (default: false) */
  readOnlyHint?: boolean;
  /** If true, tool may delete or modify data (default: true when readOnly=false) */
  destructiveHint?: boolean;
  /** If true, repeated calls with same args have same effect (default: false) */
  idempotentHint?: boolean;
  /** If true, tool interacts with external world (default: true) */
  openWorldHint?: boolean;
}

/**
 * Definition of a tool with its schema, metadata, and behavior annotations.
 * @template TInput - The input type validated by the schema
 * @template TOutput - The output type (defaults to unknown for backward compatibility)
 */
export interface ToolDefinition<TInput, TOutput = unknown> {
  name: string;
  /** Human-readable title for display */
  title?: string;
  description: string;
  schema: ToolSchema<TInput>;
  /** Zod schema for the tool's output (optional) */
  outputSchema?: z.ZodType<TOutput>;
  /** Behavior annotations per MCP specification */
  annotations?: ToolAnnotations;
  examples?: Array<{
    name: string;
    description: string;
    args: TInput;
  }>;
}

/**
 * Interface representing an Octokit RequestError
 */
interface OctokitRequestError {
  status: number;
  message?: string;
  response?: {
    headers?: Record<string, string>;
    data?: {
      message?: string;
      documentation_url?: string;
      errors?: Array<{
        resource?: string;
        field?: string;
        code?: string;
        message?: string;
      }>;
    };
  };
}

export class ToolValidator {
  /**
   * Validate tool arguments against the schema
   */
  static validate<T>(toolName: string, args: unknown, schema: ToolSchema<T>): T {
    try {
      // Apply parameter coercion before validation
      const coercedArgs = ParameterCoercion.coerceParameters(args as Record<string, any>, schema);
      return schema.parse(coercedArgs);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Format Zod validation errors
        const details = error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid parameters for tool ${toolName}: ${error.errors.map(e => e.message).join(", ")}`,
          { details }
        );
      }

      // Generic validation error
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters for tool ${toolName}`,
        { cause: String(error) }
      );
    }
  }

  /**
   * Map GitHub API errors to MCP error codes with rich context.
   * Handles Octokit RequestError and extracts rate limit info, validation errors, etc.
   */
  static mapGitHubError(error: unknown, toolName: string): McpError {
    const data: MCPErrorData = { tool: toolName };

    // Handle Octokit RequestError
    if (error && typeof error === "object" && "status" in error) {
      const octokitError = error as OctokitRequestError;
      const status = octokitError.status;
      const message = octokitError.message || octokitError.response?.data?.message || "GitHub API error";

      data.github = {
        status,
        message,
        documentation_url: octokitError.response?.data?.documentation_url,
      };

      // Handle rate limiting
      if (status === 403 && message.toLowerCase().includes("rate limit")) {
        const headers = octokitError.response?.headers;
        if (headers) {
          data.rateLimit = {
            limit: parseInt(headers["x-ratelimit-limit"] || "0", 10),
            remaining: parseInt(headers["x-ratelimit-remaining"] || "0", 10),
            reset: parseInt(headers["x-ratelimit-reset"] || "0", 10),
            retryAfter: parseInt(headers["retry-after"] || "0", 10) || undefined,
          };
        }
        return new McpError(
          MCPErrorCode.GITHUB_RATE_LIMITED,
          `GitHub API rate limit exceeded for ${toolName}`,
          data
        );
      }

      // Handle secondary rate limiting (abuse detection)
      if (status === 403 && (message.toLowerCase().includes("abuse") || message.toLowerCase().includes("secondary"))) {
        const headers = octokitError.response?.headers;
        const retryAfter = headers?.["retry-after"];
        if (retryAfter) {
          data.rateLimit = {
            limit: 0,
            remaining: 0,
            reset: 0,
            retryAfter: parseInt(retryAfter, 10),
          };
        }
        return new McpError(
          MCPErrorCode.GITHUB_RATE_LIMITED,
          `GitHub API secondary rate limit hit for ${toolName}: ${message}`,
          data
        );
      }

      // Handle validation errors (422)
      if (status === 422 && octokitError.response?.data?.errors) {
        data.validation = octokitError.response.data.errors.map(e => ({
          path: e.field || e.resource || "unknown",
          message: e.message || e.code || "Validation error",
          code: e.code || "validation_failed",
        }));
      }

      // Map HTTP status to error code
      switch (status) {
        case 401:
          return new McpError(
            MCPErrorCode.GITHUB_UNAUTHORIZED,
            `GitHub API unauthorized: ${message}`,
            data
          );
        case 403:
          return new McpError(
            MCPErrorCode.GITHUB_FORBIDDEN,
            `GitHub API forbidden: ${message}`,
            data
          );
        case 404:
          return new McpError(
            MCPErrorCode.GITHUB_NOT_FOUND,
            `GitHub resource not found: ${message}`,
            data
          );
        case 422:
          return new McpError(
            MCPErrorCode.GITHUB_VALIDATION_ERROR,
            `GitHub validation failed: ${message}`,
            data
          );
        default:
          if (status >= 500) {
            return new McpError(
              MCPErrorCode.GITHUB_SERVER_ERROR,
              `GitHub server error (${status}): ${message}`,
              data
            );
          }
          return new McpError(
            MCPErrorCode.TOOL_EXECUTION_FAILED,
            `GitHub API error (${status}): ${message}`,
            data
          );
      }
    }

    // Handle generic errors
    if (error instanceof Error) {
      data.stack = process.env.NODE_ENV === "development" ? error.stack : undefined;
      return new McpError(
        MCPErrorCode.TOOL_EXECUTION_FAILED,
        `${toolName} failed: ${error.message}`,
        data
      );
    }

    return new McpError(
      MCPErrorCode.INTERNAL_ERROR,
      `Unknown error in ${toolName}`,
      { tool: toolName, error: String(error) }
    );
  }

  /**
   * Transform MCP SDK errors to our custom error format
   */
  static handleToolError(error: unknown, toolName: string): ReturnType<typeof MCPResponseFormatter.error> {
    // Use stderr to avoid interfering with MCP protocol on stdout
    process.stderr.write(`[${toolName}] Error: ${error}\n`);

    // Check if this is a GitHub API error (has status property)
    if (error && typeof error === "object" && "status" in error && typeof (error as { status: unknown }).status === "number") {
      const mcpError = this.mapGitHubError(error, toolName);
      return MCPResponseFormatter.error(
        mcpError.code as MCPErrorCode,
        mcpError.message,
        mcpError.data as Record<string, unknown> | undefined
      );
    }

    // Handle MCP SDK errors
    if (error instanceof McpError) {
      return MCPResponseFormatter.error(
        this.mapErrorCode(error.code),
        error.message,
        // Safely handle potentially unknown error.data
        error.data && typeof error.data === 'object' ? error.data as Record<string, unknown> : undefined
      );
    }

    // Handle regular errors
    if (error instanceof Error) {
      return MCPResponseFormatter.error(
        MCPErrorCode.INTERNAL_ERROR,
        `Error executing tool ${toolName}: ${error.message}`,
        { stack: error.stack }
      );
    }

    // Handle unknown errors
    return MCPResponseFormatter.error(
      MCPErrorCode.INTERNAL_ERROR,
      `Unknown error executing tool ${toolName}`,
      { error: String(error) }
    );
  }

  /**
   * Map MCP SDK error codes to our custom error codes
   */
  private static mapErrorCode(mcpErrorCode: ErrorCode): MCPErrorCode {
    switch (mcpErrorCode) {
      case ErrorCode.InvalidParams:
        return MCPErrorCode.VALIDATION_ERROR;
      case ErrorCode.MethodNotFound:
        return MCPErrorCode.RESOURCE_NOT_FOUND;
      case ErrorCode.InternalError:
        return MCPErrorCode.INTERNAL_ERROR;
      // Replace non-existent enum values with valid ones
      case ErrorCode.InvalidRequest: // Instead of Unauthorized
        return MCPErrorCode.UNAUTHORIZED;
      case ErrorCode.ParseError: // Instead of RateLimited
        return MCPErrorCode.RATE_LIMITED;
      default:
        return MCPErrorCode.INTERNAL_ERROR;
    }
  }
}
