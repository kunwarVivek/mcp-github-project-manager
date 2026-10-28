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
}
