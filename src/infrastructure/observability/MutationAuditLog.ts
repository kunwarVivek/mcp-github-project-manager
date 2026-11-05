/**
 * MutationAuditLog - persistent, append-only record of every state-changing
 * tool call (who did what to which target, with what outcome).
 *
 * Distinct from `SecurityAuditLog`, which is an in-memory ring of transport
 * security events. This log is a durable JSONL file so operators can answer
 * "who changed this project and when" after the process is gone.
 *
 * Properties:
 * - Disabled unless configured (`AUDIT_LOG_ENABLED`); disabled = zero I/O.
 * - Writes are queued, batched and serialized; callers never await disk.
 * - Never throws into the caller: a failing sink degrades to a single warning.
 * - Size-based rotation: `path` -> `path.1` -> ... -> `path.<keep>`.
 * - `args` and `error` are passed through the logger's secret redaction.
 *
 * stdio MCP: this module never writes to stdout.
 */

import { appendFile, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { AUDIT_LOG_ENABLED, AUDIT_LOG_PATH, DEFAULT_AUDIT_LOG_PATH } from "../../env";
import { Logger, redactSecretPatterns, redactSecrets } from "../logger/index";
import { getCorrelationId } from "./CorrelationContext";

export interface MutationAuditRecord {
  /** ISO-8601 timestamp of when the mutation finished. */
  ts: string;
  /** Correlation id of the surrounding trace, or "none" outside a trace. */
  correlationId: string;
  /** Agent id when the caller is a registered agent, otherwise "token". */
  actor: string;
  /** MCP tool name. */
  tool: string;
  /** Tool action (e.g. "create", "update"). */
  action: string;
  /** What was mutated (e.g. "project:12", "issue:owner/repo#3"). */
  target: string;
  outcome: "success" | "error";
  durationMs: number;
  /** Tool arguments with credential-shaped keys/values redacted. */
  args: unknown;
  error?: string;
  /** Client-supplied idempotency key of a create, when one was given. */
  idempotencyKey?: string;
  /** Stable fingerprint of tool/action/args paired with `idempotencyKey`. */
  fingerprint?: string;
  /** Small, non-secret description of the result (e.g. created id/number). */
  resultSummary?: unknown;
}

/** Caller-supplied fields; `ts`, redaction and defaults are applied by the log. */
export interface MutationAuditInput {
  tool: string;
  action: string;
  target: string;
  outcome: "success" | "error";
  durationMs: number;
  args?: unknown;
  actor?: string;
  correlationId?: string;
  error?: unknown;
  idempotencyKey?: string;
  fingerprint?: string;
  resultSummary?: unknown;
}

/** Destination for audit records. */
export interface AuditSink {
  /** Enqueue a record. Must not throw and must not block on I/O. */
  append(record: MutationAuditRecord): void;
  /** Resolve once every previously appended record is durable. */
  flush(): Promise<void>;
  /** Flush and release resources. Appends after close are dropped. */
  close(): Promise<void>;
}

export interface MutationAuditLogConfig {
  enabled: boolean;
  /** JSONL file path. Required when enabled. */
  path?: string;
  /** Rotate when the file would exceed this many bytes. Default 10 MiB. */
  maxBytes?: number;
  /** Number of rotated files to keep. Default 5. */
  keep?: number;
}

export const DEFAULT_AUDIT_MAX_BYTES = 10 * 1024 * 1024;
export const DEFAULT_AUDIT_KEEP = 5;

/** Sink used when auditing is disabled. */
class NoopAuditSink implements AuditSink {
  append(): void {}
  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}

/**
 * Append-only JSONL file sink with serialized batched writes and size-based
 * rotation.
 */
export class FileAuditSink implements AuditSink {
  private queue: string[] = [];
  private chain: Promise<void> = Promise.resolve();
  private drainScheduled = false;
  private closed = false;
  private dirReady = false;
  private size: number | undefined;
  private warned = false;

  constructor(
    private readonly path: string,
    private readonly maxBytes: number = DEFAULT_AUDIT_MAX_BYTES,
    private readonly keep: number = DEFAULT_AUDIT_KEEP
  ) {}

  append(record: MutationAuditRecord): void {
    if (this.closed) {
      return;
    }
    let line: string;
    try {
      line = `${JSON.stringify(record)}\n`;
    } catch {
      line = `${JSON.stringify({ ...record, args: "[unserializable]" })}\n`;
    }
    this.queue.push(line);
    this.scheduleDrain();
  }

  async flush(): Promise<void> {
    // A drain may be scheduled but not yet queued on the chain.
    this.scheduleDrain();
    await this.chain;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    await this.flush();
    this.closed = true;
  }

  private scheduleDrain(): void {
    if (this.drainScheduled || this.queue.length === 0) {
      return;
    }
    this.drainScheduled = true;
    this.chain = this.chain.then(() => this.drain());
  }

  private async drain(): Promise<void> {
    this.drainScheduled = false;
    if (this.queue.length === 0) {
      return;
    }
    const batch = this.queue.join("");
    this.queue = [];
    try {
      await this.write(batch);
    } catch (error) {
      this.warnOnce(error);
    }
    // Records appended while writing.
    this.scheduleDrain();
  }

  private async write(batch: string): Promise<void> {
    if (!this.dirReady) {
      await mkdir(dirname(this.path), { recursive: true });
      this.dirReady = true;
    }
    if (this.size === undefined) {
      this.size = await stat(this.path)
        .then((s) => s.size)
        .catch(() => 0);
    }
    const bytes = Buffer.byteLength(batch);
    if (this.size > 0 && this.size + bytes > this.maxBytes) {
      await this.rotate();
      this.size = 0;
    }
    await appendFile(this.path, batch, { encoding: "utf8", mode: 0o600 });
    this.size += bytes;
  }

  private async rotate(): Promise<void> {
    if (this.keep <= 0) {
      await rm(this.path, { force: true });
      return;
    }
    await rm(`${this.path}.${this.keep}`, { force: true });
    for (let i = this.keep - 1; i >= 1; i--) {
      await rename(`${this.path}.${i}`, `${this.path}.${i + 1}`).catch(ignoreMissing);
    }
    await rename(this.path, `${this.path}.1`).catch(ignoreMissing);
  }

  private warnOnce(error: unknown): void {
    if (this.warned) {
      return;
    }
    this.warned = true;
    try {
      Logger.getInstance().warn(
        `[MutationAuditLog] write to ${this.path} failed; audit records may be lost`,
        error instanceof Error ? error.message : String(error)
      );
    } catch {
      // Logging must not break auditing either.
    }
  }
}

function ignoreMissing(error: NodeJS.ErrnoException): void {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

/** Builds redacted records and hands them to a sink. */
export class MutationAuditLog {
  constructor(
    private readonly sink: AuditSink,
    readonly enabled: boolean
  ) {}

  /**
   * Record a finished mutation. Fire-and-forget; never throws.
   */
  recordMutation(input: MutationAuditInput): void {
    if (!this.enabled) {
      return;
    }
    try {
      const record: MutationAuditRecord = {
        ts: new Date().toISOString(),
        correlationId: input.correlationId ?? getCorrelationId() ?? "none",
        actor: input.actor ?? "token",
        tool: input.tool,
        action: input.action,
        target: input.target,
        outcome: input.outcome,
        durationMs: input.durationMs,
        args: redactSecrets(input.args ?? {}),
      };
      if (input.error !== undefined) {
        record.error = redactSecretPatterns(
          input.error instanceof Error ? input.error.message : String(input.error)
        );
      }
      if (input.idempotencyKey !== undefined) {
        record.idempotencyKey = input.idempotencyKey;
      }
      if (input.fingerprint !== undefined) {
        record.fingerprint = input.fingerprint;
      }
      if (input.resultSummary !== undefined) {
        record.resultSummary = redactSecrets(input.resultSummary);
      }
      this.sink.append(record);
    } catch {
      // Auditing must never break the mutation it describes.
    }
  }

  /**
   * Run `fn`, then record its outcome and duration. The result or error of
   * `fn` is passed through unchanged.
   */
  async trackMutation<T>(
    meta: Omit<MutationAuditInput, "outcome" | "durationMs" | "error">,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.recordMutation({ ...meta, outcome: "success", durationMs: Date.now() - start });
      return result;
    } catch (error) {
      this.recordMutation({ ...meta, outcome: "error", durationMs: Date.now() - start, error });
      throw error;
    }
  }

  /** Resolve once all recorded entries are on disk. Never rejects. */
  async flush(): Promise<void> {
    await this.sink.flush().catch(() => undefined);
  }

  /** Flush and release the sink; call during graceful shutdown. Never rejects. */
  async close(): Promise<void> {
    await this.sink.close().catch(() => undefined);
  }
}

/**
 * Build an audit log from explicit config. Disabled (or enabled without a
 * path) yields a no-op log, so callers never branch on it.
 */
export function createMutationAuditLog(
  config: MutationAuditLogConfig,
  sink?: AuditSink
): MutationAuditLog {
  if (!config.enabled) {
    return new MutationAuditLog(new NoopAuditSink(), false);
  }
  const resolved =
    sink ??
    new FileAuditSink(
      config.path || DEFAULT_AUDIT_LOG_PATH,
      config.maxBytes ?? DEFAULT_AUDIT_MAX_BYTES,
      config.keep ?? DEFAULT_AUDIT_KEEP
    );
  return new MutationAuditLog(resolved, true);
}

/** Config from `AUDIT_LOG_ENABLED` / `AUDIT_LOG_PATH` (see env.ts). */
export function auditLogConfigFromEnv(): MutationAuditLogConfig {
  return { enabled: AUDIT_LOG_ENABLED, path: AUDIT_LOG_PATH };
}
