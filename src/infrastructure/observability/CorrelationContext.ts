/**
 * CorrelationContext - AsyncLocalStorage-based correlation ID tracking.
 *
 * Provides request tracing by propagating correlation IDs through async operations
 * without manual parameter passing. Uses Node.js AsyncLocalStorage for context
 * propagation across async boundaries.
 *
 * Usage:
 * ```typescript
 * await startTrace('myOperation', async () => {
 *   // Any code here can call getCorrelationId() to get the trace ID
 *   console.log(`Trace: ${getCorrelationId()}`);
 *   return result;
 * });
 * ```
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { v4 as uuidv4 } from 'uuid';

/**
 * Context stored for each trace
 */
export interface TraceContext {
  /**
   * Unique identifier for this request/operation trace
   */
  correlationId: string;

  /**
   * Timestamp when the trace started (milliseconds since epoch)
   */
  startTime: number;

  /**
   * Name of the operation being traced
   */
  operation: string;
}

/**
 * The AsyncLocalStorage instance for trace context propagation.
 * Exported for advanced use cases that need direct access.
 */
export const traceContext = new AsyncLocalStorage<TraceContext>();

/**
 * Start a new trace for an operation.
 *
 * Creates a new correlation ID and wraps the operation in a trace context.
 * Logs trace start and completion to stderr with JSON format.
 *
 * @param operation - Name of the operation being traced
 * @param fn - The async operation to execute
 * @returns The result of the operation
 * @throws Re-throws any error from the operation after logging
 */
export async function startTrace<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const context: TraceContext = {
    correlationId: uuidv4(),
    startTime: Date.now(),
    operation,
  };

  // Log trace start
  logTraceEvent('start', context);

  return traceContext.run(context, async () => {
    try {
      const result = await fn();
      logTraceEvent('success', context);
      return result;
    } catch (error) {
      logTraceEvent('error', context, error);
      throw error;
    }
  });
}

/**
 * Get the current correlation ID from the trace context.
 *
 * @returns The correlation ID if within a trace, undefined otherwise
 */
export function getCorrelationId(): string | undefined {
  return traceContext.getStore()?.correlationId;
}

/**
 * Get the full trace context.
 *
 * @returns The trace context if within a trace, undefined otherwise
 */
export function getTraceContext(): TraceContext | undefined {
  return traceContext.getStore();
}

/**
 * Log a trace event to stderr in JSON format.
 */
function logTraceEvent(
  status: 'start' | 'success' | 'error',
  context: TraceContext,
  error?: unknown
): void {
  const duration = status === 'start' ? undefined : Date.now() - context.startTime;

  const logEntry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: status === 'error' ? 'error' : 'info',
    type: 'trace',
    correlationId: context.correlationId,
    operation: context.operation,
    status,
  };

  if (duration !== undefined) {
    logEntry.durationMs = duration;
  }

  if (error !== undefined) {
    logEntry.error = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.stack) {
      logEntry.stack = error.stack;
    }
  }

  process.stderr.write(`[TRACE] ${JSON.stringify(logEntry)}\n`);
}
