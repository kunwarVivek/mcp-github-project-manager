import type { AgentStore } from '../../infrastructure/agent/AgentStore';
import type { WorkProductStore } from '../../infrastructure/agent/WorkProductStore';
import type { GitHubRepositoryFactory } from '../../infrastructure/github/GitHubRepositoryFactory';
import type {
  AgentMetrics,
  AgentMetricEntry,
  WorkProduct,
} from '../../domain/agent-orchestration-types';
import { DEFAULT_HEARTBEAT_TIMEOUT_MINUTES } from '../../domain/agent-orchestration-types';
import { safeCall } from '../utils/safeCall';

/**
 * Computes agent orchestration metrics: throughput, cycle time, budget burn,
 * and staleness — both aggregate and per-agent.
 *
 * Pure aggregation over AgentStore (agent records) and WorkProductStore
 * (completed work products → cycle time estimation). No new state is written.
 */
export class AgentMetricsService {
  private readonly factory: GitHubRepositoryFactory;
  private readonly agentStore: AgentStore;
  private readonly workProductStore: WorkProductStore;

  constructor(
    factory: GitHubRepositoryFactory,
    agentStore: AgentStore,
    workProductStore: WorkProductStore,
  ) {
    this.factory = factory;
    this.agentStore = agentStore;
    this.workProductStore = workProductStore;
  }

  /** Compute aggregate + per-agent metrics. */
  async getMetrics(
    staleAfterMinutes: number = DEFAULT_HEARTBEAT_TIMEOUT_MINUTES,
  ): Promise<AgentMetrics> {
    return safeCall(async () => {
      const agents = await this.agentStore.listAgents();
      const now = Date.now();
      const staleMs = staleAfterMinutes * 60_000;

      // Gather completed work products per agent for cycle-time estimation.
      // True claim→completion duration isn't persisted per work product, so
      // we approximate cycle time as submission-recentcy (now − submittedAt).
      // A single bounded issue scan collects products for ALL agents at once
      // (no per-agent re-scan of the repo).
      const { completedByAgent, cycleTimesByAgent } =
        await this.collectAllAgentWorkProducts();

      let totalTasksInProgress = 0;
      let totalTasksCompleted = 0;
      let totalTokensBudget = 0;
      let totalTokensUsed = 0;
      let staleAgents = 0;
      let budgetExhaustedAgents = 0;
      let activeAgents = 0;

      const entries: AgentMetricEntry[] = agents.map(agent => {
        const lastHb = agent.lastHeartbeat ? new Date(agent.lastHeartbeat).getTime() : undefined;
        const isStale = lastHb != null && now - lastHb > staleMs;
        const budget = agent.budget;
        const isExhausted =
          agent.status === 'budget_exhausted' ||
          (budget?.hardStop === true && budget.usedTokens >= budget.totalTokens);

        const completed = completedByAgent.get(agent.id) ?? 0;
        const durations = cycleTimesByAgent.get(agent.id) ?? [];
        // Approximate: average minutes since last submission(s).
        // Not a true claim→completion cycle time (that data is not persisted).
        const avgCycle = durations.length > 0
          ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length / 60_000)
          : undefined;

        const budgetUsagePercent = budget && budget.totalTokens > 0
          ? Math.round((budget.usedTokens / budget.totalTokens) * 1000) / 10
          : 0;

        if (agent.currentTaskId) totalTasksInProgress++;
        totalTasksCompleted += completed;
        if (budget) {
          totalTokensBudget += budget.totalTokens;
          totalTokensUsed += budget.usedTokens;
        }
        if (isStale) staleAgents++;
        if (isExhausted) budgetExhaustedAgents++;
        if (agent.status !== 'offline' && agent.status !== 'budget_exhausted') activeAgents++;

        return {
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          status: agent.status,
          tasksCompleted: completed,
          tasksInProgress: agent.currentTaskId ? 1 : 0,
          currentTaskId: agent.currentTaskId,
          currentTaskTitle: agent.currentTaskTitle,
          budgetUsagePercent,
          isStale,
          averageCycleTimeMinutes: avgCycle,
        };
      });

      return {
        generatedAt: new Date().toISOString(),
        totalAgents: agents.length,
        activeAgents,
        staleAgents,
        budgetExhaustedAgents,
        totalTasksInProgress,
        totalTasksCompleted,
        totalTokensBudget,
        totalTokensUsed,
        overallBudgetUsagePercent: totalTokensBudget > 0
          ? Math.round((totalTokensUsed / totalTokensBudget) * 1000) / 10
          : 0,
        agents: entries,
      };
    });
  }

  /**
   * Best-effort: collect work products for ALL agents from a single bounded
   * issue scan (first 100 issues), bucketed by agent. Avoids the N+1 pattern
   * of re-scanning the repo once per registered agent.
   */
  private async collectAllAgentWorkProducts(): Promise<{
    completedByAgent: Map<string, number>;
    cycleTimesByAgent: Map<string, number[]>;
  }> {
    const config = this.factory.getConfig();
    const octokit = this.factory.getOctokit();
    const now = Date.now();
    const productsByAgent = new Map<string, WorkProduct[]>();

    try {
      // NOTE: bounded scan (first 100 issues) — metrics are approximate.
      const { data: issues } = await octokit.rest.issues.listForRepo({
        owner: config.owner,
        repo: config.repo,
        state: 'all',
        per_page: 100,
      });

      for (const issue of issues) {
        if (issue.pull_request) continue;
        try {
          const items = await this.workProductStore.listForIssue(issue.number);
          for (const p of items) {
            if (!p.agentId) continue;
            const bucket = productsByAgent.get(p.agentId) ?? [];
            bucket.push(p);
            productsByAgent.set(p.agentId, bucket);
          }
        } catch {
          /* skip issue */
        }
      }
    } catch {
      /* metrics are best-effort */
    }

    const completedByAgent = new Map<string, number>();
    const cycleTimesByAgent = new Map<string, number[]>();
    for (const [agentId, products] of productsByAgent) {
      completedByAgent.set(agentId, products.length);
      const durations = products
        .map(p => p.submittedAt ? now - new Date(p.submittedAt).getTime() : null)
        .filter((d): d is number => d != null && d >= 0)
        .slice(0, 50);
      if (durations.length > 0) {
        cycleTimesByAgent.set(agentId, durations);
      }
    }

    return { completedByAgent, cycleTimesByAgent };
  }
}
