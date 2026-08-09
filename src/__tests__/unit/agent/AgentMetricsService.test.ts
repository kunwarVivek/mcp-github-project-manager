import { beforeEach, describe, expect, it, vi, type Mocked, } from 'vitest';
import { AgentMetricsService } from '../../../services/agent/AgentMetricsService';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import type { AgentStore } from '../../../infrastructure/agent/AgentStore';
import type { WorkProductStore } from '../../../infrastructure/agent/WorkProductStore';
import type { Agent } from '../../../domain/agent-orchestration-types';

vi.mock('../../../infrastructure/github/GitHubRepositoryFactory', () => {
  const mockFactory = vi.fn().mockImplementation(function () { return ({
    createIssueRepository: vi.fn(),
    createMilestoneRepository: vi.fn(),
    createProjectRepository: vi.fn(),
    createSprintRepository: vi.fn(),
    createAutomationRuleRepository: vi.fn(),
    createSubIssueRepository: vi.fn(),
    createStatusUpdateRepository: vi.fn(),
  }); });
  return { GitHubRepositoryFactory: mockFactory };
});

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

describe('AgentMetricsService', () => {
  let service: AgentMetricsService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStore: { listAgents: Mock<any> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWpStore: { listForIssue: Mock<any> };
  let octokit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    octokit = {
      rest: {
        issues: {
          listForRepo: vi.fn(async () => ({
            data: [{ number: 1, pull_request: undefined }],
          })),
        },
      },
    };

    mockFactory = {
      getConfig: vi.fn(() => ({ owner: 'o', repo: 'r' })),
      getOctokit: vi.fn(() => octokit),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    mockStore = { listAgents: vi.fn(async () => []) };
    mockWpStore = { listForIssue: vi.fn(async () => []) };

    service = new AgentMetricsService(
      mockFactory as unknown as GitHubRepositoryFactory,
      mockStore as unknown as AgentStore,
      mockWpStore as unknown as WorkProductStore,
    );
  });

  it('returns empty aggregates for no agents', async () => {
    const metrics = await service.getMetrics();
    expect(metrics.totalAgents).toBe(0);
    expect(metrics.agents).toEqual([]);
  });

  it('computes per-agent metrics: throughput, budget, staleness', async () => {
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const fresh = new Date().toISOString();

    mockStore.listAgents.mockResolvedValue([
      makeAgent('agent-busy', {
        status: 'working',
        currentTaskId: '42',
        currentTaskTitle: 'Task 42',
        lastHeartbeat: fresh,
        budget: { totalTokens: 1000, usedTokens: 400, warningThreshold: 0.8, hardStop: true },
      }),
      makeAgent('agent-stale', {
        status: 'offline',
        lastHeartbeat: stale,
        budget: { totalTokens: 1000, usedTokens: 2000, warningThreshold: 0.8, hardStop: true },
      }),
    ]);

    mockWpStore.listForIssue.mockResolvedValue([
      { agentId: 'agent-busy', taskId: '42', commitShas: [], filesChanged: [], summary: 'x', submittedAt: new Date().toISOString(), id: 'wp-1' },
    ]);

    const metrics = await service.getMetrics(30);

    expect(metrics.totalAgents).toBe(2);
    expect(metrics.activeAgents).toBe(1);
    expect(metrics.staleAgents).toBe(1);
    expect(metrics.budgetExhaustedAgents).toBe(1);
    expect(metrics.totalTasksInProgress).toBe(1);
    expect(metrics.totalTasksCompleted).toBe(1);

    const busy = metrics.agents.find(a => a.agentId === 'agent-busy')!;
    expect(busy.tasksCompleted).toBe(1);
    expect(busy.budgetUsagePercent).toBe(40);
    expect(busy.isStale).toBe(false);

    const staleAgent = metrics.agents.find(a => a.agentId === 'agent-stale')!;
    expect(staleAgent.isStale).toBe(true);
  });

  it('skips pull requests when scanning for work products', async () => {
    mockStore.listAgents.mockResolvedValue([makeAgent('agent-1')]);
    octokit.rest.issues.listForRepo.mockResolvedValue({
      data: [{ number: 5, pull_request: { url: 'x' } }],
    });

    const metrics = await service.getMetrics();

    expect(mockWpStore.listForIssue).not.toHaveBeenCalled();
    expect(metrics.totalTasksCompleted).toBe(0);
  });
});
