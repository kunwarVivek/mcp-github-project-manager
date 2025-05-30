#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ProjectManagementService } from "./services/ProjectManagementService";
import { GitHubStateSyncService } from "./services/GitHubStateSyncService";
import {
  GITHUB_TOKEN,
  GITHUB_OWNER,
  GITHUB_REPO,
  CLI_OPTIONS,
  SYNC_ENABLED,
  SYNC_TIMEOUT_MS,
  CACHE_DIRECTORY,
  WEBHOOK_SECRET,
  WEBHOOK_PORT,
  SSE_ENABLED
} from "./env";
import { ToolRegistry } from "./infrastructure/tools/ToolRegistry";
import { ToolValidator } from "./infrastructure/tools/ToolValidator";
import {
  executeAddFeature,
  executeGeneratePRD,
  executeParsePRD,
  executeGetNextTask,
  executeAnalyzeTaskComplexity,
  executeExpandTask,
  executeEnhancePRD,
  executeCreateTraceabilityMatrix
} from "./infrastructure/tools/ToolSchemas";
import { ToolResultFormatter } from "./infrastructure/tools/ToolResultFormatter";
import { MCPContentType } from "./domain/mcp-types";
import { ResourceCache } from "./infrastructure/cache/ResourceCache";
import { FilePersistenceAdapter } from "./infrastructure/persistence/FilePersistenceAdapter";
import { GitHubWebhookHandler } from "./infrastructure/events/GitHubWebhookHandler";
import { EventSubscriptionManager } from "./infrastructure/events/EventSubscriptionManager";
import { EventStore } from "./infrastructure/events/EventStore";
import { WebhookServer } from "./infrastructure/http/WebhookServer";
import { Logger } from "./infrastructure/logger/index";
import { AIServiceFactory } from "./services/ai/AIServiceFactory";

class GitHubProjectManagerServer {
  private server: Server;
  private service: ProjectManagementService;
  private toolRegistry: ToolRegistry;
  private logger: Logger;

  // Persistence and sync components
  private cache: ResourceCache;
  private persistence: FilePersistenceAdapter;
  private syncService?: GitHubStateSyncService;

  // Event system components
  private webhookHandler: GitHubWebhookHandler;
  private subscriptionManager: EventSubscriptionManager;
  private eventStore: EventStore;
  private webhookServer?: WebhookServer;

  constructor() {
    this.logger = Logger.getInstance();

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

    // Initialize persistence and cache
    this.cache = ResourceCache.getInstance();
    this.persistence = new FilePersistenceAdapter({
      cacheDirectory: CACHE_DIRECTORY,
      enableCompression: true,
      maxBackups: 5,
      atomicWrites: true
    });

    // Initialize event system
    this.webhookHandler = new GitHubWebhookHandler(WEBHOOK_SECRET);
    this.subscriptionManager = new EventSubscriptionManager();
    this.eventStore = new EventStore({
      storageDirectory: `${CACHE_DIRECTORY}/events`,
      enableCompression: true
    });

    // Initialize main service
    this.service = new ProjectManagementService(
      GITHUB_OWNER,
      GITHUB_REPO,
      GITHUB_TOKEN
    );

    // Get the tool registry instance
    this.toolRegistry = ToolRegistry.getInstance();

    this.setupToolHandlers();
    this.setupEventHandlers();
    this.logAIServiceStatus();

    this.server.onerror = (error) => this.logger.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.shutdown();
    });
  }

  /**
   * Log AI service status during startup
   */
  private logAIServiceStatus(): void {
    try {
      const aiFactory = AIServiceFactory.getInstance();
      const validation = aiFactory.validateConfiguration();

      this.logger.info("🤖 AI Service Status Check");

      if (validation.hasAnyProvider) {
        this.logger.info(`✅ AI Services Available: ${validation.available.join(', ')}`);
        this.logger.info(`📊 Available Models: ${validation.availableModels.join(', ')}`);

        if (validation.unavailableModels.length > 0) {
          this.logger.warn(`⚠️  Unavailable Models: ${validation.unavailableModels.join(', ')}`);
        }

        if (validation.missing.length > 0) {
          this.logger.warn(`🔑 Missing API Keys: ${validation.missing.join(', ')}`);
        }

        this.logger.info("🎯 AI-powered tools are ready: generate_prd, enhance_prd, parse_prd, add_feature, get_next_task, analyze_task_complexity, expand_task, create_traceability_matrix");
      } else {
        this.logger.warn("⚠️  No AI providers configured - AI features will be unavailable");
        this.logger.warn("🔑 Missing API Keys: " + validation.missing.join(', '));
        this.logger.info("💡 To enable AI features, set at least one of these environment variables:");
        this.logger.info("   - ANTHROPIC_API_KEY (recommended)");
        this.logger.info("   - OPENAI_API_KEY");
        this.logger.info("   - GOOGLE_API_KEY");
        this.logger.info("   - PERPLEXITY_API_KEY");
        this.logger.info("🚀 Non-AI GitHub project management features remain fully functional");
      }
    } catch (error) {
      this.logger.error("Failed to check AI service status:", error);
      this.logger.warn("⚠️  AI service status unknown - continuing with startup");
    }
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
        this.logger.error("Tool execution error:", error);
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

      // Event management tools
      case "subscribe_to_events":
        return await this.handleSubscribeToEvents(args);

      case "get_recent_events":
        return await this.handleGetRecentEvents(args);

      case "replay_events":
        return await this.handleReplayEvents(args);

      // AI Task Management tools
      case "add_feature":
        return await executeAddFeature(args);

      case "generate_prd":
        return await executeGeneratePRD(args);

      case "parse_prd":
        return await executeParsePRD(args);

      case "get_next_task":
        return await executeGetNextTask(args);

      case "analyze_task_complexity":
        return await executeAnalyzeTaskComplexity(args);

      case "expand_task":
        return await executeExpandTask(args);

      case "enhance_prd":
        return await executeEnhancePRD(args);

      case "create_traceability_matrix":
        return await executeCreateTraceabilityMatrix(args);

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool handler not implemented: ${toolName}`
        );
    }
  }

  /**
   * Handle subscribe to events tool
   */
  private async handleSubscribeToEvents(args: any): Promise<any> {
    try {
      const subscriptionId = this.subscriptionManager.subscribe({
        clientId: args.clientId,
        filters: args.filters || [],
        transport: args.transport || 'internal',
        endpoint: args.endpoint,
        expiresAt: args.expiresAt
      });

      return {
        success: true,
        subscriptionId,
        message: `Subscription created successfully for client ${args.clientId}`
      };
    } catch (error) {
      this.logger.error("Failed to create event subscription:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle get recent events tool
   */
  private async handleGetRecentEvents(args: any): Promise<any> {
    try {
      const query: any = {};

      if (args.resourceType) query.resourceType = args.resourceType;
      if (args.resourceId) query.resourceId = args.resourceId;
      if (args.eventType) query.eventType = args.eventType;
      if (args.limit) query.limit = args.limit;

      const events = await this.eventStore.getEvents(query);

      return {
        success: true,
        events,
        count: events.length
      };
    } catch (error) {
      this.logger.error("Failed to get recent events:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get recent events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle replay events tool
   */
  private async handleReplayEvents(args: any): Promise<any> {
    try {
      const query: any = {
        fromTimestamp: args.fromTimestamp,
        limit: args.limit || 1000
      };

      if (args.toTimestamp) query.toTimestamp = args.toTimestamp;
      if (args.resourceType) query.resourceType = args.resourceType;
      if (args.resourceId) query.resourceId = args.resourceId;

      const events = await this.eventStore.getEvents(query);

      return {
        success: true,
        events,
        count: events.length,
        fromTimestamp: args.fromTimestamp,
        toTimestamp: args.toTimestamp
      };
    } catch (error) {
      this.logger.error("Failed to replay events:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to replay events: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Setup event handlers for the event system
   */
  private setupEventHandlers(): void {
    // Handle events from subscription manager
    this.subscriptionManager.on('internalEvent', ({ subscriptions, event }) => {
      this.logger.debug(`Internal event notification: ${event.type} ${event.resourceType} ${event.resourceId}`);
      // Handle internal events (e.g., cache invalidation)
      this.handleInternalEvent(event);
    });

    // Store events when they're processed
    this.subscriptionManager.on('sseEvent', async ({ subscriptions, event }) => {
      try {
        await this.eventStore.storeEvent(event);
      } catch (error) {
        this.logger.error("Failed to store SSE event:", error);
      }
    });
  }

  /**
   * Handle internal events (e.g., cache invalidation)
   */
  private handleInternalEvent(event: any): void {
    // Invalidate cache for the affected resource
    if (event.resourceType && event.resourceId) {
      this.cache.invalidate(event.resourceType, event.resourceId);
      this.logger.debug(`Invalidated cache for ${event.resourceType}:${event.resourceId}`);
    }
  }

  /**
   * Initialize sync service and perform initial sync
   */
  private async initializeSync(): Promise<void> {
    if (!SYNC_ENABLED) {
      this.logger.info("Sync is disabled, skipping initialization");
      return;
    }

    try {
      // Initialize sync service
      const factory = this.service.getRepositoryFactory();
      this.syncService = new GitHubStateSyncService(factory, this.cache, this.persistence);

      // Perform initial sync with timeout
      this.logger.info("Starting initial GitHub state sync...");
      const syncResult = await this.syncService.performInitialSync(SYNC_TIMEOUT_MS);

      if (syncResult.success) {
        this.logger.info(`Initial sync completed successfully: ${syncResult.syncedResources} resources synced, ${syncResult.skippedResources} skipped in ${syncResult.duration}ms`);
      } else {
        this.logger.warn(`Initial sync completed with errors: ${syncResult.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error("Failed to initialize sync service:", error);
      this.logger.warn("Continuing without sync - cache will be populated on demand");
    }
  }

  /**
   * Initialize webhook server
   */
  private async initializeWebhookServer(): Promise<void> {
    if (!SSE_ENABLED && !WEBHOOK_SECRET) {
      this.logger.info("Event system disabled (no SSE and no webhook secret), skipping webhook server");
      return;
    }

    try {
      this.webhookServer = new WebhookServer(
        this.webhookHandler,
        this.subscriptionManager,
        this.eventStore,
        {
          port: WEBHOOK_PORT,
          enableSSE: SSE_ENABLED
        }
      );

      await this.webhookServer.start();
      this.logger.info(`Webhook server started on port ${WEBHOOK_PORT}`);
    } catch (error) {
      this.logger.error("Failed to start webhook server:", error);
      this.logger.warn("Continuing without webhook server - real-time events will not be available");
    }
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    this.logger.info("Shutting down GitHub Project Manager server...");

    try {
      // Stop webhook server
      if (this.webhookServer) {
        await this.webhookServer.stop();
        this.logger.info("Webhook server stopped");
      }

      // Cleanup event store
      await this.eventStore.cleanup();
      this.logger.info("Event store cleaned up");

      // Cleanup persistence
      await this.persistence.cleanup();
      this.logger.info("Persistence cleaned up");

      // Close MCP server
      await this.server.close();
      this.logger.info("MCP server closed");

    } catch (error) {
      this.logger.error("Error during shutdown:", error);
    } finally {
      process.exit(0);
    }
  }

  async run() {
    try {
      // Initialize sync service first
      await this.initializeSync();

      // Initialize webhook server
      await this.initializeWebhookServer();

      // Connect MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Display configuration information if verbose mode is enabled
      if (CLI_OPTIONS.verbose) {
        process.stderr.write("GitHub Project Manager MCP server configuration:\n");
        process.stderr.write(`- Owner: ${GITHUB_OWNER}\n`);
        process.stderr.write(`- Repository: ${GITHUB_REPO}\n`);
        process.stderr.write(`- Token: ${GITHUB_TOKEN.substring(0, 4)}...${GITHUB_TOKEN.substring(GITHUB_TOKEN.length - 4)}\n`);
        process.stderr.write(`- Environment file: ${CLI_OPTIONS.envFile || '.env (default)'}\n`);
        process.stderr.write(`- Sync enabled: ${SYNC_ENABLED}\n`);
        process.stderr.write(`- Cache directory: ${CACHE_DIRECTORY}\n`);
        process.stderr.write(`- Webhook port: ${WEBHOOK_PORT}\n`);
        process.stderr.write(`- SSE enabled: ${SSE_ENABLED}\n`);
      }

      process.stderr.write("GitHub Project Manager MCP server running on stdio\n");
    } catch (error) {
      this.logger.error("Failed to start server:", error);
      throw error;
    }
  }
}

// Export the server class for testing
export { GitHubProjectManagerServer };

try {
  const server = new GitHubProjectManagerServer();
  server.run().catch((error) => {
    process.stderr.write(`Failed to start server: ${error}\n`);
    process.exit(1);
  });
} catch (error) {
  if (error instanceof Error) {
    process.stderr.write(`Error initializing server: ${error.message}\n`);

    // Provide helpful instructions for common errors
    if (error.message.includes("GITHUB_TOKEN")) {
      process.stderr.write("\nPlease provide a GitHub token using one of these methods:\n");
      process.stderr.write("  - Set the GITHUB_TOKEN environment variable\n");
      process.stderr.write("  - Use the --token command line argument\n");
      process.stderr.write("\nExample: mcp-github-project-manager --token=your_token\n");
    } else if (error.message.includes("GITHUB_OWNER") || error.message.includes("GITHUB_REPO")) {
      process.stderr.write("\nPlease provide the required GitHub repository information:\n");
      process.stderr.write("  - Set the GITHUB_OWNER and GITHUB_REPO environment variables\n");
      process.stderr.write("  - Use the --owner and --repo command line arguments\n");
      process.stderr.write("\nExample: mcp-github-project-manager --owner=your_username --repo=your_repo\n");
    }

    process.stderr.write("\nFor more information, run: mcp-github-project-manager --help\n");
  } else {
    process.stderr.write(`Unknown error: ${error}\n`);
  }
  process.exit(1);
}
