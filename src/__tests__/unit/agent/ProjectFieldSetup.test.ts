import { beforeEach, describe, expect, it, vi, type Mocked, } from 'vitest';
import { ProjectFieldSetup } from '../../../infrastructure/agent/ProjectFieldSetup';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';

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

const ALL_FIELDS_RESPONSE = {
  node: {
    fields: {
      nodes: [
        { id: 'f-a', name: 'agent_claimed_by', dataType: 'TEXT' },
        { id: 'f-b', name: 'agent_claimed_at', dataType: 'TEXT' },
        { id: 'f-c', name: 'agent_status', dataType: 'SINGLE_SELECT' },
        { id: 'f-d', name: 'agent_work_branch', dataType: 'TEXT' },
        { id: 'f-e', name: 'agent_pr_number', dataType: 'NUMBER' },
      ],
    },
  },
};

describe('ProjectFieldSetup', () => {
  let setup: ProjectFieldSetup;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let createField: Mock<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let graphqlMock: Mock<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    createField = vi.fn(async () => ({ id: 'new-field' }));
    graphqlMock = vi.fn(async () => ALL_FIELDS_RESPONSE);

    mockFactory = {
      graphql: graphqlMock,
      createProjectRepository: vi.fn(() => ({ createField })),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    setup = new ProjectFieldSetup(mockFactory);
  });

  it('creates only missing fields (idempotent)', async () => {
    const result = await setup.ensureFields('project-1');

    expect(result.existing).toEqual([
      'agent_claimed_by',
      'agent_claimed_at',
      'agent_status',
      'agent_work_branch',
      'agent_pr_number',
    ]);
    expect(result.created).toEqual([]);
    expect(createField).not.toHaveBeenCalled();
  });

  it('creates fields that are absent', async () => {
    graphqlMock.mockResolvedValue({
      node: { fields: { nodes: [{ id: 'f-a', name: 'agent_status', dataType: 'SINGLE_SELECT' }] } },
    });

    const result = await setup.ensureFields('project-1');

    expect(result.created).toContain('agent_claimed_by');
    expect(result.created).toContain('agent_claimed_at');
    expect(result.created).toContain('agent_work_branch');
    expect(result.created).toContain('agent_pr_number');
    expect(createField).toHaveBeenCalledTimes(4);
  });

  it('creates agent_status with the full option set', async () => {
    graphqlMock.mockResolvedValue({
      node: { fields: { nodes: [] } },
    });

    await setup.ensureFields('project-1');

    const statusCall = createField.mock.calls.find(
      (c) => (c[1] as { name?: string } | undefined)?.name === 'agent_status',
    );
    expect(statusCall).toBeDefined();
    const data = statusCall![1] as { options?: Array<{ name: string }> };
    expect(data.options?.map(o => o.name)).toEqual([
      'unclaimed', 'in_progress', 'review', 'blocked', 'completed',
    ]);
  });
});
