# Architecture

**Analysis Date:** 2026-10-21

**Updated:** 2026-10-21 — rewritten for MCP SDK v2 (per-tool `registerTool`, shared `dispatchTool`, `isError` results), zod 4 JSON Schema generation, tsyringe container wiring, and the current credential chain.

## Pattern Overview

**Overall:** Layered Service Architecture with MCP Protocol Integration

**Key Characteristics:**
- MCP (Model Context Protocol) server exposing tools via stdio transport, on `@modelcontextprotocol/server` v2 (2026-07-28 spec)
- Repository pattern for GitHub API abstraction (GraphQL + REST)
- Service layer coordinating business logic and AI-powered automation
- tsyringe dependency injection (`src/container.ts`) with factory + singleton registrations
- Factory patterns for GitHub access (`GitHubRepositoryFactory`, `createGitHubFactory`)
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
- Wires `ToolRegistry` + `ProjectManagementService` through `src/container.ts` (tsyringe DI)

**Domain Layer:**
- Purpose: Define types, schemas, errors, and business entities — **no logic**
- Location: `src/domain/`
- Contains: Type definitions, Zod 4 schemas, error classes, entities, value objects, domain events
- Depends on: Nothing (pure types)
- Used by: All other layers

**Services Layer:**
- Purpose: Business logic orchestration, AI task processing, state management
- Location: `src/services/`
- Contains: ProjectManagementService (facade), IssueService, MilestoneService, SprintPlanningService, TaskGenerationService, agent orchestration services
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
4. The handler calls the single shared `dispatchTool(toolName, args)`, which carries the shutdown gate, in-flight tracking, telemetry, agent-budget metering, and result formatting
5. `dispatchTool` looks the tool up in `ToolRegistry`, validates arguments with `ToolValidator`, and executes it inside a correlation trace context
6. The service orchestrates GitHub API calls via repositories
7. `ToolResultFormatter.formatSuccess()` shapes the result; `structuredContent` is emitted only when the tool declares an `outputSchema`
8. Response is sent back to the client

**Tool failure convention:**
- An execution failure returns `{content, isError: true}` — the call succeeded at the protocol level and the model can read the failure and recover
- A JSON-RPC error (`ProtocolError`) is reserved for **protocol faults**: unknown tool, malformed request, server shutting down
- MCP v2 renamed `McpError` → `ProtocolError` (same `(code, message, data)` shape) and replaced the `ErrorCode` enum with plain numeric constants; `src/index.ts` keeps compatibility aliases so existing throw sites are unchanged

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
3. Repository uses `BaseGitHubRepository.withRetry()` for resilience
4. GraphQL or REST API called via Octokit
5. `GitHubTypeConverter` transforms the response to domain types
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
- Purpose: Wire services and infrastructure into one dependency graph
- Examples: `src/container.ts`
- Pattern: `configureContainer(token, owner, repo)` registers the factory, the logger, and every service; `createProjectManagementService(...)` remains available for direct instantiation

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
3. `BaseGitHubRepository.withRetry()` retries transient errors
4. Service catches and maps to MCP error codes via `mapErrorToMCPError()`
5. `dispatchTool` converts to a `ProtocolError` (protocol faults) or an `{isError: true}` tool result (execution failures)

**Retry Pattern:**
- `BaseGitHubRepository.withRetry()`: 3 attempts with exponential backoff
- Respects `Retry-After` header for rate limits
- Non-retryable errors throw immediately
- `src/infrastructure/resilience/` adds a circuit breaker and an AI resilience policy on top

## Cross-Cutting Concerns

**Logging:**
- Singleton `Logger` class (`src/infrastructure/logger/index.ts`)
- Writes to stderr to avoid MCP stdout protocol interference
- Log levels: debug, info, warn, error
- `redactSecrets()` strips token/secret/password/apiKey/authorization-shaped keys from anything the logger stringifies

**Validation:**
- Zod 4 schemas in `src/domain/resource-schemas.ts`
- `ToolValidator` validates tool arguments (SDK v2 has already checked the declared schema by this point)
- Services validate input with Zod before operations
- Startup config validation runs against the **resolved** environment, so a token supplied by file or CLI flag satisfies the required-field check

**Authentication:**
- Credentials resolve through `getSecret()` / `requireToken()`: CLI flag → `$SECRETS_DIR` file → env var → `gh auth token`
- GitHub App installation auth (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`) outranks the PAT when fully configured; a partial App config falls back to the PAT
- `process.env.GITHUB_TOKEN` is never read directly
- AI API keys configured via environment variables (with per-role overrides)

**Observability:**
- `CorrelationContext` provides a correlation id and an `AsyncLocalStorage` scope that AI middleware and the dispatcher both use
- `ToolTelemetry` records per-tool call latency and error counts
- `SecurityAuditLog` records security-relevant events

**Caching:**
- `ResourceCache.getInstance()` provides shared cache
- TTL-based expiration, tag and namespace indexing for efficient invalidation
- `CachePersistence` writes cache state to disk (directory configurable via `CACHE_DIRECTORY`, default `.mcp-cache`)

---

*Architecture analysis: 2026-10-21*
