import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ILogger } from "../../../infrastructure/logger";
import { UnpaidDebitLedger } from "../../../services/agent/UnpaidDebitLedger";

function debit(agentId: string, tokens = 10) {
  return { agentId, tokens, error: "registry unreachable" };
}

describe("UnpaidDebitLedger bounds", () => {
  let logger: { error: Mock };

  beforeEach(() => {
    vi.useFakeTimers();
    logger = { error: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function create(options: { maxEntries?: number; ttlMs?: number }): UnpaidDebitLedger {
    return new UnpaidDebitLedger(options, logger as unknown as ILogger);
  }

  it("keeps entries under the cap without logging", () => {
    const ledger = create({ maxEntries: 3 });
    ledger.record(debit("a"));
    ledger.record(debit("b"));
    ledger.record(debit("c"));

    expect(ledger.size).toBe(3);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("drops the oldest entry over the cap and logs at error level once", () => {
    const ledger = create({ maxEntries: 2 });
    ledger.record(debit("a"));
    ledger.record(debit("b"));
    ledger.record(debit("c"));

    expect(ledger.pending().map((d) => d.agentId)).toEqual(["b", "c"]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("drops entries older than the TTL in one logged batch", () => {
    const ledger = create({ maxEntries: 100, ttlMs: 1000 });
    ledger.record(debit("a"));
    ledger.record(debit("b"));
    vi.advanceTimersByTime(1500);
    ledger.record(debit("c"));

    expect(ledger.pending().map((d) => d.agentId)).toEqual(["c"]);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("still settles (removes) retained entries", () => {
    const ledger = create({ maxEntries: 2 });
    const kept = ledger.record(debit("a"));
    ledger.remove(kept.id);

    expect(ledger.size).toBe(0);
  });
});
