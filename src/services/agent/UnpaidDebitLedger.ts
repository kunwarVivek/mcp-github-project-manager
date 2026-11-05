import { type ILogger, Logger } from "../../infrastructure/logger";

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface UnpaidDebitLedgerOptions {
  /** Entries kept before the oldest are dropped. */
  maxEntries?: number;
  /** Age after which an unsettled entry is dropped. */
  ttlMs?: number;
}

/** A metered token debit that could not be written to the registry. */
export interface UnpaidDebit {
  /** Ledger-local id. */
  id: number;
  /** The agent whose tool call spent the tokens. */
  agentId: string;
  /**
   * The agent whose budget owes them, when it could be resolved at failure
   * time (a subagent debits its root). Absent when the registry itself was
   * unreadable.
   */
  budgetOwnerId?: string;
  tokens: number;
  /** The last error the debit failed with. */
  error: string;
  recordedAt: string;
  /** Failed attempts so far, including the first. */
  attempts: number;
}

/**
 * In-memory record of metered debits the registry refused.
 *
 * A tool call that already ran cannot be failed because its debit could not be
 * written, so the debit is parked here and settled before the agent's next
 * `checkout_task`. It is deliberately NOT persisted: persisting it would need
 * the very registry write that just failed. The cost is that a process restart
 * forgets what it was holding; the debit is also surfaced in the failed call's
 * `_meta.budgetDebitFailed` and the error log, so the loss is never silent.
 *
 * One ledger per process: tool executors build their services per call, so the
 * services default to {@link UnpaidDebitLedger.shared}, which the DI container
 * also registers.
 */
export class UnpaidDebitLedger {
  private static instance: UnpaidDebitLedger | undefined;
  private readonly entries = new Map<number, UnpaidDebit>();
  private nextId = 1;
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly logger: ILogger;

  constructor(options: UnpaidDebitLedgerOptions = {}, logger?: ILogger) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.logger = logger ?? Logger.getInstance();
  }

  /** The process-wide ledger. */
  static shared(): UnpaidDebitLedger {
    UnpaidDebitLedger.instance ??= new UnpaidDebitLedger();
    return UnpaidDebitLedger.instance;
  }

  record(entry: {
    agentId: string;
    budgetOwnerId?: string;
    tokens: number;
    error: string;
  }): UnpaidDebit {
    const debit: UnpaidDebit = {
      id: this.nextId++,
      agentId: entry.agentId,
      budgetOwnerId: entry.budgetOwnerId,
      tokens: entry.tokens,
      error: entry.error,
      recordedAt: new Date().toISOString(),
      attempts: 1,
    };
    this.entries.set(debit.id, debit);
    this.evict(Date.now());
    return debit;
  }

  /** Every unpaid debit, oldest first. */
  pending(): UnpaidDebit[] {
    return [...this.entries.values()];
  }

  /** A settlement attempt failed again. */
  noteFailure(id: number, error: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.attempts += 1;
    entry.error = error;
  }

  /** The debit was written (or can never be owed): drop it. */
  remove(id: number): void {
    this.entries.delete(id);
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Drop entries older than the TTL, then the oldest beyond the size cap.
   * One error log per drop batch: a dropped debit is spend the budget never sees.
   */
  private evict(now: number): void {
    const dropped: UnpaidDebit[] = [];
    for (const entry of this.entries.values()) {
      if (now - Date.parse(entry.recordedAt) >= this.ttlMs) dropped.push(entry);
    }
    for (const entry of dropped) this.entries.delete(entry.id);

    // Map iteration is insertion order, so the oldest entries come first.
    for (const entry of this.entries.values()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(entry.id);
      dropped.push(entry);
    }

    if (dropped.length === 0) return;
    const tokens = dropped.reduce((sum, entry) => sum + entry.tokens, 0);
    this.logger.error(
      `[UnpaidDebitLedger] dropped ${dropped.length} unpaid budget debit(s) (${tokens} tokens) ` +
        `over the ${this.maxEntries}-entry cap or ${this.ttlMs}ms TTL; this spend is no longer tracked`,
      dropped.map((e) => ({
        agentId: e.agentId,
        budgetOwnerId: e.budgetOwnerId,
        tokens: e.tokens,
        recordedAt: e.recordedAt,
      }))
    );
  }
}
