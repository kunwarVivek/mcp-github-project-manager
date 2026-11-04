/**
 * Simple logger interface used across the application
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
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
  "token",
  "secret",
  "password",
  "passwd",
  "credential",
  "authorization",
  "apikey",
  "privatekey",
  "accesskey",
  "clientsecret",
];

const REDACTED = "[REDACTED]";

/**
 * Value-shaped secret patterns, applied to free text (messages, string args,
 * Error messages/stacks) where no key name is available. Each replacement keeps
 * the credential *kind* (`ghp_[REDACTED]`) so a log line stays diagnosable.
 *
 * Formats (GitHub): identifiable `ghp|gho|ghu|ghs|ghr` + `_` prefixes followed
 * by base62 (30 random + 6 checksum chars) per
 * https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/
 * and fine-grained PATs `github_pat_` + `[A-Za-z0-9_]` per
 * https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/github-credential-types
 *
 * Every pattern is a flat character-class run with no nested quantifiers or
 * overlapping alternation, so matching is linear in input length. Patterns that
 * start mid-word use a one-character lookbehind so `task-...` / `desk-...` slugs
 * are not mistaken for `sk-` keys. Compiled once at module load. Order matters:
 * `sk-ant-` runs before the generic `sk-` rule.
 */
const TOKEN_BOUNDARY = "(?<![A-Za-z0-9_-])";
const VALUE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // PEM private keys; an unterminated block redacts to end of input (linear).
  [
    /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----[\s\S]*?(?:-----END (?:[A-Z]+ )*PRIVATE KEY-----|$)/g,
    "[REDACTED PRIVATE KEY BLOCK]",
  ],
  // Authorization header values, any length: `Authorization: Bearer x`.
  [/(Authorization["']?\s*[:=]\s*["']?)(Bearer|Basic)\s+[^\s"',;]+/gi, "$1$2 [REDACTED]"],
  // Bare scheme values; length floors keep prose ("Basic usage") intact.
  [/\b(Bearer)\s+[A-Za-z0-9\-._~+/]{16,}=*/gi, "$1 [REDACTED]"],
  [/\b(Basic)\s+[A-Za-z0-9+/]{20,}={0,2}/gi, "$1 [REDACTED]"],
  [new RegExp(`${TOKEN_BOUNDARY}github_pat_[A-Za-z0-9_]{22,}`, "g"), "github_pat_[REDACTED]"],
  [new RegExp(`${TOKEN_BOUNDARY}(gh[pousr])_[A-Za-z0-9]{30,}`, "g"), "$1_[REDACTED]"],
  [
    new RegExp(
      `${TOKEN_BOUNDARY}eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}`,
      "g"
    ),
    "eyJ[REDACTED JWT]",
  ],
  [new RegExp(`${TOKEN_BOUNDARY}sk-ant-[A-Za-z0-9_-]{20,}`, "g"), "sk-ant-[REDACTED]"],
  [
    new RegExp(`${TOKEN_BOUNDARY}sk-((?:proj|svcacct|admin)-)?[A-Za-z0-9_-]{32,}`, "g"),
    "sk-$1[REDACTED]",
  ],
  [new RegExp(`${TOKEN_BOUNDARY}AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])`, "g"), "AIza[REDACTED]"],
];

/**
 * Replace credential-shaped substrings (GitHub, Anthropic, OpenAI, Google keys,
 * JWTs, Authorization values, PEM private keys) in free text. Exported so every
 * sink — loggers and direct `process.stderr.write` sites — shares one pattern set.
 */
export function redactSecretPatterns(text: string): string {
  let result = text;
  for (const [pattern, replacement] of VALUE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function isSecretKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
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
  if (typeof value === "string") {
    return redactSecretPatterns(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value as object)) {
    return "[Circular]";
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry, seen));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecretPatterns(value.message),
      stack: value.stack === undefined ? undefined : redactSecretPatterns(value.stack),
    };
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

  constructor(prefix: string = "") {
    this.prefix = prefix ? `[${prefix}] ` : "";
  }

  debug(message: string, ...args: unknown[]): void {
    this.write(message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write(message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write(message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write(message, args);
  }

  /** Single sink path: message and varargs are both redacted before stderr. */
  private write(message: string, args: unknown[]): void {
    // Write to stderr to avoid interfering with MCP protocol
    process.stderr.write(`${this.prefix}${redactSecretPatterns(message)}\n`);
    if (args.length > 0) {
      process.stderr.write(`${formatArgs(args)}\n`);
    }
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
