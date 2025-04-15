/**
 * Simple logger interface used across the application
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default logger implementation that logs to console
 */
export class ConsoleLogger implements Logger {
  private readonly prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`${this.prefix}${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`${this.prefix}${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`${this.prefix}${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`${this.prefix}${message}`, ...args);
  }
}

/**
 * No-op logger that doesn't do any logging
 */
export class NoopLogger implements Logger {
  debug(message: string, ...args: any[]): void {}
  info(message: string, ...args: any[]): void {}
  warn(message: string, ...args: any[]): void {}
  error(message: string, ...args: any[]): void {}
}

/**
 * Create a logger instance with optional prefix
 */
export function createLogger(prefix?: string): Logger {
  return new ConsoleLogger(prefix);
}

/**
 * Get a logger instance with a prefix
 */
export function getLogger(prefix: string): Logger {
  return createLogger(prefix);
}

// Default singleton logger instance
export const logger = createLogger('MCP');