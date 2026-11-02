#!/usr/bin/env node
import {
  type CallToolResult,
  fromJsonSchema,
  INTERNAL_ERROR,
  type JsonSchemaType,
  McpServer,
  ProtocolError,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type { DependencyContainer } from "tsyringe";
import { configureContainer } from "./container";
import {
  AGENT_RECLAIM_ENABLED,
  AGENT_RECLAIM_INTERVAL_MS,
  AGENT_STALE_AFTER_MINUTES,
  CACHE_DIRECTORY,
  CLI_OPTIONS,
  EVENTS_ALLOW_UNAUTHENTICATED,
  GITHUB_OWNER,
  GITHUB_REPO,
  getSecret,
  SSE_ENABLED,
  SYNC_ENABLED,
  SYNC_TIMEOUT_MS,
  WEBHOOK_PORT,
  WEBHOOK_SECRET,
} from "./env";
import type { ResourceCache } from "./infrastructure/cache/ResourceCache";
import type { EventStore } from "./infrastructure/events/EventStore";
import type { EventSubscriptionManager } from "./infrastructure/events/EventSubscriptionManager";
import type {
  GitHubWebhookHandler,
  ResourceEvent,
} from "./infrastructure/events/GitHubWebhookHandler";
import { resolveGitHubAuth } from "./infrastructure/github/GitHubAuthResolver";
import type { GitHubRepositoryFactory } from "./infrastructure/github/GitHubRepositoryFactory";
import { WebhookServer } from "./infrastructure/http/WebhookServer";
import { getIdempotencyStore } from "./infrastructure/idempotency/IdempotencyStore";
import type { GracefulShutdown } from "./infrastructure/lifecycle/GracefulShutdown";
import { type ILogger, logger } from "./infrastructure/logger/index";
import { registerPrompts as registerPromptTemplates } from "./infrastructure/mcp/prompts";
import { registerResources as registerResourceHandlers } from "./infrastructure/mcp/resources";
import { ToolDispatcher } from "./infrastructure/mcp/ToolDispatcher";
import {
  auditLogConfigFromEnv,
  type MutationAuditLog,
} from "./infrastructure/observability/MutationAuditLog";
import {
  initTelemetry,
  shutdownTelemetry,
  type TelemetryConfig,
} from "./infrastructure/observability/otel";
import type { FilePersistenceAdapter } from "./infrastructure/persistence/FilePersistenceAdapter";
import { registerCompoundExecutors } from "./infrastructure/tools/compound/register-executors";
import { ToolRegistry } from "./infrastructure/tools/ToolRegistry";
import type { AgentBudgetService } from "./services/agent/AgentBudgetService";
import type { AgentReclaimScheduler } from "./services/agent/AgentReclaimScheduler";
import type { AIServiceFactory } from "./services/ai/AIServiceFactory";
import { GitHubStateSyncService } from "./services/GitHubStateSyncService";
import type { ProjectManagementService } from "./services/ProjectManagementService";
import { PACKAGE_VERSION } from "./version";

class GitHubProjectManagerServer {
  private server: McpServer;
  /** Handle from serveStdio; kept so shutdown can close the transport. */
  private stdioHandle?: ReturnType<typeof serveStdio>;
  private di: DependencyContainer;
  private authKind: "app" | "pat";
  private service: ProjectManagementService;
  private toolRegistry: ToolRegistry;
  private dispatcher: ToolDispatcher;
  private logger: ILogger;

  // AI-powered automation services
  private aiFactory: AIServiceFactory;

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

  // Observability
  private audit: MutationAuditLog;
  private telemetryConfig: TelemetryConfig;

  // Agent orchestration
  private reclaimScheduler: AgentReclaimScheduler;

  constructor() {
    this.logger = logger;

    this.server = new McpServer(
      {
        name: "github-project-manager",
        version: PACKAGE_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    // Resolve credentials (GitHub App outranks the PAT) and build every
    // entry-point component through the DI container.
    const auth = resolveGitHubAuth();
    this.authKind = auth.kind;
    this.di = configureContainer(auth, GITHUB_OWNER, GITHUB_REPO);
    this.service = this.di.resolve("ProjectManagementService");
    this.aiFactory = this.di.resolve("AIServiceFactory");
    this.cache = this.di.resolve("ResourceCache");
    this.persistence = this.di.resolve("FilePersistenceAdapter");
    this.webhookHandler = this.di.resolve("GitHubWebhookHandler");
    this.subscriptionManager = this.di.resolve("EventSubscriptionManager");
    this.eventStore = this.di.resolve("EventStore");
    this.gracefulShutdown = this.di.resolve("GracefulShutdown");
    this.audit = this.di.resolve("MutationAuditLog");
    this.telemetryConfig = this.di.resolve("TelemetryConfig");

    // Enable AI resilience (circuit breaker + retry + timeout) for all
    // executeWithResilience() calls. Opt-in: existing direct generateText/
    // generateObject calls are unaffected; services must explicitly wrap
    // via factory.executeWithResilience() to benefit.
    this.aiFactory.enableResilience();

    // Auto-reclaim scheduler: server-side self-healing for the agent swarm
    this.reclaimScheduler = this.di.resolve("AgentReclaimScheduler");
    this.reclaimScheduler.start();

    // Get the tool registry instance
    this.toolRegistry = ToolRegistry.getInstance();
    this.dispatcher = new ToolDispatcher({
      registry: this.toolRegistry,
      // Resolved lazily: only agent calls ever touch the budget registry.
      budget: () => this.di.resolve<AgentBudgetService>("AgentBudgetService"),
      audit: this.audit,
      logger: this.logger,
    });
    this.registerToolExecutors();
    this.setupToolHandlers();
    this.registerResources();
    this.registerPrompts();
    this.setupEventHandlers();
    this.logAIServiceStatus();
    this.logToolRegistrationStatus();
    // Transport errors are reported via serveStdio's `onerror` callback in run().

    // Install graceful shutdown with in-flight draining
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
        this.logger.info(`✅ AI Services Available: ${validation.available.join(", ")}`);
        this.logger.info(`📊 Available Models: ${validation.availableModels.join(", ")}`);

        if (validation.unavailableModels.length > 0) {
          this.logger.warn(`⚠️  Unavailable Models: ${validation.unavailableModels.join(", ")}`);
        }

        if (validation.missing.length > 0) {
          this.logger.warn(`🔑 Missing API Keys: ${validation.missing.join(", ")}`);
        }

        this.logger.info(
          "🎯 AI-powered tools are ready: generate_prd, enhance_prd, parse_prd, add_feature, get_next_task, analyze_task_complexity, expand_task, create_traceability_matrix"
        );
      } else {
        this.logger.warn("⚠️  No AI providers configured - AI features will be unavailable");
        this.logger.warn(`🔑 Missing API Keys: ${validation.missing.join(", ")}`);
        this.logger.info(
          "💡 To enable AI features, set at least one of these environment variables:"
        );
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
      const toolsWithAnnotations = tools.filter((t) => t.annotations !== undefined);
      const toolsWithOutputSchema = tools.filter((t) => t.outputSchema !== undefined);
      const toolsWithTitle = tools.filter((t) => t.title !== undefined);

      this.logger.info(`📦 Tool Registration Status: ${toolCount} tools registered`);

      // Annotation breakdown by behavior type
      const readOnly = toolsWithAnnotations.filter((t) => t.annotations?.readOnlyHint === true);
      const destructive = toolsWithAnnotations.filter(
        (t) => t.annotations?.destructiveHint === true
      );
      const idempotent = toolsWithAnnotations.filter((t) => t.annotations?.idempotentHint === true);

      this.logger.info(
        `   Annotations: ${toolsWithAnnotations.length}/${toolCount} (readOnly: ${readOnly.length}, destructive: ${destructive.length}, idempotent: ${idempotent.length})`
      );
      this.logger.info(`   Output Schemas: ${toolsWithOutputSchema.length}/${toolCount}`);
      this.logger.info(`   Titles: ${toolsWithTitle.length}/${toolCount}`);

      // Warn if any tools are missing compliance features
      if (toolsWithAnnotations.length < toolCount) {
        const missing = tools.filter((t) => !t.annotations).map((t) => t.name);
        this.logger.warn(`⚠️  Tools missing annotations: ${missing.join(", ")}`);
      }

      if (toolsWithOutputSchema.length < toolCount) {
        const missing = tools.filter((t) => !t.outputSchema).map((t) => t.name);
        if (missing.length <= 5) {
          this.logger.debug(`Tools without outputSchema: ${missing.join(", ")}`);
        }
      }
    } catch (error) {
      this.logger.error("Failed to check tool registration status:", error);
    }
  }

  /**
   * Register the tool executors with the ToolRegistry.
   *
   * Only the COMPOUND tools get executors. `dispatchTool` looks the tool up by
   * the name the MCP client called, and MCP clients only ever see the compound
   * surface (`ToolRegistry.getToolsForMCP`). The granular tools stay DEFINED in
   * the registry as internal implementation contracts (documented in
   * docs/TOOLS.md); an executor registered under a granular name can never be
   * dispatched, so registering one is dead weight.
   *
   * `src/__tests__/unit/infrastructure/tools/tool-registration.test.ts` pins
   * that invariant: every registered executor name must be a public tool name.
   */
  private registerToolExecutors(): void {
    registerCompoundExecutors(this.toolRegistry);
  }

  private setupToolHandlers() {
    // v2 registers each tool individually rather than serving one CallTool
    // handler. The registry stays the source of truth; every tool shares the
    // dispatcher below, which carries the shutdown gate, in-flight tracking,
    // and result formatting that used to live in the single CallTool handler.
    for (const tool of this.toolRegistry.getToolsForMCP()) {
      this.server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          // The registry already emits JSON Schema; `fromJsonSchema` adapts it
          // to the StandardSchema surface v2 expects. Going through JSON Schema
          // rather than handing over the raw Zod types also sidesteps the
          // TS2589 "excessively deep" instantiation that forced an `as any`
          // cast on the v1 handler.
          //
          // The schema the client is told about and the schema the SDK
          // validates incoming arguments against are the SAME document: the
          // adapter hands the raw JSON Schema to both, so per-action required
          // arguments are enforced at the protocol boundary.
          inputSchema: fromJsonSchema(tool.inputSchema as JsonSchemaType),
          ...(tool.outputSchema
            ? { outputSchema: fromJsonSchema(tool.outputSchema as JsonSchemaType) }
            : {}),
          ...(tool.annotations ? { annotations: tool.annotations } : {}),
        },
        // The callback is typed against the declared input schema: with
        // `fromJsonSchema` the argument type is `unknown`, so no cast is
        // needed (and none is used — an `as any` here would hide a real
        // signature change).
        async (args: unknown): Promise<CallToolResult> => this.dispatchTool(tool.name, args)
      );
    }
  }

  /**
   * Register read-only MCP resources.
   *
   * Resources expose the same GitHub-backed state as the tools above but
   * without an input schema — a client lists and reads them directly for
   * "what's the current state" queries instead of shaping a tool call.
   * Read failures are logged and re-thrown as a McpError so the client sees
   * a clean message instead of a raw stack trace.
   */
  private registerResources(): void {
    registerResourceHandlers(this.server, {
      service: this.service,
      toolRegistry: this.toolRegistry,
      agentStore: this.di.resolve("AgentStore"),
      aiFactory: this.aiFactory,
      logger: this.logger,
      serverVersion: PACKAGE_VERSION,
    });
  }

  /**
   * Register reusable MCP prompt templates.
   *
   * Prompts are self-contained AI message templates — see
   * `infrastructure/mcp/prompts.ts`. They format their arguments into a
   * message sequence and return it; they never call the GitHub API
   * themselves.
   */
  private registerPrompts(): void {
    registerPromptTemplates(this.server);
  }

  /**
   * Execute one tool call under the shutdown gate and in-flight tracking.
   *
   * `ToolDispatcher` owns the error contract: an unknown tool is a protocol
   * fault (JSON-RPC error); every other failure is a `{ isError: true }` result
   * the model can read and recover from.
   */
  private async dispatchTool(toolName: string, args: unknown): Promise<CallToolResult> {
    if (this.gracefulShutdown.shuttingDown) {
      throw new ProtocolError(INTERNAL_ERROR, "Server is shutting down — no new requests accepted");
    }

    this.gracefulShutdown.trackStart();
    try {
      return await this.dispatcher.dispatch(toolName, args);
    } finally {
      this.gracefulShutdown.trackEnd();
    }
  }

  /**
   * Setup event handlers for the event system
   */
  private setupEventHandlers(): void {
    // Handle events from subscription manager
    this.subscriptionManager.on("internalEvent", ({ event }) => {
      this.logger.debug(
        `Internal event notification: ${event.type} ${event.resourceType} ${event.resourceId}`
      );
      // Handle internal events (e.g., cache invalidation)
      this.handleInternalEvent(event);
    });

    // Store events when they're processed
    this.subscriptionManager.on("sseEvent", async ({ event }) => {
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
  private handleInternalEvent(event: ResourceEvent): void {
    // Invalidate cache for the affected resource
    if (event.resourceType && event.resourceId) {
      this.cache.invalidate(event.resourceType, event.resourceId);
      this.logger.debug(`Invalidated cache for ${event.resourceType}:${event.resourceId}`);
    }
  }

  /**
   * Rebuild the create-idempotency store from the audit log so duplicate
   * creates are still refused after a restart. Never fails startup.
   */
  private async hydrateIdempotency(): Promise<void> {
    const config = auditLogConfigFromEnv();
    if (!config.enabled || !config.path) {
      return;
    }
    try {
      const restored = await getIdempotencyStore().hydrateFromAuditLog(config.path);
      this.logger.info(`Restored ${restored} idempotency key(s) from the audit log`);
    } catch (error) {
      this.logger.warn("Could not hydrate idempotency keys from the audit log:", error);
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
      const factory = this.di.resolve<GitHubRepositoryFactory>("GitHubRepositoryFactory");
      this.syncService = new GitHubStateSyncService(factory, this.cache, this.persistence);

      // Perform initial sync with timeout
      this.logger.info("Starting initial GitHub state sync...");
      const syncResult = await this.syncService.performInitialSync(SYNC_TIMEOUT_MS);

      if (syncResult.success) {
        this.logger.info(
          `Initial sync completed successfully: ${syncResult.syncedResources} resources synced, ${syncResult.skippedResources} skipped in ${syncResult.duration}ms`
        );
      } else {
        this.logger.warn(`Initial sync completed with errors: ${syncResult.errors.join(", ")}`);
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
      this.logger.info(
        "Event system disabled (no SSE and no webhook secret), skipping webhook server"
      );
      return;
    }

    if (SSE_ENABLED && !getSecret("EVENTS_AUTH_TOKEN") && !EVENTS_ALLOW_UNAUTHENTICATED) {
      this.logger.warn(
        "SSE_ENABLED is true but neither EVENTS_AUTH_TOKEN nor EVENTS_ALLOW_UNAUTHENTICATED is set: /events/* will answer 503. Set EVENTS_AUTH_TOKEN (recommended) or SSE_ENABLED=false."
      );
    }

    try {
      this.webhookServer = new WebhookServer(
        this.webhookHandler,
        this.subscriptionManager,
        this.eventStore,
        {
          port: WEBHOOK_PORT,
          enableSSE: SSE_ENABLED,
        }
      );

      await this.webhookServer.start();
      this.logger.info(`Webhook server started on port ${WEBHOOK_PORT}`);
    } catch (error) {
      this.logger.error("Failed to start webhook server:", error);
      this.logger.warn(
        "Continuing without webhook server - real-time events will not be available"
      );
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

      // Close stdio transport
      if (this.stdioHandle) {
        await this.stdioHandle.close();
        this.logger.info("Stdio transport closed");
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

      // Flush the audit log and pending spans last so everything the drained
      // in-flight calls produced is recorded.
      await this.audit.close();
      await shutdownTelemetry();
    } catch (error) {
      this.logger.error("Error during shutdown:", error);
    }
  }

  async run() {
    try {
      await initTelemetry(this.telemetryConfig);
      await this.hydrateIdempotency();

      // Initialize sync service first
      await this.initializeSync();

      // Initialize webhook server
      await this.initializeWebhookServer();

      // Serve over stdio. `serveStdio` owns the transport and negotiates the
      // protocol revision per connection (including 2025-era clients), so the
      // hand-rolled version-mismatch handling this replaced is no longer needed.
      this.stdioHandle = serveStdio(() => this.server, {
        onerror: (error) => this.logger.error("MCP transport error:", error),
      });

      // Register MCP sampling as zero-config AI fallback.
      // The calling agent (Claude, Codex, Pi) IS the LLM — no API keys needed.
      // Registered lazily: the sampling function checks client capabilities at
      // call time because the client hasn't connected yet at this point.
      // Only works on 2025-era connections where createMessage is available.
      if (!this.aiFactory.isAIAvailable()) {
        const server = this.server.server;
        this.aiFactory.setSamplingProvider(async (params) => {
          // Check client capabilities at call time (not at registration)
          const clientCaps = server.getClientCapabilities();
          if (!clientCaps?.sampling) {
            throw new Error(
              "MCP client does not support sampling. " +
                "Configure AI_MAIN_MODEL + provider key, or use " +
                "AI_MAIN_PROVIDER=openai-compatible with a base URL. " +
                "See docs/CONFIGURATION.md for examples."
            );
          }

          const result = await server.createMessage({
            messages: params.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            systemPrompt: params.systemPrompt,
            maxTokens: params.maxTokens ?? 4096,
            modelPreferences: params.modelPreferences,
          });

          return {
            role: result.role,
            content:
              typeof result.content === "string"
                ? result.content
                : {
                    type: "text",
                    text:
                      "text" in result.content
                        ? String(result.content.text)
                        : String(result.content),
                  },
            model: result.model,
          };
        });
      }
      this.logger.info("MCP server connected over stdio");

      // Display configuration information if verbose mode is enabled
      if (CLI_OPTIONS.verbose) {
        process.stderr.write("GitHub Project Manager MCP server configuration:\n");
        process.stderr.write(`- Owner: ${GITHUB_OWNER}\n`);
        process.stderr.write(`- Repository: ${GITHUB_REPO}\n`);
        process.stderr.write(`- GitHub auth: ${this.authKind}\n`);
        process.stderr.write(`- Environment file: ${CLI_OPTIONS.envFile || ".env (default)"}\n`);
        process.stderr.write(`- Sync enabled: ${SYNC_ENABLED}\n`);
        process.stderr.write(`- Cache directory: ${CACHE_DIRECTORY}\n`);
        process.stderr.write(`- Webhook port: ${WEBHOOK_PORT}\n`);
        process.stderr.write(`- SSE enabled: ${SSE_ENABLED}\n`);
        process.stderr.write(
          `- Agent auto-reclaim: ${AGENT_RECLAIM_ENABLED ? `enabled (every ${AGENT_RECLAIM_INTERVAL_MS}ms, stale after ${AGENT_STALE_AFTER_MINUTES}min)` : "disabled"}\n`
        );
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
      process.stderr.write(
        "\nExample: mcp-github-project-manager --owner=your_username --repo=your_repo\n"
      );
    }

    process.stderr.write("\nFor more information, run: mcp-github-project-manager --help\n");
  } else {
    process.stderr.write(`Unknown error: ${error}\n`);
  }
  process.exit(1);
}
