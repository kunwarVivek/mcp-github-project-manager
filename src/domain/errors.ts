// Domain error types and error handling utilities
import { MCPErrorCode } from "./mcp-types";
import { ResourceNotFoundError } from "./resource-types";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Re-export ResourceNotFoundError from resource-types.ts
export { ResourceNotFoundError };

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized access") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Error raised for a failed GitHub API call; carries the HTTP status and MCP code. */
export class GitHubApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly mcpErrorCode: MCPErrorCode = MCPErrorCode.INTERNAL_ERROR,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

/** GitHub (or the server) refused the call because a rate limit was hit. */
export class RateLimitError extends GitHubApiError {
  constructor(
    message = "Rate limit exceeded",
    public readonly resetDate?: Date,
    details?: Record<string, unknown>
  ) {
    super(message, 429, "RATE_LIMIT_EXCEEDED", MCPErrorCode.RATE_LIMITED, {
      ...(resetDate && {
        resetAt: resetDate.toISOString(),
        resetAtFormatted: resetDate.toLocaleString(),
      }),
      ...details,
    });
    this.name = "RateLimitError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class IntegrationError extends Error {
  constructor(
    message: string,
    public source?: string
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export class MCPProtocolError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "MCPProtocolError";
  }
}

export function isErrorType<T extends Error>(
  error: unknown,
  errorType: new (...args: never[]) => T
): error is T {
  return error instanceof errorType;
}

export function unwrapError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
