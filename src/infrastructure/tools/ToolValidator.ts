import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { MCPResponseFormatter } from "../mcp/MCPResponseFormatter.js";
import { MCPErrorCode } from "../../domain/mcp-types.js";
import { ParameterCoercion } from "./ParameterCoercion.js";

export type ToolSchema<T> = z.ZodType<T>;

export interface ToolDefinition<T> {
  name: string;
  description: string;
  schema: ToolSchema<T>;
  examples?: Array<{
    name: string;
    description: string;
    args: T;
  }>;
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
   * Transform MCP SDK errors to our custom error format
   */
  static handleToolError(error: unknown, toolName: string): ReturnType<typeof MCPResponseFormatter.error> {
    // Use stderr to avoid interfering with MCP protocol on stdout
    process.stderr.write(`[${toolName}] Error: ${error}\n`);
    
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
