/**
 * IdempotencyStore - makes create operations safe to retry.
 *
 * A caller supplies an `idempotencyKey`; the first call runs, later calls with
 * the same key and the same request fingerprint within the TTL return the
 * original outcome instead of creating a duplicate. The same key with a
 * different request is a client bug and raises IdempotencyConflictError.
 *
 * State is in memory. After a restart `hydrateFromAuditLog` replays recent
 * successful audit records that carry `idempotencyKey` + `fingerprint`, so
 * duplicates are still refused; such replays have a `summary` but no `value`.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { MutationAuditLog } from "../observability/MutationAuditLog";

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 5000;

/** Same idempotency key reused with a different request. */
export class IdempotencyConflictError extends Error {
  constructor(readonly key: string) {
    super(
      `idempotencyKey "${key}" was already used with different arguments. Use a new key for a different request, or resend the original arguments to replay it.`
    );
    this.name = "IdempotencyConflictError";
  }
}

export interface IdempotencyOutcome<T> {
  /** Result of the operation; absent when replayed from the audit log. */
  value?: T;
  /** True when no new operation was started for this call. */
  replayed: boolean;
  /** Description of the original result (from `describe` or the audit log). */
  summary?: unknown;
}

/** Create actions that accept an idempotency key, per compound tool. */
const IDEMPOTENT_CREATES: Readonly<Record<string, readonly string[]>> = {
  manage_issues: ["create", "add_sub_issue", "create_draft", "create_comment"],
  manage_milestones: ["create"],
  manage_project: ["create_field"],
  manage_sprints: ["create"],
};

/** True only for the create kinds that support idempotency keys. */
export function isIdempotentCreate(tool: string, action: string): boolean {
  return IDEMPOTENT_CREATES[tool]?.includes(action) ?? false;
}

const EXCLUDED_FINGERPRINT_KEYS: Record<string, true> = { idempotencyKey: true, cursor: true };

function stableStringify(value: unknown, topLevel: boolean): string {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v, false)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([k, v]) => v !== undefined && !(topLevel && EXCLUDED_FINGERPRINT_KEYS[k]))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v, false)}`);
  return `{${entries.join(",")}}`;
}

/** sha256 of tool, action and key-sorted args, ignoring idempotencyKey/cursor. */
export function fingerprintOf(tool: string, action: string, args: unknown): string {
  return createHash("sha256")
    .update(`${tool}\n${action}\n${stableStringify(args, true)}`)
    .digest("hex");
}

interface Entry {
  fingerprint: string;
  expiresAt: number;
  /** In-flight promise; cleared on completion. */
  pending?: Promise<unknown>;
  done: boolean;
  value?: unknown;
  hasValue: boolean;
  summary?: unknown;
}

export interface IdempotencyStoreOptions {
  ttlMs?: number;
  now?: () => number;
  maxEntries?: number;
  audit?: MutationAuditLog;
}

export class IdempotencyStore {
  private readonly entries = new Map<string, Entry>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly audit?: MutationAuditLog;

  constructor(opts: IdempotencyStoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
    this.now = opts.now ?? Date.now;
    this.maxEntries = opts.maxEntries ?? DEFAULT_IDEMPOTENCY_MAX_ENTRIES;
    this.audit = opts.audit;
  }

  async run<T>(
    key: string | undefined,
    fingerprint: string,
    fn: () => Promise<T>,
    describe?: (value: T) => unknown
  ): Promise<IdempotencyOutcome<T>> {
    if (key === undefined) {
      return { value: await fn(), replayed: false };
    }

    const existing = this.live(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new IdempotencyConflictError(key);
      }
      if (!existing.done) {
        const value = (await existing.pending) as T;
        return { value, replayed: true, summary: existing.summary };
      }
      return {
        ...(existing.hasValue ? { value: existing.value as T } : {}),
        replayed: true,
        summary: existing.summary,
      };
    }

    const start = this.now();
    const entry: Entry = {
      fingerprint,
      expiresAt: start + this.ttlMs,
      done: false,
      hasValue: false,
    };
    const pending = (async () => {
      const value = await fn();
      let summary: unknown;
      try {
        summary = describe?.(value);
      } catch {
        summary = undefined;
      }
      entry.value = value;
      entry.hasValue = true;
      entry.summary = summary;
      entry.done = true;
      entry.expiresAt = this.now() + this.ttlMs;
      entry.pending = undefined;
      this.record(key, fingerprint, summary, this.now() - start);
      return value;
    })();
    entry.pending = pending;
    this.insert(key, entry);

    try {
      const value = await pending;
      return { value, replayed: false, summary: entry.summary };
    } catch (error) {
      // Failures are not cached so the caller may retry with the same key.
      if (this.entries.get(key) === entry) {
        this.entries.delete(key);
      }
      throw error;
    }
  }

  /**
   * Load recent successful audit records carrying idempotencyKey + fingerprint.
   * Returns the number of keys loaded. Never throws; a missing/corrupt file
   * yields 0 (corrupt lines are skipped).
   */
  async hydrateFromAuditLog(path: string): Promise<number> {
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch {
      return 0;
    }
    const now = this.now();
    let loaded = 0;
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const rec = JSON.parse(line) as {
          ts?: string;
          outcome?: string;
          idempotencyKey?: unknown;
          fingerprint?: unknown;
          resultSummary?: unknown;
        };
        if (
          rec.outcome !== "success" ||
          typeof rec.idempotencyKey !== "string" ||
          typeof rec.fingerprint !== "string" ||
          typeof rec.ts !== "string"
        ) {
          continue;
        }
        const ts = Date.parse(rec.ts);
        if (Number.isNaN(ts) || ts + this.ttlMs <= now) {
          continue;
        }
        if (this.live(rec.idempotencyKey)) {
          continue;
        }
        this.insert(rec.idempotencyKey, {
          fingerprint: rec.fingerprint,
          expiresAt: ts + this.ttlMs,
          done: true,
          hasValue: false,
          summary: rec.resultSummary,
        });
        loaded++;
      } catch {
        // skip corrupt line
      }
    }
    return loaded;
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.done && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  private insert(key: string, entry: Entry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
    // Map iterates in insertion order, so the first key is the oldest.
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }

  private record(key: string, fingerprint: string, summary: unknown, durationMs: number): void {
    try {
      this.audit?.recordMutation({
        tool: "idempotency",
        action: "create",
        target: `idempotencyKey:${key}`,
        outcome: "success",
        durationMs,
        idempotencyKey: key,
        fingerprint,
        resultSummary: summary,
      });
    } catch {
      // Auditing must never break the operation.
    }
  }
}

let singleton: IdempotencyStore | undefined;

/** Process-wide store. */
export function getIdempotencyStore(): IdempotencyStore {
  singleton ??= new IdempotencyStore();
  return singleton;
}
