import { beforeEach, describe, expect, it, vi, Mocked, MockedClass, MockedFunction } from 'vitest';
import { AgentStore } from '../../../infrastructure/agent/AgentStore';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
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

describe('AgentStore', () => {
  let store: AgentStore;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let octokit: {
    rest: {
      issues: {
        listForRepo: Mock;
        createLabel: Mock;
        create: Mock;
        update: Mock;
      };
    };
  };
  let registryBody: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registryBody = '[]';

    octokit = {
      rest: {
        issues: {
          listForRepo: vi.fn(async () => {
            return { data: registryBody === '[]' ? [] : [{ number: 1, body: registryBody }] };
          }),
          createLabel: vi.fn(async () => ({ data: {} })),
          create: vi.fn(async () => ({ data: { number: 1, body: registryBody } })),
          update: vi.fn(async (args: any) => {
            // Persist the new body so subsequent listAgents() reads see it
            registryBody = args.body;
            return { data: { number: 1 } };
          }),
        },
      },
    };

    mockFactory = {
      getOctokit: vi.fn(() => octokit as any),
      getConfig: vi.fn(() => ({ owner: 'test-owner', repo: 'test-repo' })),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    store = new AgentStore(mockFactory);
  });

  describe('upsertAgent', () => {
    it('adds a new agent to an empty registry', async () => {
      await store.upsertAgent(makeAgent('agent-1'));

      expect(octokit.rest.issues.create).toHaveBeenCalled();
      const body = JSON.parse(registryBody) as Agent[];
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe('agent-1');
    });

    it('updates an existing agent matched by id', async () => {
      registryBody = JSON.stringify([makeAgent('agent-1', { status: 'idle' })], null, 2);
      await store.upsertAgent(makeAgent('agent-1', { status: 'working' }));

      const body = JSON.parse(registryBody) as Agent[];
      expect(body).toHaveLength(1);
      expect(body[0].status).toBe('working');
    });

    it('re-merges lost concurrent writes (verify-and-merge retry)', async () => {
      // Simulate a concurrent writer: after our update write, the registry
      // body is different (another agent was added concurrently).
      const originalUpdate = octokit.rest.issues.update;
      let writeCount = 0;
      octokit.rest.issues.update = vi.fn(async (args: any) => {
        writeCount++;
        if (writeCount === 1) {
          // Our write lands, then a concurrent writer adds agent-concurrent
          registryBody = args.body;
          const concurrent = JSON.parse(registryBody) as Agent[];
          concurrent.push(makeAgent('agent-concurrent'));
          registryBody = JSON.stringify(concurrent, null, 2);
        } else {
          registryBody = args.body;
        }
        return { data: { number: 1 } };
      }) as any;

      await store.upsertAgent(makeAgent('agent-1'));

      const final = JSON.parse(registryBody) as Agent[];
      const ids = final.map(a => a.id);
      expect(ids).toContain('agent-1');
      expect(ids).toContain('agent-concurrent');
      expect(writeCount).toBeGreaterThan(1);
      expect(originalUpdate).toBeDefined();
    });
  });

  describe('removeAgent / removeAgentCascade', () => {
    it('returns false when the agent does not exist', async () => {
      registryBody = JSON.stringify([makeAgent('agent-1')], null, 2);
      const removed = await store.removeAgent('agent-nope');
      expect(removed).toBe(false);
    });

    it('removes an agent by id', async () => {
      registryBody = JSON.stringify([makeAgent('agent-1'), makeAgent('agent-2')], null, 2);
      const removed = await store.removeAgent('agent-1');
      expect(removed).toBe(true);
      const body = JSON.parse(registryBody) as Agent[];
      expect(body.map(a => a.id)).toEqual(['agent-2']);
    });

    it('cascades removal to descendants', async () => {
      registryBody = JSON.stringify([
        makeAgent('parent'),
        makeAgent('child-1', { parentAgentId: 'parent' }),
        makeAgent('grandchild', { parentAgentId: 'child-1' }),
        makeAgent('unrelated'),
      ], null, 2);

      const count = await store.removeAgentCascade('parent');
      expect(count).toBe(3);
      const body = JSON.parse(registryBody) as Agent[];
      expect(body.map(a => a.id)).toEqual(['unrelated']);
    });
  });

  describe('getChildren / listAgents / getAgent', () => {
    beforeEach(() => {
      registryBody = JSON.stringify([
        makeAgent('parent'),
        makeAgent('child', { parentAgentId: 'parent' }),
      ], null, 2);
    });

    it('lists all agents', async () => {
      const agents = await store.listAgents();
      expect(agents).toHaveLength(2);
    });

    it('gets an agent by id', async () => {
      const agent = await store.getAgent('child');
      expect(agent?.parentAgentId).toBe('parent');
    });

    it('returns undefined for unknown agent', async () => {
      const agent = await store.getAgent('ghost');
      expect(agent).toBeUndefined();
    });

    it('returns direct children only', async () => {
      const children = await store.getChildren('parent');
      expect(children).toHaveLength(1);
      expect(children[0].id).toBe('child');
    });

    it('returns [] when the registry body is malformed', async () => {
      registryBody = '{not-json';
      const agents = await store.listAgents();
      expect(agents).toEqual([]);
    });
  });
});
