import type { AgentStore } from '../../infrastructure/agent/AgentStore';
import type { Agent, BudgetStatus, AgentBudget } from '../../domain/agent-orchestration-types';
import { DEFAULT_AGENT_BUDGET_TOKENS } from '../../domain/agent-orchestration-types';
import { mapErrorToMCPError } from '../utils/ErrorMapper';

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
    try {
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
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Set or update an agent's budget. */
  async setBudget(
    agentId: string,
    totalTokens: number,
    warningThreshold?: number,
    resetPeriod?: 'daily' | 'weekly' | 'monthly' | 'never',
  ): Promise<BudgetStatus> {
    try {
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
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Record token usage. Subagents debit from parent's budget. Returns updated status. */
  async recordUsage(agentId: string, tokensUsed: number): Promise<BudgetStatus> {
    try {
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
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Check whether the agent can afford an estimated number of tokens. Subagents check parent. */
  async canAfford(agentId: string, estimatedTokens: number): Promise<boolean> {
    try {
      const agent = await this.agentStore.getAgent(agentId);
      if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
      }

      // Subagents check parent's budget
      const budgetOwner = await this.resolveBudgetOwner(agent);
      const status = await this.getBudgetStatus(budgetOwner.id);
      return status.remainingTokens >= estimatedTokens;
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Reset the budget if the reset period has elapsed. Returns true if a reset occurred. */
  async resetBudgetIfDue(agentId: string): Promise<boolean> {
    try {
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
    } catch (error) {
      throw mapErrorToMCPError(error);
    }
  }

  /** Resolve the agent whose budget should be used. Subagents delegate to parent. */
  private async resolveBudgetOwner(agent: Agent): Promise<Agent> {
    if (agent.parentAgentId) {
      const parent = await this.agentStore.getAgent(agent.parentAgentId);
      if (parent) return parent;
    }
    return agent;
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
