export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  error?: { name: string; message: string; stack?: string };
}

export type LogFormat = 'text' | 'json';

/**
 * Structured logging adapter. Wraps the existing Logger singleton
 * with structured output support. When LOG_FORMAT=json, emits
 * newline-delimited JSON to stderr. Otherwise, delegates to
 * the existing human-readable Logger.
 */
export class StructuredLogger {
  private static _instance: StructuredLogger;
  private format: LogFormat;
  private level: LogLevel;

  private constructor() {
    this.format = (process.env.LOG_FORMAT === 'json') ? 'json' : 'text';
    this.level = this.parseLevel(process.env.LOG_LEVEL ?? 'info');
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger._instance) {
      StructuredLogger._instance = new StructuredLogger();
    }
    return StructuredLogger._instance;
  }

  /** Reset singleton for testing. */
  static resetInstance(): void {
    StructuredLogger._instance = undefined!;
  }

  private parseLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const levelName = LogLevel[level];

    if (this.format === 'json') {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: levelName,
        message,
        ...(context && { context }),
        ...(error && { error: { name: error.name, message: error.message, stack: error.stack } }),
      };
      process.stderr.write(JSON.stringify(entry) + '\n');
    } else {
      // Delegate to existing Logger (text format)
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      const errorStr = error ? ` ${error.message}` : '';
      process.stderr.write(`[${levelName}] ${message}${contextStr}${errorStr}\n`);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void { this.emit(LogLevel.DEBUG, message, context); }
  info(message: string, context?: Record<string, unknown>): void { this.emit(LogLevel.INFO, message, context); }
  warn(message: string, context?: Record<string, unknown>): void { this.emit(LogLevel.WARN, message, context); }
  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    this.emit(LogLevel.ERROR, message, context, error instanceof Error ? error : undefined);
  }
}
