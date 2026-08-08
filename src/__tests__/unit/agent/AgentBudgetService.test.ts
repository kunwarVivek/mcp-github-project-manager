import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';;
import { AgentBudgetService } from '../../../services/agent/AgentBudgetService';
import { AgentStore } from '../../../infrastructure/agent/AgentStore';
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
      expect(status.isWarning).toBe(false);
      expect(status.isExhausted).toBe(false);
    });

    it('flags warning at the threshold', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: { totalTokens: 1000, usedTokens: 850, warningThreshold: 0.8, hardStop: true },
      }));

      const status = await service.getBudgetStatus('agent-1');

      expect(status.isWarning).toBe(true);
      expect(status.usagePercent).toBe(85);
    });

    it('delegates to the parent budget for subagents', async () => {
      mockStore.getAgent.mockImplementation(async (id: string) => {
        if (id === 'child') return makeAgent('child', { parentAgentId: 'parent' });
        return makeAgent('parent', {
          budget: { totalTokens: 2000, usedTokens: 500, warningThreshold: 0.8, hardStop: true },
        });
      });

      const status = await service.getBudgetStatus('child');

      expect(status.agentId).toBe('parent');
      expect(status.remainingTokens).toBe(1500);
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
  });

  describe('recordUsage', () => {
    it('accumulates usage and flips status at hard stop', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: { totalTokens: 1000, usedTokens: 900, warningThreshold: 0.8, hardStop: true },
      }));

      const status = await service.recordUsage('agent-1', 150);

      expect(status.usedTokens).toBe(1050);
      expect(status.isExhausted).toBe(true);
      expect(status.remainingTokens).toBe(0);
    });

    it('records against the parent budget for subagents', async () => {
      // Same object reference for parent so in-place budget mutation persists
      const parent = makeAgent('parent', {
        budget: { totalTokens: 1000, usedTokens: 0, warningThreshold: 0.8, hardStop: true },
      });
      mockStore.getAgent.mockImplementation(async (id: string) => {
        if (id === 'child') return makeAgent('child', { parentAgentId: 'parent' });
        return parent;
      });

      const status = await service.recordUsage('child', 200);

      expect(status.usedTokens).toBe(200);
    });
  });

  describe('canAfford / resetBudgetIfDue', () => {
    it('canAfford respects remaining budget', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: { totalTokens: 1000, usedTokens: 900, warningThreshold: 0.8, hardStop: true },
      }));

      expect(await service.canAfford('agent-1', 50)).toBe(true);
      expect(await service.canAfford('agent-1', 200)).toBe(false);
    });

    it('resets a daily budget that is due', async () => {
      const lastReset = new Date(Date.now() - 2 * 86_400_000).toISOString();
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, usedTokens: 800, warningThreshold: 0.8, hardStop: true,
          resetPeriod: 'daily', lastResetAt: lastReset,
        },
      }));

      const reset = await service.resetBudgetIfDue('agent-1');

      expect(reset).toBe(true);
      expect(mockStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ budget: expect.objectContaining({ usedTokens: 0 }) }),
      );
    });

    it('does not reset when the period has not elapsed', async () => {
      mockStore.getAgent.mockResolvedValue(makeAgent('agent-1', {
        budget: {
          totalTokens: 1000, usedTokens: 800, warningThreshold: 0.8, hardStop: true,
          resetPeriod: 'weekly', lastResetAt: new Date().toISOString(),
        },
      }));

      const reset = await service.resetBudgetIfDue('agent-1');

      expect(reset).toBe(false);
    });
  });
});
