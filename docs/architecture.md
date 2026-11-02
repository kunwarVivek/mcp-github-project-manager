# Architecture

MCP GitHub Project Manager follows Clean Architecture principles with clear separation of concerns.

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         MCP Layer                                │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌───────────┐ │
│  │ 21 Compound  │ │ Resources  │ │ Req Handling  │ │ Graceful  │ │
│  │ Tools (175   │ │            │ │              │ │ Shutdown  │ │
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

Core business entities, type definitions, validation schemas, and repository interfaces, grouped by concern:

**Core types**

| File | Purpose |
|------|---------|
| `types.ts` | Core entities (Issue, Milestone, Sprint, Project) and repository interfaces (`IssueRepository`, `MilestoneRepository`, `SprintRepository`, `ProjectRepository`) |
| `errors.ts` | Domain-specific error types (`DomainError`, `ValidationError`, `ResourceNotFoundError`, `UnauthorizedError`, `GitHubApiError`, `RateLimitError`, `ConfigurationError`, …) |
| `resource-types.ts` | Cached-resource metadata, staleness, and sync-state types |
| `mcp-types.ts` | MCP tool/resource descriptor types and request/response shapes |

**Rich Domain Entities** (`entities/`)

| Entity | Purpose |
|--------|---------|
| `IssueEntity` | Rich domain entity for GitHub Issues with computed properties (`isOpen`, `priority`, `isStale`, `isBlocked`) and business logic (`addLabel`, `assignTo`, `close`, `blockBy`) |
| `MilestoneEntity` | Rich domain entity for GitHub Milestones with computed properties (`isOverdue`, `daysUntilDue`, `progressPercent`) and business logic (`updateProgress`, `close`, `addIssue`) |
| `SprintEntity` | Rich domain entity for Sprints with computed properties (`durationInDays`, `daysRemaining`, `isCurrent`, `velocity`) and business logic (`start`, `complete`, `addIssue`, `moveIssueTo`) |
| `ProjectEntity` | Rich domain entity for GitHub Projects with computed properties (`health`, `activityLevel`, `isStale`) and business logic (`addField`, `close`, `archive`) |
| `PullRequestEntity` | Rich domain entity for GitHub Pull Requests |

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
| `automation-types.ts` | Project automation workflow definitions (GitHub `ProjectV2Workflow`) |
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

**Domain events and value objects**

| Directory / File | Purpose |
|------------------|---------|
| `events/` | `DomainEvent`, `AgentEvents`, `DomainEventBus` — in-process domain event plumbing |
| `value-objects/` | `SprintMetrics`, `MilestoneMetrics` — computed metric value objects |
| `entities/` | Rich domain entities (see below) |

### Domain Entities Layer (`src/domain/entities/`)

Rich domain models with behavior and business logic. Each entity implements the matching plain interface (`IssueEntity implements Issue`, etc.), so it can be handed anywhere the plain shape is expected, while adding computed properties and invariant enforcement. The domain layer holds types, zod schemas, errors, and this entity/value-object behavior; it imports nothing from `services/` or `infrastructure/`. See [ADR-005](adr/005-rich-domain-entities.md).

**Design Principles:**
- **Interface conformity**: All entities implement the plain interfaces (`IssueEntity implements Issue`, etc.)
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

External integrations and technical concerns. 15 subdirectories:

| Directory | Purpose |
|-----------|---------|
| `github/` | GitHub REST/GraphQL API integration — repositories, `GitHubRepositoryFactory` (`fromAuth`), `GitHubAuthResolver` (`resolveGitHubAuth`: App outranks PAT), `GitHubRequestExecutor` (the one retry + rate-limit path), `RateLimitManager` (proactive budgeting against `RATE_LIMIT_FLOOR`), error handling |
| `tools/` | MCP tool definitions: <!-- count:tools -->21<!-- /count --> compound tools (<!-- count:actions -->175<!-- /count --> actions) exposed to MCP clients. `compound/` holds the compound schemas (`compound-schemas.ts`), tool definitions, per-tool `_meta.schemaVersion` (`schema-version.ts`) and the executors (`compound-executors.ts`, wired by `register-executors.ts`); the granular per-operation tools (`*-tools.ts`, `schemas/`) stay registered in `ToolRegistry` as internal implementation contracts and are not listed over MCP. `ToolRegistry`, `ToolValidator`, `tool-factory.ts` (`createGitHubFactory`) and `shared-services.ts` |
| `cache/` | In-memory caching with TTL and LRU eviction (`ResourceCache`), persistence adapter |
| `resilience/` | `CircuitBreakerService` and `AIResiliencePolicy` (circuit breaker, timeout and retry around AI provider calls) — GitHub calls are retried by `GitHubRequestExecutor`, not here |
| `events/` | Webhook handling (`GitHubWebhookHandler`), `EventStore` with persistence, `EventSubscriptionManager` |
| `health/` | Health check endpoints (`HealthService`) |
| `lifecycle/` | `GracefulShutdown` — tracks in-flight requests, drains on SIGTERM/SIGINT, force-exits after timeout |
| `logger/` | `ConsoleLogger` / `Logger` (text or JSON lines to stderr; honors `LOG_LEVEL` and `LOG_FORMAT`, carries the active correlation id), `redactSecrets()` |
| `persistence/` | `FilePersistenceAdapter` for durable cache/event state |
| `secrets/` | `SecretProvider` — layered secret resolution (file-mounted → env var); Vault/AWS SM extension point |
| `mcp/` | `ToolDispatcher` (argument validation → budget gate → audited execution in an OTel span → budget debit → result formatting), `MCPResponseFormatter`, `resources.ts`, `prompts.ts`, budget-debit metadata |
| `observability/` | `CorrelationContext` (AsyncLocalStorage trace context), `MutationAuditLog` (append-only redacted JSONL of state-changing calls), `SecurityAuditLog`, `otel.ts` (opt-in OTLP tracing) |
| `http/` | `WebhookServer` — HTTP server for incoming webhooks and SSE connections |
| `agent/` | `AgentStore` (agent registry: `registry.json` on the `agent-registry` branch, Contents API with sha compare-and-swap), `LegacyAgentRegistry` (one-time import of the old registry issue), `WorkProductStore` (structured issue comments), `ProjectFieldSetup` (custom field provisioning for agent claims) |
| `idempotency/` | `IdempotencyStore` — `idempotencyKey` replay for create actions (24 h TTL, request fingerprint, audit-log recovery) |

### Service Layer (`src/services/`)

Business logic coordination, split into focused, independently-testable services.

`ProjectManagementService` is a thin facade: it holds the per-feature services and
exposes each through a typed getter (`pms.issues`, `pms.sprints`, …). It adds no behavior of its own.

**Services return plain interfaces** — CRUD services return plain domain interfaces
(`Issue`, `Milestone`, `Sprint`, `Project`) for direct MCP serialization compatibility.
Rich domain entities (`IssueEntity`, `MilestoneEntity`, `SprintEntity`, `ProjectEntity`)
in `src/domain/entities/` are available for use cases that need computed properties
and business logic, but service-layer consumers work with the lightweight interfaces:

```typescript
const issue = await service.createIssue({ title: 'Bug', description: '...' });
console.log(issue.title);        // plain interface field
console.log(issue.labels);       // string[]
// For business logic, wrap: const entity = IssueEntity.fromData(issue);
```

**Facade**

| Service | Responsibility |
|---------|----------------|
| `ProjectManagementService` | Facade — typed getters over the services below; no behavior of its own |

**Core CRUD**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `IssueService` | `Issue` | Issue CRUD, comments, Projects v2 draft issues, native blockers and issue types |
| `PullRequestService` | PR types | PR listing with filtering |
| `MilestoneService` | `Milestone` | Milestone CRUD and metrics |
| `LabelService` | Label types | Label CRUD |

**Project management**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `ProjectStatusService` | `Project` | Project CRUD (incl. close/reopen) |
| `ProjectTemplateService` | Template types | Template + field/view management |
| `ProjectLinkingService` | Linking types | Project item / repo / team linking |
| `ProjectAutomationService` | Automation types | Project workflows (`ProjectV2Workflow`): list, get, delete |

**Field / View / Item**

| Service | Responsibility |
|---------|----------------|
| `FieldValueService` | Project field-value reads and writes |
| `IterationService` | Iteration (sprint) field management |

**Planning**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `SprintPlanningService` | `Sprint` | Sprint planning and capacity (wraps `SprintEntity` for its invariants) |
| `RoadmapService` | Roadmap types | Full-roadmap creation (project + milestones + issues) |
| `RoadmapPlanningService` | Planning types | AI roadmap/milestone planning |

**Hierarchy**

| Service | Returns | Responsibility |
|---------|---------|----------------|
| `SubIssueService` | `Issue` | Hierarchical issue dependencies |

**Analytics**

| Service | Responsibility |
|---------|----------------|
| `AnalyticsService` | Read-only sprint velocity, burndown, cycle time, throughput and project summary over project items (backs the `analytics` tool) |

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
| `TaskCheckoutService` | Task claiming (strategy-driven, dependency-aware, atomic), releasing, completion, review workflow (submit/approve/reject), item-level heartbeats (`ItemHeartbeatStore`; registry written only on cold changes), stale reclaim over the newer of item and registry beat — manages agent_status/agent_claimed_by/agent_heartbeat_at/agent_progress project fields. Registry writes go through `AgentStore.createAgent`/`updateAgent` (field-level CAS) |
| `AgentContextService` | Enriched task context assembly (issue, parent, milestone, related issues, acceptance criteria) + best-effort AI suggestions (criteria, complexity, guidance) |
| `WorkProductService` | Work product submission — records structured comments on issues with test results |
| `AgentBudgetService` | Per-agent token budget tracking, warning thresholds, hard stops, periodic resets, usage recording |
| `AgentMetricsService` | Aggregate + per-agent orchestration metrics (throughput, cycle time, budget burn, staleness) |

**Subdirectories**

| Directory | Contents |
|-----------|----------|
| `ai/` | `AIServiceFactory`, `AITaskProcessor`, `TokenCounter`, `TokenBudgetManager` (per-session AI token budget, `AI_SESSION_TOKEN_LIMIT`; distinct from the per-agent budget), `AIResponseCache` (consumed by `TaskContextGenerationService`), `ConfidenceScorer`, `BacklogPrioritizer`, `LabelSuggestionService`, `DuplicateDetectionService`, `IssueEnrichmentAIService`, `RelatedIssueLinkingService`, `RoadmapAIService`, `SprintCapacityAnalyzer`, `SprintRiskAssessor`, `SprintSuggestionService`; plus `prompts/` (versioned `{{var}}` templates served by the `PromptRegistry` — every AI prompt is registered there) |
| `agent/` | `TaskCheckoutService`, `AgentContextService`, `WorkProductService`, `AgentBudgetService`, `AgentMetricsService`, `AgentReclaimScheduler` |
| `context/` | `DependencyContextGenerator`, `CodeExampleGenerator`, `ContextualReferenceGenerator` |
| `feature/` | `FeatureAnalysisService`, `FeaturePRDService`, `FeatureExpansionService`, `TaskLifecycleService` |
| `validation/` | `ContextQualityValidator` |
| `templates/` | `TemplateEngine`, `TemplateParser`, `TemplateValidator` |
| `utils/` | `InputSanitizer`, `ErrorMapper`, `safeCall` |

### MCP Layer (`src/index.ts`)

Model Context Protocol integration, on `@modelcontextprotocol/server` v2
(2026-07-28 spec):

- **Compound tool API** — <!-- count:tools -->21<!-- /count --> compound tools (<!-- count:actions -->175<!-- /count --> actions) registered via `ToolRegistry`; each routes by `action` to its executor in `compound/compound-executors.ts`
- **Progressive disclosure** — `discover_tools` meta-tool lets agents explore available actions and schemas at runtime
- **Capability profiles** — the `MCP_TOOL_GROUPS` env var selects which compound tool **groups** are exposed (default: `all`); only `discover_tools` is always exposed
- **Resources** — 6 registered resources (github://config, github://projects, github://sprints/current, github://milestones, github://agents, github://tools)
- **Prompts** — 6 registered prompts for consistent AI interaction templates
- **Argument validation** — MCP v2 validates arguments against the declared `inputSchema` *before* the handler runs, so `ToolValidator` never sees a missing required field
- **Error contract** — a tool that runs and fails returns `{ content, isError: true }` with a stable code in `_meta.error` so the model can see and recover from it: invalid arguments (field-level messages), GitHub API errors (`ToolValidator.mapGitHubError`: 401/403/404/422/rate-limit/5xx), and an exhausted agent budget (`BudgetExhausted`). A JSON-RPC error (`MethodNotFound`) is reserved for an unknown tool and protocol faults. See [ADR-007](adr/007-tool-error-contract.md)
- **Request tracking and shutdown** — every tool call goes through one `dispatchTool` that carries the shutdown gate and in-flight tracking, then `ToolDispatcher`; `GracefulShutdown` tracks in-flight requests, installs SIGTERM/SIGINT handlers, drains active work, and flushes the audit log and telemetry before exit
- **Contract versioning** — every tool advertises `_meta.schemaVersion` (all `1.0.0`, rolled up); a snapshot test fails when a tool's input schema changes without a version bump
- **Idempotency and pagination** — create actions accept `idempotencyKey`; paged list actions accept `cursor` and return an additive `nextCursor` (see [TOOLS.md](TOOLS.md#cross-cutting-parameters))

### Entry Points and Composition

| File | Role |
|------|------|
| `src/index.ts` | Entry point — boots the `McpServer` and serves it over stdio via `serveStdio`, which negotiates the protocol revision per connection |
| `src/container.ts` | tsyringe DI container — `configureContainer(auth, owner, repo)` registers the repository factory (`GitHubRepositoryFactory.fromAuth`), the services, and the components `index.ts` owns (`ResourceCache`, `FilePersistenceAdapter`, `GitHubWebhookHandler`, `EventStore`, `EventSubscriptionManager`, `GracefulShutdown`, `MutationAuditLog`, `TelemetryConfig`); `index.ts` resolves them and constructs none by hand. Tool executors are a documented exception (below) |
| `src/env.ts` | Configuration resolution, secret chain, and startup validation against the *resolved* config |
| `src/cli.ts` | Command-line flag parsing (`--token`, `--owner`, `--repo`, `--env-file`, `--verbose`); CLI flags override env vars |

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

### Service Facade

`ProjectManagementService` is not an anti-corruption layer and does not coordinate cross-context workflows: it is a thin facade (typed getters only) so callers go straight to the owning service. Context boundaries are kept by the services themselves, each independently testable.

## Key Patterns

### Dependency Injection

Uses `tsyringe` for IoC. `configureContainer(auth, owner, repo)` builds the
`GitHubRepositoryFactory` from the resolved credentials, registers it as an
instance, and registers each service with a `useFactory`:

```typescript
// src/container.ts
const factory = GitHubRepositoryFactory.fromAuth(auth, owner, repo);
container.registerInstance("GitHubRepositoryFactory", factory);

container.register("IssueService", {
  useFactory: (c) => new IssueService(c.resolve("GitHubRepositoryFactory"))
});

container.register("ProjectManagementService", {
  useFactory: (c) => new ProjectManagementService(
    c.resolve("SubIssueService"),
    c.resolve("MilestoneService"),
    // ... the remaining feature services
  )
});
```

**Authentication.** Credentials come only from `resolveGitHubAuth()`
(`infrastructure/github/GitHubAuthResolver.ts`): a complete GitHub App config
(`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID`)
outranks the PAT; a partial App config falls back to the PAT. Repositories are
built only through `GitHubRepositoryFactory.fromAuth(auth, owner, repo)`.
See [ADR-008](adr/008-app-auth-precedence.md).

**Documented exception — tool executors.** Executors in `infrastructure/tools/**`
do not resolve from the container. They self-construct through the one shared
factory (`createGitHubFactory()` in `tools/tool-factory.ts` / the
`shared-services` accessor), which itself uses `resolveGitHubAuth()`. Do not add
a second construction path. See [ADR-006](adr/006-composition-root-exception.md).

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

Resilience for AI provider calls (`AIResiliencePolicy` wraps `CircuitBreakerService`
with timeout and retry):

```typescript
const result = await resiliencePolicy.execute(() => generateText({ model, prompt }));
```

### Request Execution and Rate-Limit Budgeting

Every GitHub call — REST and GraphQL, from the factory and from every repository
— goes through one `GitHubRequestExecutor` (shared per Octokit instance). It
gates each call on the shared `RateLimitManager` budget, runs the operation,
retries retryable failures (up to 3 attempts) with GitHub-aware backoff, and
converts terminal failures to structured errors. `RateLimitManager` tracks the
GraphQL points budget and the REST budget separately, learns from response
headers and the `rateLimit` field of GraphQL results, and waits for the reset
(or throws `RateLimitError` when the wait would exceed its cap) once the
remaining quota falls below `RATE_LIMIT_FLOOR` (default 100) — so the server backs
off proactively instead of burning the budget and hitting a 403.

### Logging

`ConsoleLogger` (`infrastructure/logger/`) writes to stderr (stdout is the MCP
channel) and honors two settings:
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`) — minimum level emitted
- `LOG_FORMAT` — `text` (default, human-readable) or `json` (one JSON object per
  line, carrying the active trace's `correlationId`)

Output passes through `redactSecrets()`, which strips token/secret/password/apiKey/
authorization-shaped keys and token-shaped substrings.

### Observability

- **Mutation audit log** — `MutationAuditLog` appends a redacted JSONL record of every
  state-changing tool call (actor = agent id or `token`) to `AUDIT_LOG_PATH`
  (default `.mcp-audit/mutations.jsonl`) when `AUDIT_LOG_ENABLED=true`. The idempotency
  store uses it to recover a replayed result that has aged out of memory.
- **OpenTelemetry** — opt-in: set `OTEL_EXPORTER_OTLP_ENDPOINT` (and optionally
  `OTEL_SERVICE_NAME`) and each dispatched call runs inside a `tool.<name>` span.
  Unset, nothing is exported.
- Both flush during graceful shutdown. See [ADR-010](adr/010-observability.md).

### Idempotency and Pagination

Create actions (`manage_issues` `create`/`add_sub_issue`/`create_draft`/`create_comment`,
`manage_milestones` `create`, `manage_project` `create_field`, `manage_sprints` `create`)
accept an `idempotencyKey`. `IdempotencyStore` fingerprints the request: a repeat with
the same key and fingerprint within 24 h returns the first result flagged
`replayed: true`; the same key with a different request is an error. Paged list
actions accept `cursor` and add `nextCursor` beside the existing `pageInfo`. See
[ADR-009](adr/009-idempotency-and-audit.md).

## Data Flow

```
MCP Client Request (e.g. manage_issues, action: "create")
       │
       ▼
┌─────────────────────┐
│  dispatchTool       │  ← shutdown gate, in-flight tracking
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  ToolDispatcher     │  ← validate args (ToolValidator) → budget gate →
│                     │    audited execution in an OTel span → budget debit
└────────┬────────────┘
         ▼
┌─────────────────────┐
│  Compound executor  │  ← routes by action (executeManageIssues …),
│                     │    idempotencyKey / cursor handling
└────────┬────────────┘
         ▼
┌─────────────────┐
│    Service      │  ← Business logic
└────────┬────────┘
         ▼
┌─────────────────┐
│  Repository     │  ← Data access abstraction
└────────┬────────┘
         ▼
┌─────────────────┐
│ GitHubRequest-  │  ← rate-limit gate + retry
│ Executor        │
└────────┬────────┘
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

### Prompts, Caching and Budgets

- **`PromptRegistry`** (`services/ai/prompts/`) holds every AI prompt as a versioned
  template with `{{var}}` placeholders; services render by id through
  `defaultPromptRegistry`. Registering an existing id/version twice throws.
- **`AIResponseCache`** is consumed by `TaskContextGenerationService` (TTL cache of AI
  generation results; `metrics.cacheHit` reports a fully cached build).
- **`TokenBudgetManager`** meters AI task generation per session (correlation id) against
  `AI_SESSION_TOKEN_LIMIT` (0 = unlimited); an exhausted budget makes optional AI steps
  fall back instead of throwing. It is **distinct from the per-agent budget**
  (`AgentBudgetService`, `agent_manage set_budget`), which is debited once per tool call
  by `ToolDispatcher` and can hard-stop AI tools with `BudgetExhausted`. See
  [ADR-011](adr/011-prompt-registry-and-token-budgets.md).

## Configuration

Environment-based configuration (`src/env.ts`), validated at startup by Zod schemas
in `src/domain/config-schema.ts`. CLI arguments override env vars; file-mounted
secrets (`SECRETS_DIR`) override both.

**GitHub** (required)

| Variable | Default | Purpose |
|----------|---------|---------|
| `GITHUB_TOKEN` | — | GitHub PAT (not required when a complete GitHub App config is set) |
| `GITHUB_OWNER` | — | Repository owner |
| `GITHUB_REPO` | — | Repository name |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | — | Optional GitHub App installation auth; outranks the PAT when all three are set |
| `RATE_LIMIT_FLOOR` | `100` | Remaining GraphQL points below which calls back off proactively |

**AI Providers** (at least one recommended for AI features)

| Variable | Default | Purpose |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | `""` | Anthropic Claude API key |
| `OPENAI_API_KEY` | `""` | OpenAI API key |
| `GOOGLE_API_KEY` | `""` | Google AI API key |
| `PERPLEXITY_API_KEY` | `""` | Perplexity API key |

**AI Models**

There are no built-in default models — you configure the models you use. A role
with a key but no model is left unconfigured and the server warns instead of
silently picking one.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_MAIN_MODEL` | _(none)_ | Primary model for general tasks |
| `AI_RESEARCH_MODEL` | _(none)_ | Model for research/online tasks |
| `AI_FALLBACK_MODEL` | _(none)_ | Fallback when primary unavailable |
| `AI_PRD_MODEL` | _(none)_ | Model for PRD generation |

Each role also accepts `AI_<ROLE>_PROVIDER`, `AI_<ROLE>_API_KEY` and
`AI_<ROLE>_BASE_URL` for per-role provider, key and endpoint overrides.

**AI Task Generation**

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_TASKS_PER_PRD` | `50` | Max tasks generated per PRD |
| `DEFAULT_COMPLEXITY_THRESHOLD` | `7` | Complexity threshold (1–10) for sub-task creation |
| `MAX_SUBTASK_DEPTH` | `3` | Max nesting depth for sub-tasks |
| `AI_BATCH_SIZE` | `10` | Batch size for parallel AI operations |
| `AI_SESSION_TOKEN_LIMIT` | `0` | Per-session token budget for AI task generation (0 = unlimited) |

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
| `WEBHOOK_HOST` | `127.0.0.1` | Interface the HTTP server binds (loopback by default) |
| `EVENTS_AUTH_TOKEN` | — | Bearer token required on `/events/*` (503 when unset, unless `EVENTS_ALLOW_UNAUTHENTICATED=true`) |
| `WEBHOOK_TRUSTED_PROXIES` | — | Comma-separated proxy IPs whose `X-Forwarded-For` is trusted |
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
| `AUDIT_LOG_ENABLED` / `AUDIT_LOG_PATH` | `false` / `.mcp-audit/mutations.jsonl` | Append-only JSONL audit of state-changing tool calls |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` | — / `mcp-github-project-manager` | Opt-in OpenTelemetry tracing |

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
for AI agents: <!-- count:actions -->175<!-- /count --> actions are grouped into <!-- count:tools -->21<!-- /count --> compound tools, each accepting
an `action` parameter.

```
MCP Client (Claude/Codex/Cursor)
  │  sees only <!-- count:tools -->21<!-- /count --> compound tools
  ▼
ToolRegistry.getToolsForMCP()
  │  returns compound tools filtered by MCP_TOOL_GROUPS (by group name)
  ▼
executeManageIssues / executeAnalytics / … (compound-executors.ts)
  │  validates action, routes to the service layer
  ▼
Services → repositories → GitHubRequestExecutor
```

### Tool Groups

| Compound Tool | Actions | Group | Domain |
|---------------|---------|-------|--------|
| `manage_project` | 38 | `core` | Project CRUD (incl. close/reopen), fields, views, items, templates, linking, collaborators |
| `manage_issues` | 22 | `core` | Issue CRUD, comments, drafts, search, sub-issues, blockers, issue types |
| `manage_prs` | 7 | `core` | PR CRUD, merge, reviews |
| `manage_milestones` | 7 | `core` | Milestone CRUD, metrics, deadlines |
| `manage_sprints` | 9 | `core` | Sprint planning, metrics, velocity, delete (needs `confirm: true`) |
| `manage_labels` | 2 | `core` | Label CRUD |
| `manage_automation` | 3 | `core` | Project workflows (list, get, delete) |
| `manage_iterations` | 5 | `core` | Iteration field management |
| `manage_status_updates` | 3 | `core` | Project status updates |
| `manage_branches` | 4 | `core` | Branch protection rules, branch listing |
| `manage_releases` | 6 | `core` | Release CRUD, latest release |
| `manage_workflows` | 6 | `core` | GitHub Actions workflows and runs |
| `manage_events` | 3 | `events` | Event subscription, replay |
| `ai_generate` | 9 | `ai` | PRD generation, task breakdown, traceability, task materialization |
| `ai_analyze` | 8 | `ai` | Issue enrichment, triage, duplicates, label suggestions |
| `ai_plan` | 6 | `ai` | Capacity, backlog, risk, roadmap |
| `agent_work` | 12 | `agents` | Agent registration, task lifecycle, review workflow |
| `agent_manage` | 18 | `agents` | Agent admin, budgets, work products, reclaim, metrics, PM coordination |
| `system` | 2 | `system` | Health check, agent field provisioning |
| `discover_tools` | — | `system` | Runtime tool/action/schema discovery (meta-tool) |
| `analytics` | 5 | `core` | Read-only sprint velocity, burndown, cycle time, throughput, project summary |

### Capability Profiles

The `MCP_TOOL_GROUPS` environment variable selects which compound tool
**groups** are exposed to MCP clients. It filters by group name, not by tool
name — a tool name in this variable exposes nothing.

| Profile | `MCP_TOOL_GROUPS` value | Use case |
|---------|------------------------|----------|
| Full (default) | `all` | All <!-- count:tools -->21<!-- /count --> tools exposed |
| Project management | `core` | CRUD-only agents |
| AI-powered | `core,ai` | Planning and analysis agents |
| Agent orchestration | `agents` | Autonomous task agents |
| Minimal | `core,events` | Simple issue/PR bots with event tracking |

`discover_tools` is always available regardless of `MCP_TOOL_GROUPS` setting,
allowing agents to introspect available capabilities at runtime. Every other
tool — including `system` — is subject to the filter.

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
│                approve_task · reject_task ·                         │
│                validate_work_product · get_handoff_context          │
│  agent_manage: list · deregister · get_activity ·                   │
│                submit_work_product · get_budget · set_budget ·      │
│                reclaim_stale · record_usage · get_metrics ·         │
│                setup_fields · assign_task · get_swarm_status ·      │
│                rebalance_workload · decompose_task · smart_assign · │
│                converge_project · converge_until_done ·              │
│                cleanup_registry                                     │
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
│  │ (file on   │ │ with markers     │ │ (agent_claimed_by, etc.)  │  │
│  │ a branch,  │ └──────────────────┘ └───────────────────────────┘  │
│  │ sha CAS)   │                                                     │
│  └────────────┘                                                     │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                  GitHub-Native Storage                               │
│  • Agent registry → registry.json on the agent-registry branch (CAS)│
│  • Task claims    → project custom fields (SINGLE_SELECT / TEXT)    │
│  • Work products  → structured issue comments (JSON marker blocks)  │
│  • Budgets        → agent registry metadata                         │
│  • Heartbeats     → item agent_heartbeat_at (hot) / lastHeartbeat   │
└─────────────────────────────────────────────────────────────────────┘
```

### GitHub-Native Data Model

The orchestration layer uses seven custom project fields (auto-provisioned by
`ProjectFieldSetup`):

| Field | Type | Purpose |
|-------|------|---------|
| `agent_claimed_by` | TEXT | Agent ID that currently owns the task |
| `agent_claimed_at` | TEXT | ISO 8601 timestamp of when the claim was made |
| `agent_status` | SINGLE_SELECT | Task status: `unclaimed`, `in_progress`, `review`, `blocked`, `completed` |
| `agent_work_branch` | TEXT | Git branch name the agent is working on |
| `agent_pr_number` | TEXT | Pull request number for the submitted work |
| `agent_heartbeat_at` | TEXT | ISO 8601 timestamp of the last heartbeat on the claimed item (hot state) |
| `agent_progress` | TEXT | 0-100 progress of the claimed item as last reported |

Agent records are stored as one file, `registry.json`, on a dedicated orphan
branch `agent-registry` (`AGENT_REGISTRY_BRANCH` / `AGENT_REGISTRY_FILE`),
written through the GitHub Contents API. Work products are stored as structured
issue comments with a `<!-- agent-work-product: -->` HTML comment marker for
machine-parseable retrieval.

**Why a file on a branch, not an issue body.** An issue body is last-write-wins:
two writers could both read the registry, both write, and both succeed while one
registration silently vanished (an agent registered and was "not found" a moment
later). `PUT /contents` is a compare-and-swap — the request carries the blob sha
that was read and GitHub answers **409** when the file changed since — so a lost
update is impossible by construction. `AgentStore.mutateAgents` reads the file
and its sha, applies the mutation, and writes with that sha; on a conflict it
re-reads, re-applies the mutation on the fresh list and retries with jittered
exponential backoff (50 attempts by default). Exhaustion **throws**; a mutation
that changes nothing writes nothing. Two writers of the same agent end with the
record that was committed last, whole — never a mix of the two.

**Evidence behind the design (live GitHub API).** Eight parallel `PUT`s carrying
the same sha: exactly one 200, six 409s (the eighth never reached GitHub — a
local DNS failure). Reading
`getContent(ref=agent-registry)` right after a write returned the written sha in
25 of 25 cycles (and `git.getRef` the new commit in 25 of 25), so a registration
is visible to the very next read from any process and the plain branch-name read
is used. An empty repository (no commits) is refused with an explanatory error:
the Git Data API cannot bootstrap a branch there, and a Contents API write would
turn the registry branch into the default branch.

**Bootstrap and one-time migration.** The first access creates the branch (blob,
tree, parentless commit, then `git.createRef`); `createRef` is the arbiter, so
two processes racing to bootstrap yield one branch (the loser gets 422
"Reference already exists" and re-reads). When a legacy registry issue (title
`Agent Registry`, or label `agent-registry`) exists, its agents are imported into
the new branch — duplicate issues folded with the record written last winning,
a corrupt canonical body failing closed, a corrupt duplicate skipped — and each
imported issue's body is rewritten to a human-readable pointer to
`agent-registry:registry.json` (not JSON, so it is never imported again). The
issue itself is kept. `AgentStore.registryExists()` stays read-only: true when
the branch exists or a legacy registry issue is still waiting to be migrated.

**Permissions.** Registry writes need the `contents: write` permission, and no
branch ruleset or protection may block the `agent-registry` branch. A rejected
write raises an error naming the branch and the permission.

**Native GitHub primitives, not emulations.** The orchestration layer uses
GitHub's own models wherever they exist: the "blocked by" relation is the
`Issue.blockedBy` / `Issue.blocking` edge (written with `addBlockedBy` /
`removeBlockedBy`) instead of a `blocked-by:#N` label; the issue kind is the
`Issue.issueType` written with `updateIssueIssueType` instead of a `type:`
label; a task's board membership is `Issue.projectItems(includeArchived: true)`,
which is how a task that is already claimed on another board is recognised; a
project's access is `updateProjectV2Collaborators`; and a claiming pool is a
project view (`ProjectV2View.filter` / `sortByFields`), whose order the claim
path follows. The label emulations remain the fallback for a deployment whose
schema does not know the native field, so a board wired up before the native
API existed keeps working.

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
    │              └── beat stored on the claimed item (hot); registry only on cold change; stale after 30 min
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

*Last updated: 2026-11-02 — reconciled against the code after the remediation (auth precedence, request executor, error contract, idempotency, audit log, OTel, analytics tool).*
