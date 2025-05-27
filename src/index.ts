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
import { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, CLI_OPTIONS } from "./env.js";
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
      // Roadmap and planning tools
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
      
      // Project tools
      case "create_project":
        return await this.service.createProject(args);
        
      case "list_projects":
        return await this.service.listProjects(args.status, args.limit);
        
      case "get_project":
        return await this.service.getProject(args.projectId);
        
      case "update_project":
        return await this.service.updateProject(args);
        
      case "delete_project":
        return await this.service.deleteProject(args);
        
      case "list_project_fields":
        return await this.service.listProjectFields(args);
        
      case "update_project_field":
        return await this.service.updateProjectField(args);
      
      // Milestone tools
      case "create_milestone":
        return await this.service.createMilestone(args);
        
      case "list_milestones":
        return await this.service.listMilestones(args.status, args.sort, args.direction);
        
      case "update_milestone":
        return await this.service.updateMilestone(args);
        
      case "delete_milestone":
        return await this.service.deleteMilestone(args);
      
      // Issue tools
      case "create_issue":
        return await this.service.createIssue(args);
        
      case "list_issues":
        return await this.service.listIssues(args);
        
      case "get_issue":
        return await this.service.getIssue(args.issueId);
        
      case "update_issue":
        return await this.service.updateIssue(args.issueId, {
          title: args.title,
          description: args.description,
          status: args.status,
          milestoneId: args.milestoneId,
          assignees: args.assignees,
          labels: args.labels
        });
        
      // Sprint tools
      case "create_sprint":
        return await this.service.createSprint(args);
        
      case "list_sprints":
        return await this.service.listSprints(args.status);
        
      case "get_current_sprint":
        return await this.service.getCurrentSprint(args.includeIssues);
        
      case "update_sprint":
        return await this.service.updateSprint(args);
        
      case "add_issues_to_sprint":
        return await this.service.addIssuesToSprint(args);
        
      case "remove_issues_from_sprint":
        return await this.service.removeIssuesFromSprint(args);
        
      // Label tools
      case "create_label":
        return await this.service.createLabel(args);
        
      case "list_labels":
        return await this.service.listLabels(args);
        
      // Project field tools
        
      // Project view tools
      case "create_project_view":
        return await this.service.createProjectView(args);
        
      case "list_project_views":
        return await this.service.listProjectViews(args);
        
      case "update_project_view":
        return await this.service.updateProjectView(args);
        
      // Project item tools
      case "add_project_item":
        return await this.service.addProjectItem(args);
        
      case "remove_project_item":
        return await this.service.removeProjectItem(args);
        
      case "list_project_items":
        return await this.service.listProjectItems(args);
        
      case "set_field_value":
        return await this.service.setFieldValue(args);
        
      case "get_field_value":
        return await this.service.getFieldValue(args);

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

    // Display configuration information if verbose mode is enabled
    if (CLI_OPTIONS.verbose) {
      console.error("GitHub Project Manager MCP server configuration:");
      console.error(`- Owner: ${GITHUB_OWNER}`);
      console.error(`- Repository: ${GITHUB_REPO}`);
      console.error(`- Token: ${GITHUB_TOKEN.substring(0, 4)}...${GITHUB_TOKEN.substring(GITHUB_TOKEN.length - 4)}`);
      console.error(`- Environment file: ${CLI_OPTIONS.envFile || '.env (default)'}`);
    }

    console.error("GitHub Project Manager MCP server running on stdio");
  }
}

try {
  const server = new GitHubProjectManagerServer();
  server.run().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
} catch (error) {
  if (error instanceof Error) {
    console.error("Error initializing server:", error.message);

    // Provide helpful instructions for common errors
    if (error.message.includes("GITHUB_TOKEN")) {
      console.error("\nPlease provide a GitHub token using one of these methods:");
      console.error("  - Set the GITHUB_TOKEN environment variable");
      console.error("  - Use the --token command line argument");
      console.error("\nExample: mcp-github-project-manager --token=your_token");
    } else if (error.message.includes("GITHUB_OWNER") || error.message.includes("GITHUB_REPO")) {
      console.error("\nPlease provide the required GitHub repository information:");
      console.error("  - Set the GITHUB_OWNER and GITHUB_REPO environment variables");
      console.error("  - Use the --owner and --repo command line arguments");
      console.error("\nExample: mcp-github-project-manager --owner=your_username --repo=your_repo");
    }

    console.error("\nFor more information, run: mcp-github-project-manager --help");
  } else {
    console.error("Unknown error:", error);
  }
  process.exit(1);
}
