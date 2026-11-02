# API Reference

This document provides API reference documentation for the key services and infrastructure components in the MCP GitHub Project Manager.

## Table of Contents

1. [Services](#services)
   - [AIServiceFactory](#aiservicefactory)
   - [ProjectManagementService](#projectmanagementservice)
   - [HealthService](#healthservice)
2. [Infrastructure](#infrastructure)
   - [CircuitBreakerService](#circuitbreakerservice)
   - [AIResiliencePolicy](#airesiliencepolicy)
   - [CorrelationContext](#correlationcontext)
   - [ResourceCache](#resourcecache)
   - [ConsoleLogger](#consolelogger)
   - [GitHubRequestExecutor](#githubrequestexecutor)
   - [IdempotencyStore](#idempotencystore)
   - [MutationAuditLog](#mutationauditlog)
3. [Types](#types)
4. [Configuration](#configuration)

---

## Services

### AIServiceFactory

Factory for creating AI service instances with Vercel AI SDK. Provides model access, resilience features, and graceful degradation.

**Location:** `src/services/ai/AIServiceFactory.ts`

> **MCP sampling — scope of support.** The last-resort AI fallback uses the MCP
> `sampling/createMessage` request: when no provider key is configured and the
> client declares the sampling capability, the server routes the completion
> back to the client. The 2026-07-28 MCP specification marks `roots` and
> `sampling` as deprecated in favour of the elicitation flow, so this path is
> intentionally kept at the 2025-era shape: it works with clients that
> implement `sampling/createMessage` and is simply not offered to clients that
> only implement the newer elicitation-based flow. A client without a sampling
> capability gets the documented "no AI provider configured" failure instead
> of a silent hang.

#### Static Methods

##### getInstance()

Get the singleton instance of AIServiceFactory.

```typescript
static getInstance(): AIServiceFactory
```

**Returns:** The singleton AIServiceFactory instance

**Example:**
```typescript
const factory = AIServiceFactory.getInstance();
```

#### Instance Methods

##### getModel(type)

Get an AI model instance for a specific use case.

```typescript
getModel(type: 'main' | 'research' | 'fallback' | 'prd'): LanguageModel | null
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Model type: 'main', 'research', 'fallback', or 'prd' |

**Returns:** LanguageModel instance or null if unavailable

**Example:**
```typescript
const model = factory.getModel('main');
if (model) {
  const result = await generateText({ model, prompt: 'Hello' });
}
```

##### getMainModel()

Get the main AI model for general task generation.

```typescript
getMainModel(): LanguageModel | null
```

##### getResearchModel()

Get the research AI model for enhanced analysis.

```typescript
getResearchModel(): LanguageModel | null
```

##### getFallbackModel()

Get the fallback AI model when main model fails.

```typescript
getFallbackModel(): LanguageModel | null
```

##### getPRDModel()

Get the PRD AI model for PRD generation.

```typescript
getPRDModel(): LanguageModel | null
```

##### getBestAvailableModel()

Get the best available model with fallback logic.

```typescript
getBestAvailableModel(): LanguageModel | null
```

**Tries models in order:** main -> fallback -> prd -> research

##### isAIAvailable()

Check if any AI models are configured and available.

```typescript
isAIAvailable(): boolean
```

**Returns:** true if at least one model is available

##### validateConfiguration()

Validate the AI service configuration.

```typescript
validateConfiguration(): ConfigStatus
```

**Returns:** Configuration status object

```typescript
interface ConfigStatus {
  isValid: boolean;
  availableModels: string[];
  unavailableModels: string[];
  warnings: string[];
}
```

##### enableResilience(config?)

Enable resilience features for AI calls.

```typescript
enableResilience(config?: AIResilienceConfig): void
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| config.maxRetries | number | Max retry attempts (default: 3) |
| config.timeoutMs | number | Timeout per operation (default: 30000) |
| config.halfOpenAfterMs | number | Circuit half-open time (default: 30000) |
| config.consecutiveFailures | number | Failures before circuit opens (default: 5) |

**Example:**
```typescript
factory.enableResilience({
  maxRetries: 2,
  timeoutMs: 15000
});
```

##### isResilienceEnabled()

Check if resilience is enabled.

```typescript
isResilienceEnabled(): boolean
```

##### getCircuitState()

Get the current circuit breaker state.

```typescript
getCircuitState(): 'closed' | 'open' | 'half-open' | 'disabled'
```

##### executeWithResilience(operation, fallback?)

Execute an AI operation with resilience protection.

```typescript
async executeWithResilience<T>(
  operation: () => Promise<T>,
  fallback?: () => T | DegradedResult
): Promise<T | DegradedResult>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| operation | function | Async operation to execute |
| fallback | function | Optional fallback for graceful degradation |

**Returns:** Operation result or DegradedResult

**Example:**
```typescript
factory.enableResilience();

const result = await factory.executeWithResilience(
  () => generateText({ model, prompt: 'Analyze this' }),
  () => ({ degraded: true, message: 'Using cached response' })
);

if ('degraded' in result) {
  console.log('AI unavailable:', result.message);
} else {
  console.log('AI response:', result);
}
```

---

### ProjectManagementService

Thin composition facade (121 lines, getters only) over 13 injected per-feature services. It has no methods of its own: callers go straight to the owning service.

**Location:** `src/services/ProjectManagementService.ts`

#### Constructor

```typescript
constructor(
  subIssueService: SubIssueService,
  milestoneService: MilestoneService,
  sprintPlanningService: SprintPlanningService,
  projectStatusService: ProjectStatusService,
  templateService: ProjectTemplateService,
  linkingService: ProjectLinkingService,
  issueService: IssueService,
  roadmapService: RoadmapService,
  automationService: ProjectAutomationService,
  pullRequestService: PullRequestService,
  fieldValueService: FieldValueService,
  labelService: LabelService,
  iterationService: IterationService
)
```

#### Getters

| Getter | Service |
|--------|---------|
| `issues` | `IssueService` |
| `subIssues` | `SubIssueService` |
| `milestones` | `MilestoneService` |
| `sprints` | `SprintPlanningService` |
| `projects` | `ProjectStatusService` |
| `templates` | `ProjectTemplateService` |
| `linking` | `ProjectLinkingService` |
| `roadmap` | `RoadmapService` |
| `automation` | `ProjectAutomationService` |
| `pullRequests` | `PullRequestService` |
| `fieldValues` | `FieldValueService` |
| `labels` | `LabelService` |
| `iterations` | `IterationService` |

```typescript
const issue = await pms.issues.createIssue({ title: 'Bug' });
const sprint = await pms.sprints.createSprint(params);
```

---

### Extracted Domain Services

These services are the per-feature building blocks behind the facade getters:

#### PullRequestService

**Location:** `src/services/PullRequestService.ts`

Manages pull request operations: create, list, get, merge, create review, list reviews, get diff.

#### FieldValueService

**Location:** `src/services/FieldValueService.ts`

Manages project field values: set field value, get field value, clear field value, list project fields, create/update project fields.

Field values can be set for the field types GitHub's `ProjectV2CustomFieldType`
covers: `TEXT`, `NUMBER`, `DATE`, `SINGLE_SELECT`, `MULTI_SELECT` and
`ITERATION`.

#### LabelService

**Location:** `src/services/LabelService.ts`

Manages repository labels: create label, list labels.

#### IterationService

**Location:** `src/services/IterationService.ts`

Manages project iterations: configure iteration field, list iterations, get current iteration, assign item to iteration, date-based assignment.

---

### Agent Services

Services supporting autonomous agent workflows (all under `src/services/agent/`):

#### TaskCheckoutService

**Location:** `src/services/agent/TaskCheckoutService.ts`

Manages agent task checkout/checkin lifecycle: checkout task, checkin task, get checkout status, list active checkouts.

#### AgentContextService

**Location:** `src/services/agent/AgentContextService.ts`

Generates task context for agents: get task context, get related context, get dependency context.

#### WorkProductService

**Location:** `src/services/agent/WorkProductService.ts`

Manages agent work products: submit work product, list work products, get work product.

#### AgentBudgetService

**Location:** `src/services/agent/AgentBudgetService.ts`

Tracks agent resource budgets: get budget, update budget, check budget, list budgets, reset budget.

#### AgentMetricsService

**Location:** `src/services/agent/AgentMetricsService.ts`

Aggregate and per-agent orchestration metrics: throughput, cycle time, budget burn, staleness.

#### AgentReclaimScheduler

**Location:** `src/services/agent/AgentReclaimScheduler.ts`

Server-side background sweep that reclaims tasks from agents whose heartbeat has
gone stale and flags those agents `offline`.

---

### HealthService

Centralized health check logic for system monitoring.

**Location:** `src/infrastructure/health/HealthService.ts`

#### Constructor

```typescript
constructor(deps?: HealthServiceDependencies)
```

**Dependencies:**
```typescript
interface HealthServiceDependencies {
  aiFactory?: AIServiceFactory;
  aiResilience?: AIResiliencePolicy;
  cache?: ResourceCache;
}
```

#### Methods

##### check()

Perform a comprehensive health check.

```typescript
async check(): Promise<HealthStatus>
```

**Returns:** Complete health status

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    github: {
      connected: boolean;
      rateLimit?: { remaining: number; limit: number; };
    };
    ai: {
      available: boolean;
      circuitState: 'closed' | 'open' | 'half-open' | 'disabled';
      models: { available: string[]; unavailable: string[]; };
    };
    cache: {
      entries: number;
      persistenceEnabled: boolean;
      lastPersist?: string;
    };
  };
}
```

**Status determination:**
- `unhealthy`: GitHub is not connected
- `degraded`: AI unavailable or circuit is open
- `healthy`: All services operational

**Example:**
```typescript
const healthService = new HealthService({
  aiFactory: AIServiceFactory.getInstance(),
  cache: ResourceCache.getInstance()
});

const status = await healthService.check();
if (status.status === 'degraded') {
  console.log('System running in degraded mode');
}
```

---

## Infrastructure

### CircuitBreakerService

Wraps Cockatiel circuit breaker for resilient operations.

**Location:** `src/infrastructure/resilience/CircuitBreakerService.ts`

#### Constructor

```typescript
constructor(name: string, config?: CircuitBreakerConfig)
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| name | string | Identifier for logging |
| config.halfOpenAfter | number | Time before circuit tests recovery (default: 30000ms) |
| config.consecutiveFailures | number | Failures before circuit opens (default: 5) |

#### Methods

##### execute(fn)

Execute an operation through the circuit breaker.

```typescript
async execute<T>(fn: () => Promise<T>): Promise<T>
```

**Behavior:**
- Circuit closed: Operation executes normally
- Circuit open: Operation fails fast without executing
- Circuit half-open: Operation executes to test recovery

##### getState()

Get the current circuit state.

```typescript
getState(): 'closed' | 'open' | 'half-open'
```

##### isOpen()

Check if circuit is blocking requests.

```typescript
isOpen(): boolean
```

**Example:**
```typescript
const breaker = new CircuitBreakerService('API', {
  consecutiveFailures: 3,
  halfOpenAfter: 10000
});

try {
  const result = await breaker.execute(() => fetchAPI());
} catch (error) {
  if (breaker.isOpen()) {
    console.log('Circuit is open, service unavailable');
  }
}
```

---

### AIResiliencePolicy

Composed resilience policy for AI service calls.

**Location:** `src/infrastructure/resilience/AIResiliencePolicy.ts`

#### Constructor

```typescript
constructor(config?: AIResilienceConfig)
```

**Configuration:**
```typescript
interface AIResilienceConfig {
  maxRetries?: number;        // Default: 3
  timeoutMs?: number;         // Default: 30000
  halfOpenAfterMs?: number;   // Default: 30000
  consecutiveFailures?: number; // Default: 5
}
```

#### Methods

##### execute(operation, fallback?)

Execute an operation with full resilience protection.

```typescript
async execute<T>(
  operation: () => Promise<T>,
  fallbackFn?: () => T | DegradedResult
): Promise<T | DegradedResult>
```

**Protection layers (outer to inner):**
1. Fallback - catches all failures
2. Retry - retries with exponential backoff
3. Circuit Breaker - prevents cascading failures
4. Timeout - ensures timely completion

##### getCircuitState()

Get circuit breaker state.

```typescript
getCircuitState(): 'closed' | 'open' | 'half-open'
```

##### isCircuitOpen()

Check if circuit is open.

```typescript
isCircuitOpen(): boolean
```

##### getConfig()

Get the resolved configuration.

```typescript
getConfig(): Readonly<Required<AIResilienceConfig>>
```

**Example:**
```typescript
const policy = new AIResiliencePolicy({
  maxRetries: 2,
  timeoutMs: 5000
});

const result = await policy.execute(
  () => aiService.generateText(prompt),
  () => ({ degraded: true, message: 'AI unavailable' })
);
```

---

### CorrelationContext

AsyncLocalStorage-based correlation ID tracking for request tracing.

**Location:** `src/infrastructure/observability/CorrelationContext.ts`

#### Functions

##### startTrace(operation, fn)

Start a new trace for an operation.

```typescript
async function startTrace<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| operation | string | Name of the operation being traced |
| fn | function | Async operation to execute |

**Logs to stderr:**
```json
{"timestamp": "...", "type": "trace", "correlationId": "uuid", "operation": "...", "status": "start"}
{"timestamp": "...", "type": "trace", "correlationId": "uuid", "operation": "...", "status": "success", "durationMs": 123}
```

##### getCorrelationId()

Get the current correlation ID.

```typescript
function getCorrelationId(): string | undefined
```

**Returns:** Correlation ID if within a trace, undefined otherwise

##### getTraceContext()

Get the full trace context.

```typescript
function getTraceContext(): TraceContext | undefined
```

```typescript
interface TraceContext {
  correlationId: string;
  startTime: number;
  operation: string;
}
```

**Example:**
```typescript
await startTrace('processRequest', async () => {
  console.log(`Trace ID: ${getCorrelationId()}`);
  // Any nested calls can access the same correlation ID
  return await processData();
});
```

---

### ResourceCache

In-memory cache with optional persistence.

**Location:** `src/infrastructure/cache/ResourceCache.ts`

#### Static Methods

##### getInstance()

Get the singleton cache instance.

```typescript
static getInstance(): ResourceCache
```

#### Instance Methods

##### set(type, id, value, options?)

Cache a resource.

```typescript
async set<T>(
  type: ResourceType,
  id: string,
  value: T,
  options?: ResourceCacheOptions
): Promise<void>
```

**Options:**
```typescript
interface ResourceCacheOptions {
  ttl?: number;           // Time-to-live in ms (default: 1 hour)
  tags?: string[];        // Tags for filtering
  namespaces?: string[];  // Namespaces for grouping
}
```

##### get(type, id, options?)

Get a cached resource.

```typescript
async get<T extends Resource>(
  type: ResourceType,
  id: string,
  options?: ResourceCacheOptions
): Promise<T | null>
```

##### getByType(type, options?)

Get all resources of a type.

```typescript
async getByType<T extends Resource>(
  type: ResourceType,
  options?: ResourceCacheOptions
): Promise<T[]>
```

##### getByTag(tag, type?, options?)

Get resources by tag.

```typescript
async getByTag<T extends Resource>(
  tag: string,
  type?: ResourceType,
  options?: ResourceCacheOptions
): Promise<T[]>
```

##### enablePersistence(filePath?)

Enable cache persistence to disk.

```typescript
enablePersistence(filePath?: string): void
```

**Default path:** `~/.cache/mcp-github-pm/resource-cache.json`

##### persist()

Manually trigger cache persistence.

```typescript
async persist(): Promise<void>
```

##### getStats()

Get cache statistics.

```typescript
getStats(): CacheStats
```

```typescript
interface CacheStats {
  size: number;
  tagCount: number;
  typeCount: number;
  namespaceCount: number;
  persistenceEnabled: boolean;
  lastPersist?: string;
}
```

**Example:**
```typescript
const cache = ResourceCache.getInstance();
cache.enablePersistence();

await cache.set('project', 'proj_123', projectData, {
  ttl: 3600000,
  tags: ['active']
});

const project = await cache.get('project', 'proj_123');
const activeProjects = await cache.getByTag('active', 'project');
```

---

### ConsoleLogger

Stderr logger (stdout is the MCP channel). Honors `LOG_LEVEL` and `LOG_FORMAT`; arguments pass through `redactSecrets()`.

**Location:** `src/infrastructure/logger/index.ts`

#### Interface

```typescript
interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

Obtain one with `getLogger('MyService')` / `createLogger(prefix?)`; `logger` is the shared default instance. `NoopLogger` discards everything.

**JSON format (`LOG_FORMAT=json`):** one object per line, `correlationId` is the active trace's id (or `no-trace`):
```json
{
  "timestamp": "2026-11-02T12:00:00.000Z",
  "level": "info",
  "correlationId": "uuid-from-trace",
  "operation": "manage_issues",
  "message": "Operation completed",
  "data": { "key": "value" },
  "durationMs": 12
}
```

**Example:**
```typescript
const log = getLogger('MyService');

await startTrace('operation', async () => {
  log.info('Starting operation', { input: data });
  log.info('Operation complete', { result: output });
});
```

---

### GitHubRequestExecutor

The one retry and rate-limit path for every GitHub call (REST and GraphQL). Gates each call on the shared `RateLimitManager` budget (`RATE_LIMIT_FLOOR`), retries retryable failures up to 3 attempts with GitHub-aware backoff, and converts terminal failures to structured errors. Shared per Octokit instance via `GitHubRequestExecutor.for(octokit)`.

**Location:** `src/infrastructure/github/GitHubRequestExecutor.ts`

```typescript
run<T>(kind: 'graphql' | 'rest', operation: () => Promise<T>, context: string, cost?: number): Promise<T>
graphql<T>(octokit, query: string, variables: Record<string, unknown>, context: string): Promise<T>
```

Credentials come from `resolveGitHubAuth()` (`GitHubAuthResolver.ts`; a complete GitHub App config outranks the PAT) and repositories are built with `GitHubRepositoryFactory.fromAuth(auth, owner, repo)`.

---

### IdempotencyStore

Replays the first result of a create action for a repeated `idempotencyKey` (same key + same request fingerprint within the TTL, default 24 h). The same key with a different request raises `IdempotencyConflictError`. Only the creates listed in `isIdempotentCreate` honour the key. A result recovered from the audit log is returned as its summary.

**Location:** `src/infrastructure/idempotency/IdempotencyStore.ts` (`getIdempotencyStore()` returns the shared instance)

---

### MutationAuditLog

Builds redacted records of state-changing tool calls and hands them to a sink (JSONL file at `AUDIT_LOG_PATH`, default `.mcp-audit/mutations.jsonl`, when `AUDIT_LOG_ENABLED=true`). Created with `createMutationAuditLog(config, sink?)`; the container registers it and `ToolDispatcher` writes to it.

**Location:** `src/infrastructure/observability/MutationAuditLog.ts`

---

## Types

### DegradedResult

Returned when AI service uses fallback.

```typescript
interface DegradedResult {
  degraded: true;
  message: string;
}
```

### HealthStatus

System health status from HealthService.

```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: ServiceHealthStatus;
}
```

### CircuitBreakerState

Circuit breaker state.

```typescript
type CircuitBreakerState = 'closed' | 'open' | 'half-open';
```

### ResourceType

Supported resource types for caching.

```typescript
type ResourceType =
  | 'project'
  | 'issue'
  | 'pull_request'
  | 'milestone'
  | 'sprint'
  | 'label'
  | 'user'
  | 'comment'
  | 'review';
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| GITHUB_TOKEN | GitHub personal access token (not required with a complete GitHub App config) | Yes (or App) |
| GITHUB_OWNER | Repository owner | Yes |
| GITHUB_REPO | Repository name | Yes |
| GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID | GitHub App installation auth (outranks the PAT when all three are set) | No |
| ANTHROPIC_API_KEY | Anthropic API key for Claude models | No* |
| OPENAI_API_KEY | OpenAI API key for GPT models | No* |
| GOOGLE_API_KEY | Google API key for Gemini models | No* |
| PERPLEXITY_API_KEY | Perplexity API key | No* |
| AI_MAIN_MODEL | Main AI model | No |
| AI_RESEARCH_MODEL | Research AI model | No |
| AI_FALLBACK_MODEL | Fallback AI model | No |
| AI_PRD_MODEL | PRD generation AI model | No |

*At least one AI provider key is required for AI features.

There are **no default models** — a role with a key but no model is left
unconfigured and the server warns rather than silently picking one. See
[CONFIGURATION.md](CONFIGURATION.md) for the full environment reference.

### Model Configuration

Models are auto-detected based on name:

| Prefix | Provider |
|--------|----------|
| `claude-` | Anthropic |
| `gpt-`, `o1` | OpenAI |
| `gemini-` | Google |
| `llama`, `sonar`, `perplexity` | Perplexity |

**Example .env:**
```bash
GITHUB_TOKEN=ghp_xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
AI_MAIN_MODEL=claude-sonnet-4-20250514
AI_FALLBACK_MODEL=gpt-4o-mini
```

---

## Source Files

| Component | Location |
|-----------|----------|
| AIServiceFactory | `src/services/ai/AIServiceFactory.ts` |
| ProjectManagementService | `src/services/ProjectManagementService.ts` |
| HealthService | `src/infrastructure/health/HealthService.ts` |
| CircuitBreakerService | `src/infrastructure/resilience/CircuitBreakerService.ts` |
| AIResiliencePolicy | `src/infrastructure/resilience/AIResiliencePolicy.ts` |
| CorrelationContext | `src/infrastructure/observability/CorrelationContext.ts` |
| ResourceCache | `src/infrastructure/cache/ResourceCache.ts` |
| ConsoleLogger | `src/infrastructure/logger/index.ts` |
| GitHubRequestExecutor | `src/infrastructure/github/GitHubRequestExecutor.ts` |
| IdempotencyStore | `src/infrastructure/idempotency/IdempotencyStore.ts` |
| MutationAuditLog | `src/infrastructure/observability/MutationAuditLog.ts` |
| DI Container | `src/container.ts` |

---

*Refreshed: 2026-11-02 — MCP GitHub Project Manager v3.0.0*
