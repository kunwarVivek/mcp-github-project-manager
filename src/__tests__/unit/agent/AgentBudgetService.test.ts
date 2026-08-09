import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AgentBudgetService } from '../../../services/agent/AgentBudgetService';
import type { AgentStore } from '../../../infrastructure/agent/AgentStore';
import type { Agent } from '../../../domain/agent-orchestration-types';

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: 'engineer',
    runtime: 'claude-code',
    capabilities: [],
    status: 'idle',
    registeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AgentBudgetService', () => {
  let service: AgentBudgetService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStore: { getAgent: Mock<any>; upsertAgent: Mock<any> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = {
      getAgent: vi.fn(),
      upsertAgent: vi.fn(async () => {}),
    };
    service = new AgentBudgetService(mockStore as unknown as AgentStore);
  });

  describe('getBudgetStatus', () => {
    it('returns defaults when no budget is configured', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const status = await service.getBudgetStatus('agent-1');

      expect(status.totalTokens).toBe(500_000);
      expect(status.usedTokens).toBe(0);
      expect(status.meteredTokens).toBe(0);
      expect(status.reportedTokens).toBe(0);
      expect(status.isWarning).toBe(false);
      expect(status.isExhausted).toBe(false);
    });

    it('flags warning at the threshold', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 850, reportedTokens: 0,
          usedTokens: 850, warningFraction: 0.8, hardStop: true,
        },
      }));

      const status = await service.getBudgetStatus('agent-1');

      expect(status.isWarning).toBe(true);
      expect(status.usagePercent).toBe(85);
    });

    it('delegates to the parent budget for subagents', async () => {
      mockStore.getAgent.mockImplementation(async (id) => {
        if (id === 'child') return makeAgent('child', { parentAgentId: 'parent' });
        return makeAgent('parent', {
          budget: {
            totalTokens: 2000, meteredTokens: 300, reportedTokens: 200,
            usedTokens: 500, warningFraction: 0.8, hardStop: true,
          },
        });
      });

      const status = await service.getBudgetStatus('child');

      expect(status.agentId).toBe('parent');
      expect(status.remainingTokens).toBe(1500);
    });

    it('calls resetBudgetIfDue lazily', async () => {
      const lastReset = new Date(Date.now() - 2 * 86_400_000).toISOString();
      const agent = makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 300,
          usedTokens: 800, warningFraction: 0.8, hardStop: true,
          resetPeriod: 'daily', lastResetAt: lastReset,
        },
      });
      mockStore.getAgent.mockResolvedValue(agent);

      const status = await service.getBudgetStatus('agent-1');

      // After lazy reset, counters should be zeroed
      expect(status.usedTokens).toBe(0);
      expect(status.meteredTokens).toBe(0);
      expect(status.reportedTokens).toBe(0);
      // upsertAgent should have been called (reset persisted)
      expect(mockStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: expect.objectContaining({
            meteredTokens: 0,
            reportedTokens: 0,
            usedTokens: 0,
          }),
        }),
      );
    });

    it('warning status correctly uses warningFraction', async () => {
      // 70% usage with 0.75 warning fraction → not warning
      mockStore.getAgent.mockResolvedValue(makeAgent('a', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 200,
          usedTokens: 700, warningFraction: 0.75, hardStop: true,
        },
      }));

      const belowStatus = await service.getBudgetStatus('a');
      expect(belowStatus.isWarning).toBe(false);

      // 80% usage with 0.75 warning fraction → warning
      mockStore.getAgent.mockResolvedValue(makeAgent('b', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 300,
          usedTokens: 800, warningFraction: 0.75, hardStop: true,
        },
      }));

      const aboveStatus = await service.getBudgetStatus('b');
      expect(aboveStatus.isWarning).toBe(true);
    });
  });

  describe('setBudget', () => {
    it('sets total tokens and returns updated status', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const status = await service.setBudget('agent-1', 100_000, 0.9, 'daily');

      expect(status.totalTokens).toBe(100_000);
      expect(status.resetPeriod).toBe('daily');
      expect(mockStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: expect.objectContaining({ totalTokens: 100_000, resetPeriod: 'daily' }),
        }),
      );
    });

    it('updates hardStop', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 0, reportedTokens: 0,
          usedTokens: 0, warningFraction: 0.8, hardStop: true,
        },
      }));

      await service.setBudget('agent-1', 1000, undefined, undefined, false);

      expect(mockStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: expect.objectContaining({ hardStop: false }),
        }),
      );
    });
  });

  describe('recordMeteredUsage', () => {
    it('accumulates metered usage and flips status at hard stop', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 900, reportedTokens: 0,
          usedTokens: 900, warningFraction: 0.8, hardStop: true,
        },
      }));

      const status = await service.recordMeteredUsage('agent-1', 150);

      expect(status.usedTokens).toBe(1050);
      expect(status.meteredTokens).toBe(1050);
      expect(status.reportedTokens).toBe(0);
      expect(status.isExhausted).toBe(true);
      expect(status.remainingTokens).toBe(0);
    });

    it('records against the parent budget for subagents', async () => {
      const parent = makeAgent('parent', {
        budget: {
          totalTokens: 1000, meteredTokens: 0, reportedTokens: 0,
          usedTokens: 0, warningFraction: 0.8, hardStop: true,
        },
      });
      mockStore.getAgent.mockImplementation(async (id) => {
        if (id === 'child') return makeAgent('child', { parentAgentId: 'parent' });
        return parent;
      });

      const status = await service.recordMeteredUsage('child', 200);

      expect(status.usedTokens).toBe(200);
      expect(status.meteredTokens).toBe(200);
    });
  });

  describe('recordReportedUsage', () => {
    it('accumulates reported usage separately', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 100, reportedTokens: 200,
          usedTokens: 300, warningFraction: 0.8, hardStop: true,
        },
      }));

      const status = await service.recordReportedUsage('agent-1', 50);

      expect(status.reportedTokens).toBe(250);
      expect(status.meteredTokens).toBe(100);
      expect(status.usedTokens).toBe(350);
    });
  });

  describe('metered vs reported isolation', () => {
    it('metered and reported usage tracked independently', async () => {
      const agent = makeAgent('agent-1', {
        budget: {
          totalTokens: 10000, meteredTokens: 0, reportedTokens: 0,
          usedTokens: 0, warningFraction: 0.8, hardStop: true,
        },
      });
      mockStore.getAgent.mockResolvedValue(agent);

      await service.recordMeteredUsage('agent-1', 300);
      // Agent state was mutated in-place by the service
      await service.recordReportedUsage('agent-1', 100);

      const status = await service.getBudgetStatus('agent-1');
      expect(status.meteredTokens).toBe(300);
      expect(status.reportedTokens).toBe(100);
      expect(status.usedTokens).toBe(400);
    });

    it('record_usage cannot double-count with metered spend', async () => {
      // Start with some metered spend
      const agent = makeAgent('agent-1', {
        budget: {
          totalTokens: 10000, meteredTokens: 500, reportedTokens: 0,
          usedTokens: 500, warningFraction: 0.8, hardStop: true,
        },
      });
      mockStore.getAgent.mockResolvedValue(agent);

      // recordReportedUsage (what record_usage tool calls) only touches reportedTokens
      await service.recordReportedUsage('agent-1', 200);

      expect(agent.budget!.reportedTokens).toBe(200);
      expect(agent.budget!.meteredTokens).toBe(500); // unchanged
      expect(agent.budget!.usedTokens).toBe(700); // sum

      // recordMeteredUsage only touches meteredTokens
      await service.recordMeteredUsage('agent-1', 100);

      expect(agent.budget!.meteredTokens).toBe(600);
      expect(agent.budget!.reportedTokens).toBe(200); // unchanged
      expect(agent.budget!.usedTokens).toBe(800); // sum
    });
  });

  describe('canAfford / resetBudgetIfDue', () => {
    it('canAfford respects remaining budget', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 400,
          usedTokens: 900, warningFraction: 0.8, hardStop: true,
        },
      }));

      expect(await service.canAfford('agent-1', 50)).toBe(true);
      expect(await service.canAfford('agent-1', 200)).toBe(false);
    });

    it('resets a daily budget that is due', async () => {
      const lastReset = new Date(Date.now() - 2 * 86_400_000).toISOString();
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 300,
          usedTokens: 800, warningFraction: 0.8, hardStop: true,
          resetPeriod: 'daily', lastResetAt: lastReset,
        },
      }));

      const reset = await service.resetBudgetIfDue('agent-1');

      expect(reset).toBe(true);
      expect(mockStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          budget: expect.objectContaining({
            meteredTokens: 0,
            reportedTokens: 0,
            usedTokens: 0,
          }),
        }),
      );
    });

    it('does not reset when the period has not elapsed', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, meteredTokens: 500, reportedTokens: 300,
          usedTokens: 800, warningFraction: 0.8, hardStop: true,
          resetPeriod: 'weekly', lastResetAt: new Date().toISOString(),
        },
      }));

      const reset = await service.resetBudgetIfDue('agent-1');

      expect(reset).toBe(false);
    });
  });
});

describe('resolveBudgetOwner (hierarchy walk)', () => {
  let service: AgentBudgetService;
  let agents: Map<string, Agent>;
  let store: { getAgent: Mock<any>; upsertAgent: Mock<any> };

  beforeEach(() => {
    agents = new Map();
    store = {
      getAgent: vi.fn(async (id) => agents.get(id as string)),
      upsertAgent: vi.fn(async (a) => {
        agents.set((a as Agent).id, a as Agent);
      }),
    };
    service = new AgentBudgetService(store as unknown as AgentStore);
  });

  // Regression: this walked a single hop, so a grandchild debited its parent
  // rather than the root and budget isolation broke below depth 1.
  it('a grandchild debits the ROOT budget, not its immediate parent', async () => {
    agents.set('root', makeAgent('root', {
      budget: {
        totalTokens: 1000, meteredTokens: 0, reportedTokens: 0,
        usedTokens: 0, warningFraction: 0.8, hardStop: true,
      },
    }));
    agents.set('child', makeAgent('child', { parentAgentId: 'root' }));
    agents.set('grandchild', makeAgent('grandchild', { parentAgentId: 'child' }));

    const status = await service.recordMeteredUsage('grandchild', 250);

    expect(status.agentId).toBe('root');
    expect(agents.get('root')!.budget!.meteredTokens).toBe(250);
    expect(agents.get('root')!.budget!.usedTokens).toBe(250);
    expect(agents.get('child')!.budget).toBeUndefined();
  });

  it('reports the root budget for a deeply nested agent', async () => {
    agents.set('root', makeAgent('root', {
      budget: {
        totalTokens: 900, meteredTokens: 400, reportedTokens: 200,
        usedTokens: 600, warningFraction: 0.5, hardStop: true,
      },
    }));
    agents.set('a', makeAgent('a', { parentAgentId: 'root' }));
    agents.set('b', makeAgent('b', { parentAgentId: 'a' }));

    const status = await service.getBudgetStatus('b');

    expect(status.agentId).toBe('root');
    expect(status.totalTokens).toBe(900);
    expect(status.usedTokens).toBe(600);
  });

  it('terminates on a parent cycle instead of looping forever', async () => {
    agents.set('x', makeAgent('x', { parentAgentId: 'y' }));
    agents.set('y', makeAgent('y', { parentAgentId: 'x' }));

    await expect(service.getBudgetStatus('x')).resolves.toBeDefined();
  });

  it('tolerates a dangling parent reference', async () => {
    agents.set('orphan', makeAgent('orphan', { parentAgentId: 'missing' }));

    const status = await service.getBudgetStatus('orphan');

    expect(status.agentId).toBe('orphan');
  });
});
