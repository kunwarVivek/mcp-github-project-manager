# Phase 5: Resilience and Observability - Research

**Researched:** 2026-01-31
**Domain:** Resilience patterns, observability, and graceful degradation for MCP servers
**Confidence:** HIGH

## Summary

This phase adds production-ready resilience and observability infrastructure to the MCP GitHub Project Manager. The research covers circuit breaker patterns for AI service protection, health check design for MCP servers (which use stdio transport), correlation ID tracing, cache persistence, and graceful degradation strategies.

The codebase already has a solid foundation:
- `AIServiceFactory` with fallback model logic (`getBestAvailableModel()`)
- `ResourceCache` as in-memory singleton with TTL support
- `FilePersistenceAdapter` with atomic writes and compression
- `ConsoleLogger` that writes to stderr (MCP-compatible)
- Environment configuration pattern in `env.ts`

**Primary recommendation:** Use Cockatiel for circuit breaker/retry/timeout policies (composable, TypeScript-first), add JSON file persistence to ResourceCache, implement correlation IDs via AsyncLocalStorage, and expose health check as an MCP tool rather than HTTP endpoint (since stdio transport is default).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cockatiel | ^3.2.1 | Circuit breaker, retry, timeout, fallback | TypeScript-first, composable policies, excellent API design, inspired by .NET Polly |
| uuid | ^11.1.0 | Correlation ID generation | Already in codebase, standard for UUIDs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-persist | ^4.0.0 | File-based cache persistence | Alternative if JSON file approach proves insufficient |
| find-cache-dir | ^5.0.0 | Standard cache directory location | Cross-platform cache directory discovery |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cockatiel | opossum | Opossum is more popular but less TypeScript-native; cockatiel has cleaner composable API |
| JSON file persistence | node-persist | node-persist is heavier but handles edge cases; JSON is simpler and sufficient for this use case |
| AsyncLocalStorage | cls-hooked | AsyncLocalStorage is Node.js native (16+), no external dependency |

**Installation:**
```bash
npm install cockatiel
# uuid already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── infrastructure/
│   ├── resilience/           # NEW: Circuit breaker, retry policies
│   │   ├── CircuitBreakerService.ts
│   │   ├── AIResiliencePolicy.ts
│   │   └── index.ts
│   ├── observability/        # NEW: Tracing, correlation
│   │   ├── CorrelationContext.ts
│   │   ├── TracingLogger.ts
│   │   └── index.ts
│   ├── cache/
│   │   ├── ResourceCache.ts  # MODIFY: Add persistence
│   │   └── CachePersistence.ts  # NEW
│   └── health/               # NEW: Health check implementation
│       ├── HealthService.ts
│       └── index.ts
```

### Pattern 1: Composable Resilience Policies

**What:** Use Cockatiel's `wrap()` to combine retry, circuit breaker, timeout, and fallback into a single policy.

**When to use:** For all AI service calls that may fail or timeout.

**Example:**
```typescript
// Source: https://github.com/connor4312/cockatiel
import {
  wrap,
  retry,
  circuitBreaker,
  timeout,
  fallback,
  handleAll,
  ExponentialBackoff,
  ConsecutiveBreaker
} from 'cockatiel';

// Create AI resilience policy
const aiPolicy = wrap(
  // Fallback returns graceful degradation response
  fallback(handleAll, () => ({
    success: false,
    degraded: true,
    message: 'AI service unavailable, returning partial results'
  })),

  // Retry with exponential backoff (3 attempts)
  retry(handleAll, {
    maxAttempts: 3,
    backoff: new ExponentialBackoff({ initialDelay: 1000, maxDelay: 10000 })
  }),

  // Circuit breaker (open after 5 consecutive failures)
  circuitBreaker(handleAll, {
    halfOpenAfter: 30 * 1000,
    breaker: new ConsecutiveBreaker(5)
  }),

  // Timeout (30 seconds for AI calls)
  timeout(30 * 1000)
);

// Usage
const result = await aiPolicy.execute(
  ({ signal }) => generatePRD(params, signal)
);
```

### Pattern 2: Correlation ID with AsyncLocalStorage

**What:** Use Node.js AsyncLocalStorage to propagate correlation IDs through async operations without manual passing.

**When to use:** For all MCP request handling, ensuring every log entry includes a traceable ID.

**Example:**
```typescript
// Source: Node.js documentation
import { AsyncLocalStorage } from 'node:async_hooks';
import { v4 as uuidv4 } from 'uuid';

interface RequestContext {
  correlationId: string;
  startTime: number;
  operation: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

// Wrap MCP tool execution
function withCorrelation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const context: RequestContext = {
    correlationId: uuidv4(),
    startTime: Date.now(),
    operation
  };

  return requestContext.run(context, fn);
}

// Get current correlation ID in any async context
function getCorrelationId(): string {
  return requestContext.getStore()?.correlationId ?? 'no-context';
}
```

### Pattern 3: MCP Health Check as Tool

**What:** Since MCP uses stdio transport (no HTTP server by default), expose health check as an MCP tool rather than HTTP endpoint.

**When to use:** For the primary health check mechanism. HTTP endpoint is optional for external monitoring.

**Example:**
```typescript
// Health check MCP tool
const healthCheckTool = {
  name: 'health_check',
  description: 'Check system health and service availability',
  inputSchema: { type: 'object', properties: {} },
  async execute(): Promise<HealthStatus> {
    return {
      status: 'healthy', // 'healthy' | 'degraded' | 'unhealthy'
      timestamp: new Date().toISOString(),
      services: {
        github: await checkGitHubConnection(),
        ai: {
          available: aiFactory.isAIAvailable(),
          circuitState: getAICircuitState(), // 'closed' | 'open' | 'half-open'
          availableModels: aiFactory.validateConfiguration().availableModels
        },
        cache: {
          entries: cache.getSize(),
          persisted: await checkCachePersistence()
        }
      },
      uptime: process.uptime()
    };
  }
};
```

### Pattern 4: Cache Persistence with JSON

**What:** Extend ResourceCache to periodically persist to JSON file, restore on startup.

**When to use:** For cache entries that should survive server restart.

**Example:**
```typescript
// Source: Existing FilePersistenceAdapter pattern
interface CacheSnapshot {
  version: 1;
  timestamp: string;
  entries: Array<{
    key: string;
    value: unknown;
    expiresAt?: number;
    tags?: string[];
  }>;
}

class CachePersistence {
  private readonly filePath: string;

  constructor(cacheDirectory: string) {
    this.filePath = path.join(cacheDirectory, 'cache-snapshot.json');
  }

  async save(cache: ResourceCache): Promise<void> {
    const snapshot: CacheSnapshot = {
      version: 1,
      timestamp: new Date().toISOString(),
      entries: cache.getAllEntries()
    };
    await fs.writeFile(
      this.filePath,
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );
  }

  async restore(cache: ResourceCache): Promise<number> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const snapshot = JSON.parse(data) as CacheSnapshot;
      let restored = 0;
      for (const entry of snapshot.entries) {
        if (!entry.expiresAt || entry.expiresAt > Date.now()) {
          await cache.set(entry.type, entry.id, entry.value, {
            ttl: entry.expiresAt ? entry.expiresAt - Date.now() : undefined,
            tags: entry.tags
          });
          restored++;
        }
      }
      return restored;
    } catch {
      return 0; // No snapshot or corrupted
    }
  }
}
```

### Anti-Patterns to Avoid

- **Retry without backoff:** Always use exponential backoff for retries to avoid overwhelming failing services.
- **Circuit breaker with too low threshold:** 5 consecutive failures is a good minimum; 2-3 can trigger on transient issues.
- **Synchronous cache persistence:** Always persist asynchronously to avoid blocking MCP responses.
- **HTTP health endpoint without stdio alternative:** MCP clients can't access HTTP; provide tool-based health check.
- **Correlation ID in function parameters:** Use AsyncLocalStorage to avoid polluting function signatures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker | Custom state machine | Cockatiel | Complex state transitions, half-open testing, statistics |
| Retry with backoff | setTimeout loops | Cockatiel ExponentialBackoff | Jitter, max delay, exponential calculation |
| Policy composition | Nested try/catch | Cockatiel wrap() | Order matters, context propagation |
| Correlation ID propagation | Manual parameter passing | AsyncLocalStorage | Works across async boundaries without pollution |
| Cache serialization | Custom binary format | JSON.stringify | Debugging, portability, built-in |

**Key insight:** Resilience patterns look simple but have subtle edge cases (half-open state, backoff jitter, concurrent requests during circuit trip). Libraries handle these correctly.

## Common Pitfalls

### Pitfall 1: Circuit Breaker Opens Too Aggressively

**What goes wrong:** Circuit opens on a few slow responses, blocking legitimate requests.

**Why it happens:** Timeout set too low, or using error count without considering success rate.

**How to avoid:**
- Use `ConsecutiveBreaker(5)` for consecutive failures (simpler, predictable)
- Or `SamplingBreaker({ threshold: 0.2, duration: 30000 })` for 20% failure rate over 30s
- Set timeout to 2-3x expected response time (30s for AI, 10s for GitHub)

**Warning signs:** Circuit opens during normal operation, legitimate requests rejected.

### Pitfall 2: Graceful Degradation Returns Errors

**What goes wrong:** Fallback throws or returns error structure, user sees failure instead of partial results.

**Why it happens:** Fallback function not designed for actual use case.

**How to avoid:**
- Fallback should return valid but limited response
- For AI tasks: return empty task list with `degraded: true` flag
- For health check: return `status: 'degraded'` not throw

**Warning signs:** Error rates spike when AI is down instead of graceful handling.

### Pitfall 3: Correlation IDs Lost in Worker Threads

**What goes wrong:** Logs from worker threads or child processes lack correlation IDs.

**Why it happens:** AsyncLocalStorage context doesn't transfer across worker boundaries.

**How to avoid:**
- Pass correlation ID explicitly to worker threads via postMessage
- For this codebase: AI calls are async but in-process, so AsyncLocalStorage works
- If adding workers later, include correlationId in message payload

**Warning signs:** Some log entries missing correlation ID, especially for CPU-intensive operations.

### Pitfall 4: Cache Persistence Blocks Shutdown

**What goes wrong:** Server hangs on shutdown waiting for cache to persist.

**Why it happens:** Large cache, slow disk, or synchronous persistence in shutdown handler.

**How to avoid:**
- Persist periodically (every 5 minutes) not just on shutdown
- Set shutdown timeout (5 seconds max for final persistence)
- Use atomic write (write to temp file, rename)

**Warning signs:** Server takes >10 seconds to shutdown, data loss on force-kill.

### Pitfall 5: Health Check Returns False Positives

**What goes wrong:** Health check returns "healthy" when services are actually failing.

**Why it happens:** Only checking if service object exists, not if it can actually respond.

**How to avoid:**
- For GitHub: Make a lightweight API call (e.g., rate limit check)
- For AI: Check `isAIAvailable()` (already implemented)
- Include circuit breaker state in health response

**Warning signs:** Load balancer sends traffic to unhealthy instances.

## Code Examples

### Circuit Breaker for AI Service

```typescript
// Source: Cockatiel documentation + codebase patterns
import { circuitBreaker, ConsecutiveBreaker, handleAll, wrap, retry, timeout, fallback, ExponentialBackoff } from 'cockatiel';
import { AIServiceFactory } from './AIServiceFactory';

export class AIResilienceService {
  private readonly policy;
  private readonly circuitBreaker;

  constructor(private readonly aiFactory: AIServiceFactory) {
    // Create circuit breaker with observability
    this.circuitBreaker = circuitBreaker(handleAll, {
      halfOpenAfter: 30 * 1000,
      breaker: new ConsecutiveBreaker(5)
    });

    // Log state changes
    this.circuitBreaker.onStateChange(state => {
      process.stderr.write(
        `[AI Circuit] State changed to: ${state}\n`
      );
    });

    // Compose full policy
    this.policy = wrap(
      fallback(handleAll, this.createFallbackResponse.bind(this)),
      retry(handleAll, {
        maxAttempts: 3,
        backoff: new ExponentialBackoff()
      }),
      this.circuitBreaker,
      timeout(30 * 1000)
    );
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return this.policy.execute(operation);
  }

  getCircuitState(): 'closed' | 'open' | 'half-open' {
    // Cockatiel exposes state via events, track internally
    return this._currentState;
  }

  private createFallbackResponse(): { degraded: true; message: string } {
    return {
      degraded: true,
      message: 'AI service unavailable. Operation completed with limited functionality.'
    };
  }
}
```

### Tracing Logger with Correlation ID

```typescript
// Source: Node.js AsyncLocalStorage + existing ConsoleLogger
import { AsyncLocalStorage } from 'node:async_hooks';
import { v4 as uuidv4 } from 'uuid';

interface TraceContext {
  correlationId: string;
  startTime: number;
  operation: string;
}

export const traceContext = new AsyncLocalStorage<TraceContext>();

export function startTrace<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  const context: TraceContext = {
    correlationId: uuidv4(),
    startTime: Date.now(),
    operation
  };
  return traceContext.run(context, async () => {
    try {
      const result = await fn();
      logTraceComplete('success');
      return result;
    } catch (error) {
      logTraceComplete('error', error);
      throw error;
    }
  });
}

function logTraceComplete(status: 'success' | 'error', error?: unknown): void {
  const ctx = traceContext.getStore();
  if (!ctx) return;

  const duration = Date.now() - ctx.startTime;
  const logEntry = {
    correlationId: ctx.correlationId,
    operation: ctx.operation,
    duration,
    status,
    error: error instanceof Error ? error.message : undefined
  };
  process.stderr.write(`[TRACE] ${JSON.stringify(logEntry)}\n`);
}

export class TracingLogger {
  log(level: string, message: string, ...args: unknown[]): void {
    const ctx = traceContext.getStore();
    const correlationId = ctx?.correlationId ?? 'no-trace';

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId,
      message,
      ...(args.length > 0 ? { data: args } : {})
    };

    process.stderr.write(JSON.stringify(logEntry) + '\n');
  }
}
```

### Health Check Service

```typescript
// Source: MCP best practices + existing codebase patterns
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    github: { connected: boolean; rateLimit?: { remaining: number; limit: number } };
    ai: {
      available: boolean;
      circuitState: 'closed' | 'open' | 'half-open';
      models: { available: string[]; unavailable: string[] };
    };
    cache: {
      entries: number;
      persisted: boolean;
      lastPersist?: string;
    };
  };
}

export class HealthService {
  constructor(
    private readonly aiFactory: AIServiceFactory,
    private readonly aiResilience: AIResilienceService,
    private readonly cache: ResourceCache,
    private readonly cachePersistence: CachePersistence
  ) {}

  async check(): Promise<HealthStatus> {
    const aiConfig = this.aiFactory.validateConfiguration();
    const cacheStats = this.cache.getStats();

    const status: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        github: await this.checkGitHub(),
        ai: {
          available: this.aiFactory.isAIAvailable(),
          circuitState: this.aiResilience.getCircuitState(),
          models: {
            available: aiConfig.availableModels,
            unavailable: aiConfig.unavailableModels
          }
        },
        cache: {
          entries: cacheStats.size,
          persisted: await this.cachePersistence.exists(),
          lastPersist: await this.cachePersistence.getLastPersistTime()
        }
      }
    };

    // Determine overall status
    if (!status.services.github.connected) {
      status.status = 'unhealthy';
    } else if (!status.services.ai.available || status.services.ai.circuitState === 'open') {
      status.status = 'degraded';
    }

    return status;
  }

  private async checkGitHub(): Promise<{ connected: boolean; rateLimit?: { remaining: number; limit: number } }> {
    try {
      // Use existing GitHubRepositoryFactory to check connection
      const rateLimit = await this.githubFactory.checkRateLimit();
      return {
        connected: true,
        rateLimit: { remaining: rateLimit.remaining, limit: rateLimit.limit }
      };
    } catch {
      return { connected: false };
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hystrix (Java) patterns | Cockatiel/Polly-inspired TypeScript libraries | 2020+ | Native TypeScript, composable policies |
| Manual retry loops | Policy-based retry with backoff | 2019+ | Standardized behavior, configurable |
| Thread-local storage | AsyncLocalStorage (Node 16+) | Node 16 (2021) | Native, no dependency, async-aware |
| Custom health endpoints | MCP tool-based health for stdio | MCP 2024 | Works with stdio transport |

**Deprecated/outdated:**
- `domain` module for context: Deprecated, use AsyncLocalStorage
- `cls-hooked`: Works but AsyncLocalStorage is native and preferred
- Hystrix direct ports: Overkill for Node.js, use lighter libraries

## Open Questions

1. **Cache Persistence Granularity**
   - What we know: Cache has type/id structure, TTL support exists
   - What's unclear: Should all cache types persist, or only specific ones (e.g., AI results but not GitHub API responses)?
   - Recommendation: Start with all entries, add configuration flag per type if needed

2. **HTTP Health Endpoint Necessity**
   - What we know: MCP uses stdio by default, but WebhookServer exists on port 3001
   - What's unclear: Is HTTP health endpoint needed for external monitoring (Kubernetes probes)?
   - Recommendation: Add optional `/health` endpoint to WebhookServer if it's running; primary is MCP tool

3. **Circuit Breaker Per-Provider vs Global**
   - What we know: AIServiceFactory supports multiple providers (Anthropic, OpenAI, Google, Perplexity)
   - What's unclear: Should each provider have its own circuit breaker?
   - Recommendation: Start with global circuit breaker for simplicity; if one provider consistently fails, switch via `getBestAvailableModel()` fallback

## Sources

### Primary (HIGH confidence)
- [Cockatiel GitHub](https://github.com/connor4312/cockatiel) - Circuit breaker, retry, timeout, fallback patterns
- [Model Context Protocol Architecture](https://modelcontextprotocol.io/docs/learn/architecture) - MCP transport, lifecycle, primitives
- Node.js AsyncLocalStorage documentation - Context propagation pattern

### Secondary (MEDIUM confidence)
- [Opossum GitHub](https://github.com/nodeshift/opossum) - Alternative circuit breaker (verified API patterns)
- [MCPcat Health Check Guide](https://mcpcat.io/guides/building-health-check-endpoint-mcp-server/) - MCP health check patterns
- [Node.js Reference Architecture - Health Checks](https://nodeshift.dev/nodejs-reference-architecture/operations/healthchecks/) - /readyz, /livez patterns

### Tertiary (LOW confidence)
- WebSearch results for correlation ID best practices - General patterns, needs validation against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Cockatiel verified via GitHub, existing codebase patterns analyzed
- Architecture: HIGH - Based on existing codebase structure and MCP protocol docs
- Pitfalls: MEDIUM - Based on general resilience patterns, some may need adjustment

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain, but verify cockatiel version)
