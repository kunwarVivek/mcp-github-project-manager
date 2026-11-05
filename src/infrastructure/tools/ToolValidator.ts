import type { z } from "zod";
import {
  createErrorResponse,
  MCPErrorCode,
  type MCPErrorData,
  type MCPErrorResponse,
} from "../../domain/mcp-types";
import { getGhCliUser } from "../../env";
import { type GhCredentialContext, ghScopeErrorHint } from "../github/auth/gh/ghErrorHint";
import { resolveGitHubAuth } from "../github/auth/resolveGitHubAuth";
import { getCorrelationId } from "../observability/CorrelationContext";
import { coerceParameters } from "./ParameterCoercion";

export type ToolSchema<T> = z.ZodType<T>;

/** The credential currently in force, resolved only when an error needs it. */
function currentCredential(): GhCredentialContext {
  try {
    return { source: resolveGitHubAuth().source, pinnedUser: getGhCliUser() };
  } catch {
    return { source: undefined };
  }
}

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
  /** Executor function for this tool */
  execute?: (args: TInput) => Promise<unknown>;
  examples?: Array<{
    name: string;
    description: string;
    args: TInput;
  }>;
}

/** One failed argument: dotted path, human message and zod issue code. */
export interface ToolArgumentIssue {
  path: string;
  message: string;
  code: string;
}

/**
 * Raised by {@link ToolValidator.validate} when arguments do not satisfy a
 * tool's schema. Carries the per-field issues so the caller can fix the call.
 */
export class ToolArgumentError extends Error {
  constructor(
    readonly toolName: string,
    readonly issues: ToolArgumentIssue[]
  ) {
    super(
      `Invalid parameters for tool ${toolName}: ${issues
        .map((i) => (i.path ? `${i.path}: ${i.message}` : i.message))
        .join("; ")}`
    );
    this.name = "ToolArgumentError";
  }
}

/** An error classified for the MCP client: a stable code, a message and context. */
export interface MappedToolError {
  code: MCPErrorCode;
  message: string;
  data: MCPErrorData;
}

/** Shape of an Octokit `RequestError` / `GitHubApiError`: a numeric HTTP status. */
interface StatusError {
  status: number;
  message?: string;
  details?: Record<string, unknown>;
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

function hasStatus(error: unknown): error is StatusError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  );
}

function headerInt(headers: Record<string, string> | undefined, name: string): number {
  return Number.parseInt(headers?.[name] ?? "0", 10) || 0;
}

export const ToolValidator = {
  /**
   * Validate tool arguments against the schema. Failures throw a
   * {@link ToolArgumentError} listing every invalid field.
   */
  validate<T>(toolName: string, args: unknown, schema: ToolSchema<T>): T {
    let coerced: unknown;
    try {
      coerced = coerceParameters(args as Record<string, unknown>, schema);
    } catch (error) {
      throw new ToolArgumentError(toolName, [
        {
          path: "",
          message: error instanceof Error ? error.message : String(error),
          code: "invalid",
        },
      ]);
    }
    const parsed = schema.safeParse(coerced);
    if (parsed.success) {
      return parsed.data;
    }
    throw new ToolArgumentError(
      toolName,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }))
    );
  },

  /**
   * Classify an execution failure for the client: argument errors, GitHub API
   * failures (Octokit `RequestError`, `GitHubApiError`, `RateLimitError`) and
   * plain errors each get a stable code and an actionable message.
   */
  mapGitHubError(
    error: unknown,
    toolName: string,
    credential: () => GhCredentialContext = currentCredential
  ): MappedToolError {
    const mapped = ToolValidator.classifyError(error, toolName);
    // A missing OAuth scope on a GitHub CLI credential is fixable with one gh
    // command; no other credential source gets the hint.
    const hint = ghScopeErrorHint(error, credential);
    return hint ? { ...mapped, message: `${mapped.message} ${hint}` } : mapped;
  },

  classifyError(error: unknown, toolName: string): MappedToolError {
    const data: MCPErrorData = { tool: toolName };

    if (error instanceof ToolArgumentError) {
      data.validation = error.issues;
      return { code: MCPErrorCode.VALIDATION_ERROR, message: error.message, data };
    }

    if (hasStatus(error)) {
      const status = error.status;
      const message = error.message || error.response?.data?.message || "GitHub API error";
      const lower = message.toLowerCase();
      const headers = error.response?.headers;

      data.github = {
        status,
        message,
        documentation_url: error.response?.data?.documentation_url,
      };

      const retryAfter = headerInt(headers, "retry-after") || undefined;
      const primaryLimit =
        status === 429 || (status === 403 && lower.includes("rate limit")) || undefined;
      if (primaryLimit) {
        if (headers) {
          data.rateLimit = {
            limit: headerInt(headers, "x-ratelimit-limit"),
            remaining: headerInt(headers, "x-ratelimit-remaining"),
            reset: headerInt(headers, "x-ratelimit-reset"),
            retryAfter,
          };
        }
        const wait = retryAfter ? ` Retry after ${retryAfter}s.` : "";
        return {
          code: MCPErrorCode.GITHUB_RATE_LIMITED,
          message: `GitHub API rate limit exceeded for ${toolName}.${wait} Reduce request volume or wait for the limit to reset.`,
          data,
        };
      }

      if (status === 403 && (lower.includes("abuse") || lower.includes("secondary"))) {
        if (retryAfter) {
          data.rateLimit = { limit: 0, remaining: 0, reset: 0, retryAfter };
        }
        const wait = retryAfter
          ? ` Retry after ${retryAfter}s.`
          : " Wait a minute before retrying.";
        return {
          code: MCPErrorCode.GITHUB_RATE_LIMITED,
          message: `GitHub secondary rate limit hit for ${toolName}: ${message}.${wait}`,
          data,
        };
      }

      if (status === 422) {
        const errors = error.response?.data?.errors;
        if (errors) {
          data.validation = errors.map((e) => ({
            path: e.field || e.resource || "unknown",
            message: e.message || e.code || "Validation error",
            code: e.code || "validation_failed",
          }));
        }
      }

      switch (status) {
        case 401:
          return {
            code: MCPErrorCode.GITHUB_UNAUTHORIZED,
            message: `GitHub rejected the credentials: ${message}. Check GITHUB_TOKEN or the GitHub App configuration.`,
            data,
          };
        case 403:
          return {
            code: MCPErrorCode.GITHUB_FORBIDDEN,
            message: `GitHub denied access: ${message}. The token or App installation lacks the permission this operation needs.`,
            data,
          };
        case 404:
          return {
            code: MCPErrorCode.GITHUB_NOT_FOUND,
            message: `GitHub resource not found: ${message}. Verify the owner, repository and identifiers, and that the credentials can see the resource.`,
            data,
          };
        case 422:
          return {
            code: MCPErrorCode.GITHUB_VALIDATION_ERROR,
            message: `GitHub rejected the request as invalid: ${message}`,
            data,
          };
        default:
          return status >= 500
            ? {
                code: MCPErrorCode.GITHUB_SERVER_ERROR,
                message: `GitHub server error (${status}): ${message}. This is usually transient; retry shortly.`,
                data,
              }
            : {
                code: MCPErrorCode.TOOL_EXECUTION_FAILED,
                message: `GitHub API error (${status}): ${message}`,
                data,
              };
      }
    }

    if (error instanceof Error) {
      return { code: MCPErrorCode.TOOL_EXECUTION_FAILED, message: error.message, data };
    }

    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: `Unknown error in ${toolName}`,
      data: { ...data, error: String(error) },
    };
  },

  /** Build the structured error response for a failed tool call. */
  handleToolError(error: unknown, toolName: string): MCPErrorResponse {
    const mapped = ToolValidator.mapGitHubError(error, toolName);
    return createErrorResponse(
      `req-${Date.now()}`,
      mapped.code,
      mapped.message,
      getCorrelationId(),
      undefined,
      "1.0",
      mapped.data
    );
  },
};
