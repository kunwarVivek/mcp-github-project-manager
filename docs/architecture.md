# Architecture

MCP GitHub Project Manager follows Clean Architecture principles with clear separation of concerns.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         MCP Layer                                │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ 16 Compound  │ │ Resources  │ │ Req Handling  │ │ Graceful  │ │
│  │ Tools (134   │ │            │ │              │ │ Shutdown  │ │
│  │ actions)     │ │            │ │              │ │           │ │
│  └──────────────┘ └────────────┘ └──────────────┘ └───────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                       Service Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ ProjectMgmt  │ │ AI Services  │ │  Planning    │ │  Agent  │ │
│  │ Facade       │ │ (PRD, Tasks, │ │  Services    │ │  Orch.  │ │
│  │              │ │  Triage …)   │ │              │ │         │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                           │
│  ┌────────────┐ ┌────────┐ ┌────────────┐ ┌──────────┐          │
│  │ GitHub API │ │ Cache  │ │ Resilience │ │ Rate     │          │
│  │ Repos      │ │ & Pers.│ │ (CB/Retry) │ │ Limiting │          │
│  ├────────────┤ ├────────┤ ├────────────┤ ├──────────┤          │
│  │ Events/SSE │ │ Health │ │ Lifecycle  │ │ Agent    │          │
│  │ & Webhooks │ │        │ │ & Shutdown │ │ Storage  │          │
│  └────────────┘ └────────┘ └────────────┘ └──────────┘          │
├──────────────────────────────────────────────────────────────────┤
│                       Domain Layer                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Entities   │ │ Interfaces │ │ Zod Schemas│ │ AI & Agent   │  │
│  │ & Types    │ │ (Repos)    │ │            │ │ Type System  │  │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Layer Structure

### Domain Layer (`src/domain/`)

Core business entities, type definitions, validation schemas, and repository interfaces.
22 files grouped by concern:

**Core types**

| File | Purpose |
|------|---------|
| `types.ts` | Core entities (Issue, Milestone, Sprint, Project) and repository interfaces (`IssueRepository`, `MilestoneRepository`, `SprintRepository`, `ProjectRepository`) |
| `errors.ts` | Domain-specific error types (`DomainError`, `ValidationError`, `NotFoundError`, `ConflictError`) |
| `project-types.ts` | Extended project entity types and creation DTOs |
| `resource-types.ts` | Cached-resource metadata, staleness, and sync-state types |
| `mcp-types.ts` | MCP tool/resource descriptor types and request/response shapes |

**Rich Domain Entities** (`entities/`)

| Entity | Purpose |
|--------|---------|
| `IssueEntity` | Rich domain entity for GitHub Issues with computed properties (`isOpen`, `priority`, `isStale`, `isBlocked`) and business logic (`addLabel`, `assignTo`, `close`, `blockBy`) |
| `MilestoneEntity` | Rich domain entity for GitHub Milestones with computed properties (`isOverdue`, `daysUntilDue`, `progressPercent`) and business logic (`updateProgress`, `close`, `addIssue`) |
| `SprintEntity` | Rich domain entity for Sprints with computed properties (`durationInDays`, `daysRemaining`, `isCurrent`, `velocity`) and business logic (`start`, `complete`, `addIssue`, `moveIssueTo`) |
| `ProjectEntity` | Rich domain entity for GitHub Projects with computed properties (`health`, `activityLevel`, `isStale`) and business logic (`addField`, `close`, `archive`) |

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

**Agent orchestration**

| File | Purpose |
|------|---------|
| `agent-orchestration-types.ts` | Agent registry, task checkout, heartbeat, work product, budget, context, and activity types with Zod schemas |

**Validation**

| File | Purpose |
|------|---------|
| `resource-schemas.ts` | Zod schemas for issue, milestone, project, and sprint validation |
| `type-guards.ts` | Runtime type-guard functions for domain entities |
| `config-schema.ts` | Zod schemas for server configuration; validates env vars at startup |

### Domain Entities Layer (`src/domain/entities/`)

Rich domain models with behavior and business logic. These entities implement the existing interfaces for backward compatibility while adding computed properties and invariant enforcement.

**Design Principles:**
- **Backward Compatibility**: All entities implement the original interfaces (`IssueEntity implements Issue`, etc.)
- **Factory Methods**: `fromData()` for creating from existing data, `create()` for new instances
- **Computed Properties**: Derived values calculated from entity state (e.g., `isOpen`, `isOverdue`)
- **Business Logic**: Methods that enforce invariants and encapsulate domain rules
- **Serialization**: `toData()` for converting back to plain objects
- **Deep Copy**: `clone()` for creating independent copies

**Usage Pattern:**
```typescript
import { IssueEntity, MilestoneEntity, SprintEntity, ProjectEntity } from '../domain/entities';

// Create from existing data
const issue = IssueEntity.fromData(githubIssueData);

// Use business logic
issue.addLabel('bug');
issue.assignTo('user1');
console.log(issue.priority); // 'high'
console.log(issue.isStale); // true if no update in 14+ days

// Convert back to plain object
const plainIssue = issue.toData();
```

**Entity Relationships:**
- Issues can be linked to Milestones via `assignToMilestone()`
- Issues can be added to Sprints via `sprint.addIssue(issueId)`
- Sprints can move issues between each other via `moveIssueTo()`
- Milestones track issue progress via `addIssue()` and `completeIssue()`

### Infrastructure Layer (`src/infrastructure/`)

External integrations and technical concerns. 16 subdirectories:

| Directory | Purpose |
|-----------|---------|
| `github/` | GitHub REST/GraphQL API integration — repositories, `GitHubRepositoryFactory`, `RateLimitManager`, error handling |
| `tools/` | MCP tool definitions: 16 compound tools (138 actions) exposed to MCP clients, with `CompoundExecutor` routing to internal granular executors. `ToolRegistry`, `ToolValidator`, schemas |
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
| `agent/` | `AgentStore` (issue-backed agent registry with optimistic concurrency), `WorkProductStore` (structured issue comments), `ProjectFieldSetup` (custom field provisioning for agent claims) |

### Service Layer (`src/services/`)

Business logic coordination. 27 top-level services plus supporting subdirectories.

`ProjectManagementService` is a thin facade that delegates to focused,
independently-testable services.

**Services return domain entities** — all CRUD services now return rich domain entities
(`IssueEntity`, `MilestoneEntity`, `SprintEntity`, `ProjectEntity`) instead of plain interfaces.
This enables consumers to use computed properties and business logic directly:

```typescript
const issue = await service.createIssue({ title: 'Bug', description: '...' });
console.log(issue.priority);      // 'high' (computed from labels)
console.log(issue.isStale);       // true if no update in 14+ days
console.log(issue.canBeAddedToSprint()); // true if open with priority
```

**Facade**

| Service | Responsibility |
|---------|----------------|
| `ProjectManagementService` | Facade — delegates to all services below; returns domain entities |

**Core CRUD**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `IssueService` | `IssueEntity` | Issue CRUD, comments, Projects v2 draft issues |
| `PullRequestService` | PR types | PR listing with filtering |
| `MilestoneService` | `MilestoneEntity` | Milestone CRUD and metrics |
| `LabelService` | Label types | Label CRUD |

**Project management**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `ProjectStatusService` | `ProjectEntity` | Project CRUD |
| `ProjectTemplateService` | Template types | Template + field/view management |
| `ProjectLinkingService` | Linking types | Project item / repo / team linking |
| `ProjectAutomationService` | Automation types | Automation-rule management |

**Field / View / Item**

| Service | Responsibility |
|---------|----------------|
| `FieldValueService` | Project field-value reads and writes |
| `IterationService` | Iteration (sprint) field management |

**Planning**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `SprintPlanningService` | `SprintEntity` | Sprint planning and capacity |
| `RoadmapService` | Roadmap types | Full-roadmap creation (project + milestones + issues) |
| `RoadmapPlanningService` | Planning types | AI roadmap/milestone planning |

**Hierarchy**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `SubIssueService` | `IssueEntity` | Hierarchical issue dependencies |

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

**Agent orchestration** (`services/agent/`)

| Service | Responsibility |
|---------|----------------|
| `TaskCheckoutService` | Task claiming (strategy-driven, dependency-aware, atomic), releasing, completion, review workflow (submit/approve/reject), heartbeat history, stale reclaim — manages agent_status/agent_claimed_by project fields |
| `AgentContextService` | Enriched task context assembly (issue, parent, milestone, related issues, acceptance criteria) + best-effort AI suggestions (criteria, complexity, guidance) |
| `WorkProductService` | Work product submission — records structured comments on issues with test results |
| `AgentBudgetService` | Per-agent token budget tracking, warning thresholds, hard stops, periodic resets, usage recording |
| `AgentMetricsService` | Aggregate + per-agent orchestration metrics (throughput, cycle time, budget burn, staleness) |

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
- **Compound tool API** — 16 compound tools (138 actions) registered via `ToolRegistry`; each routes through `CompoundExecutor` to internal granular executors
- **Progressive disclosure** — `discover_tools` meta-tool lets agents explore available actions and schemas at runtime
- **Capability profiles** — `MCP_TOOL_GROUPS` env var controls which compound tools are exposed (default: `all`)
- Resource exposure
- Request/response handling
- Error formatting via `MCPErrorHandler`
- **Graceful shutdown** — `GracefulShutdown` tracks in-flight requests, installs SIGTERM/SIGINT handlers, drains active work before exit

## Bounded Contexts

The domain is organized into distinct bounded contexts, each with its own ubiquitous language, entities, and business rules. These contexts align with the service layer decomposition and the domain entity model.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCP GitHub Project Manager                          │
│                         Bounded Context Map                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│  │    PROJECT      │     │    ISSUE        │     │    MILESTONE    │      │
│  │  MANAGEMENT     │◄────│   MANAGEMENT    │────►│   MANAGEMENT    │      │
│  │    CONTEXT      │     │    CONTEXT      │     │    CONTEXT      │      │
│  └────────┬────────┘     └────────┬────────┘     └─────────────────┘      │
│           │                       │                                        │
│           │                       │                                        │
│           ▼                       ▼                                        │
│  ┌─────────────────┐     ┌─────────────────┐                              │
│  │    SPRINT       │     │     PULL        │                              │
│  │   PLANNING      │     │    REQUEST      │                              │
│  │    CONTEXT      │     │    CONTEXT      │                              │
│  └─────────────────┘     └─────────────────┘                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     AI SERVICES CONTEXT                            │   │
│  │  PRD Generation │ Task Generation │ Issue Triage │ Enrichment      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  AGENT ORCHESTRATION CONTEXT                        │   │
│  │  Agent Registry │ Task Checkout │ Heartbeats │ Work Products        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Context Definitions

#### 1. Project Management Context
**Ubiquitous Language:** Project, Field, View, Item, Template
**Entities:** `ProjectEntity`
**Services:** `ProjectStatusService`, `ProjectTemplateService`, `ProjectLinkingService`, `FieldValueService`
**Responsibility:** Managing GitHub Projects, custom fields, views, and project-level configuration.

#### 2. Issue Management Context
**Ubiquitous Language:** Issue, Label, Assignee, Status, Priority, Type
**Entities:** `IssueEntity`
**Services:** `IssueService`, `SubIssueService`, `LabelService`
**Responsibility:** Issue CRUD, hierarchical relationships, labeling, and assignment.

#### 3. Milestone Management Context
**Ubiquitous Language:** Milestone, Due Date, Progress, State
**Entities:** `MilestoneEntity`
**Services:** `MilestoneService`
**Responsibility:** Milestone lifecycle, progress tracking, and deadline management.

#### 4. Sprint Planning Context
**Ubiquitous Language:** Sprint, Capacity, Velocity, Duration, Status
**Entities:** `SprintEntity`
**Services:** `SprintPlanningService`, `IterationService`
**Responsibility:** Sprint planning, capacity analysis, velocity tracking, and iteration fields.

#### 5. Pull Request Context
**Ubiquitous Language:** Pull Request, Review, Merge, Draft, Branch
**Entities:** `PullRequestEntity`
**Services:** `PullRequestService`
**Responsibility:** PR lifecycle, reviews, merge operations, and branch management.

#### 6. AI Services Context
**Ubiquitous Language:** PRD, Task, Complexity, Confidence, Traceability, Enrichment
**Entities:** None (stateless services)
**Services:** `PRDGenerationService`, `TaskGenerationService`, `IssueTriagingService`, `IssueEnrichmentService`, `RequirementsTraceabilityService`, `FeatureManagementService`, `TaskContextGenerationService`
**Responsibility:** AI-powered generation, analysis, and enrichment across all domains.

#### 7. Agent Orchestration Context
**Ubiquitous Language:** Agent, Task, Checkout, Heartbeat, Work Product, Budget, Review
**Entities:** Agent (in registry)
**Services:** `TaskCheckoutService`, `AgentContextService`, `WorkProductService`, `AgentBudgetService`, `AgentMetricsService`
**Responsibility:** Autonomous agent lifecycle, task claiming, progress tracking, and review workflow.

### Context Relationships

| Relationship | Type | Mechanism |
|--------------|------|-----------|
│ Project → Issue | Compositional | Issues belong to Projects |
│ Issue → Milestone | Associative | Issues assigned to Milestones |
│ Sprint → Issue | Associative | Sprints contain Issues |
│ Milestone → Sprint | Temporal | Milestones span multiple Sprints |
│ Agent → Task | Associative | Agents claim Tasks from Issue pool |
│ AI → Issue | Enriching | AI services add metadata to Issues |
│ AI → PRD | Generative | AI creates PRDs that spawn Issues |

### Anti-Corruption Layer

The `ProjectManagementService` facade acts as an anti-corruption layer between contexts:
- Translates between context-specific language
- Coordinates cross-context workflows
- Prevents direct coupling between contexts

Each context's services are independently testable and can evolve without affecting other contexts.

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
MCP Client Request (e.g. manage_issues, action: "create")
       │
       ▼
┌─────────────────────┐
│  Compound Tool      │  ← Validates action + input with Zod
│  (CompoundExecutor)  │
└────────┬────────────┘
         │  routes by action
         ▼
┌─────────────────┐
│  Granular        │  ← Internal executor (e.g. executeCreateIssue)
│  Executor        │
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


## Compound Tool Architecture

The MCP server uses progressive disclosure to reduce tool-selection overhead
for AI agents: 131 granular operations are grouped into 16 compound tools,
each accepting an `action` parameter.

```
MCP Client (Claude/Codex/Cursor)
  │  sees only 16 compound tools
  ▼
ToolRegistry.getToolsForMCP()
  │  returns compound tools filtered by MCP_TOOL_GROUPS
  ▼
CompoundExecutor.execute(action, args)
  │  validates action, routes to internal executor
  ▼
Existing execute* functions (unchanged)
```

### Tool Groups

| Compound Tool | Actions | Domain |
|---------------|---------|--------|
| `manage_project` | 37 | Project CRUD, fields, views, items, templates, linking |
| `manage_issues` | 18 | Issue CRUD, comments, drafts, search, sub-issues |
| `manage_prs` | 7 | PR CRUD, merge, reviews |
| `manage_milestones` | 7 | Milestone CRUD, metrics, deadlines |
| `manage_sprints` | 8 | Sprint planning, metrics, velocity |
| `manage_labels` | 2 | Label CRUD |
| `manage_automation` | 7 | Automation rules |
| `manage_iterations` | 5 | Iteration field management |
| `manage_events` | 3 | Event subscription, replay |
| `manage_status_updates` | 3 | Project status updates |
| `ai_generate` | 9 | PRD generation, task breakdown, traceability, task materialization |
| `ai_analyze` | 8 | Issue enrichment, triage, duplicates |
| `ai_plan` | 6 | Capacity, backlog, risk, roadmap |
| `agent_work` | 10 | Agent registration, task lifecycle, review workflow |
| `agent_manage` | 13 | Agent admin, budgets, work products, reclaim, metrics, PM coordination |
| `discover_tools` | — | Runtime tool/action/schema discovery (meta-tool) |

### Capability Profiles

The `MCP_TOOL_GROUPS` environment variable controls which compound tools are
exposed to MCP clients. This enables tailored profiles for different use cases:

| Profile | `MCP_TOOL_GROUPS` value | Use case |
|---------|------------------------|----------|
| Full (default) | `all` | All 16 tools exposed |
| Project management | `core` | CRUD-only agents |
| AI-powered | `core,ai` | Planning and analysis agents |
| Agent orchestration | `agents` | Autonomous task agents |
| Minimal | `core,events` | Simple issue/PR bots with event tracking |

`discover_tools` is always available regardless of `MCP_TOOL_GROUPS` setting,
allowing agents to introspect available capabilities at runtime.

## Agent Orchestration Layer

The agent orchestration layer enables autonomous AI agents to operate on a
GitHub project without human dispatch. All state is stored natively in GitHub
(issues, project fields, comments) — no external database required.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              MCP Compound Tool Layer (2 tools)                      │
│  agent_work:   register · checkout_task · release_task ·            │
│                complete_task · heartbeat · check_work_status ·      │
│                get_task_context · submit_for_review ·               │
│                approve_task · reject_task                           │
│  agent_manage: list · deregister · get_activity ·                   │
│                submit_work_product · get_budget · set_budget ·      │
│                reclaim_stale · record_usage · get_metrics ·         │
│                setup_fields · assign_task · get_swarm_status ·      │
│                rebalance_workload                                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                       Service Layer                                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────┐  │
│  │TaskCheckoutService│ │AgentContextService│ │WorkProductService   │  │
│  │ claim / release / │ │ assemble enriched │ │ record structured   │  │
│  │ complete tasks    │ │ context for agent │ │ comments on issues  │  │
│  └──────────────────┘ └──────────────────┘ └─────────────────────┘  │
│  ┌──────────────────┐                                               │
│  │AgentBudgetService │  Token budget tracking & enforcement          │
│  └──────────────────┘                                               │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    Infrastructure Layer                              │
│  ┌────────────┐ ┌──────────────────┐ ┌───────────────────────────┐  │
│  │ AgentStore │ │ WorkProductStore │ │ ProjectFieldSetup         │  │
│  │ registry   │ │ issue comments   │ │ custom field provisioning │  │
│  │ (JSON in   │ │ with markers     │ │ (agent_claimed_by, etc.)  │  │
│  │ pinned     │ └──────────────────┘ └───────────────────────────┘  │
│  │ issue)     │                                                     │
│  └────────────┘                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                  GitHub-Native Storage                               │
│  • Agent registry → issue body (label: agent-registry)              │
│  • Task claims    → project custom fields (SINGLE_SELECT / TEXT)    │
│  • Work products  → structured issue comments (JSON marker blocks)  │
│  • Budgets        → agent registry metadata                         │
│  • Heartbeats     → agent lastHeartbeat timestamp                   │
└─────────────────────────────────────────────────────────────────────┘
```

### GitHub-Native Data Model

The orchestration layer uses five custom project fields (auto-provisioned by
`ProjectFieldSetup`):

| Field | Type | Purpose |
|-------|------|---------|
| `agent_claimed_by` | TEXT | Agent ID that currently owns the task |
| `agent_claimed_at` | TEXT | ISO 8601 timestamp of when the claim was made |
| `agent_status` | SINGLE_SELECT | Task status: `unclaimed`, `in_progress`, `review`, `blocked`, `completed` |
| `agent_work_branch` | TEXT | Git branch name the agent is working on |
| `agent_pr_number` | TEXT | Pull request number for the submitted work |

Agent records are stored as a JSON array in the body of a pinned issue
labeled `agent-registry`. Work products are stored as structured issue
comments with a `<!-- agent-work-product: -->` HTML comment marker for
machine-parseable retrieval.

### Autonomous Loop

```
Agent starts
    │
    ▼
register_agent ─── agent record created in registry
    │
    ▼
checkout_task ──── strategy-driven selection (priority/age/skills/deadline/AI),
    │              dependency-aware (skipBlocked), atomic TOCTOU-guarded claim
    │
    ├──► get_task_context ── enriched context (issue, milestone, criteria, AI suggestions)
    │
    ▼
work loop ────── agent_heartbeat (every N minutes)
    │              └── heartbeat history retained (last 50); stale detection after 30 min
    │
    ▼
submit_work_product ─── structured comment on issue
    │
    ▼
submit_for_review ─── issue enters review queue; agent → needs_review
    │
    ▼
(reviewer) checkout_task { reviewQueue: true }
    │    ├── approve_task ── completes + closes issue
    │    └── reject_task ─── returns to pool with feedback comment
    │
    ▼
checkout_task ──── repeat with next task

Recovery: agent_manage/reclaim_stale returns tasks from stale agents to the pool
Accounting: agent_manage/record_usage keeps budgets accurate; hard stops block draws
Observability: agent_manage/get_metrics (throughput, cycle time, budget burn, staleness)
PM coordination: agent_manage/assign_task, get_swarm_status, rebalance_workload
```

### Domain Types

All types are defined in `src/domain/agent-orchestration-types.ts`:

| Type | Purpose |
|------|---------|
| `Agent` | Registered agent with role, runtime, capabilities, status, budget |
| `AgentRole` | `engineer`, `reviewer`, `pm`, `designer`, `qa`, `devops`, `general` |
| `AgentRuntime` | `claude-code`, `codex`, `cursor`, `cli`, `http`, `custom` |
| `AgentOperationalStatus` | `idle`, `working`, `blocked`, `needs_review`, `offline`, `budget_exhausted` |
| `TaskCheckoutResult` | Checkout outcome with issue details and branch suggestion |
| `CheckoutStrategy` | `highest_priority` (default), `oldest_first`, `skills_match`, `milestone_deadline`, `ai` (LLM-ranked with deterministic fallback) |
| `AgentHeartbeat` | Liveness ping with progress %, branch, blocker info |
| `WorkProduct` | Submitted code: branch, PR, commits, files, test results |
| `TestResults` | passed, failed, skipped, total, coverage |
| `AgentBudget` | Token budget with warning threshold, hard stop, reset period |
| `BudgetStatus` | Current budget report: used, remaining, %, warning/exhausted flags |
| `AgentTaskContext` | Enriched context: issue, parent, milestone, related, criteria |
| `AgentActivityEntry` | Dashboard entry: agent, task, heartbeat age, budget, completions |

---

*Last updated: 2026-08-08 (bounded contexts documented)*
