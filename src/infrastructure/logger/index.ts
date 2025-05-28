/**
 * Simple logger interface used across the application
 */
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Default logger implementation that logs to console
 * All logs go to stderr to avoid interfering with MCP protocol on stdout
 */
export class ConsoleLogger implements ILogger {
  private readonly prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}] ` : '';
  }

  debug(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${JSON.stringify(args, null, 2)}\n`);
    }
  }

  info(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${JSON.stringify(args, null, 2)}\n`);
    }
  }

  warn(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${JSON.stringify(args, null, 2)}\n`);
    }
  }

  error(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${JSON.stringify(args, null, 2)}\n`);
    }
  }
}

/**
 * No-op logger that doesn't do any logging
 */
export class NoopLogger implements ILogger {
  debug(message: string, ...args: any[]): void {}
  info(message: string, ...args: any[]): void {}
  warn(message: string, ...args: any[]): void {}
  error(message: string, ...args: any[]): void {}
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
export const logger = createLogger('MCP');

/**
 * Singleton logger class for global access
 */
export class Logger {
  private static instance: Logger;
  private logger: ConsoleLogger;

  private constructor() {
    this.logger = new ConsoleLogger('MCP');
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.logger.error(message, ...args);
  }
}