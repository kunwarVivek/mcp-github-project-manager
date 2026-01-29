# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Layered Service Architecture with MCP Protocol Integration

**Key Characteristics:**
- MCP (Model Context Protocol) server exposing tools via stdio transport
- Repository pattern for GitHub API abstraction (GraphQL + REST)
- Service layer coordinating business logic and AI-powered automation
- Factory patterns for dependency injection (AIServiceFactory, GitHubRepositoryFactory)
- Singleton patterns for shared infrastructure (ResourceCache, Logger, ToolRegistry)
- Event-driven architecture for webhook handling and state sync

## Layers

**Entry Point (MCP Server):**
- Purpose: Bootstrap MCP server, register tools, handle protocol requests
- Location: `src/index.ts`
- Contains: `GitHubProjectManagerServer` class orchestrating all components
- Depends on: Services, Infrastructure, Domain types
- Used by: MCP clients (Claude Desktop, etc.)

**Domain Layer:**
- Purpose: Define types, schemas, errors, and business entities
- Location: `src/domain/`
- Contains: Type definitions, Zod schemas, error classes, resource types
- Depends on: Nothing (pure types)
- Used by: All other layers

**Services Layer:**
- Purpose: Business logic orchestration, AI task processing, state management
- Location: `src/services/`
- Contains: ProjectManagementService, TaskGenerationService, AI automation services
- Depends on: Infrastructure (repositories, AI), Domain types
- Used by: MCP tools, entry point

**Infrastructure Layer:**
- Purpose: External integrations, persistence, caching, MCP protocol handling
- Location: `src/infrastructure/`
- Contains: GitHub repositories, cache, events, MCP formatters, tools
- Depends on: Domain types, external SDKs (Octokit, Vercel AI SDK)
- Used by: Services layer, entry point

## Data Flow

**MCP Tool Execution:**

1. MCP client sends `call_tool` request via stdio transport
2. `GitHubProjectManagerServer.setupToolHandlers()` receives request
3. `ToolRegistry.getTool()` retrieves tool definition
4. `ToolValidator.validate()` validates arguments against Zod schema
5. `executeToolHandler()` dispatches to appropriate service method
6. Service orchestrates GitHub API calls via repositories
7. `ToolResultFormatter.formatSuccess()` creates MCP response
8. Response sent back to client

**AI Task Generation (parse_prd tool):**

1. PRD content received via `ParsePRDTool`
2. `TaskGenerationService.generateEnhancedTasksFromPRD()` orchestrates
3. `PRDGenerationService.extractFeaturesFromPRD()` parses PRD
4. `AITaskProcessor` uses Vercel AI SDK for LLM calls
5. `RequirementsTraceabilityService` creates traceability matrix
6. Enhanced tasks returned with context and dependencies

**GitHub Operations:**

1. Service method called (e.g., `createIssue`)
2. `GitHubRepositoryFactory` creates appropriate repository
3. Repository uses `BaseGitHubRepository.withRetry()` for resilience
4. GraphQL or REST API called via Octokit
5. `GitHubTypeConverter` transforms response to domain types
6. Result cached in `ResourceCache`
7. Event emitted to `EventStore`

**State Management:**
- `ResourceCache` (singleton): In-memory cache with TTL, tag indexing, namespace support
- `FilePersistenceAdapter`: File-based persistence with compression, atomic writes, backup recovery
- `GitHubStateSyncService`: Periodic sync between cache and GitHub API
- `EventStore`: Event sourcing for audit trail

## Key Abstractions

**GitHubRepositoryFactory:**
- Purpose: Create GitHub repository instances with shared Octokit config
- Examples: `src/infrastructure/github/GitHubRepositoryFactory.ts`
- Pattern: Factory method for `GitHubIssueRepository`, `GitHubProjectRepository`, etc.

**BaseGitHubRepository:**
- Purpose: Common GitHub API interaction patterns
- Examples: `src/infrastructure/github/repositories/BaseGitHubRepository.ts`
- Pattern: Template method with retry logic, error handling, GraphQL/REST helpers

**ToolRegistry:**
- Purpose: Central registry of all MCP tools
- Examples: `src/infrastructure/tools/ToolRegistry.ts`
- Pattern: Singleton with tool registration, retrieval, MCP format conversion

**AIServiceFactory:**
- Purpose: Create AI model instances for different providers
- Examples: `src/services/ai/AIServiceFactory.ts`
- Pattern: Singleton factory supporting Anthropic, OpenAI, Google, Perplexity

**Resource Types:**
- Purpose: Unified resource model for all entities
- Examples: `src/domain/resource-types.ts`
- Pattern: Base `Resource` interface with `ResourceType` enum, status, versioning

## Entry Points

**MCP Server (`src/index.ts`):**
- Location: `src/index.ts`
- Triggers: `node build/index.js` or MCP client connection
- Responsibilities:
  - Initialize all infrastructure (cache, persistence, events)
  - Create `ProjectManagementService` with GitHub credentials
  - Initialize AI automation services
  - Register MCP request handlers
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
5. Entry point converts to `McpError` for protocol response

**Retry Pattern:**
- `BaseGitHubRepository.withRetry()`: 3 attempts with exponential backoff
- Respects `Retry-After` header for rate limits
- Non-retryable errors throw immediately

## Cross-Cutting Concerns

**Logging:**
- Singleton `Logger` class (`src/infrastructure/logger/index.ts`)
- Writes to stderr to avoid MCP stdout protocol interference
- Log levels: debug, info, warn, error

**Validation:**
- Zod schemas in `src/domain/resource-schemas.ts`
- `ToolValidator` validates tool arguments
- Services validate input with Zod before operations

**Authentication:**
- GitHub token passed via CLI args or `GITHUB_TOKEN` env var
- Token stored in `GitHubConfig` and passed to repositories
- AI API keys configured via environment variables

**Caching:**
- `ResourceCache.getInstance()` provides shared cache
- TTL-based expiration (default 1 hour)
- Tag and namespace indexing for efficient invalidation
- Type indexing for bulk operations

---

*Architecture analysis: 2026-01-29*
