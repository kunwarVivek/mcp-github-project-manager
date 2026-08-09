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

      const budget = budgetOwner.budget ?? defaultBudget();
      const remainingTokens = Math.max(0, budget.totalTokens - budget.usedTokens);
      const usagePercent = budget.totalTokens > 0
        ? (budget.usedTokens / budget.totalTokens) * 100
        : 0;

      return {
        agentId: budgetOwner.id,
        agentName: budgetOwner.name,
        totalTokens: budget.totalTokens,
        usedTokens: budget.usedTokens,
        remainingTokens,
        usagePercent: Math.round(usagePercent * 100) / 100,
        isWarning: usagePercent / 100 >= budget.warningThreshold,
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
    warningThreshold?: number,
    resetPeriod?: 'daily' | 'weekly' | 'monthly' | 'never',
  ): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      const existing = agent.budget ?? defaultBudget();
      const updated: AgentBudget = {
        ...existing,
        totalTokens,
        warningThreshold: warningThreshold ?? existing.warningThreshold,
        resetPeriod: resetPeriod ?? existing.resetPeriod,
      };

      agent.budget = updated;
      await this.agentStore.upsertAgent(agent);

      return this.getBudgetStatus(agentId);
    });
  }

  /** Record token usage. Subagents debit from parent's budget. Returns updated status. */
  async recordUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    return safeCall(async () => {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents debit from parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);

      const budget = budgetOwner.budget ?? defaultBudget();
      budget.usedTokens += tokensUsed;
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

      const budget = agent.budget ?? defaultBudget();
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
    usedTokens: 0,
    warningThreshold: 0.8,
    hardStop: true,
    resetPeriod: 'never',
  };
}

function resetPeriodToMs(period: 'daily' | 'weekly' | 'monthly'): number {
  const MS_PER_DAY = 86_400_000;
  switch (period) {
    case 'daily':   return MS_PER_DAY;
    case 'weekly':  return MS_PER_DAY * 7;
    case 'monthly': return MS_PER_DAY * 30;
  }
}
