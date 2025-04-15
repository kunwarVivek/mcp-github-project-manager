#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ProjectManagementService } from "./services/ProjectManagementService.js";
import { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } from "./env.js";
import { ToolRegistry } from "./infrastructure/tools/ToolRegistry.js";
import { ToolValidator } from "./infrastructure/tools/ToolValidator.js";
import { ToolResultFormatter } from "./infrastructure/tools/ToolResultFormatter.js";
import { MCPContentType } from "./domain/mcp-types.js";

class GitHubProjectManagerServer {
  private server: Server;
  private service: ProjectManagementService;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: "github-project-manager",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.service = new ProjectManagementService(
      GITHUB_OWNER,
      GITHUB_REPO,
      GITHUB_TOKEN
    );
    
    // Get the tool registry instance
    this.toolRegistry = ToolRegistry.getInstance();

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // Handle list_tools request by returning registered tools from the registry
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolRegistry.getToolsForMCP(),
    }));

    // Handle call_tool requests with validation and proper response formatting
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name: toolName, arguments: args } = request.params;
        const tool = this.toolRegistry.getTool(toolName);
        
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${toolName}`
          );
        }
        
        // Validate tool arguments against the schema
        const validatedArgs = ToolValidator.validate(toolName, args, tool.schema);
        
        // Execute the tool based on its name
        const result = await this.executeToolHandler(toolName, validatedArgs);
        
        // Format the result as an MCP response
        const mcpResponse = ToolResultFormatter.formatSuccess(toolName, result, {
          contentType: MCPContentType.JSON,
        });
        
        // Convert our custom MCPResponse to the format expected by the SDK
        // Only success responses have the output property
        if (mcpResponse.status === "success") {
          return {
            tools: this.toolRegistry.getToolsForMCP(),
            output: mcpResponse.output.content,
            _meta: mcpResponse.output.context
          };
        } else {
          // Handle error case (though this shouldn't happen in the success formatter)
          throw new McpError(
            ErrorCode.InternalError,
            "Unexpected response format from tool execution"
          );
        }
        
      } catch (error) {
        if (error instanceof McpError) {
          throw error; // Re-throw MCP errors directly
        }
        
        // Log and convert other errors to MCP errors
        console.error("Tool execution error:", error);
        const message =
          error instanceof Error ? error.message : "An unknown error occurred";
        throw new McpError(ErrorCode.InternalError, message);
      }
    });
  }

  /**
   * Execute the appropriate tool handler based on the tool name
   */
  private async executeToolHandler(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "create_roadmap":
        return await this.service.createRoadmap(args);
        
      case "plan_sprint":
        return await this.service.planSprint(args);
        
      case "get_milestone_metrics":
        return await this.service.getMilestoneMetrics(args.milestoneId, args.includeIssues);
        
      case "get_sprint_metrics":
        return await this.service.getSprintMetrics(args.sprintId, args.includeIssues);
        
      case "get_overdue_milestones":
        return await this.service.getOverdueMilestones(args.limit, args.includeIssues);
        
      case "get_upcoming_milestones":
        return await this.service.getUpcomingMilestones(args.daysAhead, args.limit, args.includeIssues);
        
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool handler not implemented: ${toolName}`
        );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GitHub Project Manager MCP server running on stdio");
  }
}

const server = new GitHubProjectManagerServer();
server.run().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
