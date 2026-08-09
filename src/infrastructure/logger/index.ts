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
 * Keys whose values must never reach a log sink.
 *
 * Matching is done on an alphanumeric-normalised key, so `GITHUB_TOKEN`,
 * `githubToken`, and `github-token` all match. Bare "key" is deliberately NOT a
 * match (it would redact `keywords`, `monkey`, ...); the specific compounds
 * below cover the real credential names.
 */
const SECRET_KEY_FRAGMENTS = [
  'token',
  'secret',
  'password',
  'passwd',
  'credential',
  'authorization',
  'apikey',
  'privatekey',
  'accesskey',
  'clientsecret',
];

const REDACTED = '[REDACTED]';

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SECRET_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

/**
 * Deep-copy `value`, replacing any secret-looking property with `[REDACTED]`.
 *
 * The logger stringifies arbitrary caller-supplied arguments, so a single
 * `logger.debug('config', cfg)` would otherwise print a live GitHub PAT or an AI
 * provider key. Cycles are tracked so a self-referential object cannot hang the
 * server, and Errors are flattened (their own fields are non-enumerable).
 */
export function redactSecrets(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, seen));
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSecretKey(key) ? REDACTED : redactSecrets(entry, seen);
  }
  return result;
}

/** Serialise logger varargs with secrets stripped. */
function formatArgs(args: unknown[]): string {
  return JSON.stringify(redactSecrets(args), null, 2);
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
      process.stderr.write(`${formatArgs(args)}\n`);
    }
  }

  info(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${formatArgs(args)}\n`);
    }
  }

  warn(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${formatArgs(args)}\n`);
    }
  }

  error(message: string, ...args: any[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${message}\n`);
    if (args.length > 0) {
      process.stderr.write(`${formatArgs(args)}\n`);
    }
  }
}

/**
 * No-op logger that doesn't do any logging
 */
export class NoopLogger implements ILogger {
  debug(_message: string, ..._args: any[]): void {}
  info(_message: string, ..._args: any[]): void {}
  warn(_message: string, ..._args: any[]): void {}
  error(_message: string, ..._args: any[]): void {}
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
export class Logger implements ILogger {
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