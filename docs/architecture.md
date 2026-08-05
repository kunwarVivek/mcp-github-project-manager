# Architecture

MCP GitHub Project Manager follows Clean Architecture principles with clear separation of concerns.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         MCP Layer                                │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ Tool Defs    │ │ Resources  │ │ Req Handling  │ │ Graceful  │ │
│  │ (118 tools)  │ │            │ │              │ │ Shutdown  │ │
│  └──────────────┘ └────────────┘ └──────────────┘ └───────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                       Service Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ ProjectMgmt  │ │ AI Services  │ │  Planning    │ │ Sync    │ │
│  │ Facade       │ │ (PRD, Tasks, │ │  Services    │ │         │ │
│  │              │ │  Triage …)   │ │              │ │         │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                           │
│  ┌────────────┐ ┌────────┐ ┌────────────┐ ┌──────────┐          │
│  │ GitHub API │ │ Cache  │ │ Resilience │ │ Rate     │          │
│  │ Repos      │ │ & Pers.│ │ (CB/Retry) │ │ Limiting │          │
│  ├────────────┤ ├────────┤ ├────────────┤ ├──────────┤          │
│  │ Events/SSE │ │ Health │ │ Lifecycle  │ │ Logging  │          │
│  │ & Webhooks │ │        │ │ & Shutdown │ │ (struct) │          │
│  └────────────┘ └────────┘ └────────────┘ └──────────┘          │
├──────────────────────────────────────────────────────────────────┤
│                       Domain Layer                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Entities   │ │ Interfaces │ │ Zod Schemas│ │ AI Type      │  │
│  │ & Types    │ │ (Repos)    │ │            │ │ System       │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Layer Structure

### Domain Layer (`src/domain/`)

Core business entities, type definitions, validation schemas, and repository interfaces.
21 files grouped by concern:

**Core types**

| File | Purpose |
|------|---------|
| `types.ts` | Core entities (Issue, Milestone, Sprint, Project) and repository interfaces (`IssueRepository`, `MilestoneRepository`, `SprintRepository`, `ProjectRepository`) |
| `errors.ts` | Domain-specific error types (`DomainError`, `ValidationError`, `NotFoundError`, `ConflictError`) |
| `project-types.ts` | Extended project entity types and creation DTOs |
| `resource-types.ts` | Cached-resource metadata, staleness, and sync-state types |
| `mcp-types.ts` | MCP tool/resource descriptor types and request/response shapes |

**AI types**

| File | Purpose |
|------|---------|
| `ai-types.ts` | Barrel re-export for all AI-related types |
| `ai-task-types.ts` | AI task generation parameters, results, and batch types |
| `prd-types.ts` | PRD generation/enhancement request and response types |
| `traceability-types.ts` | Requirements traceability matrix, coverage, and trace-link types |
| `feature-lifecycle-types.ts` | Feature lifecycle stages, transitions, and status-tracking types |
| `confidence-types.ts` | AI confidence scoring types and calibration thresholds |
| `task-generation-config-types.ts` | Enhanced task generation configuration and defaults |

**Domain-specific**

| File | Purpose |
|------|---------|
| `sprint-planning-types.ts` | Sprint capacity, velocity, risk, and planning types |
| `roadmap-planning-types.ts` | Roadmap themes, milestones, and AI planning types |
| `issue-intelligence-types.ts` | Issue triage, enrichment, label suggestions, and duplicate detection types |
| `automation-types.ts` | Project automation rule definitions and trigger types |
| `template-types.ts` | Project template descriptors and field/view definitions |
| `task-context-schemas.ts` | Zod schemas for rich task-context payloads (business, technical, implementation) |

**Validation**

| File | Purpose |
|------|---------|
| `resource-schemas.ts` | Zod schemas for issue, milestone, project, and sprint validation |
| `type-guards.ts` | Runtime type-guard functions for domain entities |
| `config-schema.ts` | Zod schemas for server configuration; validates env vars at startup |

### Infrastructure Layer (`src/infrastructure/`)

External integrations and technical concerns. 15 subdirectories:

| Directory | Purpose |
|-----------|---------|
| `github/` | GitHub REST/GraphQL API integration — repositories, `GitHubRepositoryFactory`, `RateLimitManager`, error handling |
| `tools/` | MCP tool definitions (118 tools — 119 registrations, 1 intentional overwrite), `ToolRegistry`, `ToolValidator`, schemas |
| `cache/` | In-memory caching with TTL and LRU eviction (`ResourceCache`), persistence adapter |
| `resilience/` | Circuit breaker (`CircuitBreakerService`), retry policies, `AIResiliencePolicy` |
| `events/` | Webhook handling (`GitHubWebhookHandler`), `EventStore` with persistence, `EventSubscriptionManager` |
| `health/` | Health check endpoints (`HealthService`) |
| `lifecycle/` | `GracefulShutdown` — tracks in-flight requests, drains on SIGTERM/SIGINT, force-exits after timeout |
| `logger/` | `StructuredLogger` (JSON or text to stderr), log-level filtering |
| `persistence/` | `FilePersistenceAdapter` for durable cache/event state |
| `secrets/` | `SecretProvider` — layered secret resolution (file-mounted → env var); Vault/AWS SM extension point |
| `mcp/` | `MCPResponseFormatter`, `MCPErrorHandler` — MCP protocol response/error shaping |
| `validation/` | `ValidationRuleEngine`, `PRDValidator`, pluggable rule definitions |
| `resource/` | `ResourceFactory`, `ResourceManager`, `ResourceRelationshipManager`, `OptimisticLockManager` |
| `observability/` | `CorrelationContext` (request tracing), `TracingLogger` |
| `http/` | `WebhookServer` — HTTP server for incoming webhooks and SSE connections |

### Service Layer (`src/services/`)

Business logic coordination. 23 top-level services plus supporting subdirectories.

`ProjectManagementService` is a thin facade that delegates to focused,
independently-testable services:

**Facade**

| Service | Responsibility |
|---------|----------------|
| `ProjectManagementService` | Facade — delegates to all services below |

**Core CRUD**

| Service | Responsibility |
|---------|----------------|
| `IssueService` | Issue CRUD, comments, Projects v2 draft issues |
| `PullRequestService` | PR listing with filtering |
| `MilestoneService` | Milestone CRUD and metrics |
| `LabelService` | Label CRUD |

**Project management**

| Service | Responsibility |
|---------|----------------|
| `ProjectStatusService` | Project CRUD |
| `ProjectTemplateService` | Template + field/view management |
| `ProjectLinkingService` | Project item / repo / team linking |
| `ProjectAutomationService` | Automation-rule management |

**Field / View / Item**

| Service | Responsibility |
|---------|----------------|
| `FieldValueService` | Project field-value reads and writes |
| `IterationService` | Iteration (sprint) field management |

**Planning**

| Service | Responsibility |
|---------|----------------|
| `SprintPlanningService` | Sprint planning and capacity |
| `RoadmapService` | Full-roadmap creation (project + milestones + issues) |
| `RoadmapPlanningService` | AI roadmap/milestone planning |

**Hierarchy**

| Service | Responsibility |
|---------|----------------|
| `SubIssueService` | Hierarchical issue dependencies |

**AI-powered**

| Service | Responsibility |
|---------|----------------|
| `PRDGenerationService` | AI-powered PRD generation and enhancement |
| `TaskGenerationService` | Task breakdown, estimation, and enhanced generation |
| `TaskContextGenerationService` | Rich context generation (business, technical, implementation) for tasks |
| `IssueTriagingService` | AI-powered issue triage and prioritisation |
| `IssueEnrichmentService` | AI-powered issue enrichment with labels, estimates, descriptions |
| `FeatureManagementService` | Feature lifecycle tracking and management |
| `RequirementsTraceabilityService` | Requirements traceability matrices and coverage analysis |

**Sync**

| Service | Responsibility |
|---------|----------------|
| `GitHubStateSyncService` | Background state synchronisation with GitHub |

**Subdirectories**

| Directory | Contents |
|-----------|----------|
| `ai/` | 14 files — `AIServiceFactory`, `AITaskProcessor`, `TokenCounter`, `AIResponseCache`, `ConfidenceScorer`, `BacklogPrioritizer`, `LabelSuggestionService`, `DuplicateDetectionService`, `IssueEnrichmentAIService`, `RelatedIssueLinkingService`, `RoadmapAIService`, `SprintCapacityAnalyzer`, `SprintRiskAssessor`, `SprintSuggestionService`; plus `prompts/` (9 prompt templates) |
| `context/` | 3 files — `DependencyContextGenerator`, `CodeExampleGenerator`, `ContextualReferenceGenerator` |
| `validation/` | 1 file — `ContextQualityValidator` |
| `templates/` | 3 files — `TemplateEngine`, `TemplateParser`, `TemplateValidator` |
| `utils/` | 2 files — `InputSanitizer`, `ErrorMapper` |

### MCP Layer (`src/index.ts`)

Model Context Protocol integration:
- Tool registration and execution (118 tools via `ToolRegistry`)
- Resource exposure
- Request/response handling
- Error formatting via `MCPErrorHandler`
- **Graceful shutdown** — `GracefulShutdown` tracks in-flight requests, installs SIGTERM/SIGINT handlers, drains active work before exit

## Key Patterns

### Dependency Injection

Uses `tsyringe` for IoC. A concrete `GitHubRepositoryFactory` is registered as a
singleton instance; services receive it via `useFactory` registrations:

```typescript
// src/container.ts
const factory = new GitHubRepositoryFactory(token, owner, repo);
container.registerInstance("GitHubRepositoryFactory", factory);

container.register("IssueService", {
  useFactory: (c) => new IssueService(c.resolve("GitHubRepositoryFactory"))
});

container.register("ProjectManagementService", {
  useFactory: (c) => new ProjectManagementService(
    c.resolve("GitHubRepositoryFactory"),
    c.resolve("SubIssueService"),
    c.resolve("MilestoneService"),
    // ... all extracted services
  )
});
```

### Repository Pattern

The domain layer defines repository interfaces (`IssueRepository`,
`MilestoneRepository`, `SprintRepository`, `ProjectRepository` in `types.ts`),
and the infrastructure layer provides concrete implementations
(`GitHubIssueRepository`, `GitHubMilestoneRepository`, etc. in
`infrastructure/github/repositories/`).

In practice the project uses **concrete factory injection** — services receive a
`GitHubRepositoryFactory` and call e.g. `factory.createIssueRepository()` rather
than depending on the repository interfaces directly. This is a pragmatic trade-off:
one factory registration wires all repositories without a per-interface DI entry.

```typescript
// Domain defines the contract
export interface IssueRepository {
  create(data: CreateIssue): Promise<Issue>;
  update(id: IssueId, data: Partial<Issue>): Promise<Issue>;
  // ...
}

// Infrastructure implements it
class GitHubIssueRepository implements IssueRepository { /* GitHub API calls */ }

// Factory creates concrete repositories
class GitHubRepositoryFactory {
  createIssueRepository(): GitHubIssueRepository { /* ... */ }
  createMilestoneRepository(): GitHubMilestoneRepository { /* ... */ }
  // ...
}
```

### Circuit Breaker

Resilience for external APIs:

```typescript
// Wraps GitHub API calls
const result = await circuitBreaker.execute(() =>
  this.octokit.projects.get({ project_id })
);
```

### Rate Limit Management

`RateLimitManager` (`infrastructure/github/`) tracks GitHub API rate-limit headers
and provides pre-call checks. It caches rate-limit status with a 30 s TTL and
exposes remaining quota so callers can back off before hitting 403s.

### Structured Logging

`StructuredLogger` (`infrastructure/logger/`) supports two output modes controlled
by `LOG_FORMAT`:
- `text` (default) — human-readable output via the existing `Logger`
- `json` — newline-delimited JSON to stderr for machine consumption

Log level is controlled by `LOG_LEVEL` (`debug`, `info`, `warn`, `error`).

## Data Flow

```
MCP Client Request
       │
       ▼
┌─────────────────┐
│  Tool Handler   │  ← Validates input with Zod
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │  ← Business logic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Repository     │  ← Data access abstraction
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GitHub API     │  ← REST/GraphQL calls
└─────────────────┘
```

## AI Integration

Multi-provider AI support with automatic fallback:

```
┌──────────────────────────────────────────────────────┐
│                  AIServiceFactory                     │
├──────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────────┐  │
│  │Anthropic │ │ OpenAI │ │ Google │ │ Perplexity │  │
│  └──────────┘ └────────┘ └────────┘ └────────────┘  │
└──────────────────────────────────────────────────────┘
```

Used for:
- PRD generation and enhancement
- Task complexity analysis and breakdown
- Issue enrichment and triage
- Label suggestions
- Duplicate detection
- Sprint risk assessment and capacity analysis
- Roadmap planning
- Backlog prioritisation
- Confidence scoring

## Configuration

Environment-based configuration (`src/env.ts`), validated at startup by Zod schemas
in `src/domain/config-schema.ts`. CLI arguments override env vars; file-mounted
secrets (`SECRETS_DIR`) override both.

**GitHub** (required)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` | — | GitHub API authentication |
| `GITHUB_OWNER` | — | Repository owner |
| `GITHUB_REPO` | — | Repository name |

**AI Providers** (at least one recommended for AI features)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | `""` | Anthropic Claude API key |
| `OPENAI_API_KEY` | `""` | OpenAI API key |
| `GOOGLE_API_KEY` | `""` | Google AI API key |
| `PERPLEXITY_API_KEY` | `""` | Perplexity API key |

**AI Models**

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_MAIN_MODEL` | `claude-3-5-sonnet-20241022` | Primary model for generation |
| `AI_RESEARCH_MODEL` | `perplexity-llama-3.1-sonar-large-128k-online` | Research/online model |
| `AI_FALLBACK_MODEL` | `gpt-4o` | Fallback when primary unavailable |
| `AI_PRD_MODEL` | `claude-3-5-sonnet-20241022` | Model for PRD generation |

**AI Task Generation**

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_TASKS_PER_PRD` | `50` | Max tasks generated per PRD |
| `DEFAULT_COMPLEXITY_THRESHOLD` | `7` | Complexity threshold (1–10) for sub-task creation |
| `MAX_SUBTASK_DEPTH` | `3` | Max nesting depth for sub-tasks |
| `AI_BATCH_SIZE` | `10` | Batch size for parallel AI operations |

**Sync / Cache**

| Variable | Default | Purpose |
|----------|---------|---------|
| `SYNC_ENABLED` | `true` | Enable background state sync |
| `SYNC_TIMEOUT_MS` | `30000` | Sync operation timeout |
| `SYNC_INTERVAL_MS` | `0` | Sync interval (0 = disabled) |
| `CACHE_DIRECTORY` | `.mcp-cache` | Directory for persistent cache/events |
| `MAX_CACHE_ENTRIES` | `10000` | In-memory cache cap before LRU eviction |

**Events / Webhooks**

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBHOOK_SECRET` | `""` | Webhook HMAC secret |
| `WEBHOOK_ALLOW_UNSIGNED` | `false` | Accept unsigned webhooks (dev only) |
| `WEBHOOK_PORT` | `3001` | Webhook HTTP server port |
| `WEBHOOK_TIMEOUT_MS` | `5000` | Webhook processing timeout |
| `SSE_ENABLED` | `true` | Enable Server-Sent Events endpoint |
| `EVENT_RETENTION_DAYS` | `7` | Days to retain stored events |
| `MAX_EVENTS_IN_MEMORY` | `1000` | Max events held in memory |

**Secrets**

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRETS_DIR` | — | Directory for file-mounted secrets (Docker/k8s `/run/secrets`); takes precedence over env vars |

**Logging**

| Variable | Default | Purpose |
|----------|---------|---------|
| `LOG_FORMAT` | `text` | `text` or `json` — structured JSON logs to stderr |
| `LOG_LEVEL` | `info` | Minimum log level: `debug`, `info`, `warn`, `error` |

**Enhanced Features**

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENHANCED_TASK_GENERATION` | `true` | Enable enhanced task generation with traceability |
| `AUTO_CREATE_TRACEABILITY` | `true` | Auto-create requirements traceability matrices |
| `AUTO_GENERATE_USE_CASES` | `true` | Auto-generate use cases from PRDs |
| `AUTO_CREATE_LIFECYCLE` | `true` | Auto-create feature lifecycle tracking |
| `ENHANCED_CONTEXT_LEVEL` | `standard` | Context depth: `minimal`, `standard`, `full` |
| `INCLUDE_BUSINESS_CONTEXT` | `false` | Include business context in task generation |
| `INCLUDE_TECHNICAL_CONTEXT` | `false` | Include technical context in task generation |
| `INCLUDE_IMPLEMENTATION_GUIDANCE` | `false` | Include implementation guidance in task generation |
| `AUTO_CREATE_PROJECT_FIELDS` | `true` | Auto-create custom project fields for AI features |

Secrets resolve through `src/infrastructure/secrets/SecretProvider` (env + file
providers; Vault/AWS SM are an extension point).

See [CONFIGURATION.md](CONFIGURATION.md) for full details.

---

*Last updated: 2026-08-05*
