import type { BudgetDebitFailure } from "../../services/agent/AgentBudgetService";

/**
 * Add `_meta.budgetDebitFailed` to a tool result.
 *
 * `CallToolResult._meta` is a loose object in the MCP SDK's result schema, so
 * a custom key rides through to the client untouched. The key tells the caller
 * that the tokens this call spent could not be recorded against the agent's
 * budget (they are parked and settled before the next `checkout_task`).
 * Existing `_meta` keys are preserved.
 */
export function withBudgetDebitFailure<T extends object>(
  result: T & { _meta?: Record<string, unknown> },
  failure: BudgetDebitFailure
): T & { _meta: Record<string, unknown> } {
  return {
    ...result,
    _meta: {
      ...result._meta,
      budgetDebitFailed: {
        agentId: failure.agentId,
        tokens: failure.tokens,
        error: failure.error,
      },
    },
  };
}
