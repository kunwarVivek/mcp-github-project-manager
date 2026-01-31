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
   - [TracingLogger](#tracinglogger)
3. [Types](#types)
4. [Configuration](#configuration)

---

## Services

### AIServiceFactory

Factory for creating AI service instances with Vercel AI SDK. Provides model access, resilience features, and graceful degradation.

**Location:** `src/services/ai/AIServiceFactory.ts`

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

Central facade for all project management operations. Delegates to specialized services.

**Location:** `src/services/ProjectManagementService.ts`

#### Constructor

```typescript
constructor(factory: GitHubRepositoryFactory)
```

#### Key Methods

##### createProject(params)

Create a new GitHub project.

```typescript
async createProject(params: CreateProjectParams): Promise<Project>
```

##### getProject(projectId)

Get project details.

```typescript
async getProject(projectId: string): Promise<Project | null>
```

##### updateProject(projectId, params)

Update a project.

```typescript
async updateProject(projectId: string, params: UpdateProjectParams): Promise<Project>
```

##### createIssue(params)

Create a new issue.

```typescript
async createIssue(params: CreateIssueParams): Promise<Issue>
```

##### createMilestone(params)

Create a new milestone.

```typescript
async createMilestone(params: CreateMilestoneParams): Promise<Milestone>
```

##### createSprint(params)

Create a new sprint.

```typescript
async createSprint(params: CreateSprintParams): Promise<Sprint>
```

**Note:** See `src/services/ProjectManagementService.ts` for the full list of 34+ methods.

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

### TracingLogger

Logger with correlation ID in every JSON log entry.

**Location:** `src/infrastructure/observability/TracingLogger.ts`

#### Constructor

```typescript
constructor(context?: string)
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| context | string | Logger context name (e.g., service name) |

#### Methods

##### info(message, data?)

Log info level message.

```typescript
info(message: string, data?: Record<string, unknown>): void
```

##### warn(message, data?)

Log warning level message.

```typescript
warn(message: string, data?: Record<string, unknown>): void
```

##### error(message, error?, data?)

Log error level message.

```typescript
error(message: string, error?: Error, data?: Record<string, unknown>): void
```

##### debug(message, data?)

Log debug level message.

```typescript
debug(message: string, data?: Record<string, unknown>): void
```

**Log format:**
```json
{
  "timestamp": "2024-01-31T12:00:00.000Z",
  "level": "info",
  "correlationId": "uuid-from-trace",
  "context": "MyService",
  "message": "Operation completed",
  "data": { "key": "value" }
}
```

**Example:**
```typescript
const logger = new TracingLogger('MyService');

await startTrace('operation', async () => {
  logger.info('Starting operation', { input: data });
  // ...
  logger.info('Operation complete', { result: output });
});
```

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
| GITHUB_TOKEN | GitHub personal access token | Yes |
| ANTHROPIC_API_KEY | Anthropic API key for Claude models | No* |
| OPENAI_API_KEY | OpenAI API key for GPT models | No* |
| GOOGLE_API_KEY | Google API key for Gemini models | No* |
| PERPLEXITY_API_KEY | Perplexity API key | No* |
| AI_MAIN_MODEL | Main AI model (e.g., claude-3-5-sonnet-20241022) | No |
| AI_RESEARCH_MODEL | Research AI model | No |
| AI_FALLBACK_MODEL | Fallback AI model | No |
| AI_PRD_MODEL | PRD generation AI model | No |

*At least one AI provider key is required for AI features.

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
AI_MAIN_MODEL=claude-3-5-sonnet-20241022
AI_FALLBACK_MODEL=gpt-4o
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
| TracingLogger | `src/infrastructure/observability/TracingLogger.ts` |
| DI Container | `src/container.ts` |

---

*Generated: 2026-01-31*
*MCP GitHub Project Manager v1.0*
