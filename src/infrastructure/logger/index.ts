import { LOG_FORMAT, LOG_LEVEL } from "../../env";
import { getTraceContext } from "../observability/CorrelationContext";
import { redactSecretPatterns, redactSecrets } from "./redaction";

/**
 * Simple logger interface used across the application
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export type LogLevelName = "debug" | "info" | "warn" | "error";
export type LogFormat = "text" | "json";

export { redactSecretPatterns, redactSecrets };

const LEVEL_ORDER: Record<LogLevelName, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function parseLevel(value: string): LogLevelName {
  const normalized = value.trim().toLowerCase();
  return normalized in LEVEL_ORDER ? (normalized as LogLevelName) : "info";
}

function parseFormat(value: string): LogFormat {
  return value.trim().toLowerCase() === "json" ? "json" : "text";
}

/** Serialise logger varargs with secrets stripped. */
function formatArgs(args: unknown[]): string {
  return JSON.stringify(redactSecrets(args), null, 2);
}

/** One structured log line (LOG_FORMAT=json). */
export interface LogEntry {
  timestamp: string;
  level: LogLevelName;
  /** Correlation ID of the active trace, or 'no-trace'. */
  correlationId: string;
  /** Operation name of the active trace. */
  operation?: string;
  message: string;
  data?: unknown;
  /** Milliseconds since the active trace started. */
  durationMs?: number;
}

export interface ConsoleLoggerOptions {
  /** Minimum level emitted. Defaults to LOG_LEVEL. */
  level?: LogLevelName;
  /** Output format. Defaults to LOG_FORMAT. */
  format?: LogFormat;
}

/**
 * Default logger implementation.
 * All logs go to stderr to avoid interfering with MCP protocol on stdout.
 * Honors LOG_LEVEL and LOG_FORMAT (`json` => one JSON object per line carrying
 * the active trace's correlationId).
 */
export class ConsoleLogger implements ILogger {
  private readonly prefix: string;
  private readonly threshold: number;
  private readonly format: LogFormat;

  constructor(prefix: string = "", options: ConsoleLoggerOptions = {}) {
    this.prefix = prefix ? `[${prefix}] ` : "";
    this.threshold = LEVEL_ORDER[options.level ?? parseLevel(LOG_LEVEL)];
    this.format = options.format ?? parseFormat(LOG_FORMAT);
  }

  debug(message: string, ...args: unknown[]): void {
    this.write("debug", message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write("info", message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write("warn", message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write("error", message, args);
  }

  private write(level: LogLevelName, message: string, args: unknown[]): void {
    if (LEVEL_ORDER[level] < this.threshold) {
      return;
    }
    const text = redactSecretPatterns(`${this.prefix}${message}`);
    if (this.format === "json") {
      process.stderr.write(`${JSON.stringify(this.buildEntry(level, text, args))}\n`);
      return;
    }
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${text}\n`);
    if (args.length > 0) {
      process.stderr.write(`${formatArgs(args)}\n`);
    }
  }

  private buildEntry(level: LogLevelName, message: string, args: unknown[]): LogEntry {
    const trace = getTraceContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: trace?.correlationId ?? "no-trace",
      message,
    };
    if (trace?.operation) {
      entry.operation = trace.operation;
    }
    if (trace?.startTime) {
      entry.durationMs = Date.now() - trace.startTime;
    }
    if (args.length > 0) {
      const redacted = redactSecrets(args) as unknown[];
      entry.data = redacted.length === 1 ? redacted[0] : redacted;
    }
    return entry;
  }
}

/**
 * No-op logger that doesn't do any logging
 */
export class NoopLogger implements ILogger {
  debug(_message: string, ..._args: unknown[]): void {}
  info(_message: string, ..._args: unknown[]): void {}
  warn(_message: string, ..._args: unknown[]): void {}
  error(_message: string, ..._args: unknown[]): void {}
}

/**
 * Create a logger instance with optional prefix
 */
export function createLogger(prefix?: string): ILogger {
  return new ConsoleLogger(prefix);
}

/**
 * Get a logger instance with a prefix
 */
export function getLogger(prefix: string): ILogger {
  return createLogger(prefix);
}

// Default singleton logger instance
export const logger = createLogger("MCP");

/**
 * Singleton logger class for global access
 */
export class Logger implements ILogger {
  private static instance: Logger;
  private logger: ConsoleLogger;

  private constructor() {
    this.logger = new ConsoleLogger("MCP");
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.logger.error(message, ...args);
  }
}
