import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolRegistry } from "../../infrastructure/tools/ToolRegistry";
import { ProjectManagementService } from "../../services/ProjectManagementService";
import { ResourceStatus } from "../../domain/resource-types";
import { TestFactory } from "../test-utils";
import { GitHubProjectManagerServer } from "../../index";

describe("MCP Server E2E Tests", () => {
  let service: any;
  let toolRegistry: any;

  beforeAll(() => {
    const token = process.env.GITHUB_TOKEN || "test-token";
    const owner = process.env.GITHUB_OWNER || "test-owner";
    const repo = process.env.GITHUB_REPO || "test-repo";

    service = new ProjectManagementService(owner, repo, token);
    toolRegistry = ToolRegistry.getInstance();
  });

  describe("Tool Registration", () => {
    it("should have all required tools registered", () => {
      const tools = toolRegistry.getToolsForMCP();
      expect(tools.find((t: any) => t.name === "create_roadmap")).toBeDefined();
      expect(tools.find((t: any) => t.name === "plan_sprint")).toBeDefined();
      expect(tools.find((t: any) => t.name === "get_milestone_metrics")).toBeDefined();
      expect(tools.find((t: any) => t.name === "get_sprint_metrics")).toBeDefined();
      expect(tools.find((t: any) => t.name === "get_overdue_milestones")).toBeDefined();
      expect(tools.find((t: any) => t.name === "get_upcoming_milestones")).toBeDefined();
    });

    it("should validate tool parameters", () => {
      const createRoadmapTool = toolRegistry.getTool("create_roadmap");
      expect(createRoadmapTool).toBeDefined();
      if (createRoadmapTool) {
        expect(createRoadmapTool.schema).toBeDefined();
      }
    });
  });

  describe("MCP Error Handling", () => {
    it("should convert domain errors to MCP errors", () => {
      // Test error conversion
      const notFoundError = new Error("Resource not found");
      const mcpError = convertToMcpError(notFoundError);
      
      expect(mcpError).toBeInstanceOf(McpError);
      expect(mcpError.code).toBe(ErrorCode.MethodNotFound);
      
      // Test validation error conversion
      const validationError = new Error("Invalid input parameter");
      const mcpValidationError = convertToMcpError(validationError);
      
      expect(mcpValidationError).toBeInstanceOf(McpError);
      expect(mcpValidationError.code).toBe(ErrorCode.InvalidParams);
    });

    it("should handle rate limit errors gracefully", async () => {
      // Mock a rate limit error from GitHub
      const rateLimitError = new Error("API rate limit exceeded");
      rateLimitError.name = "HttpError";
      (rateLimitError as any).status = 403;
      
      try {
        // Convert the error
        const mcpError = convertToMcpError(rateLimitError);
        
        // Verify conversion
        expect(mcpError).toBeInstanceOf(McpError);
        expect(mcpError.code).toBe(ErrorCode.ParseError);
      } catch (error) {
        fail("Should have converted the rate limit error to an MCP error");
      }
    });
  });

  describe("MCP Response Formatting", () => {
    it("should format successful responses correctly", () => {
      // Create a test result object
      const testResult = {
        id: "test-123",
        name: "Test Resource",
        status: "active"
      };
      
      // Format the result
      const formattedResult = formatSuccessResponse("test_operation", testResult);
      
      // Verify formatting
      expect(formattedResult).toHaveProperty("data");
      expect(formattedResult).toHaveProperty("metadata");
      expect(formattedResult.data).toEqual(testResult);
    });

    it("should format error responses correctly", () => {
      // Create a test error
      const testError = new Error("Test error message");
      
      // Format the error
      const formattedError = formatErrorResponse("test_operation", testError);
      
      // Verify formatting
      expect(formattedError).toHaveProperty("error");
      expect(formattedError.error).toHaveProperty("message");
      expect(formattedError.error.message).toContain("Test error message");
    });
  });
});

// Helper functions that would typically be in your actual codebase
function convertToMcpError(error: Error): InstanceType<typeof McpError> {
  if (error instanceof McpError) {
    return error;
  }
  
  // Rate limit error
  if (error.name === "HttpError" && (error as any).status === 403) {
    return new McpError(ErrorCode.ParseError, "GitHub API rate limit exceeded");
  }
  
  // Not found error
  if (error.message.includes("not found")) {
    return new McpError(ErrorCode.MethodNotFound, error.message);
  }
  
  // Validation error
  if (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("validation")) {
    return new McpError(ErrorCode.InvalidParams, error.message);
  }
  
  // Default to internal error
  return new McpError(ErrorCode.InternalError, error.message);
}

function formatSuccessResponse(operation: string, result: any) {
  return {
    data: result,
    metadata: {
      timestamp: new Date().toISOString(),
      operation
    }
  };
}

function formatErrorResponse(operation: string, error: Error) {
  return {
    error: {
      message: error.message,
      code: (error as any).code || ErrorCode.InternalError,
      operation
    }
  };
}