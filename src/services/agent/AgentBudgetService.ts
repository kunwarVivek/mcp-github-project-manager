import type { AgentStore } from '../../infrastructure/agent/AgentStore';
import type { Agent, BudgetStatus, AgentBudget } from '../../domain/agent-orchestration-types';
import {
  DEFAULT_AGENT_BUDGET_TOKENS,
  MAX_AGENT_HIERARCHY_DEPTH,
} from '../../domain/agent-orchestration-types';
import { safeCall } from '../utils/safeCall';

/**
 * Per-agent token budget tracking and enforcement.
 *
 * Budget data lives on the Agent record in AgentStore. This service
 * provides a focused API for querying, updating, and enforcing budgets
 * without touching other agent fields.
 */
export class AgentBudgetService {
  private readonly agentStore: AgentStore;

  constructor(agentStore: AgentStore) {
    this.agentStore = agentStore;
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

      // Lazy reset on every read
      await this.resetBudgetIfDue(budgetOwner.id);
      // Re-read after potential reset
      const freshOwner = await this.agentStore.getAgent(budgetOwner.id);
      const budget = normalizeBudget(freshOwner?.budget ?? budgetOwner.budget ?? defaultBudget());

      const remainingTokens = Math.max(0, budget.totalTokens - budget.usedTokens);
      const usagePercent = budget.totalTokens > 0
        ? (budget.usedTokens / budget.totalTokens) * 100
        : 0;

      return {
        agentId: budgetOwner.id,
        agentName: budgetOwner.name,
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
    });
  }

  /** Set or update an agent's budget. */
  async setBudget(
    agentId: string,
    totalTokens: number,
    warningFraction?: number,
    resetPeriod?: 'daily' | 'weekly' | 'monthly' | 'never',
    hardStop?: boolean,
  ): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const existing = normalizeBudget(agent.budget ?? defaultBudget());
      const updated: AgentBudget = {
        ...existing,
        totalTokens,
        warningFraction: warningFraction ?? existing.warningFraction,
        resetPeriod: resetPeriod ?? existing.resetPeriod,
        hardStop: hardStop ?? existing.hardStop,
        usedTokens: existing.meteredTokens + existing.reportedTokens,
      };

      agent.budget = updated;
      await this.agentStore.upsertAgent(agent);

      return this.getBudgetStatus(agentId);
    });
  }

  /**
   * Record metered token usage (measured at provider boundary).
   * Subagents debit from parent's budget. Returns updated status.
   */
  async recordMeteredUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents debit from parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);

      const budget = normalizeBudget(budgetOwner.budget ?? defaultBudget());
      budget.meteredTokens += tokensUsed;
      budget.usedTokens = budget.meteredTokens + budget.reportedTokens;
      budgetOwner.budget = budget;

      // Flip status when budget is exhausted
      if (budget.hardStop && budget.usedTokens >= budget.totalTokens) {
        budgetOwner.status = 'budget_exhausted';
      }

      await this.agentStore.upsertAgent(budgetOwner);
      return this.getBudgetStatus(budgetOwner.id);
    });
  }

  /**
   * Record reported token usage (asserted by agent via record_usage tool).
   * Subagents debit from parent's budget. Returns updated status.
   */
  async recordReportedUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents debit from parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);

      const budget = normalizeBudget(budgetOwner.budget ?? defaultBudget());
      budget.reportedTokens += tokensUsed;
      budget.usedTokens = budget.meteredTokens + budget.reportedTokens;
      budgetOwner.budget = budget;

      // Flip status when budget is exhausted
      if (budget.hardStop && budget.usedTokens >= budget.totalTokens) {
        budgetOwner.status = 'budget_exhausted';
      }

      await this.agentStore.upsertAgent(budgetOwner);
      return this.getBudgetStatus(budgetOwner.id);
    });
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

      const budget = normalizeBudget(agent.budget ?? defaultBudget());
      if (!budget.resetPeriod || budget.resetPeriod === 'never') {
        return false;
      }

      const now = new Date();
      const lastReset = budget.lastResetAt ? new Date(budget.lastResetAt) : new Date(0);
      const elapsed = now.getTime() - lastReset.getTime();

      const thresholdMs = resetPeriodToMs(budget.resetPeriod);
      if (elapsed < thresholdMs) {
        return false;
      }

      budget.meteredTokens = 0;
      budget.reportedTokens = 0;
      budget.usedTokens = 0;
      budget.lastResetAt = now.toISOString();
      agent.budget = budget;

      // Restore agent status if it was budget-exhausted
      if (agent.status === 'budget_exhausted') {
        agent.status = 'idle';
      }

      await this.agentStore.upsertAgent(agent);
      return true;
    });
  }

  /** Resolve the agent whose budget should be used. Subagents delegate to parent. */
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
    resetPeriod: 'never',
  };
}

/**
 * Coalesce fields that may be missing from legacy persisted data.
 * AgentStore does raw JSON.parse — Zod defaults never run on reads.
 */
function normalizeBudget(raw: AgentBudget): AgentBudget {
  const hadSplitFields = raw.meteredTokens != null || raw.reportedTokens != null;
  raw.meteredTokens ??= 0;
  raw.reportedTokens ??= 0;
  raw.warningFraction ??= 0.8;
  // Legacy data has all spend in usedTokens with no metered/reported split.
  // Attribute existing spend to meteredTokens so the sum stays correct.
  if (!hadSplitFields && raw.usedTokens > 0 && raw.meteredTokens === 0 && raw.reportedTokens === 0) {
    raw.meteredTokens = raw.usedTokens;
  }
  raw.usedTokens = raw.meteredTokens + raw.reportedTokens;
  return raw;
}

function resetPeriodToMs(period: 'daily' | 'weekly' | 'monthly'): number {
  const MS_PER_DAY = 86_400_000;
  switch (period) {
    case 'daily':   return MS_PER_DAY;
    case 'weekly':  return MS_PER_DAY * 7;
    case 'monthly': return MS_PER_DAY * 30;
  }
}
