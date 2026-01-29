# External Integrations

**Analysis Date:** 2026-01-29

## APIs & External Services

**GitHub API:**
- Primary external integration for all project management operations
- SDK/Client: `@octokit/rest` ^22.0.0
- Auth: `GITHUB_TOKEN` environment variable
- Scopes required: repo, project, workflow, write:org, admin:org
- Both REST and GraphQL APIs used
- Factory: `src/infrastructure/github/GitHubRepositoryFactory.ts`
- Config: `src/infrastructure/github/GitHubConfig.ts`

**Anthropic (Claude):**
- AI model provider for task generation, PRD parsing, and analysis
- SDK/Client: `@ai-sdk/anthropic` ^1.2.12
- Auth: `ANTHROPIC_API_KEY` environment variable
- Models: claude-3-5-sonnet-20241022 (default main/prd model)
- Factory: `src/services/ai/AIServiceFactory.ts`

**OpenAI:**
- AI model provider (fallback)
- SDK/Client: `@ai-sdk/openai` ^1.3.22
- Auth: `OPENAI_API_KEY` environment variable
- Models: gpt-4o (default fallback model)
- Factory: `src/services/ai/AIServiceFactory.ts`

**Google AI:**
- AI model provider (alternative)
- SDK/Client: `@ai-sdk/google` ^1.2.18
- Auth: `GOOGLE_API_KEY` environment variable
- Models: gemini-* models
- Factory: `src/services/ai/AIServiceFactory.ts`

**Perplexity:**
- AI model provider specialized for research/web search
- SDK/Client: `@ai-sdk/perplexity` ^1.1.9
- Auth: `PERPLEXITY_API_KEY` environment variable
- Models: perplexity-llama-3.1-sonar-large-128k-online (default research model)
- Factory: `src/services/ai/AIServiceFactory.ts`

## Data Storage

**Databases:**
- None - No external database required

**File Storage:**
- Local filesystem for cache and persistence
- Directory: `.mcp-cache/` (configurable via `CACHE_DIRECTORY`)
- Implementation: `src/infrastructure/persistence/FilePersistenceAdapter.ts`
- Features: Atomic writes, compression (gzip), backup rotation

**Caching:**
- In-memory resource cache
- Implementation: `src/infrastructure/cache/ResourceCache.ts`
- Options: TTL, max entries, prefix-based grouping

## Authentication & Identity

**Auth Provider:**
- GitHub Personal Access Token (PAT) for GitHub API
- Implementation: Token passed to Octokit client
- No OAuth flow - direct token authentication

**AI Provider Auth:**
- API keys for each AI provider
- Keys validated at startup via `AIServiceFactory.validateConfiguration()`

## Monitoring & Observability

**Error Tracking:**
- None (external service)
- Internal error handling via `src/infrastructure/github/GitHubErrorHandler.ts`
- MCP errors via `src/infrastructure/mcp/MCPErrorHandler.ts`

**Logs:**
- Custom logger to stderr (avoids MCP protocol on stdout)
- Implementation: `src/infrastructure/logger/index.ts`
- Singleton pattern: `Logger.getInstance()`
- Levels: debug, info, warn, error

## CI/CD & Deployment

**Hosting:**
- npm registry (public package)
- Package name: `mcp-github-project-manager`

**CI Pipeline:**
- Not detected in codebase (likely GitHub Actions external)
- Test scripts available: `npm test`, `npm run test:e2e`

## Environment Configuration

**Required env vars:**
- `GITHUB_TOKEN` - GitHub PAT with full repo/project access
- `GITHUB_OWNER` - Repository owner (user or org)
- `GITHUB_REPO` - Repository name

**AI env vars (at least one required):**
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `PERPLEXITY_API_KEY`

**Sync/Cache env vars:**
- `SYNC_ENABLED` - Enable GitHub state sync (default: true)
- `SYNC_TIMEOUT_MS` - Sync timeout (default: 30000)
- `CACHE_DIRECTORY` - Cache location (default: .mcp-cache)

**Webhook env vars:**
- `WEBHOOK_SECRET` - GitHub webhook secret
- `WEBHOOK_PORT` - Webhook server port (default: 3001)
- `SSE_ENABLED` - Server-Sent Events (default: true)

**Secrets location:**
- `.env` file in project root (not committed)
- `.env.example` provides template
- CLI args can override (--token, --owner, --repo)

## Webhooks & Callbacks

**Incoming:**
- `/webhooks/github` - Receives GitHub webhooks (POST)
- `/events/stream` - SSE endpoint for real-time events (GET)
- `/events/subscribe` - Create event subscription (POST)
- `/events/subscribe/:id` - Delete subscription (DELETE)
- `/events/replay/:timestamp` - Replay events from timestamp (GET)
- `/events/recent` - Get recent events (GET)
- `/health` - Health check endpoint (GET)
- Implementation: `src/infrastructure/http/WebhookServer.ts`

**Outgoing:**
- None detected (no outbound webhook calls)

## MCP Protocol Integration

**Transport:**
- stdio (stdin/stdout) for MCP communication
- Implementation: `@modelcontextprotocol/sdk/server/stdio.js`
- Entry point: `src/index.ts`

**Tools Exposed:**
- GitHub project management tools (create/update projects, issues, milestones)
- AI task tools (parse PRD, generate tasks, analyze complexity)
- Tool definitions: `src/infrastructure/tools/ToolSchemas.ts`
- Tool registry: `src/infrastructure/tools/ToolRegistry.ts`

## GitHub API Operations

**REST API Usage:**
- Issues: CRUD operations via `src/infrastructure/github/repositories/GitHubIssueRepository.ts`
- Milestones: CRUD via `src/infrastructure/github/repositories/GitHubMilestoneRepository.ts`
- Sprints: Management via `src/infrastructure/github/repositories/GitHubSprintRepository.ts`

**GraphQL API Usage:**
- Projects V2: Full project management via `src/infrastructure/github/repositories/GitHubProjectRepository.ts`
- Custom fields, views, items
- Automation rules via `src/infrastructure/github/repositories/GitHubAutomationRuleRepository.ts`

## AI Service Architecture

**Factory Pattern:**
- Singleton: `AIServiceFactory.getInstance()`
- Location: `src/services/ai/AIServiceFactory.ts`
- Provider detection from model name prefix (claude-, gpt-, gemini-, perplexity/llama/sonar)

**Model Types:**
- `main` - General task generation
- `research` - Enhanced analysis with web search
- `fallback` - Backup when main fails
- `prd` - PRD generation/parsing

**Fallback Logic:**
- `getBestAvailableModel()` tries: main -> fallback -> prd -> research

---

*Integration audit: 2026-01-29*
