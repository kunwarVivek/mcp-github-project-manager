import { describe, expect, it } from "vitest";
import { traceContext } from "../../../../infrastructure/observability/CorrelationContext";
import {
  TokenBudgetExceededError,
  TokenBudgetManager,
} from "../../../../services/ai/TokenBudgetManager";

describe("TokenBudgetManager", () => {
  it("reserves, commits provider usage and reports status", () => {
    const budget = new TokenBudgetManager(0);
    budget.startSession("s", 1000);

    budget.reserve("s", 400);
    expect(budget.getStatus("s")).toMatchObject({ used: 0, reserved: 400, remaining: 600 });

    // ai@7 usage objects, not numbers
    budget.commit("s", { inputTokens: { total: 100 }, outputTokens: { total: 50 } }, 400);
    expect(budget.getStatus("s")).toMatchObject({ used: 150, reserved: 0, remaining: 850 });
  });

  it("charges the reserved estimate when no usage is reported", () => {
    const budget = new TokenBudgetManager(0);
    budget.startSession("s", 1000);
    budget.reserve("s", 300);
    budget.commit("s", undefined, 300);
    expect(budget.getStatus("s")?.used).toBe(300);
  });

  it("throws a typed error when a reservation would exceed the limit", () => {
    const budget = new TokenBudgetManager(0);
    budget.startSession("s", 500);
    budget.reserve("s", 400);

    expect(() => budget.reserve("s", 200)).toThrow(TokenBudgetExceededError);
    // The rejected reservation is not held.
    expect(budget.getStatus("s")?.reserved).toBe(400);

    budget.release("s", 400);
    expect(() => budget.reserve("s", 200)).not.toThrow();
  });

  it("endSession drops the session", () => {
    const budget = new TokenBudgetManager(0);
    budget.startSession("s", 10);
    budget.endSession("s");
    expect(budget.getStatus("s")).toBeUndefined();
  });

  it("keys sessions by correlation id and lazily applies the default limit", () => {
    const budget = new TokenBudgetManager(100);
    traceContext.run({ correlationId: "corr-1", startTime: 0, operation: "t" }, () => {
      expect(budget.reserve(undefined, 60)).toBe("corr-1");
      expect(budget.getStatus()).toMatchObject({ sessionId: "corr-1", limit: 100, reserved: 60 });
      expect(() => budget.reserve(undefined, 60)).toThrow(TokenBudgetExceededError);
    });
    traceContext.run({ correlationId: "corr-2", startTime: 0, operation: "t" }, () => {
      expect(budget.getStatus()).toBeUndefined();
    });
  });

  it("applies no budget with an unlimited default or outside a correlation context", () => {
    const unlimited = new TokenBudgetManager(0);
    traceContext.run({ correlationId: "c", startTime: 0, operation: "t" }, () => {
      expect(unlimited.reserve(undefined, 1e9)).toBeUndefined();
    });
    expect(new TokenBudgetManager(10).reserve(undefined, 1e9)).toBeUndefined();
  });
});
