import {
  RateLimitError,
  ResourceNotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors";
import { type MCPError, MCPErrorCode, type MCPErrorResponse } from "../../domain/mcp-types";

/**
 * Create standardized MCP error object
 */
function createMCPError(error: unknown): MCPError {
  if (error instanceof Error) {
    const code = determineErrorCode(error);
    return {
      code,
      message: error.message,
      details: {
        name: error.name,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    };
  } else if (error instanceof Object) {
    return {
      code: MCPErrorCode.INTERNAL_ERROR,
      message: JSON.stringify(error),
      details: { originalError: error },
    };
  }

  return {
    code: MCPErrorCode.INTERNAL_ERROR,
    message: "An unexpected error occurred",
    details: { originalError: error },
  };
}

/**
 * Map error types to MCP error codes
 */
function determineErrorCode(error: Error): MCPErrorCode {
  if (error instanceof ValidationError) {
    return MCPErrorCode.VALIDATION_ERROR;
  }
  if (error instanceof ResourceNotFoundError) {
    return MCPErrorCode.RESOURCE_NOT_FOUND;
  }
  if (error instanceof UnauthorizedError) {
    return MCPErrorCode.UNAUTHORIZED;
  }
  if (error instanceof RateLimitError) {
    return MCPErrorCode.RATE_LIMITED;
  }
  return MCPErrorCode.INTERNAL_ERROR;
}

export const MCPErrorHandler = {
  /**
   * Convert any error to a standardized MCP error response
   */
  handle(error: unknown, requestId?: string): MCPErrorResponse {
    const mcpError = createMCPError(error);

    // Create proper MCPErrorResponse object
    return {
      version: "1.0",
      requestId: requestId || `req-${Date.now()}`,
      status: "error",
      error: {
        code: mcpError.code,
        message: mcpError.message,
        details: mcpError.details
          ? [
              {
                code: "details",
                message: JSON.stringify(mcpError.details),
              },
            ]
          : undefined,
      },
    };
  },

  /**
   * Create custom error with specific MCP error code
   */
  createError(code: MCPErrorCode, message: string, details?: Record<string, unknown>): MCPError {
    return {
      code,
      message,
      details,
    };
  },

  /**
   * Helper method to create validation error
   */
  validationError(message: string, details?: Record<string, unknown>): MCPError {
    return MCPErrorHandler.createError(MCPErrorCode.VALIDATION_ERROR, message, details);
  },

  /**
   * Helper method to create not found error
   */
  notFoundError(message: string, details?: Record<string, unknown>): MCPError {
    return MCPErrorHandler.createError(MCPErrorCode.RESOURCE_NOT_FOUND, message, details);
  },

  /**
   * Helper method to create unauthorized error
   */
  unauthorizedError(message: string, details?: Record<string, unknown>): MCPError {
    return MCPErrorHandler.createError(MCPErrorCode.UNAUTHORIZED, message, details);
  },

  /**
   * Helper method to create rate limit error
   */
  rateLimitError(message: string, details?: Record<string, unknown>): MCPError {
    return MCPErrorHandler.createError(MCPErrorCode.RATE_LIMITED, message, details);
  },
};
