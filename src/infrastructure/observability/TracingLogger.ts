/**
 * TracingLogger - Logger with correlation ID integration.
 *
 * Implements ILogger interface and includes correlation ID in every log entry.
 * Outputs JSON-formatted logs to stderr for structured log parsing.
 *
 * @example
 * ```typescript
 * const logger = createTracingLogger('MyService');
 *
 * // Within a trace context
 * await startTrace('handleRequest', async () => {
 *   logger.info('Processing request', { userId: 123 });
 *   // Output: {"timestamp":"...","level":"info","correlationId":"abc-123","operation":"handleRequest","message":"[MyService] Processing request","data":{"userId":123}}
 * });
 * ```
 */

import { getCorrelationId, getTraceContext } from './CorrelationContext.js';
import { type ILogger } from '../logger/index.js';

/**
 * Structured log entry format
 */
export interface LogEntry {
  /**
   * ISO timestamp of the log entry
   */
  timestamp: string;

  /**
   * Log level: debug, info, warn, error
   */
  level: string;

  /**
   * Correlation ID from trace context, or 'no-trace' if not in a trace
   */
  correlationId: string;

  /**
   * Operation name from trace context (optional)
   */
  operation?: string;

  /**
   * The log message
   */
  message: string;

  /**
   * Additional structured data (optional)
   */
  data?: unknown;

  /**
   * Duration in milliseconds since trace started (optional)
   */
  durationMs?: number;
}

/**
 * TracingLogger implements ILogger with correlation ID and structured JSON output.
 *
 * All log entries include:
 * - Timestamp
 * - Log level
 * - Correlation ID (from current trace context or 'no-trace')
 * - Operation name (if within a trace)
 * - Duration since trace started (if within a trace)
 */
export class TracingLogger implements ILogger {
  private readonly prefix: string;

  /**
   * Creates a new TracingLogger.
   *
   * @param prefix - Optional prefix for log messages (e.g., service name)
   */
  constructor(prefix?: string) {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  /**
   * Log a debug-level message.
   *
   * @param message - The log message
   * @param args - Additional data to include in the log entry
   */
  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  /**
   * Log an info-level message.
   *
   * @param message - The log message
   * @param args - Additional data to include in the log entry
   */
  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }

  /**
   * Log a warn-level message.
   *
   * @param message - The log message
   * @param args - Additional data to include in the log entry
   */
  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  /**
   * Log an error-level message.
   *
   * @param message - The log message
   * @param args - Additional data to include in the log entry
   */
  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }

  /**
   * Format and write a log entry to stderr.
   */
  private write(level: string, message: string, args: unknown[]): void {
    const entry = this.formatEntry(level, message, args);
    process.stderr.write(`${entry}\n`);
  }

  /**
   * Format a log entry as JSON string.
   */
  private formatEntry(level: string, message: string, args: unknown[]): string {
    const correlationId = getCorrelationId() ?? 'no-trace';
    const traceContext = getTraceContext();

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId,
      message: `${this.prefix}${message}`,
    };

    // Add operation from trace context
    if (traceContext?.operation) {
      entry.operation = traceContext.operation;
    }

    // Add duration since trace started
    if (traceContext?.startTime) {
      entry.durationMs = Date.now() - traceContext.startTime;
    }

    // Add additional data
    if (args.length > 0) {
      entry.data = args.length === 1 ? args[0] : args;
    }

    return JSON.stringify(entry);
  }
}

/**
 * Create a TracingLogger instance.
 *
 * @param prefix - Optional prefix for log messages (e.g., service name)
 * @returns A new TracingLogger instance
 *
 * @example
 * ```typescript
 * const logger = createTracingLogger('AIService');
 * logger.info('Starting AI call');
 * ```
 */
export function createTracingLogger(prefix?: string): TracingLogger {
  return new TracingLogger(prefix);
}
