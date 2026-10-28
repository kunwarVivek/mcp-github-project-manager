import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from "vitest";
import {
  type Agent,
  WORK_PRODUCT_MARKER,
  type WorkProduct,
} from "../../../domain/agent-orchestration-types";
import type { AgentStore } from "../../../infrastructure/agent/AgentStore";
import type { WorkProductStore } from "../../../infrastructure/agent/WorkProductStore";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import { AgentMetricsService } from "../../../services/agent/AgentMetricsService";

function workProductComment(
  product: WorkProduct,
  htmlUrl: string
): { html_url: string; body: string } {
  return {
    html_url: htmlUrl,
    body: `${WORK_PRODUCT_MARKER} ${JSON.stringify(product)} -->`,
  };
}

vi.mock("../../../infrastructure/github/GitHubRepositoryFactory", () => {
  const mockFactory = vi.fn().mockImplementation(function () {
    return {
      createIssueRepository: vi.fn(),
      createMilestoneRepository: vi.fn(),
      createProjectRepository: vi.fn(),
      createSprintRepository: vi.fn(),
      createProjectWorkflowRepository: vi.fn(),
      createSubIssueRepository: vi.fn(),
      createStatusUpdateRepository: vi.fn(),
    };
  });
  return { GitHubRepositoryFactory: mockFactory };
});

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: "engineer",
    runtime: "claude-code",
    capabilities: [],
    status: "idle",
    registeredAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("AgentMetricsService", () => {
  let service: AgentMetricsService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let graphqlMock: Mock;
  let mockStore: { listAgents: Mock<() => Promise<Agent[]>> };
  let mockWpStore: { listForIssue: Mock<() => Promise<WorkProduct[]>> };
  let octokit: {
    rest: { issues: { listCommentsForRepo: Mock<() => Promise<{ data: unknown[] }>> } };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    octokit = {
      rest: {
        issues: {
          listCommentsForRepo: vi.fn(async () => ({ data: [] })),
        },
      },
    };

    graphqlMock = vi.fn(async () => ({ repository: {} }));
    mockFactory = {
      getConfig: vi.fn(() => ({ owner: "o", repo: "r" })),
      getOctokit: vi.fn(() => octokit),
      graphql: graphqlMock,
    } as unknown as Mocked<GitHubRepositoryFactory>;

    mockStore = { listAgents: vi.fn(async () => []) };
    mockWpStore = { listForIssue: vi.fn(async () => []) };

    service = new AgentMetricsService(
      mockFactory as unknown as GitHubRepositoryFactory,
      mockStore as unknown as AgentStore,
      mockWpStore as unknown as WorkProductStore
    );
  });

  it("returns empty aggregates for no agents", async () => {
    const metrics = await service.getMetrics();
    expect(metrics.totalAgents).toBe(0);
    expect(metrics.agents).toEqual([]);
  });

  it("computes per-agent metrics: throughput, budget, staleness", async () => {
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const fresh = new Date().toISOString();

    mockStore.listAgents.mockResolvedValue([
      makeAgent("agent-busy", {
        status: "working",
        currentTaskId: "42",
        currentTaskTitle: "Task 42",
        lastHeartbeat: fresh,
        budget: {
          totalTokens: 1000,
          meteredTokens: 400,
          reportedTokens: 0,
          usedTokens: 400,
          warningFraction: 0.8,
          hardStop: true,
        },
      }),
      makeAgent("agent-stale", {
        status: "offline",
        lastHeartbeat: stale,
        budget: {
          totalTokens: 1000,
          meteredTokens: 2000,
          reportedTokens: 0,
          usedTokens: 2000,
          warningFraction: 0.8,
          hardStop: true,
        },
      }),
    ]);

    octokit.rest.issues.listCommentsForRepo.mockResolvedValue({
      data: [
        workProductComment(
          {
            agentId: "agent-busy",
            taskId: "42",
            commitShas: [],
            filesChanged: [],
            summary: "x",
            submittedAt: new Date().toISOString(),
            id: "wp-1",
          },
          "https://github.com/o/r/issues/42#issuecomment-1"
        ),
      ],
    });

    const metrics = await service.getMetrics(30);

    expect(metrics.totalAgents).toBe(2);
    expect(metrics.activeAgents).toBe(1);
    expect(metrics.staleAgents).toBe(1);
    expect(metrics.budgetExhaustedAgents).toBe(1);
    expect(metrics.totalTasksInProgress).toBe(1);
    expect(metrics.totalTasksCompleted).toBe(1);

    const busy = metrics.agents.find((a) => a.agentId === "agent-busy");
    if (!busy) throw new Error("agent-busy missing from metrics");
    expect(busy.tasksCompleted).toBe(1);
    expect(busy.budgetUsagePercent).toBe(40);
    expect(busy.isStale).toBe(false);

    const staleAgent = metrics.agents.find((a) => a.agentId === "agent-stale");
    if (!staleAgent) throw new Error("agent-stale missing from metrics");
    expect(staleAgent.isStale).toBe(true);
  });

  describe("staleness of a working agent comes from its claimed item", () => {
    const minutesAgo = (minutes: number): string =>
      new Date(Date.now() - minutes * 60_000).toISOString();

    function boardShows(items: Record<number, { claimedBy: string; at?: string }>): void {
      graphqlMock.mockImplementation(async (query: string) => {
        const repository: Record<string, unknown> = {};
        for (const match of query.matchAll(/(i\d+): issue\(number: (\d+)\)/g)) {
          const item = items[Number(match[2])];
          repository[match[1]] = {
            projectItems: {
              nodes: item
                ? [
                    {
                      id: `item-${match[2]}`,
                      project: { id: "p1" },
                      fieldValues: {
                        nodes: [
                          { field: { name: "agent_claimed_by" }, text: item.claimedBy },
                          ...(item.at
                            ? [{ field: { name: "agent_heartbeat_at" }, text: item.at }]
                            : []),
                        ],
                      },
                    },
                  ]
                : [],
            },
          };
        }
        return { repository };
      });
    }

    it("is not stale when the item beat is recent although the registry beat is old", async () => {
      mockStore.listAgents.mockResolvedValue([
        makeAgent("a", { status: "working", currentTaskId: "42", lastHeartbeat: minutesAgo(120) }),
      ]);
      boardShows({ 42: { claimedBy: "a", at: minutesAgo(2) } });

      const metrics = await service.getMetrics(30);

      expect(metrics.staleAgents).toBe(0);
      expect(metrics.agents[0].isStale).toBe(false);
    });

    it("is stale when both the item beat and the registry beat are old", async () => {
      mockStore.listAgents.mockResolvedValue([
        makeAgent("a", { status: "working", currentTaskId: "42", lastHeartbeat: minutesAgo(120) }),
      ]);
      boardShows({ 42: { claimedBy: "a", at: minutesAgo(90) } });

      const metrics = await service.getMetrics(30);

      expect(metrics.staleAgents).toBe(1);
    });

    it("falls back to the registry beat when the item has no heartbeat yet", async () => {
      mockStore.listAgents.mockResolvedValue([
        makeAgent("a", { status: "working", currentTaskId: "42", lastHeartbeat: minutesAgo(120) }),
      ]);
      boardShows({ 42: { claimedBy: "a" } });

      const metrics = await service.getMetrics(30);

      expect(metrics.staleAgents).toBe(1);
    });

    it("reads the board once for all working agents and never for idle ones", async () => {
      mockStore.listAgents.mockResolvedValue([
        makeAgent("a", { status: "working", currentTaskId: "42", lastHeartbeat: minutesAgo(1) }),
        makeAgent("b", { status: "working", currentTaskId: "43", lastHeartbeat: minutesAgo(1) }),
        makeAgent("c", { status: "idle", lastHeartbeat: minutesAgo(5) }),
      ]);
      boardShows({ 42: { claimedBy: "a" }, 43: { claimedBy: "b" } });

      await service.getMetrics(30);

      expect(graphqlMock).toHaveBeenCalledTimes(1);
    });
  });
  it("skips pull requests when scanning for work products", async () => {
    mockStore.listAgents.mockResolvedValue([makeAgent("agent-1")]);
    octokit.rest.issues.listCommentsForRepo.mockResolvedValue({
      data: [
        workProductComment(
          {
            agentId: "agent-1",
            taskId: "5",
            commitShas: [],
            filesChanged: [],
            summary: "x",
            submittedAt: new Date().toISOString(),
            id: "wp-2",
          },
          "https://github.com/o/r/pull/5#issuecomment-2"
        ),
      ],
    });

    const metrics = await service.getMetrics();

    expect(metrics.totalTasksCompleted).toBe(0);
  });
});
