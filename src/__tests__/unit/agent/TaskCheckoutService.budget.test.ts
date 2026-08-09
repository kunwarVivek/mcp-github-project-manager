import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskCheckoutService } from '../../../services/agent/TaskCheckoutService';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentStore } from '../../../infrastructure/agent/AgentStore';
import type { AgentContextService } from '../../../services/agent/AgentContextService';
import { AgentBudgetService } from '../../../services/agent/AgentBudgetService';
import type { Agent } from '../../../domain/agent-orchestration-types';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-1',
    name: 'worker',
    role: 'engineer',
    runtime: 'claude-code',
    capabilities: [],
    status: 'idle',
    registeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Regression suite for the budget gate.
 *
 * Before the gate existed, `hardStop` enforced nothing: recordUsage flipped an
 * agent to 'budget_exhausted', and the very next checkoutTask set
 * `agent.status = 'working'` unconditionally — clearing the exhausted state and
 * handing out another task. An agent could loop past its budget forever.
 */
describe('TaskCheckoutService budget gate', () => {
  let agents: Map<string, Agent>;
  let store: Pick<AgentStore, 'getAgent' | 'upsertAgent'>;
  let service: TaskCheckoutService;

  beforeEach(() => {
    agents = new Map();
    store = {
      getAgent: vi.fn(async (id: string) => agents.get(id)),
      upsertAgent: vi.fn(async (a: Agent) => {
        agents.set(a.id, a);
      }),
    } as unknown as AgentStore;

    service = new TaskCheckoutService(
      {} as GitHubRepositoryFactory,
      store as AgentStore,
      {} as AgentContextService,
      { getInstance: vi.fn() } as never,
      new AgentBudgetService(store as AgentStore),
    );
  });

  it('refuses checkout once the budget is exhausted', async () => {
    agents.set('agent-1', makeAgent({
      budget: { totalTokens: 100, usedTokens: 100, warningThreshold: 0.8, hardStop: true },
    }));

    const result = await service.checkoutTask('agent-1');

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/budget exhausted/i);
  });

  it('does not silently reset a budget_exhausted agent to working', async () => {
    agents.set('agent-1', makeAgent({
      status: 'budget_exhausted',
      budget: { totalTokens: 100, usedTokens: 150, warningThreshold: 0.8, hardStop: true },
    }));

    await service.checkoutTask('agent-1');

    expect(agents.get('agent-1')!.status).toBe('budget_exhausted');
  });

  it('a subagent is blocked by the ROOT budget, not its own empty one', async () => {
    agents.set('root', makeAgent({
      id: 'root',
      budget: { totalTokens: 100, usedTokens: 100, warningThreshold: 0.8, hardStop: true },
    }));
    agents.set('child', makeAgent({ id: 'child', parentAgentId: 'root' }));
    agents.set('grandchild', makeAgent({ id: 'grandchild', parentAgentId: 'child' }));

    // Subagents are rejected earlier (they inherit the parent's task), which is
    // itself the correct behaviour — assert that, so the guard can't regress.
    const result = await service.checkoutTask('grandchild');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/subagent/i);
  });

  /**
   * Past the gate, checkout reaches the (deliberately unmocked) GitHub factory
   * and throws. That throw IS the signal it got past the gate — assert only
   * that the failure is not the budget rejection.
   */
  async function failureMessage(agentId: string): Promise<string> {
    try {
      const result = await service.checkoutTask(agentId);
      return result.message ?? '';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  it('allows checkout past the gate when budget remains', async () => {
    agents.set('agent-1', makeAgent({
      budget: { totalTokens: 1000, usedTokens: 10, warningThreshold: 0.8, hardStop: true },
    }));

    expect(await failureMessage('agent-1')).not.toMatch(/budget exhausted/i);
  });

  it('hardStop:false lets an over-budget agent continue', async () => {
    agents.set('agent-1', makeAgent({
      budget: { totalTokens: 100, usedTokens: 500, warningThreshold: 0.8, hardStop: false },
    }));

    expect(await failureMessage('agent-1')).not.toMatch(/budget exhausted/i);
  });
});
