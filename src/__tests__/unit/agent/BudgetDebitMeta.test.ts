import { describe, expect, it } from "vitest";
import { withBudgetDebitFailure } from "../../../infrastructure/mcp/budget-debit-meta";

const failure = { agentId: "a1", tokens: 120, error: "registry unreachable" };

describe("withBudgetDebitFailure", () => {
  it("adds _meta.budgetDebitFailed to a result that has no _meta", () => {
    const original = { content: [{ type: "text", text: "ok" }] };
    const result = withBudgetDebitFailure(original, failure);

    expect(result._meta).toEqual({
      budgetDebitFailed: { agentId: "a1", tokens: 120, error: "registry unreachable" },
    });
    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
  });

  it("preserves existing _meta keys", () => {
    const result = withBudgetDebitFailure({ _meta: { traceId: "t-1" } }, failure);

    expect(result._meta).toEqual({
      traceId: "t-1",
      budgetDebitFailed: { agentId: "a1", tokens: 120, error: "registry unreachable" },
    });
  });

  it("does not mutate the input result", () => {
    const original = { _meta: { traceId: "t-1" } };
    withBudgetDebitFailure(original, failure);

    expect(original._meta).toEqual({ traceId: "t-1" });
  });
});
