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
import { configureContainer } from "./container";
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
  SSE_ENABLED,
  AGENT_RECLAIM_ENABLED,
  AGENT_RECLAIM_INTERVAL_MS,
  AGENT_STALE_AFTER_MINUTES
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
  executeLinkProjectToRepository,
  executeUnlinkProjectFromRepository,
  executeLinkProjectToTeam,
  executeUnlinkProjectFromTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
} from "./infrastructure/tools/ToolSchemas";

// Phase 8 - Project Lifecycle Tools
import {
  executeCloseProject,
  executeReopenProject,
  executeConvertDraftIssue,
} from "./infrastructure/tools/project-lifecycle-tools";

// Phase 8 - Project Advanced Tools
import {
  executeUpdateItemPosition,
  executeSearchIssuesAdvanced,
  executeFilterProjectItems,
} from "./infrastructure/tools/project-advanced-tools";

// Phase 10 - Sprint AI Tools
import {
  executeCalculateSprintCapacity,
  executePrioritizeBacklog,
  executeAssessSprintRisk,
  executeSuggestSprintComposition,
} from "./infrastructure/tools/sprint-ai-tools";

// Phase 10 - Roadmap AI Tools
import {
  executeGenerateRoadmapVisualization,
} from "./infrastructure/tools/roadmap-ai-tools";

// Phase 11 - Issue Intelligence Tools
import {
  executeSuggestLabels,
  executeDetectDuplicates,
  executeFindRelatedIssues,
} from "./infrastructure/tools/issue-intelligence-tools";

// Agent orchestration tools
import {
  executeRegisterAgent,
  executeListAgents,
  executeDeregisterAgent,
  executeCheckoutTask,
  executeReleaseTask,
  executeCompleteTask,
  executeGetTaskContext,
  executeAgentHeartbeat,
  executeSubmitWorkProduct,
  executeGetAgentActivity,
  executeGetBudgetStatus,
  executeSetAgentBudget,
  executeCheckWorkStatus,
  executeReclaimStaleTasks,
  executeRecordUsage,
  executeSubmitForReview,
  executeApproveTask,
  executeRejectTask,
  executeGetAgentMetrics,
  executeSetupAgentFields,
} from "./infrastructure/tools/agent-orchestration-tools";

// Health Tools
import { executeHealthCheck } from "./infrastructure/tools/health-tools";

// Compound tool executors
import {
  executeManageProject,
  executeManageIssues,
  executeManagePrs,
  executeManageMilestones,
  executeManageSprints,
  executeManageLabels,
  executeManageAutomation,
  executeManageIterations,
  executeManageEvents,
  executeManageStatusUpdates,
  executeAiGenerate,
  executeAiAnalyze,
  executeAiPlan,
  executeAgentWork,
  executeAgentManage,
  executeSystem,
  executeDiscoverTools,
} from "./infrastructure/tools/compound/compound-executors";

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
import { ILogger, Logger, logger } from "./infrastructure/logger/index";
import { AIServiceFactory } from "./services/ai/AIServiceFactory";
import { RoadmapPlanningService } from "./services/RoadmapPlanningService";
import { IssueEnrichmentService } from "./services/IssueEnrichmentService";
import { IssueTriagingService } from "./services/IssueTriagingService";
import { GracefulShutdown } from "./infrastructure/lifecycle/GracefulShutdown";
import type { AgentReclaimScheduler } from "./services/agent/AgentReclaimScheduler";

class GitHubProjectManagerServer {
  private server: Server;
  private service: ProjectManagementService;
  private toolRegistry: ToolRegistry;
  private logger: ILogger;

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
  private gracefulShutdown: GracefulShutdown;

  // Agent orchestration
  private reclaimScheduler: AgentReclaimScheduler;

  constructor() {
    this.logger = logger;

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

    // Initialize all services via DI container
    const di = configureContainer(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO);
    this.service = di.resolve("ProjectManagementService");
    this.aiFactory = di.resolve("AIServiceFactory");
    this.roadmapService = di.resolve("RoadmapPlanningService");
    this.enrichmentService = di.resolve("IssueEnrichmentService");
    this.triagingService = di.resolve("IssueTriagingService");

    // Auto-reclaim scheduler: server-side self-healing for the agent swarm
    this.reclaimScheduler = di.resolve("AgentReclaimScheduler");
    this.reclaimScheduler.start();

    // Get the tool registry instance
    this.toolRegistry = ToolRegistry.getInstance();
    this.registerToolExecutors();
    this.setupToolHandlers();
    this.setupEventHandlers();
    this.logAIServiceStatus();
    this.logToolRegistrationStatus();

    this.server.onerror = (error) => this.logger.error("[MCP Error]", error);

    // Install graceful shutdown with in-flight draining
    this.gracefulShutdown = new GracefulShutdown({ logger: this.logger });
    this.gracefulShutdown.installSignalHandlers(async () => {
      await this.shutdown();
    });
  }

  /**
   * Log AI service status during startup
   */
  private logAIServiceStatus(): void {
    try {
      const validation = this.aiFactory.validateConfiguration();

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

  /**
   * Register all tool executors with the ToolRegistry.
   * Replaces the former 120-case executeToolHandler switch with
   * a data-driven dispatch via ToolRegistry.execute().
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private registerToolExecutors(): void {
    const r = this.toolRegistry;
    const svc = this.service;

    // ── Pattern A: PMS facade (pass-through — args forwarded as-is) ──
    const passthroughTools: Array<[string, string]> = [
      ['create_roadmap', 'createRoadmap'],
      ['plan_sprint', 'planSprint'],
      ['create_project', 'createProject'],
      ['update_project', 'updateProject'],
      ['delete_project', 'deleteProject'],
      ['get_project_readme', 'getProjectReadme'],
      ['update_project_readme', 'updateProjectReadme'],
      ['list_project_fields', 'listProjectFields'],
      ['update_project_field', 'updateProjectField'],
      ['create_milestone', 'createMilestone'],
      ['update_milestone', 'updateMilestone'],
      ['delete_milestone', 'deleteMilestone'],
      ['create_issue', 'createIssue'],
      ['list_issues', 'listIssues'],
      ['create_issue_comment', 'createIssueComment'],
      ['update_issue_comment', 'updateIssueComment'],
      ['delete_issue_comment', 'deleteIssueComment'],
      ['list_issue_comments', 'listIssueComments'],
      ['create_draft_issue', 'createDraftIssue'],
      ['update_draft_issue', 'updateDraftIssue'],
      ['delete_draft_issue', 'deleteDraftIssue'],
      ['create_pull_request', 'createPullRequest'],
      ['get_pull_request', 'getPullRequest'],
      ['list_pull_requests', 'listPullRequests'],
      ['update_pull_request', 'updatePullRequest'],
      ['merge_pull_request', 'mergePullRequest'],
      ['list_pull_request_reviews', 'listPullRequestReviews'],
      ['create_pull_request_review', 'createPullRequestReview'],
      ['create_sprint', 'createSprint'],
      ['update_sprint', 'updateSprint'],
      ['add_issues_to_sprint', 'addIssuesToSprint'],
      ['remove_issues_from_sprint', 'removeIssuesFromSprint'],
      ['create_label', 'createLabel'],
      ['list_labels', 'listLabels'],
      ['create_project_view', 'createProjectView'],
      ['list_project_views', 'listProjectViews'],
      ['update_project_view', 'updateProjectView'],
      ['delete_project_view', 'deleteProjectView'],
      ['add_project_item', 'addProjectItem'],
      ['remove_project_item', 'removeProjectItem'],
      ['list_project_items', 'listProjectItems'],
      ['archive_project_item', 'archiveProjectItem'],
      ['unarchive_project_item', 'unarchiveProjectItem'],
      ['set_field_value', 'setFieldValue'],
      ['get_field_value', 'getFieldValue'],
      ['clear_field_value', 'clearFieldValue'],
      ['create_automation_rule', 'createAutomationRule'],
      ['update_automation_rule', 'updateAutomationRule'],
      ['delete_automation_rule', 'deleteAutomationRule'],
      ['get_automation_rule', 'getAutomationRule'],
      ['list_automation_rules', 'listAutomationRules'],
      ['enable_automation_rule', 'enableAutomationRule'],
      ['disable_automation_rule', 'disableAutomationRule'],
      ['get_iteration_configuration', 'getIterationConfiguration'],
      ['get_current_iteration', 'getCurrentIteration'],
      ['get_iteration_items', 'getIterationItems'],
      ['get_iteration_by_date', 'getIterationByDate'],
      ['assign_items_to_iteration', 'assignItemsToIteration'],
      ['create_project_field', 'createProjectField'],
    ];
    for (const [tool, method] of passthroughTools) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      r.registerExecutor(tool, (a: Record<string, unknown>) => (svc as any)[method](a));
    }

    // Pattern A: PMS facade (arg destructuring required)
    r.registerExecutor('get_milestone_metrics', (a) => svc.getMilestoneMetrics(a.milestoneId, a.includeIssues));
    r.registerExecutor('get_sprint_metrics', (a) => svc.getSprintMetrics(a.sprintId, a.includeIssues));
    r.registerExecutor('get_overdue_milestones', (a) => svc.getOverdueMilestones(a.limit, a.includeIssues));
    r.registerExecutor('get_upcoming_milestones', (a) => svc.getUpcomingMilestones(a.daysAhead, a.limit, a.includeIssues));
    r.registerExecutor('list_projects', (a) => svc.listProjects(a.status, a.limit));
    r.registerExecutor('get_project', (a) => svc.getProject(a.projectId));
    r.registerExecutor('list_milestones', (a) => svc.listMilestones(a.status, a.sort, a.direction));
    r.registerExecutor('get_issue', (a) => svc.getIssue(a.issueId));
    r.registerExecutor('update_issue', (a) => svc.updateIssue(a.issueId, {
      title: a.title, description: a.description, status: a.status,
      milestoneId: a.milestoneId, assignees: a.assignees, labels: a.labels,
    }));
    r.registerExecutor('list_sprints', (a) => svc.listSprints(a.status));
    r.registerExecutor('get_current_sprint', (a) => svc.getCurrentSprint(a.includeIssues));

    // ── Pattern B: standalone execute functions ──────────────────────
    r.registerExecutor('add_feature', executeAddFeature);
    r.registerExecutor('generate_prd', executeGeneratePRD);
    r.registerExecutor('parse_prd', executeParsePRD);
    r.registerExecutor('get_next_task', executeGetNextTask);
    r.registerExecutor('analyze_task_complexity', executeAnalyzeTaskComplexity);
    r.registerExecutor('expand_task', executeExpandTask);
    r.registerExecutor('enhance_prd', executeEnhancePRD);
    r.registerExecutor('create_traceability_matrix', executeCreateTraceabilityMatrix);
    r.registerExecutor('add_sub_issue', executeAddSubIssue);
    r.registerExecutor('list_sub_issues', executeListSubIssues);
    r.registerExecutor('get_parent_issue', executeGetParentIssue);
    r.registerExecutor('reprioritize_sub_issue', executeReprioritizeSubIssue);
    r.registerExecutor('remove_sub_issue', executeRemoveSubIssue);
    r.registerExecutor('create_status_update', executeCreateStatusUpdate);
    r.registerExecutor('list_status_updates', executeListStatusUpdates);
    r.registerExecutor('get_status_update', executeGetStatusUpdate);
    r.registerExecutor('mark_project_as_template', executeMarkProjectAsTemplate);
    r.registerExecutor('unmark_project_as_template', executeUnmarkProjectAsTemplate);
    r.registerExecutor('copy_project_from_template', executeCopyProjectFromTemplate);
    r.registerExecutor('list_organization_templates', executeListOrganizationTemplates);
    r.registerExecutor('link_project_to_repository', executeLinkProjectToRepository);
    r.registerExecutor('unlink_project_from_repository', executeUnlinkProjectFromRepository);
    r.registerExecutor('link_project_to_team', executeLinkProjectToTeam);
    r.registerExecutor('unlink_project_from_team', executeUnlinkProjectFromTeam);
    r.registerExecutor('list_linked_repositories', executeListLinkedRepositories);
    r.registerExecutor('list_linked_teams', executeListLinkedTeams);
    r.registerExecutor('close_project', executeCloseProject);
    r.registerExecutor('reopen_project', executeReopenProject);
    r.registerExecutor('convert_draft_issue', executeConvertDraftIssue);
    r.registerExecutor('update_item_position', executeUpdateItemPosition);
    r.registerExecutor('search_issues_advanced', executeSearchIssuesAdvanced);
    r.registerExecutor('filter_project_items', executeFilterProjectItems);
    r.registerExecutor('calculate_sprint_capacity', executeCalculateSprintCapacity);
    r.registerExecutor('prioritize_backlog', executePrioritizeBacklog);
    r.registerExecutor('assess_sprint_risk', executeAssessSprintRisk);
    r.registerExecutor('suggest_sprint_composition', executeSuggestSprintComposition);
    r.registerExecutor('generate_roadmap_visualization', executeGenerateRoadmapVisualization);
    r.registerExecutor('suggest_labels', executeSuggestLabels);
    r.registerExecutor('detect_duplicates', executeDetectDuplicates);
    r.registerExecutor('find_related_issues', executeFindRelatedIssues);
    r.registerExecutor('health_check', () => executeHealthCheck());

    // ── Agent orchestration tools ──────────────────────────────────
    r.registerExecutor('register_agent', executeRegisterAgent);
    r.registerExecutor('list_agents', executeListAgents);
    r.registerExecutor('deregister_agent', executeDeregisterAgent);
    r.registerExecutor('checkout_task', executeCheckoutTask);
    r.registerExecutor('release_task', executeReleaseTask);
    r.registerExecutor('complete_task', executeCompleteTask);
    r.registerExecutor('get_task_context', executeGetTaskContext);
    r.registerExecutor('agent_heartbeat', executeAgentHeartbeat);
    r.registerExecutor('submit_work_product', executeSubmitWorkProduct);
    r.registerExecutor('get_agent_activity', executeGetAgentActivity);
    r.registerExecutor('get_budget_status', executeGetBudgetStatus);
    r.registerExecutor('set_agent_budget', executeSetAgentBudget);
    r.registerExecutor('check_work_status', (args) => executeCheckWorkStatus(args));
    r.registerExecutor('reclaim_stale_tasks', executeReclaimStaleTasks);
    r.registerExecutor('record_usage', executeRecordUsage);
    r.registerExecutor('submit_for_review', executeSubmitForReview);
    r.registerExecutor('approve_task', executeApproveTask);
    r.registerExecutor('reject_task', executeRejectTask);
    r.registerExecutor('get_agent_metrics', executeGetAgentMetrics);
    r.registerExecutor('setup_agent_fields', executeSetupAgentFields);

    // ── Pattern C: server-bound handlers (use this.xxxService) ───────
    r.registerExecutor('subscribe_to_events', (a) => this.handleSubscribeToEvents(a));
    r.registerExecutor('get_recent_events', (a) => this.handleGetRecentEvents(a));
    r.registerExecutor('replay_events', (a) => this.handleReplayEvents(a));
    r.registerExecutor('generate_roadmap', (a) => this.handleGenerateRoadmap(a));
    r.registerExecutor('enrich_issue', (a) => this.handleEnrichIssue(a));
    r.registerExecutor('enrich_issues_bulk', (a) => this.handleEnrichIssuesBulk(a));
    r.registerExecutor('triage_issue', (a) => this.handleTriageIssue(a));
    r.registerExecutor('triage_all_issues', (a) => this.handleTriageAllIssues(a));
    r.registerExecutor('schedule_triaging', (a) => this.handleScheduleTriaging(a));

    // ── Compound tools (aggregated MCP-facing tools) ────────────────
    r.registerExecutor('manage_project', executeManageProject);
    r.registerExecutor('manage_issues', executeManageIssues);
    r.registerExecutor('manage_prs', executeManagePrs);
    r.registerExecutor('manage_milestones', executeManageMilestones);
    r.registerExecutor('manage_sprints', executeManageSprints);
    r.registerExecutor('manage_labels', executeManageLabels);
    r.registerExecutor('manage_automation', executeManageAutomation);
    r.registerExecutor('manage_iterations', executeManageIterations);
    r.registerExecutor('manage_events', executeManageEvents);
    r.registerExecutor('manage_status_updates', executeManageStatusUpdates);
    r.registerExecutor('ai_generate', executeAiGenerate);
    r.registerExecutor('ai_analyze', executeAiAnalyze);
    r.registerExecutor('ai_plan', executeAiPlan);
    r.registerExecutor('agent_work', executeAgentWork);
    r.registerExecutor('agent_manage', executeAgentManage);
    r.registerExecutor('system', executeSystem);
    r.registerExecutor('discover_tools', executeDiscoverTools);
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
        // Reject new requests during shutdown
        if (this.gracefulShutdown.shuttingDown) {
          throw new McpError(
            ErrorCode.InternalError,
            "Server is shutting down — no new requests accepted",
          );
        }

        this.gracefulShutdown.trackStart();
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
          const result = await this.toolRegistry.execute(toolName, validatedArgs);

          // Format the result as an MCP response
          const mcpResponse = ToolResultFormatter.formatSuccess(toolName, result, {
            contentType: MCPContentType.JSON,
          });

          // Convert our custom MCPResponse to the format expected by the SDK
          // SDK 1.25+ expects { content: [...], structuredContent?: {...}, isError?: boolean }
          if (mcpResponse.status === "success") {
            // Prepare structuredContent if result is a non-null, non-array object.
            // Arrays are excluded because most tool outputSchemas expect a record;
            // array results (e.g., list actions) are still fully accessible via the
            // text content. Class instances are serialized via JSON round-trip to
            // produce plain records the MCP SDK can validate.
            const structuredContent = (
              result !== null &&
              typeof result === 'object' &&
              !Array.isArray(result)
            )
              ? JSON.parse(JSON.stringify(result)) as Record<string, unknown>
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
        } finally {
          this.gracefulShutdown.trackEnd();
        }
      }
    );
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
      // Stop the agent auto-reclaim scheduler
      this.reclaimScheduler.stop();

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
        process.stderr.write(`- Agent auto-reclaim: ${AGENT_RECLAIM_ENABLED ? `enabled (every ${AGENT_RECLAIM_INTERVAL_MS}ms, stale after ${AGENT_STALE_AFTER_MINUTES}min)` : 'disabled'}\n`);
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
