# External Integrations

**Analysis Date:** 2026-11-02

**Updated:** 2026-11-02 — reconciled with code: dependency versions from `package.json`, one `GitHubRequestExecutor` with proactive rate-limit budgeting, mutation audit log + opt-in OpenTelemetry, webhook hardening, CI supply-chain gates; removed deleted modules (`MCPErrorHandler`, `TracingLogger`).

## APIs & External Services

**GitHub API:**
- Primary external integration for all project management operations
- SDK/Client: `@octokit/rest` ^22.0.1 (REST + GraphQL)
- App auth: `@octokit/auth-app` ^8.3.1
- Auth: resolved through the credential chain (see *Authentication & Identity*)
- Scopes required: repo, project, workflow, write:org
- Factory: `src/infrastructure/github/GitHubRepositoryFactory.ts` (infrastructure) and `createGitHubFactory()` in `src/infrastructure/tools/tool-factory.ts` (tool layer)
- Config: `src/infrastructure/github/GitHubConfig.ts` — `token` is non-enumerable so `JSON.stringify` cannot emit the PAT
- Rate limiting: every REST/GraphQL call goes through `src/infrastructure/github/GitHubRequestExecutor.ts`, which gates on `RateLimitManager` (`RATE_LIMIT_FLOOR`, default 100: backs off before the budget is exhausted) and retries retryable failures

**MCP (Model Context Protocol):**
- SDK: `@modelcontextprotocol/server` ^2.3.1 — MCP **v2**, 2026-07-28 spec
- Client SDK (dev/test): `@modelcontextprotocol/client` ^2.3.1
- Transport: stdio, via `serveStdio` from `@modelcontextprotocol/server/stdio`; the protocol revision is negotiated per connection
- Tools are registered individually with `server.registerTool(...)`; every tool shares one `dispatchTool` in `src/index.ts`
- Migration record: `docs/adr/003-mcp-sdk-v2-migration.md`

**Anthropic (Claude):**
- AI model provider for task generation, PRD parsing, and analysis
- SDK/Client: `@ai-sdk/anthropic` ^4.0.85
- Auth: `ANTHROPIC_API_KEY` environment variable
- Factory: `src/services/ai/AIServiceFactory.ts`

**OpenAI:**
- AI model provider (fallback)
- SDK/Client: `@ai-sdk/openai` ^4.0.99
- Auth: `OPENAI_API_KEY` environment variable
- Factory: `src/services/ai/AIServiceFactory.ts`

**Google AI:**
- AI model provider (alternative)
- SDK/Client: `@ai-sdk/google` ^4.0.102
- Auth: `GOOGLE_API_KEY` environment variable
- Factory: `src/services/ai/AIServiceFactory.ts`

**Perplexity:**
- AI model provider specialized for research/web search
- SDK/Client: `@ai-sdk/perplexity` ^5.0.17
- Auth: `PERPLEXITY_API_KEY` environment variable
- Factory: `src/services/ai/AIServiceFactory.ts`

**AI SDK core:**
- `ai` ^7.0.148 — unified model interface, streaming, structured output
- `@ai-sdk/provider` `4.0.31` — pinned exact, a **direct** dependency (type imports only; `ai`@7 does not re-export `LanguageModelV4*` and pnpm does not hoist transitives)
- Usage is reported as **objects**: `usage.inputTokens.total` / `usage.outputTokens.total` — reading them as numbers yields `NaN`

## Data Storage

**Databases:**
- None - No external database required

**File Storage:**
- Local filesystem for cache and persistence
- Directory: `.mcp-cache/` (configurable via `CACHE_DIRECTORY`)
- Implementation: `src/infrastructure/persistence/FilePersistenceAdapter.ts`
- Features: Atomic writes, compression (gzip), backup rotation
- Cache persistence: `src/infrastructure/cache/CachePersistence.ts`

**Caching:**
- In-memory resource cache
- Implementation: `src/infrastructure/cache/ResourceCache.ts`
- Options: TTL, max entries, prefix-based grouping

## Authentication & Identity

**GitHub credential chain (first hit wins; `resolveGitHubAuth()`):**
1. GitHub App installation auth (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`; see below)
2. `--token` CLI flag
3. `$SECRETS_DIR/GITHUB_TOKEN` file (Docker/Kubernetes secret convention)
4. `GITHUB_TOKEN` environment variable
5. Stored OAuth login (`auth login`)
6. `gh auth token` (an authenticated GitHub CLI) — disable with `GH_CLI_TOKEN_FALLBACK=false`; it is off automatically under `NODE_ENV=test`, so tests never shell out

GitHub credentials resolve only through `resolveGitHubAuth()` (`src/infrastructure/github/auth/`), which returns a `GitHubAuth`; `createGitHubFactory()` (`src/infrastructure/tools/tool-factory.ts`) resolves one per call. Other secrets go through `getSecret()` in `src/env.ts`. Reading `process.env.GITHUB_TOKEN` directly bypasses the chain and is the reason `SECRETS_DIR` and `--token` were previously broken.

**GitHub App auth (optional):**
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`
- When all three are set, App installation auth **outranks** the PAT and no PAT is needed
- A partial App configuration falls through to the next credential tier rather than failing, so a half-set environment cannot lock the server out

**Secret providers:**
- `SecretProvider` interface (`src/infrastructure/secrets/SecretProvider.ts`) with `EnvSecretProvider`, `FileSecretProvider`, and `GhCliSecretProvider`
- Extension point for Vault / AWS Secrets Manager: implement `SecretProvider` and unshift it onto the chain (their SDKs are async, so cache values synchronously at startup)
- `getSecret()` reads fresh on every call, so a rotated mounted file is picked up

**AI Provider Auth:**
- API keys for each AI provider, with per-role overrides (`AI_<ROLE>_PROVIDER`, `AI_<ROLE>_API_KEY`, `AI_<ROLE>_BASE_URL`)
- The `openai-compatible` provider type works with any OpenAI-protocol endpoint (OpenRouter, Together, Groq, Ollama, LM Studio, Azure OpenAI, …)
- Zero-config fallback: when the MCP client declares sampling capability, the client's own LLM is registered as the last-resort model (`AIServiceFactory.setSamplingProvider`)

## Monitoring & Observability

**Error Tracking:**
- None (external service)
- Internal error handling via `src/infrastructure/github/GitHubErrorHandler.ts` and `src/services/utils/ErrorMapper.ts`
- Tool failures are returned as `isError` results by `ToolDispatcher` (`src/infrastructure/mcp/ToolDispatcher.ts`)
- Per-tool latency/error telemetry via `src/infrastructure/tools/ToolTelemetry.ts`

**Correlation & Tracing:**
- `src/infrastructure/observability/CorrelationContext.ts` — correlation id + `AsyncLocalStorage` scope
- `src/infrastructure/observability/SecurityAuditLog.ts`
- `src/infrastructure/observability/MutationAuditLog.ts` — opt-in (`AUDIT_LOG_ENABLED`) append-only redacted JSONL of state-changing tool calls (`AUDIT_LOG_PATH`, default `.mcp-audit/mutations.jsonl`)
- `src/infrastructure/observability/otel.ts` — opt-in OpenTelemetry: when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, one `tool.<name>` span per tool call is exported over OTLP/HTTP (`OTEL_SERVICE_NAME`); flushed in graceful shutdown

**Logs:**
- Custom logger to stderr (avoids MCP protocol on stdout)
- Implementation: `src/infrastructure/logger/index.ts`
- Singleton pattern: `Logger.getInstance()`
- Levels: debug, info, warn, error; `LOG_FORMAT` (`text`|`json`) and `LOG_LEVEL` are configurable
- Secrets are redacted by `redactSecrets()`

## CI/CD & Deployment

**Hosting:**
- npm registry (public package)
- Package name: `mcp-github-project-manager`

**CI Pipeline:**
- GitHub Actions: `.github/workflows/ci.yml` (plus `bump-version.yml`, `release.yml`, `codeql.yml`); `.github/dependabot.yml` (weekly npm + github-actions updates)
- `test` job: Node `22.x` and `24.x` × package manager `npm` and `pnpm` — the npm×pnpm matrix is what catches a dependency that only resolves under one of them; steps: install → `build` → `typecheck` → `test`
- `action-sweep` job: every action of every tool without credentials (`test:e2e:sweep`, `test:e2e:coverage`)
- `lint` job (Node 24): `pnpm run lint`, `check:lockfiles` (lockfiles resolve the same direct-dependency versions), `check:docs` (published tool/action counts equal the `ToolRegistry`)
- `audit` job: `npm audit --audit-level=high`; `codeql.yml` runs CodeQL analysis
- `release.yml` publishes a CycloneDX SBOM (`sbom.cdx.json`) as a release asset
- pnpm is pinned to version 12 in CI; `package.json` deliberately has no `packageManager` field

**Docker:**
- Multi-stage `Dockerfile` on `node:24-slim`
- Builder stage: `npm ci --ignore-scripts` from `package-lock.json`, then `npm run build`
- Runtime stage: `npm ci --omit=dev --ignore-scripts`, copies `build/`, runs as the non-root user `mcpuser`
- `docker-compose.yml` provides a local compose setup

## Environment Configuration

**Required env vars:**
- `GITHUB_TOKEN` - GitHub PAT with full repo/project access (unless GitHub App auth is used)
- `GITHUB_OWNER` - Repository owner (user or org)
- `GITHUB_REPO` - Repository name

**AI env vars (at least one required for hosted AI features):**
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY`
- `PERPLEXITY_API_KEY`

**Sync/Cache env vars:**
- `SYNC_ENABLED` - Enable GitHub state sync (default: true)
- `SYNC_TIMEOUT_MS` - Sync timeout (default: 30000)
- `SYNC_INTERVAL_MS` - Sync interval (default: 0 = disabled)
- `CACHE_DIRECTORY` - Cache location (default: `.mcp-cache`)

**Webhook env vars:**
- `WEBHOOK_SECRET` - GitHub webhook secret
- `WEBHOOK_ALLOW_UNSIGNED` - Accept unsigned webhooks (default: `false`; signature validation fails closed)
- `WEBHOOK_HOST` - Bind address (default `127.0.0.1`; `0.0.0.0` to expose)
- `WEBHOOK_PORT` - Webhook server port (default: 3001)
- `EVENTS_AUTH_TOKEN` - bearer token required on `/events/*` (or `EVENTS_ALLOW_UNAUTHENTICATED=true`, dev only)
- `WEBHOOK_TRUSTED_PROXIES` - exact proxy IPs whose `X-Forwarded-For` is trusted for rate-limit keying (default: none)
- `WEBHOOK_TIMEOUT_MS`, `WEBHOOK_ALLOWED_ORIGINS`, `WEBHOOK_RATE_LIMIT`, `WEBHOOK_RATE_WINDOW_MS`
- `SSE_ENABLED` - Server-Sent Events (default: true)
- `EVENT_RETENTION_DAYS` (default: 7), `MAX_EVENTS_IN_MEMORY` (default: 1000)

**Observability / limits env vars:**
- `RATE_LIMIT_FLOOR` (default 100), `AUDIT_LOG_ENABLED` (default false), `AUDIT_LOG_PATH`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `LOG_LEVEL`, `LOG_FORMAT`, `AI_SESSION_TOKEN_LIMIT`

**Agent env vars:**
- `AGENT_RECLAIM_ENABLED` (default: true), `AGENT_RECLAIM_INTERVAL_MS` (default: 300000), `AGENT_STALE_AFTER_MINUTES` (default: 30)

**Tool exposure:**
- `MCP_TOOL_GROUPS` - `all` (default) or a comma-separated list of: core, ai, agents, events, system

**Secrets location:**
- `.env` file in project root (not committed) — `.env.example` provides the template
- `$SECRETS_DIR` file-mounted secrets (checked before env vars)
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
- Implementation: `src/infrastructure/http/WebhookServer.ts`, backed by `src/infrastructure/health/HealthService.ts`

**Outgoing:**
- OpenTelemetry OTLP/HTTP trace export to `OTEL_EXPORTER_OTLP_ENDPOINT`, only when configured

## MCP Protocol Integration

**Transport:**
- stdio (stdin/stdout) for MCP communication
- Implementation: `serveStdio` from `@modelcontextprotocol/server/stdio`
- Entry point: `src/index.ts`

**Tools Exposed:**
- GitHub project management tools (create/update projects, issues, milestones, sprints, iterations, labels, status updates, PRs, branches, releases, workflows)
- AI task tools (parse PRD, generate tasks, analyze complexity, issue intelligence, roadmap/sprint AI)
- Agent swarm orchestration tools (register, checkout, submit, budget, metrics)
- Compound tools (manage issues, milestones, sprints, PRs, branches, releases, workflows, events, automations, system)
- Tool definitions: `src/infrastructure/tools/ToolSchemas.ts` and the `*-tools.ts` modules
- Tool registry: `src/infrastructure/tools/ToolRegistry.ts`
- Each tool's JSON Schema is generated by zod 4's native `z.toJSONSchema(schema, { io: 'input' })`; no separate JSON-Schema conversion package is used

**MCP Resources & Prompts:**
- Read-only resources: `src/infrastructure/mcp/resources.ts`
- Prompt templates: `src/infrastructure/mcp/prompts.ts`

## GitHub API Operations

**REST API Usage:**
- Issues: CRUD operations via `src/infrastructure/github/repositories/GitHubIssueRepository.ts`
- Milestones: CRUD via `src/infrastructure/github/repositories/GitHubMilestoneRepository.ts`
- Sprints: Management via `src/infrastructure/github/repositories/GitHubSprintRepository.ts`
- Pull requests, status updates, sub-issues: dedicated repositories under `src/infrastructure/github/repositories/`

**GraphQL API Usage:**
- Projects V2: Full project management via `src/infrastructure/github/repositories/GitHubProjectRepository.ts`
- Custom fields, views, items
- Automation rules via `src/infrastructure/github/repositories/GitHubAutomationRuleRepository.ts`

## AI Service Architecture

**Factory Pattern:**
- Singleton: `AIServiceFactory.getInstance(logger)`
- Location: `src/services/ai/AIServiceFactory.ts`
- Provider detection from model name prefix (claude-, gpt-/o1/o3, gemini-, perplexity/sonar/llama)

**Model Types:**
- `main` - General task generation
- `research` - Enhanced analysis with web search
- `fallback` - Backup when main fails
- `prd` - PRD generation/parsing

**Fallback Logic:**
- `getBestAvailableModel()` tries: main → fallback → prd → research → MCP sampling (client's own LLM)

---

*Integration audit: 2026-11-02*
