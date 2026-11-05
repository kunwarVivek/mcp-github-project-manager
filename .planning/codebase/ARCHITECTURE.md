# Architecture

**Analysis Date:** 2026-11-02

**Updated:** 2026-11-02 — reconciled with code: rich domain entities, `ToolDispatcher` pipeline (budget gate → audited execution in an OTel span), single `GitHubRequestExecutor` with proactive rate-limit budgeting, idempotency keys / cursor pagination / schema versioning, webhook hardening, `PromptRegistry` / `TokenBudgetManager`, and the `analytics` tool.

## Pattern Overview

**Overall:** Layered Service Architecture with MCP Protocol Integration

**Key Characteristics:**
- MCP (Model Context Protocol) server exposing tools via stdio transport, on `@modelcontextprotocol/server` v2 (2026-07-28 spec)
- Repository pattern for GitHub API abstraction (GraphQL + REST)
- Service layer coordinating business logic and AI-powered automation
- Factory patterns for GitHub access (`GitHubRepositoryFactory.fromAuth`, `createGitHubFactory`)
- One GitHub request path: `GitHubRequestExecutor` (retry + proactive rate-limit budgeting via `RateLimitManager`)
- Singleton patterns for shared infrastructure (ResourceCache, Logger, ToolRegistry, AIServiceFactory)
- Event-driven architecture for webhook handling and state sync
- Secret resolution chain (CLI flag → `SECRETS_DIR` file → env var → `gh auth token`)

## Layers

**Entry Point (MCP Server):**
- Purpose: Bootstrap MCP server, register tools/resources/prompts, handle protocol requests
- Location: `src/index.ts`
- Contains: `GitHubProjectManagerServer` class orchestrating all components
- Depends on: Services, Infrastructure, Domain types
- Used by: MCP clients (Claude Desktop, etc.)
- Resolves the components it owns (`ResourceCache`, `FilePersistenceAdapter`, `GitHubWebhookHandler`, `EventStore`, `EventSubscriptionManager`, `HealthService`, `GracefulShutdown`, `MutationAuditLog`, `TelemetryConfig`) and the services from `src/container.ts` (tsyringe); it constructs none by hand

**Domain Layer:**
- Purpose: Define types, schemas, errors, and business entities with their own behavior (rich entities: state transitions, invariants, derived properties)
- Location: `src/domain/`
- Contains: Type definitions, Zod 4 schemas, error classes, entities, value objects, domain events
- Depends on: Nothing — imports nothing from `services/` or `infrastructure/`
- Used by: All other layers

**Services Layer:**
- Purpose: Business logic orchestration, AI task processing, state management
- Location: `src/services/`
- Contains: `ProjectManagementService` (thin getters-only facade, 121 lines, over the extracted per-feature services), IssueService, MilestoneService, SprintPlanningService, AnalyticsService, TaskGenerationService, agent orchestration services
- Depends on: Infrastructure (repositories, AI), Domain types
- Used by: MCP tools, entry point

**Infrastructure Layer:**
- Purpose: External integrations, persistence, caching, resilience, secrets, MCP protocol handling
- Location: `src/infrastructure/`
- Contains: GitHub repositories, cache, events, observability, resilience, secrets, MCP resources/prompts, tools
- Depends on: Domain types, external SDKs (Octokit, Vercel AI SDK)
- Used by: Services layer, entry point

## Data Flow

**MCP Tool Execution (SDK v2):**

1. MCP client sends a `tools/call` request over stdio
2. `src/index.ts` registers every registry tool with `server.registerTool(name, {inputSchema, ...}, handler)` — the registry stays the source of truth
3. v2 validates arguments against the declared `inputSchema` **before** the handler runs, so a missing required field never reaches `ToolValidator`
4. The handler calls the single shared `dispatchTool(toolName, args)`, which carries the shutdown gate and in-flight tracking, then delegates to `ToolDispatcher` (`src/infrastructure/mcp/ToolDispatcher.ts`): argument validation → agent-budget gate → audited execution inside a `tool.<name>` OTel span (idempotency replay for create actions) → budget debit → result formatting with `_meta.schemaVersion`
5. `ToolDispatcher` looks the tool up in `ToolRegistry`, validates arguments with `ToolValidator`, and executes it inside a correlation trace context
6. The service orchestrates GitHub API calls via repositories
7. `ToolResultFormatter.formatSuccess()` shapes the result; `structuredContent` is emitted only when the tool declares an `outputSchema`
8. Response is sent back to the client

**Tool failure convention:**
- An execution failure returns `{content, isError: true}` with the stable code in `_meta.error` — the call succeeded at the protocol level and the model can read the failure and recover. This covers invalid arguments, GitHub API errors (`ToolValidator.mapGitHubError`), and an exhausted agent budget (`BudgetExhausted`)
- A JSON-RPC error (`ProtocolError`) is reserved for **protocol faults**: unknown tool, malformed request, server shutting down
- MCP v2 renamed `McpError` → `ProtocolError` (same `(code, message, data)` shape) and replaced the `ErrorCode` enum with plain numeric constants; `src/index.ts` imports them (`INTERNAL_ERROR`, ...) directly from `@modelcontextprotocol/server`

**AI Task Generation (parse_prd tool):**

1. PRD content received via the PRD tool
2. `TaskGenerationService.generateEnhancedTasksFromPRD()` orchestrates
3. `PRDGenerationService.extractFeaturesFromPRD()` parses PRD
4. `AITaskProcessor` uses the Vercel AI SDK for LLM calls
5. `RequirementsTraceabilityService` creates the traceability matrix
6. Enhanced tasks returned with context and dependencies

**GitHub Operations:**

1. Service method called (e.g., `createIssue`)
2. `GitHubRepositoryFactory` creates the appropriate repository
3. Repository calls go through the shared `GitHubRequestExecutor` (REST and GraphQL): it waits on the `RateLimitManager` budget (backs off below `RATE_LIMIT_FLOOR`), runs the call, and retries retryable failures
4. GraphQL or REST API called via Octokit
5. `GitHubTypeConverter` (`github/util/conversion.ts`) transforms the response to domain types
6. Result cached in `ResourceCache`
7. Event emitted to `EventStore`

**State Management:**
- `ResourceCache` (singleton): In-memory cache with TTL, tag indexing, namespace support
- `CachePersistence`: writes cache state to disk so it survives restarts
- `FilePersistenceAdapter`: File-based persistence with compression, atomic writes, backup recovery
- `GitHubStateSyncService`: Periodic sync between cache and GitHub API
- `EventStore`: Event sourcing for audit trail, with in-memory buffer eviction at `maxEventsInMemory`

## Key Abstractions

**GitHubRepositoryFactory / createGitHubFactory:**
- Purpose: Create GitHub repository instances with shared Octokit config, resolving credentials through the secret chain
- Examples: `src/infrastructure/github/GitHubRepositoryFactory.ts`, `src/infrastructure/tools/tool-factory.ts`
- Pattern: `createGitHubFactory()` returns an App-authenticated factory when the GitHub App is fully configured, otherwise a PAT-backed one

**BaseGitHubRepository:**
- Purpose: Common GitHub API interaction patterns
- Examples: `src/infrastructure/github/repositories/BaseGitHubRepository.ts`
- Pattern: Template method with retry logic, error handling, GraphQL/REST helpers

**ToolRegistry:**
- Purpose: Central registry of all MCP tools
- Examples: `src/infrastructure/tools/ToolRegistry.ts`
- Pattern: Singleton with tool registration, retrieval, and MCP format conversion; each tool's JSON Schema is generated with zod 4's native `z.toJSONSchema(schema, { io: 'input' })`

**AIServiceFactory:**
- Purpose: Create AI model instances for different providers
- Examples: `src/services/ai/AIServiceFactory.ts`
- Pattern: Singleton factory supporting Anthropic, OpenAI, Google, Perplexity; wraps every model with middleware that accumulates provider-reported usage into the correlation context

**Resource Types:**
- Purpose: Unified resource model for all entities
- Examples: `src/domain/resource-types.ts`
- Pattern: Base `Resource` interface with `ResourceType` enum, status, versioning

**Container (tsyringe):**
- Purpose: Wire services and the components `index.ts` owns into one dependency graph
- Examples: `src/container.ts`
- Pattern: `configureContainer(auth, owner, repo)` registers the factory (`GitHubRepositoryFactory.fromAuth`), the logger, services, and the entry-point components; `createProjectManagementService(...)` remains available for direct instantiation. **Documented exception:** tool executors (`infrastructure/tools/**`) do not resolve from the container — they self-construct through `createGitHubFactory()` / the shared-services accessor, which uses `resolveGitHubAuth()`

## Entry Points

**MCP Server (`src/index.ts`):**
- Location: `src/index.ts`
- Triggers: `node build/index.js` or MCP client connection
- Responsibilities:
  - Initialize all infrastructure (cache, persistence, events)
  - Configure the DI container and create `ProjectManagementService`
  - Initialize AI automation services
  - Register every tool with `registerTool`, plus MCP resources and prompt templates
  - Serve over stdio via `serveStdio`, which negotiates the protocol revision per connection
  - Handle graceful shutdown

**CLI (`src/cli.ts`):**
- Location: `src/cli.ts`
- Triggers: Command-line invocation with arguments
- Responsibilities:
  - Parse CLI arguments (token, owner, repo, env-file)
  - Display version and help information

## Error Handling

**Strategy:** Typed error hierarchy with MCP error code mapping

**Error Types:**
- `DomainError`: Base error class with stack trace capture
- `ValidationError`: Input validation failures
- `ResourceNotFoundError`: Missing resources
- `RateLimitError`: GitHub API rate limiting (includes reset time)
- `UnauthorizedError`: Authentication failures
- `GitHubAPIError`: GitHub-specific API errors
- `MCPProtocolError`: MCP protocol violations

**Error Flow:**
1. Repository catches Octokit errors
2. `GitHubErrorHandler.handleError()` classifies and wraps
3. `GitHubRequestExecutor.run()` retries transient errors (see Retry Pattern)
4. Service catches and maps to MCP-flavoured errors via `mapErrorToMCPError()` (`src/services/utils/ErrorMapper.ts`)
5. `ToolDispatcher` converts to an `{isError: true}` tool result (execution failures) or lets a `ProtocolError` through (protocol faults)

**Retry Pattern:**
- `GitHubRequestExecutor.run()`: up to 3 attempts, GitHub-aware backoff (honors `Retry-After` / reset headers); a budget exhaustion is final and never retried
- Non-retryable errors throw immediately
- `src/infrastructure/resilience/` adds a circuit breaker and an AI resilience policy on top (AI calls only)

## Cross-Cutting Concerns

**Logging:**
- Singleton `Logger` class plus `createLogger()` / `getLogger()` (`src/infrastructure/logger/index.ts`)
- Writes to stderr to avoid MCP stdout protocol interference
- Levels: debug, info, warn, error, filtered by `LOG_LEVEL`; `LOG_FORMAT=json` emits one JSON object per line with the active correlation id
- `redactSecrets()` strips token/secret/password/apiKey/authorization-shaped keys from anything the logger stringifies

**Validation:**
- Zod 4 schemas in `src/domain/resource-schemas.ts`
- `ToolValidator` validates tool arguments (SDK v2 has already checked the declared schema by this point)
- Services validate input with Zod before operations
- Startup config validation runs against the **resolved** environment, so a token supplied by file or CLI flag satisfies the required-field check

**Authentication:**
- GitHub credentials resolve only through `resolveGitHubAuth()` (`src/infrastructure/github/auth/`), which returns a `GitHubAuth`; other secrets resolve through `getSecret()`
- GitHub App installation auth (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`) outranks the PAT when fully configured; a partial App config falls through to the next credential tier
- `process.env.GITHUB_TOKEN` is never read directly
- AI API keys configured via environment variables (with per-role overrides)

**Observability:**
- `CorrelationContext` provides a correlation id and an `AsyncLocalStorage` scope that AI middleware and the dispatcher both use
- `ToolTelemetry` records per-tool call latency and error counts
- `SecurityAuditLog` records security-relevant events
- `MutationAuditLog` (opt-in, `AUDIT_LOG_ENABLED`) appends a redacted JSONL record of every state-changing tool call (default `.mcp-audit/mutations.jsonl`); `IdempotencyStore` replays from it
- OpenTelemetry (opt-in, `OTEL_EXPORTER_OTLP_ENDPOINT`): `tool.<name>` spans via `src/infrastructure/observability/otel.ts`; flushed in graceful shutdown

**Tool contract features:**
- `idempotencyKey` on create actions: same key + same arguments within 24h replays the first result (`src/infrastructure/idempotency/IdempotencyStore.ts`)
- Additive pagination: list actions accept `cursor` and answer `nextCursor` next to `pageInfo`
- Per-tool `_meta.schemaVersion` (`compound/schema-version.ts`, all 1.0.0), pinned by a schema snapshot test
- `manage_sprints` delete requires `confirm: true`
- `analytics` tool (read-only): `sprint_velocity`, `sprint_burndown`, `cycle_time`, `throughput`, `project_summary`, backed by `AnalyticsService`

**AI layer:**
- All prompts are registered, versioned (`{{var}}` templates) and rendered through `PromptRegistry` (`src/services/ai/prompts/`)
- `TokenBudgetManager` (`AI_SESSION_TOKEN_LIMIT`) is a per-session budget for the AI task pipeline, distinct from the agent budget metered by `AgentBudgetService` (whose `hardStop` gates AI tools with `BudgetExhausted`)
- `AIResponseCache` is wired into `TaskContextGenerationService`

**Webhook/SSE server (`src/infrastructure/http/WebhookServer.ts`):**
- Binds loopback by default (`WEBHOOK_HOST`), `/events/*` requires `EVENTS_AUTH_TOKEN`, signature validation fails closed, CORS allow-list, rate limit, request timeout, `X-Forwarded-For` trusted only from `WEBHOOK_TRUSTED_PROXIES`

**Caching:**
- `ResourceCache.getInstance()` provides shared cache
- TTL-based expiration, tag and namespace indexing for efficient invalidation
- `CachePersistence` writes cache state to disk (directory configurable via `CACHE_DIRECTORY`, default `.mcp-cache`)

---

*Architecture analysis: 2026-11-02*
