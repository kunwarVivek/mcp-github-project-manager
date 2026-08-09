import { beforeEach, describe, expect, it, vi, type Mocked, } from 'vitest';
import { WorkProductService } from '../../../services/agent/WorkProductService';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import type { WorkProductStore } from '../../../infrastructure/agent/WorkProductStore';
import type { WorkProduct } from '../../../domain/agent-orchestration-types';

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

const LIST_FIELDS_RESPONSE = {
  node: {
    fields: {
      nodes: [
        { id: 'f-branch', name: 'agent_work_branch', dataType: 'TEXT' },
        { id: 'f-pr', name: 'agent_pr_number', dataType: 'NUMBER' },
        {
          id: 'f-status',
          name: 'agent_status',
          dataType: 'SINGLE_SELECT',
          options: [
            { id: 'opt-review', name: 'review' },
          ],
        },
      ],
    },
  },
};

function makeProduct(overrides: Partial<WorkProduct> = {}): WorkProduct {
  return {
    id: 'wp-1',
    agentId: 'agent-1',
    taskId: '42',
    branch: 'feat/login',
    prNumber: 99,
    commitShas: ['abc123'],
    filesChanged: ['src/login.ts'],
    summary: 'Added login form',
    submittedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('WorkProductService', () => {
  let service: WorkProductService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStore: { submit: Mock<any>; listForIssue: Mock<any> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graphqlMock: Mock<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let octokit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    octokit = {
      rest: {
        issues: {
          listForRepo: vi.fn(async () => ({
            data: [{ number: 42, pull_request: undefined }],
          })),
        },
      },
    };

    graphqlMock = vi.fn(async (_query: string, vars: Record<string, any>) => {
      if (vars.projectId) return LIST_FIELDS_RESPONSE;
      if (vars.issueNumber != null) {
        return {
          repository: {
            issue: {
              projectItems: {
                nodes: [{ id: 'item-42', project: { id: 'project-1' } }],
              },
            },
          },
        };
      }
      return { repository: { issue: null } };
    }) as unknown as Mock<any>;

    mockFactory = {
      getConfig: vi.fn(() => ({ owner: 'o', repo: 'r' })),
      getOctokit: vi.fn(() => octokit),
      graphql: graphqlMock,
    } as unknown as Mocked<GitHubRepositoryFactory>;

    mockStore = {
      submit: vi.fn(async () => {}),
      listForIssue: vi.fn(async () => []),
    };

    service = new WorkProductService(
      mockFactory as unknown as GitHubRepositoryFactory,
      mockStore as unknown as WorkProductStore,
    );
  });

  it('persists the work product and updates project fields', async () => {
    await service.submitWorkProduct(makeProduct());

    expect(mockStore.submit).toHaveBeenCalledWith(42, expect.objectContaining({ agentId: 'agent-1' }));
    // Branch + PR + status updates via GraphQL
    expect(graphqlMock).toHaveBeenCalledWith(
      expect.stringContaining('updateProjectV2ItemFieldValue'),
      expect.objectContaining({ value: expect.anything() }),
    );
  });

  it('lists work products for an issue', async () => {
    mockStore.listForIssue.mockResolvedValue([makeProduct()]);
    const products = await service.listWorkProducts(42);
    expect(products).toHaveLength(1);
    expect(mockStore.listForIssue).toHaveBeenCalledWith(42);
  });

  it('filters work products by agent when querying', async () => {
    mockStore.listForIssue.mockResolvedValue([
      makeProduct({ agentId: 'agent-1' }),
      makeProduct({ id: 'wp-2', agentId: 'agent-2' }),
    ]);

    const products = await service.getWorkProductsByAgent('agent-1');

    expect(products).toHaveLength(1);
    expect(products[0].agentId).toBe('agent-1');
  });
});
