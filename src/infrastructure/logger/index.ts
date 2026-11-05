import { LOG_FORMAT, LOG_LEVEL } from "../../env";
import { getTraceContext } from "../observability/CorrelationContext";

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

const LEVEL_ORDER: Record<LogLevelName, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function parseLevel(value: string): LogLevelName {
  const normalized = value.trim().toLowerCase();
  return normalized in LEVEL_ORDER ? (normalized as LogLevelName) : "info";
}

function parseFormat(value: string): LogFormat {
  return value.trim().toLowerCase() === "json" ? "json" : "text";
}

/**
 * Whole-word credential names. A key is split into segments on separators and
 * camelCase boundaries (`GITHUB_TOKEN`, `githubToken`, `github-token` all give
 * `[github, token]`), then each segment is compared exactly. That keeps
 * `inputTokens`/`maxTokens` (segment `tokens`) and `keywords`/`monkey` visible
 * while `token`, `apiKey`, `authorization`, `secret`, `password` are redacted.
 */
const SECRET_SEGMENTS = new Set([
  "token",
  "secret",
  "secrets",
  "password",
  "passwords",
  "passwd",
  "credential",
  "credentials",
  "authorization",
  "apikey",
  "privatekey",
  "accesskey",
  "clientsecret",
]);

/** `<prefix> key` pairs that name a credential (e.g. `api_key`, `privateKey`). */
const SECRET_KEY_PREFIXES = new Set(["api", "private", "access", "signing", "encryption"]);

const REDACTED = "[REDACTED]";

function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

function isSecretKey(key: string): boolean {
  const segments = keySegments(key);
  return segments.some(
    (segment, index) =>
      SECRET_SEGMENTS.has(segment) ||
      (segment === "key" && index > 0 && SECRET_KEY_PREFIXES.has(segments[index - 1]))
  );
}

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
  // Bare scheme values. Bearer and the GitHub prefixes keep the floors released
  // in v4.0.0 (8 / 10 chars); Basic needs 20 so prose ("Basic usage") survives.
  [/\b(Bearer)\s+[A-Za-z0-9\-._~+/]{8,}=*/gi, "$1 [REDACTED]"],
  [/\b(Basic)\s+[A-Za-z0-9+/]{20,}={0,2}/gi, "$1 [REDACTED]"],
  [new RegExp(`${TOKEN_BOUNDARY}github_pat_[A-Za-z0-9_]{10,}`, "g"), "github_pat_[REDACTED]"],
  [new RegExp(`${TOKEN_BOUNDARY}(gh[pousr])_[A-Za-z0-9]{10,}`, "g"), "$1_[REDACTED]"],
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

/**
 * Deep-copy `value`, replacing any secret-looking property with `[REDACTED]`
 * and scrubbing secret-shaped string values.
 *
 * The logger stringifies arbitrary caller-supplied arguments, so a single
 * `logger.debug('config', cfg)` would otherwise print a live GitHub PAT or an AI
 * provider key. Cycles are detected by tracking the current ancestor path only,
 * so a self-referential object cannot hang the server while a non-circular
 * object referenced twice is still printed in full. Errors are flattened
 * (their own fields are non-enumerable).
 */
export function redactSecrets(value: unknown, ancestors: Set<object> = new Set()): unknown {
  if (typeof value === "string") {
    return redactSecretPatterns(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (ancestors.has(value)) {
    return "[Circular]";
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecretPatterns(value.message),
      stack: value.stack === undefined ? undefined : redactSecretPatterns(value.stack),
    };
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry) => redactSecrets(entry, ancestors));
    }
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSecretKey(key) ? REDACTED : redactSecrets(entry, ancestors);
    }
    return result;
  } finally {
    ancestors.delete(value);
  }
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
