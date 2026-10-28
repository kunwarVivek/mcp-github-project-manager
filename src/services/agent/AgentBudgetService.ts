import type { Agent, AgentBudget, BudgetStatus } from "../../domain/agent-orchestration-types";
import {
  DEFAULT_AGENT_BUDGET_TOKENS,
  MAX_AGENT_HIERARCHY_DEPTH,
} from "../../domain/agent-orchestration-types";
import type { AgentStore } from "../../infrastructure/agent/AgentStore";
import { safeCall } from "../utils/safeCall";
import { type UnpaidDebit, UnpaidDebitLedger } from "./UnpaidDebitLedger";

/** A metered debit that failed twice and is now parked in the ledger. */
export interface BudgetDebitFailure {
  agentId: string;
  tokens: number;
  error: string;
}

/** Result of debiting one tool call's metered tokens. */
export type MeteredDebitOutcome =
  | { ok: true; status: BudgetStatus }
  | { ok: false; failure: BudgetDebitFailure };

/** Result of trying to pay the unpaid debits a checkout depends on. */
export interface DebitSettlement {
  settledTokens: number;
  /** Debits owed by this agent's budget that still cannot be written. */
  outstanding: UnpaidDebit[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Per-agent token budget tracking and enforcement.
 *
 * Budget data lives on the Agent record in AgentStore. This service
 * provides a focused API for querying, updating, and enforcing budgets
 * without touching other agent fields: every write goes through
 * `AgentStore.updateAgent`, so counters are applied as deltas to the record as
 * it is stored at the moment of the write and a concurrent heartbeat, claim or
 * budget change to the same agent is never reverted.
 */
export class AgentBudgetService {
  private readonly agentStore: AgentStore;
  private readonly ledger: UnpaidDebitLedger;

  constructor(agentStore: AgentStore, ledger: UnpaidDebitLedger = UnpaidDebitLedger.shared()) {
    this.agentStore = agentStore;
    this.ledger = ledger;
  }

  /** Return current budget status for an agent. Subagents return parent's budget. */
  async getBudgetStatus(agentId: string): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents delegate to parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);

      // Lazy reset on every read; the status reflects the post-reset record.
      const current = isResetDue(normalizeBudget({ ...(budgetOwner.budget ?? defaultBudget()) }))
        ? await this.agentStore.updateAgent(budgetOwner.id, (fresh) =>
            applyBudgetReset(fresh, new Date())
          )
        : budgetOwner;

      return statusOf(current);
    });
  }

  /** Set or update an agent's budget. */
  async setBudget(
    agentId: string,
    totalTokens: number,
    warningFraction?: number,
    resetPeriod?: "daily" | "weekly" | "monthly" | "never",
    hardStop?: boolean
  ): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      await this.agentStore.updateAgent(agentId, (fresh) => {
        const existing = normalizeBudget({ ...(fresh.budget ?? defaultBudget()) });
        const updated: AgentBudget = {
          ...existing,
          totalTokens,
          warningFraction: warningFraction ?? existing.warningFraction,
          resetPeriod: resetPeriod ?? existing.resetPeriod,
          hardStop: hardStop ?? existing.hardStop,
          usedTokens: existing.meteredTokens + existing.reportedTokens,
        };
        return { ...fresh, budget: updated };
      });

      return this.getBudgetStatus(agentId);
    });
  }

  /**
   * Record metered token usage (measured at provider boundary).
   * Subagents debit from parent's budget. Returns updated status.
   */
  async recordMeteredUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    return this.debit(agentId, "meteredTokens", tokensUsed);
  }

  /**
   * Record reported token usage (asserted by agent via record_usage tool).
   * Subagents debit from parent's budget. Returns updated status.
   */
  async recordReportedUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    return this.debit(agentId, "reportedTokens", tokensUsed);
  }

  /**
   * Debit one tool call's metered tokens, never letting the debit vanish.
   *
   * A failed write is retried once. If it fails again the debit is parked in
   * the {@link UnpaidDebitLedger}, to be settled before the agent's next
   * checkout, and the failure is returned for the caller to surface. The tool
   * call itself already ran, so this never throws.
   */
  async debitMeteredWithRetry(agentId: string, tokens: number): Promise<MeteredDebitOutcome> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { ok: true, status: await this.recordMeteredUsage(agentId, tokens) };
      } catch (error) {
        lastError = error;
      }
    }

    const error = errorText(lastError);
    this.ledger.record({
      agentId,
      budgetOwnerId: await this.tryResolveOwnerId(agentId),
      tokens,
      error,
    });
    return { ok: false, failure: { agentId, tokens, error } };
  }

  /**
   * Try to write the parked debits that `agentId`'s budget owes.
   *
   * A debit belongs to `agentId` when it was spent by that agent or by one of
   * its subagents (which debit their root). A debit whose owner cannot be
   * determined because the registry is unreadable is treated as belonging to
   * the caller: the budget cannot be trusted until it is paid. A debit whose
   * agent is no longer registered is owed to nobody and is dropped.
   */
  async settleUnpaidDebits(agentId: string): Promise<DebitSettlement> {
    const outstanding: UnpaidDebit[] = [];
    let settledTokens = 0;

    for (const debit of this.ledger.pending()) {
      let ownerId = debit.budgetOwnerId;
      if (debit.agentId !== agentId && ownerId === undefined) {
        try {
          const spender = await this.agentStore.getAgent(debit.agentId);
          if (!spender) {
            this.ledger.remove(debit.id);
            continue;
          }
          ownerId = (await this.resolveBudgetOwner(spender)).id;
        } catch (error) {
          this.ledger.noteFailure(debit.id, errorText(error));
          outstanding.push(debit);
          continue;
        }
      }
      if (debit.agentId !== agentId && ownerId !== agentId) continue;

      try {
        await this.recordMeteredUsage(debit.agentId, debit.tokens);
        this.ledger.remove(debit.id);
        settledTokens += debit.tokens;
      } catch (error) {
        this.ledger.noteFailure(debit.id, errorText(error));
        outstanding.push(debit);
      }
    }

    return { settledTokens, outstanding };
  }

  /** Check whether the agent can afford an estimated number of tokens. Subagents check parent. */
  async canAfford(agentId: string, estimatedTokens: number): Promise<boolean> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents check parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);
      const status = await this.getBudgetStatus(budgetOwner.id);
      return status.remainingTokens >= estimatedTokens;
    });
  }

  /** Reset the budget if the reset period has elapsed. Returns true if a reset occurred. */
  async resetBudgetIfDue(agentId: string): Promise<boolean> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      if (!isResetDue(normalizeBudget({ ...(agent.budget ?? defaultBudget()) }))) {
        return false;
      }

      let reset = false;
      await this.agentStore.updateAgent(agentId, (fresh) => {
        const next = applyBudgetReset(fresh, new Date());
        reset = next !== fresh;
        return next;
      });
      return reset;
    });
  }

  /** Add `tokens` to one counter of the budget owner's record and return the resulting status. */
  private async debit(
    agentId: string,
    counter: "meteredTokens" | "reportedTokens",
    tokens: number
  ): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents debit from parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);

      const updated = await this.agentStore.updateAgent(budgetOwner.id, (fresh) => {
        // A period that elapsed since the snapshot is reset first, so the
        // debit lands in the new period instead of being wiped by a later reset.
        const current = applyBudgetReset(fresh, new Date());
        const budget = normalizeBudget({ ...(current.budget ?? defaultBudget()) });
        budget[counter] += tokens;
        budget.usedTokens = budget.meteredTokens + budget.reportedTokens;

        // Flip status when budget is exhausted
        const exhausted = budget.hardStop && budget.usedTokens >= budget.totalTokens;
        return { ...current, budget, status: exhausted ? "budget_exhausted" : current.status };
      });
      return statusOf(updated);
    });
  }

  /** Best-effort owner id for the ledger; `undefined` when the registry cannot say. */
  private async tryResolveOwnerId(agentId: string): Promise<string | undefined> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      return agent ? (await this.resolveBudgetOwner(agent)).id : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Walk to the root of the agent hierarchy — the agent that actually owns the
   * budget.
   *
   * This previously resolved a single hop, so in root -> child -> grandchild the
   * grandchild debited the *child* rather than the root, and budget isolation
   * silently broke for any hierarchy deeper than one level.
   *
   * Guarded against cycles (A.parent=B, B.parent=A) with a visited set, and
   * against runaway chains with MAX_AGENT_HIERARCHY_DEPTH, so a malformed
   * registry can never hang a caller.
   */
  private async resolveBudgetOwner(agent: Agent): Promise<Agent> {
    const seen = new Set<string>([agent.id]);
    let current = agent;

    for (let hops = 0; hops < MAX_AGENT_HIERARCHY_DEPTH; hops++) {
      const parentId = current.parentAgentId;
      if (!parentId || seen.has(parentId)) break;
      const parent = await this.agentStore.getAgent(parentId);
      if (!parent) break;
      seen.add(parent.id);
      current = parent;
    }

    return current;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultBudget(): AgentBudget {
  return {
    totalTokens: DEFAULT_AGENT_BUDGET_TOKENS,
    meteredTokens: 0,
    reportedTokens: 0,
    usedTokens: 0,
    warningFraction: 0.8,
    hardStop: true,
    resetPeriod: "never",
  };
}

/** The budget status of `owner`'s record. */
function statusOf(owner: Agent): BudgetStatus {
  const budget = normalizeBudget({ ...(owner.budget ?? defaultBudget()) });
  const remainingTokens = Math.max(0, budget.totalTokens - budget.usedTokens);
  const usagePercent = budget.totalTokens > 0 ? (budget.usedTokens / budget.totalTokens) * 100 : 0;

  return {
    agentId: owner.id,
    agentName: owner.name,
    totalTokens: budget.totalTokens,
    meteredTokens: budget.meteredTokens,
    reportedTokens: budget.reportedTokens,
    usedTokens: budget.usedTokens,
    remainingTokens,
    usagePercent: Math.round(usagePercent * 100) / 100,
    isWarning: usagePercent / 100 >= budget.warningFraction,
    isExhausted: budget.hardStop && budget.usedTokens >= budget.totalTokens,
    resetPeriod: budget.resetPeriod,
    lastResetAt: budget.lastResetAt,
  };
}

/** Is the budget's reset period over? `never`/unset periods never are. */
function isResetDue(budget: AgentBudget, now: Date = new Date()): boolean {
  if (!budget.resetPeriod || budget.resetPeriod === "never") return false;
  const lastReset = budget.lastResetAt ? new Date(budget.lastResetAt) : new Date(0);
  return now.getTime() - lastReset.getTime() >= resetPeriodToMs(budget.resetPeriod);
}

/**
 * The agent with its budget reset, when the reset period is over; the same
 * object when it is not. Pure: derives everything from `agent`.
 */
function applyBudgetReset(agent: Agent, now: Date): Agent {
  const budget = normalizeBudget({ ...(agent.budget ?? defaultBudget()) });
  if (!isResetDue(budget, now)) return agent;

  return {
    ...agent,
    budget: {
      ...budget,
      meteredTokens: 0,
      reportedTokens: 0,
      usedTokens: 0,
      lastResetAt: now.toISOString(),
    },
    // Restore agent status if it was budget-exhausted
    status: agent.status === "budget_exhausted" ? "idle" : agent.status,
  };
}

/**
 * Coalesce fields that may be missing from legacy persisted data.
 * AgentStore does raw JSON.parse — Zod defaults never run on reads.
 * Mutates and returns `raw`; callers pass a copy.
 */
function normalizeBudget(raw: AgentBudget): AgentBudget {
  const hadSplitFields = raw.meteredTokens != null || raw.reportedTokens != null;
  raw.meteredTokens ??= 0;
  raw.reportedTokens ??= 0;
  raw.warningFraction ??= 0.8;
  // Legacy data has all spend in usedTokens with no metered/reported split.
  // Attribute existing spend to meteredTokens so the sum stays correct.
  if (
    !hadSplitFields &&
    raw.usedTokens > 0 &&
    raw.meteredTokens === 0 &&
    raw.reportedTokens === 0
  ) {
    raw.meteredTokens = raw.usedTokens;
  }
  raw.usedTokens = raw.meteredTokens + raw.reportedTokens;
  return raw;
}

function resetPeriodToMs(period: "daily" | "weekly" | "monthly"): number {
  const MS_PER_DAY = 86_400_000;
  switch (period) {
    case "daily":
      return MS_PER_DAY;
    case "weekly":
      return MS_PER_DAY * 7;
    case "monthly":
      return MS_PER_DAY * 30;
  }
}
