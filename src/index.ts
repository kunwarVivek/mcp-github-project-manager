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

class GitHubProjectManagerServer {
  private server: Server;
  private service: ProjectManagementService;

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

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "create_roadmap",
          description: "Create a project roadmap with milestones and tasks",
          inputSchema: {
            type: "object",
            properties: {
              project: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  visibility: { enum: ["private", "public"] },
                },
                required: ["title", "description"],
              },
              milestones: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    milestone: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        dueDate: { type: "string", format: "date" },
                      },
                      required: ["title", "description"],
                    },
                    issues: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          priority: { enum: ["high", "medium", "low"] },
                          type: {
                            enum: [
                              "bug",
                              "feature",
                              "enhancement",
                              "documentation",
                            ],
                          },
                          assignees: {
                            type: "array",
                            items: { type: "string" },
                          },
                          labels: {
                            type: "array",
                            items: { type: "string" },
                          },
                        },
                        required: ["title", "description", "priority"],
                      },
                    },
                  },
                  required: ["milestone", "issues"],
                },
              },
            },
            required: ["project", "milestones"],
          },
        },
        {
          name: "plan_sprint",
          description: "Plan a new sprint with selected issues",
          inputSchema: {
            type: "object",
            properties: {
              sprint: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  startDate: { type: "string", format: "date-time" },
                  endDate: { type: "string", format: "date-time" },
                  goals: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["title", "startDate", "endDate"],
              },
              issueIds: {
                type: "array",
                items: { type: "number" },
              },
            },
            required: ["sprint", "issueIds"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "create_roadmap":
            return await this.handleCreateRoadmap(request.params.arguments);
          case "plan_sprint":
            return await this.handlePlanSprint(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "An unknown error occurred";
        throw new McpError(ErrorCode.InternalError, message);
      }
    });
  }

  private async handleCreateRoadmap(args: any) {
    const result = await this.service.createRoadmap(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async handlePlanSprint(args: any) {
    const result = await this.service.planSprint(args);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
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
