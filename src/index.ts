#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  CallToolRequest,
  CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ProjectManagementService } from "./services/ProjectManagementService";
import { createProjectManagementService } from "./container";
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
  executeCreateTraceabilityMatrix,
  executeAddSubIssue,
  executeListSubIssues,
  executeGetParentIssue,
  executeReprioritizeSubIssue,
  executeRemoveSubIssue,
  executeCreateStatusUpdate,
  executeListStatusUpdates,
  executeGetStatusUpdate,
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
} from "./infrastructure/tools/ToolSchemas";
import { ToolResultFormatter } from "./infrastructure/tools/ToolResultFormatter";
import { MCPContentType, MCPErrorCode } from "./domain/mcp-types";
import { ResourceCache } from "./infrastructure/cache/ResourceCache";

/**
 * Supported MCP protocol versions.
 * The MCP SDK handles version negotiation, but we track supported versions
 * for error messaging and compatibility checks.
 */
const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05"];
const PREFERRED_PROTOCOL_VERSION = "2024-11-05";
import { FilePersistenceAdapter } from "./infrastructure/persistence/FilePersistenceAdapter";
import { GitHubWebhookHandler } from "./infrastructure/events/GitHubWebhookHandler";
import { EventSubscriptionManager } from "./infrastructure/events/EventSubscriptionManager";
import { EventStore } from "./infrastructure/events/EventStore";
import { WebhookServer } from "./infrastructure/http/WebhookServer";
import { Logger } from "./infrastructure/logger/index";
import { AIServiceFactory } from "./services/ai/AIServiceFactory";
import { RoadmapPlanningService } from "./services/RoadmapPlanningService";
import { IssueEnrichmentService } from "./services/IssueEnrichmentService";
import { IssueTriagingService } from "./services/IssueTriagingService";

class GitHubProjectManagerServer {
  private server: Server;
  private service: ProjectManagementService;
  private toolRegistry: ToolRegistry;
  private logger: Logger;

  // AI-powered automation services
  private aiFactory: AIServiceFactory;
  private roadmapService: RoadmapPlanningService;
  private enrichmentService: IssueEnrichmentService;
  private triagingService: IssueTriagingService;

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

    // Initialize main service via DI container helper
    // This wires up all extracted services (SubIssue, Milestone, Sprint, etc.)
    this.service = createProjectManagementService(
      GITHUB_OWNER,
      GITHUB_REPO,
      GITHUB_TOKEN
    );

    // Initialize AI-powered automation services
    this.aiFactory = AIServiceFactory.getInstance();
    this.roadmapService = new RoadmapPlanningService(this.aiFactory, this.service);
    this.enrichmentService = new IssueEnrichmentService(this.aiFactory, this.service);
    this.triagingService = new IssueTriagingService(
      this.aiFactory,
      this.service,
      this.enrichmentService
    );

    // Get the tool registry instance
    this.toolRegistry = ToolRegistry.getInstance();

    this.setupToolHandlers();
    this.setupEventHandlers();
    this.logAIServiceStatus();
    this.logToolRegistrationStatus();

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

  /**
   * Log tool registration status and verify MCP compliance
   */
  private logToolRegistrationStatus(): void {
    try {
      const tools = this.toolRegistry.getToolsForMCP();
      const toolCount = tools.length;

      // Count tools with various MCP compliance features
      const toolsWithAnnotations = tools.filter(t => t.annotations !== undefined);
      const toolsWithOutputSchema = tools.filter(t => t.outputSchema !== undefined);
      const toolsWithTitle = tools.filter(t => t.title !== undefined);

      this.logger.info(`📦 Tool Registration Status: ${toolCount} tools registered`);

      // Annotation breakdown by behavior type
      const readOnly = toolsWithAnnotations.filter(t => t.annotations?.readOnlyHint === true);
      const destructive = toolsWithAnnotations.filter(t => t.annotations?.destructiveHint === true);
      const idempotent = toolsWithAnnotations.filter(t => t.annotations?.idempotentHint === true);

      this.logger.info(`   Annotations: ${toolsWithAnnotations.length}/${toolCount} (readOnly: ${readOnly.length}, destructive: ${destructive.length}, idempotent: ${idempotent.length})`);
      this.logger.info(`   Output Schemas: ${toolsWithOutputSchema.length}/${toolCount}`);
      this.logger.info(`   Titles: ${toolsWithTitle.length}/${toolCount}`);

      // Warn if any tools are missing compliance features
      if (toolsWithAnnotations.length < toolCount) {
        const missing = tools.filter(t => !t.annotations).map(t => t.name);
        this.logger.warn(`⚠️  Tools missing annotations: ${missing.join(', ')}`);
      }

      if (toolsWithOutputSchema.length < toolCount) {
        const missing = tools.filter(t => !t.outputSchema).map(t => t.name);
        if (missing.length <= 5) {
          this.logger.debug(`Tools without outputSchema: ${missing.join(', ')}`);
        }
      }
    } catch (error) {
      this.logger.error("Failed to check tool registration status:", error);
    }
  }

  private setupToolHandlers() {
    // Handle list_tools request by returning registered tools from the registry
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.toolRegistry.getToolsForMCP(),
    }));

    /**
     * SDK LIMITATION: MCP SDK 1.25+ Type Instantiation Depth Error
     *
     * The MCP SDK's generic types cause TypeScript error TS2589:
     * "Type instantiation is excessively deep and possibly infinite"
     *
     * This occurs because:
     * 1. CallToolRequestSchema has deeply nested ZodObject types
     * 2. Combined with our complex inputSchema definitions (84 tools)
     * 3. TypeScript's type instantiation limit (50 levels) is exceeded
     *
     * Workaround: Use type assertion with explicit request/result types.
     * The handler still receives properly typed CallToolRequest and
     * returns properly typed CallToolResult - only the generic binding
     * is bypassed, not the runtime type safety.
     *
     * Tracked: This is a known SDK limitation, not a codebase type safety gap.
     * The SDK's RequestHandlerExtra type creates exponential type expansion
     * when combined with complex Zod schemas.
     *
     * Review: Check if future SDK versions (>1.25.3) resolve this.
     * @see https://github.com/modelcontextprotocol/typescript-sdk
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.server.setRequestHandler as any)(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<CallToolResult> => {
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
          // SDK 1.25+ expects { content: [...], structuredContent?: {...}, isError?: boolean }
          if (mcpResponse.status === "success") {
            // Prepare structuredContent if result is an object
            // structuredContent provides typed data matching the tool's outputSchema
            const structuredContent = (result !== null && typeof result === 'object')
              ? result as Record<string, unknown>
              : undefined;

            return {
              content: [
                {
                  type: "text" as const,
                  text: mcpResponse.output.content ?? JSON.stringify(result)
                }
              ],
              // Include structuredContent for MCP 2025-11-25 compliance
              // This allows clients to access typed data matching the tool's outputSchema
              structuredContent,
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
      }
    );
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

      case "get_project_readme":
        return await this.service.getProjectReadme(args);

      case "update_project_readme":
        return await this.service.updateProjectReadme(args);

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

      // Issue comment tools
      case "create_issue_comment":
        return await this.service.createIssueComment(args);

      case "update_issue_comment":
        return await this.service.updateIssueComment(args);

      case "delete_issue_comment":
        return await this.service.deleteIssueComment(args);

      case "list_issue_comments":
        return await this.service.listIssueComments(args);

      // Draft issue tools
      case "create_draft_issue":
        return await this.service.createDraftIssue(args);

      case "update_draft_issue":
        return await this.service.updateDraftIssue(args);

      case "delete_draft_issue":
        return await this.service.deleteDraftIssue(args);

      // Pull Request tools
      case "create_pull_request":
        return await this.service.createPullRequest(args);

      case "get_pull_request":
        return await this.service.getPullRequest(args);

      case "list_pull_requests":
        return await this.service.listPullRequests(args);

      case "update_pull_request":
        return await this.service.updatePullRequest(args);

      case "merge_pull_request":
        return await this.service.mergePullRequest(args);

      case "list_pull_request_reviews":
        return await this.service.listPullRequestReviews(args);

      case "create_pull_request_review":
        return await this.service.createPullRequestReview(args);

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

      case "delete_project_view":
        return await this.service.deleteProjectView(args);

      // Project item tools
      case "add_project_item":
        return await this.service.addProjectItem(args);

      case "remove_project_item":
        return await this.service.removeProjectItem(args);

      case "list_project_items":
        return await this.service.listProjectItems(args);

      case "archive_project_item":
        return await this.service.archiveProjectItem(args);

      case "unarchive_project_item":
        return await this.service.unarchiveProjectItem(args);

      case "set_field_value":
        return await this.service.setFieldValue(args);

      case "get_field_value":
        return await this.service.getFieldValue(args);

      case "clear_field_value":
        return await this.service.clearFieldValue(args);

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

      // Automation service tools
      case "create_automation_rule":
        return await this.service.createAutomationRule(args);

      case "update_automation_rule":
        return await this.service.updateAutomationRule(args);

      case "delete_automation_rule":
        return await this.service.deleteAutomationRule(args);

      case "get_automation_rule":
        return await this.service.getAutomationRule(args);

      case "list_automation_rules":
        return await this.service.listAutomationRules(args);

      case "enable_automation_rule":
        return await this.service.enableAutomationRule(args);

      case "disable_automation_rule":
        return await this.service.disableAutomationRule(args);

      // Iteration management tools
      case "get_iteration_configuration":
        return await this.service.getIterationConfiguration(args);

      case "get_current_iteration":
        return await this.service.getCurrentIteration(args);

      case "get_iteration_items":
        return await this.service.getIterationItems(args);

      case "get_iteration_by_date":
        return await this.service.getIterationByDate(args);

      case "assign_items_to_iteration":
        return await this.service.assignItemsToIteration(args);

      // AI-powered automation tools
      case "generate_roadmap":
        return await this.handleGenerateRoadmap(args);

      case "enrich_issue":
        return await this.handleEnrichIssue(args);

      case "enrich_issues_bulk":
        return await this.handleEnrichIssuesBulk(args);

      case "triage_issue":
        return await this.handleTriageIssue(args);

      case "triage_all_issues":
        return await this.handleTriageAllIssues(args);

      case "schedule_triaging":
        return await this.handleScheduleTriaging(args);

      // Sub-issue management tools
      case "add_sub_issue":
        return await executeAddSubIssue(args);

      case "list_sub_issues":
        return await executeListSubIssues(args);

      case "get_parent_issue":
        return await executeGetParentIssue(args);

      case "reprioritize_sub_issue":
        return await executeReprioritizeSubIssue(args);

      case "remove_sub_issue":
        return await executeRemoveSubIssue(args);

      case "create_status_update":
        return await executeCreateStatusUpdate(args);

      case "list_status_updates":
        return await executeListStatusUpdates(args);

      case "get_status_update":
        return await executeGetStatusUpdate(args);

      // Project template tools
      case "mark_project_as_template":
        return await executeMarkProjectAsTemplate(args);

      case "unmark_project_as_template":
        return await executeUnmarkProjectAsTemplate(args);

      case "copy_project_from_template":
        return await executeCopyProjectFromTemplate(args);

      case "list_organization_templates":
        return await executeListOrganizationTemplates(args);

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
   * Handle generate roadmap tool
   */
  private async handleGenerateRoadmap(args: any): Promise<any> {
    try {
      const roadmap = await this.roadmapService.generateRoadmap({
        projectId: args.projectId,
        projectTitle: args.projectTitle,
        projectDescription: args.projectDescription,
        sprintDurationWeeks: args.sprintDurationWeeks,
        targetMilestones: args.targetMilestones
      });

      if (args.autoCreate) {
        const result = await this.roadmapService.createRoadmapInGitHub({
          projectId: args.projectId,
          roadmap
        });

        return {
          success: true,
          roadmap,
          created: result
        };
      }

      return {
        success: true,
        roadmap
      };
    } catch (error) {
      this.logger.error("Failed to generate roadmap:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate roadmap: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle enrich issue tool
   */
  private async handleEnrichIssue(args: any): Promise<any> {
    try {
      const enrichment = await this.enrichmentService.enrichIssue({
        projectId: args.projectId,
        issueId: args.issueId,
        issueTitle: args.issueTitle,
        issueDescription: args.issueDescription,
        projectContext: args.projectContext
      });

      if (args.autoApply) {
        await this.enrichmentService.applyEnrichment({
          projectId: args.projectId,
          issueNumber: args.issueNumber,
          enrichment,
          applyLabels: true
        });
      }

      return {
        success: true,
        enrichment
      };
    } catch (error) {
      this.logger.error("Failed to enrich issue:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to enrich issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle enrich issues bulk tool
   */
  private async handleEnrichIssuesBulk(args: any): Promise<any> {
    try {
      const items = await this.service.listProjectItems({
        projectId: args.projectId,
        limit: 200
      });

      const issueIds = args.issueIds || items.map((item: any) => item.id);

      const enrichments = await this.enrichmentService.enrichIssues({
        projectId: args.projectId,
        issueIds,
        projectContext: args.projectContext
      });

      return {
        success: true,
        enriched: enrichments.length,
        enrichments
      };
    } catch (error) {
      this.logger.error("Failed to bulk enrich issues:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to bulk enrich issues: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle triage issue tool
   */
  private async handleTriageIssue(args: any): Promise<any> {
    try {
      const triage = await this.triagingService.triageIssue({
        projectId: args.projectId,
        issueId: args.issueId,
        issueNumber: args.issueNumber,
        issueTitle: args.issueTitle,
        issueDescription: args.issueDescription,
        projectContext: args.projectContext,
        autoApply: args.autoApply
      });

      return {
        success: true,
        triage
      };
    } catch (error) {
      this.logger.error("Failed to triage issue:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to triage issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle triage all issues tool
   */
  private async handleTriageAllIssues(args: any): Promise<any> {
    try {
      const result = await this.triagingService.triageAllIssues({
        projectId: args.projectId,
        onlyUntriaged: args.onlyUntriaged,
        autoApply: args.autoApply,
        projectContext: args.projectContext
      });

      return {
        success: true,
        triaged: result.triaged,
        results: result.results
      };
    } catch (error) {
      this.logger.error("Failed to triage all issues:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to triage all issues: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle schedule triaging tool
   */
  private async handleScheduleTriaging(args: any): Promise<any> {
    try {
      const result = await this.triagingService.scheduleTriaging({
        projectId: args.projectId,
        schedule: args.schedule,
        autoApply: args.autoApply
      });

      return {
        success: true,
        ruleId: result.ruleId,
        schedule: args.schedule
      };
    } catch (error) {
      this.logger.error("Failed to schedule triaging:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to schedule triaging: ${error instanceof Error ? error.message : 'Unknown error'}`
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

      // Connect MCP server with protocol version handling
      const transport = new StdioServerTransport();
      try {
        await this.server.connect(transport);
        this.logger.info(`MCP server connected (protocol version: ${PREFERRED_PROTOCOL_VERSION})`);
      } catch (connectError) {
        // Check if this is a version mismatch error
        if (connectError instanceof McpError &&
            connectError.message &&
            (connectError.message.includes("version") || connectError.message.includes("protocol"))) {
          throw new McpError(
            MCPErrorCode.PROTOCOL_VERSION_MISMATCH,
            `Protocol version mismatch. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`,
            {
              protocol: {
                supported: SUPPORTED_PROTOCOL_VERSIONS,
                preferred: PREFERRED_PROTOCOL_VERSION,
                requested: "unknown", // Would be extracted from error if available
              }
            }
          );
        }
        throw connectError;
      }

      // Display configuration information if verbose mode is enabled
      if (CLI_OPTIONS.verbose) {
        process.stderr.write("GitHub Project Manager MCP server configuration:\n");
        process.stderr.write(`- Protocol version: ${PREFERRED_PROTOCOL_VERSION}\n`);
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
