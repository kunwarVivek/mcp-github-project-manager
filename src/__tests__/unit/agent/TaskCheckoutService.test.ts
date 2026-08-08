import { beforeEach, describe, expect, it, vi, Mocked, MockedClass, MockedFunction } from 'vitest';
import { TaskCheckoutService } from '../../../services/agent/TaskCheckoutService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { AgentStore } from '../../../infrastructure/agent/AgentStore';
import { AgentContextService } from '../../../services/agent/AgentContextService';
import type { Agent } from '../../../domain/agent-orchestration-types';

vi.mock('../../../infrastructure/github/GitHubRepositoryFactory', () => {
  const mockFactory = vi.fn().mockImplementation(function() { return ({
    createIssueRepository: vi.fn(),
    createMilestoneRepository: vi.fn(),
    createProjectRepository: vi.fn(),
    createSprintRepository: vi.fn(),
    createAutomationRuleRepository: vi.fn(),
    createSubIssueRepository: vi.fn(),
    createStatusUpdateRepository: vi.fn(),
  }));
  return { GitHubRepositoryFactory: mockFactory };
});

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

interface IssueFixture {
  id?: string;
  number: number;
  title?: string;
  body?: string;
  createdAt?: string;
  labels?: string[];
  milestone?: { title: string; dueOn?: string | null } | null;
  claimedBy?: string;
  status?: string;
}

function makeIssue(overrides: IssueFixture) {
  const {
    id = `issue-${overrides.number}`,
    number,
    title = `Task ${number}`,
    body = '',
    createdAt = '2026-01-01T00:00:00Z',
    labels = [],
    milestone = null,
    claimedBy,
    status,
  } = overrides;

  const fieldValues = [
    ...(claimedBy
      ? [{ field: { name: 'agent_claimed_by' }, text: claimedBy }]
      : []),
    ...(status
      ? [{ field: { name: 'agent_status' }, name: status }]
      : []),
  ];

  return {
    id,
    number,
    title,
    body,
    state: 'OPEN',
    createdAt,
    labels: { nodes: labels.map(name => ({ name })) },
    milestone,
    projectItems: {
      nodes: [{
        id: `item-${number}`,
        project: { id: 'project-1' },
        fieldValues: { nodes: fieldValues },
      }],
    },
  };
}

function makeAgent(id: string, overrides: Partial<Agent> = {}): Agent {
  return {
    id,
    name: `agent-${id}`,
    role: 'engineer',
    runtime: 'claude-code',
    capabilities: ['typescript'],
    status: 'idle',
    registeredAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const LIST_FIELDS_RESPONSE = {
  node: {
    fields: {
      nodes: [
        { id: 'f-claimed-by', name: 'agent_claimed_by', dataType: 'TEXT' },
        { id: 'f-claimed-at', name: 'agent_claimed_at', dataType: 'TEXT' },
        {
          id: 'f-status',
          name: 'agent_status',
          dataType: 'SINGLE_SELECT',
          options: [
            { id: 'opt-unclaimed', name: 'unclaimed' },
            { id: 'opt-in-progress', name: 'in_progress' },
            { id: 'opt-review', name: 'review' },
            { id: 'opt-completed', name: 'completed' },
          ],
        },
      ],
    },
  },
};

describe('TaskCheckoutService', () => {
  let service: TaskCheckoutService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAgentStore: {
    getAgent: Mock<any>;
    upsertAgent: Mock<any>;
    listAgents: Mock<any>;
    getChildren: Mock<any>;
    removeAgent: Mock<any>;
    registryExists: Mock<any>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockContextService: { getTaskContext: Mock<any> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let octokit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let issuesFixture: ReturnType<typeof makeIssue>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graphqlMock: Mock<any>;
  // Simulated persisted claims: itemId → agentId (written by claim mutations)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let persistedClaims: Map<string, string>;

  function configureGraphqlMock() {
    graphqlMock.mockImplementation(
      async (query: string, vars: Record<string, any>) => {
        // Claim mutations persist the claimed_by value so post-write
        // verification reads see it.
        if (
          query.includes('updateProjectV2ItemFieldValue') &&
          vars.fieldId === 'f-claimed-by' &&
          typeof vars.value === 'string'
        ) {
          persistedClaims.set(vars.itemId, vars.value);
        }
        // Project fields lookup
        if (vars.projectId === 'project-1' && vars.itemId === undefined && vars.number === undefined) {
          return LIST_FIELDS_RESPONSE;
        }
        // Open issues list
        if (vars.owner && vars.repo && vars.cursor === undefined && vars.itemId === undefined) {
          return {
            repository: {
              issues: {
                nodes: issuesFixture,
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          };
        }
        // Fresh item read (atomic claim verification)
        if (vars.itemId) {
          const num = Number(vars.itemId.replace('item-', ''));
          const issue = issuesFixture.find(i => i.number === num);
          const fieldValues = issue ? [...issue.projectItems.nodes[0].fieldValues.nodes] : [];
          const persisted = persistedClaims.get(vars.itemId);
          if (persisted) {
            // Persisted claim supersedes fixture state
            const existing = fieldValues.findIndex(
              fv => fv.field?.name === 'agent_claimed_by',
            );
            const claimed = { field: { name: 'agent_claimed_by' }, text: persisted };
            if (existing >= 0) fieldValues[existing] = claimed;
            else fieldValues.push(claimed);
          }
          return {
            node: {
              project: { id: 'project-1' },
              fieldValues: { nodes: fieldValues },
            },
          };
        }
        // Issue project items lookup (clearClaimFields / setStatusField)
        if (vars.number != null) {
          return {
            repository: {
              issue: {
                projectItems: {
                  nodes: [{
                    id: `item-${vars.number}`,
                    project: { id: 'project-1' },
                  }],
                },
              },
            },
          };
        }
        return { node: { fields: { nodes: [] } } };
      },
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    issuesFixture = [];
    persistedClaims = new Map();

    octokit = {
      rest: {
        issues: {
          createComment: vi.fn(async () => ({ data: {} })),
          update: vi.fn(async () => ({ data: {} })),
        },
        pulls: {
          get: vi.fn(),
          listReviews: vi.fn(),
        },
      },
    };

    graphqlMock = vi.fn();

    mockFactory = {
      getConfig: vi.fn(() => ({ owner: 'test-owner', repo: 'test-repo' })),
      getOctokit: vi.fn(() => octokit),
      graphql: graphqlMock,
    } as unknown as Mocked<GitHubRepositoryFactory>;

    mockAgentStore = {
      getAgent: vi.fn(),
      upsertAgent: vi.fn(async () => {}),
      listAgents: vi.fn(async () => []),
      getChildren: vi.fn(async () => []),
      removeAgent: vi.fn(async () => true),
      registryExists: vi.fn(async () => true),
    };

    mockContextService = {
      getTaskContext: vi.fn(async () => ({
        issue: { id: 'x', number: 1, title: 'T', body: '', labels: [], assignees: [], state: 'OPEN', createdAt: '2026-01-01T00:00:00Z' },
        relatedIssues: [],
        branchSuggestion: 'agent/1-task',
        acceptanceCriteria: [],
      })),
    };

    service = new TaskCheckoutService(
      mockFactory as unknown as GitHubRepositoryFactory,
      mockAgentStore as unknown as AgentStore,
      mockContextService as unknown as AgentContextService,
    );

    configureGraphqlMock();
  });

  describe('checkoutTask — strategy selection', () => {
    it('claims the highest-priority task by default', async () => {
      issuesFixture = [
        makeIssue({ number: 1, title: 'Low', labels: ['priority:low'] }),
        makeIssue({ number: 2, title: 'High', labels: ['priority:high'] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1');

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
      expect(result.selectionRationale).toContain('priority');
    });

    it('honors oldest_first strategy', async () => {
      issuesFixture = [
        makeIssue({ number: 1, createdAt: '2026-03-01T00:00:00Z' }),
        makeIssue({ number: 2, createdAt: '2026-01-01T00:00:00Z' }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', { strategy: 'oldest_first' });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('honors skills_match strategy', async () => {
      issuesFixture = [
        makeIssue({ number: 1, labels: ['ruby'] }),
        makeIssue({ number: 2, labels: ['typescript'] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('agent-1', { capabilities: ['typescript'] }),
      );

      const result = await service.checkoutTask('agent-1', { strategy: 'skills_match' });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('honors milestone_deadline strategy (earliest due date first)', async () => {
      issuesFixture = [
        makeIssue({ number: 1, milestone: { title: 'M1', dueOn: '2026-06-01T00:00:00Z' } }),
        makeIssue({ number: 2, milestone: { title: 'M2', dueOn: '2026-04-01T00:00:00Z' } }),
        makeIssue({ number: 3, milestone: null }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', { strategy: 'milestone_deadline' });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('skips claimed and non-unclaimed issues', async () => {
      issuesFixture = [
        makeIssue({ number: 1, claimedBy: 'agent-other' }),
        makeIssue({ number: 2, status: 'in_progress' }),
        makeIssue({ number: 3 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1');

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(3);
    });

    it('filters by label and projectId', async () => {
      issuesFixture = [
        makeIssue({ number: 1, labels: ['backend'] }),
        makeIssue({ number: 2, labels: ['frontend'] }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', {
        strategy: 'highest_priority',
        labels: ['frontend'],
      });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('returns failure when no tasks are available', async () => {
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));
      const result = await service.checkoutTask('agent-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No unclaimed tasks');
    });

    it('rejects agents that already hold a task', async () => {
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('agent-1', { currentTaskId: '99' }),
      );
      const result = await service.checkoutTask('agent-1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('already has a task');
    });
  });

  describe('checkoutTask — dependency awareness', () => {
    it('skips issues blocked by an open issue when skipBlocked is set', async () => {
      issuesFixture = [
        makeIssue({ number: 1, body: 'Blocked by #2' }),
        makeIssue({ number: 2 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('skips issues with a blocked label when skipBlocked is set', async () => {
      issuesFixture = [
        makeIssue({ number: 1, labels: ['blocked'] }),
        makeIssue({ number: 2 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', { skipBlocked: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });

    it('does not filter blocked issues when skipBlocked is unset', async () => {
      issuesFixture = [
        makeIssue({ number: 1, body: 'Blocked by #2' }),
        makeIssue({ number: 2 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      const result = await service.checkoutTask('agent-1', { strategy: 'oldest_first' });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(1);
    });
  });

  describe('checkoutTask — atomic claim guard', () => {
    it('aborts when another agent claims the item between read and write', async () => {
      issuesFixture = [
        makeIssue({ number: 1 }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(makeAgent('agent-1'));

      // Simulate a claim that landed between the candidate list fetch and
      // the claim write: the fresh claim-time item read shows the issue has
      // been claimed by another agent (TOCTOU window).
      let itemReads = 0;
      graphqlMock.mockImplementation(
        async (query: string, vars: Record<string, any>) => {
          // The pre-write check sees another agent's claim → abort.
          if (vars.itemId && query.includes('node(')) {
            itemReads++;
            return {
              node: {
                project: { id: 'project-1' },
                fieldValues: {
                  nodes: [{ field: { name: 'agent_claimed_by' }, text: 'agent-other' }],
                },
              },
            };
          }
          if (vars.owner && vars.repo) {
            return {
              repository: {
                issues: {
                  nodes: issuesFixture,
                  pageInfo: { hasNextPage: false },
                },
              },
            };
          }
          if (vars.projectId && !vars.itemId) return LIST_FIELDS_RESPONSE;
          if (vars.number != null) {
            return {
              repository: { issue: { projectItems: { nodes: [{ id: 'item-1', project: { id: 'project-1' } }] } } },
            };
          }
          return { node: { fields: { nodes: [] } } };
        },
      );

      const result = await service.checkoutTask('agent-1');

      expect(result.success).toBe(false);
      expect(result.message).toContain('concurrently');
    });
  });

  describe('review workflow', () => {
    it('submits a task for review and updates agent status', async () => {
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('agent-1', { currentTaskId: '42' }),
      );
      issuesFixture = [makeIssue({ number: 42, status: 'in_progress' })];

      const result = await service.submitForReview('agent-1', '42', 'Done');

      expect(result.success).toBe(true);
      expect(octokit.rest.issues.createComment).toHaveBeenCalled();
      expect(mockAgentStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'needs_review' }),
      );
    });

    it('approves a task and closes the issue', async () => {
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('reviewer-1', { currentTaskId: '42' }),
      );
      issuesFixture = [makeIssue({ number: 42, status: 'review' })];

      const result = await service.approveTask('reviewer-1', '42', 'LGTM');

      expect(result.success).toBe(true);
      expect(octokit.rest.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed' }),
      );
      expect(mockAgentStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'idle', currentTaskId: undefined }),
      );
    });

    it('rejects a task and returns it to the pool', async () => {
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('reviewer-1', { currentTaskId: '42' }),
      );
      issuesFixture = [makeIssue({ number: 42, status: 'review' })];

      const result = await service.rejectTask('reviewer-1', '42', 'Add tests');

      expect(result.success).toBe(true);
      expect(result.message).toContain('returned to pool');
      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('Add tests') }),
      );
    });

    it('approve releases the original submitting agent (not just the reviewer)', async () => {
      const original = makeAgent('agent-1', { currentTaskId: '42', status: 'needs_review' });
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('reviewer-1', { currentTaskId: '77' }),
      );
      mockAgentStore.listAgents.mockResolvedValue([original, makeAgent('reviewer-1', { currentTaskId: '77' })]);
      issuesFixture = [makeIssue({ number: 42, status: 'review' })];

      const result = await service.approveTask('reviewer-1', '42', 'LGTM');

      expect(result.success).toBe(true);
      expect(mockAgentStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'idle', currentTaskId: undefined }),
      );
    });

    it('reject releases the original submitting agent', async () => {
      const original = makeAgent('agent-1', { currentTaskId: '42', status: 'needs_review' });
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('reviewer-1', { currentTaskId: '77' }),
      );
      mockAgentStore.listAgents.mockResolvedValue([original, makeAgent('reviewer-1', { currentTaskId: '77' })]);
      issuesFixture = [makeIssue({ number: 42, status: 'review' })];

      const result = await service.rejectTask('reviewer-1', '42', 'Fix tests');

      expect(result.success).toBe(true);
      expect(mockAgentStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'idle', currentTaskId: undefined }),
      );
    });

    it('review queue checkout returns a task in review state', async () => {
      issuesFixture = [
        makeIssue({ number: 1 }),
        makeIssue({ number: 2, status: 'review' }),
      ];
      mockAgentStore.getAgent.mockResolvedValue(
        makeAgent('reviewer-1', { role: 'reviewer' }),
      );

      const result = await service.checkoutTask('agent-r', { reviewQueue: true });

      expect(result.success).toBe(true);
      expect(result.issueNumber).toBe(2);
    });
  });

  describe('reclaimStaleTasks', () => {
    it('does nothing and never bootstraps the registry when none exists', async () => {
      mockAgentStore.registryExists.mockResolvedValue(false);

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(0);
      expect(mockAgentStore.listAgents).not.toHaveBeenCalled();
    });

    it('reclaims tasks from stale agents, posts an audit comment, marks offline', async () => {
      const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
      mockAgentStore.listAgents.mockResolvedValue([
        makeAgent('agent-1', {
          currentTaskId: '42',
          status: 'working',
          lastHeartbeat: stale,
        }),
        makeAgent('agent-2', {
          currentTaskId: '43',
          status: 'working',
          lastHeartbeat: new Date().toISOString(),
        }),
      ]);
      issuesFixture = [
        makeIssue({ number: 42, status: 'in_progress' }),
        makeIssue({ number: 43, status: 'in_progress' }),
      ];

      const result = await service.reclaimStaleTasks(30);

      expect(result.reclaimed).toBe(1);
      expect(result.details).toEqual([{ agentId: 'agent-1', taskId: '42' }]);
      expect(octokit.rest.issues.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ body: expect.stringContaining('Agent Task Auto-Reclaimed') }),
      );
      expect(mockAgentStore.upsertAgent).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'agent-1', status: 'offline', currentTaskId: undefined }),
      );
    });
  });

  describe('processHeartbeat', () => {
    it('records heartbeat history (most recent first, capped)', async () => {
      const agent = makeAgent('agent-1', { metadata: {} });
      mockAgentStore.getAgent.mockResolvedValue(agent);

      await service.processHeartbeat({
        agentId: 'agent-1',
        status: 'working',
        taskId: '42',
        progress: 25,
        progressSummary: 'Started',
        timestamp: '2026-01-01T00:00:01Z',
      });
      await service.processHeartbeat({
        agentId: 'agent-1',
        status: 'working',
        taskId: '42',
        progress: 50,
        timestamp: '2026-01-01T00:00:02Z',
      });

      expect(mockAgentStore.upsertAgent).toHaveBeenCalledTimes(2);
      const saved = mockAgentStore.upsertAgent.mock.calls[1][0] as Agent;
      const history = saved.metadata?.heartbeatHistory as Array<{ progress: number }>;
      expect(history).toHaveLength(2);
      expect(history[0].progress).toBe(50); // most recent first
    });
  });
});
