import { MCPError, MCPErrorCode, MCPResponse, MCPContentType, MCPErrorResponse } from "../../domain/mcp-types";
import { MCPResponseFormatter } from "./MCPResponseFormatter";
import { ValidationError, ResourceNotFoundError, UnauthorizedError, RateLimitError } from "../../domain/errors";

export class MCPErrorHandler {
  /**
   * Convert any error to a standardized MCP error response
   */
  static handle(error: unknown, requestId?: string): MCPErrorResponse {
    const mcpError = this.createMCPError(error);
    
    // Create proper MCPErrorResponse object
    return {
      version: "1.0",
      requestId: requestId || `req-${Date.now()}`,
      status: "error",
      error: {
        code: mcpError.code,
        message: mcpError.message,
        details: mcpError.details ? [{ 
          code: "details", 
          message: JSON.stringify(mcpError.details) 
        }] : undefined
      }
    };
  }

  /**
   * Create standardized MCP error object
   */
  private static createMCPError(error: unknown): MCPError {
    if (error instanceof Error) {
      const code = this.determineErrorCode(error);
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
  private static determineErrorCode(error: Error): MCPErrorCode {
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

  /**
   * Map MCP error codes to HTTP status codes
   */
  private static getStatusCode(errorCode: MCPErrorCode): number {
    switch (errorCode) {
      case MCPErrorCode.VALIDATION_ERROR:
        return 400;
      case MCPErrorCode.UNAUTHORIZED:
        return 401;
      case MCPErrorCode.RESOURCE_NOT_FOUND:
        return 404;
      case MCPErrorCode.RATE_LIMITED:
        return 429;
      default:
        return 500;
    }
  }

  /**
   * Create custom error with specific MCP error code
   */
  static createError(
    code: MCPErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): MCPError {
    return {
      code,
      message,
      details,
    };
  }

  /**
   * Helper method to create validation error
   */
  static validationError(message: string, details?: Record<string, unknown>): MCPError {
    return this.createError(MCPErrorCode.VALIDATION_ERROR, message, details);
  }

  /**
   * Helper method to create not found error
   */
  static notFoundError(message: string, details?: Record<string, unknown>): MCPError {
    return this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, message, details);
  }

  /**
   * Helper method to create unauthorized error
   */
  static unauthorizedError(message: string, details?: Record<string, unknown>): MCPError {
    return this.createError(MCPErrorCode.UNAUTHORIZED, message, details);
  }

  /**
   * Helper method to create rate limit error
   */
  static rateLimitError(message: string, details?: Record<string, unknown>): MCPError {
    return this.createError(MCPErrorCode.RATE_LIMITED, message, details);
  }
}