import { describe, expect, it, vi, beforeEach, type Mocked, } from 'vitest';
import { IssueService, } from '../../../services/IssueService';
import type { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import type { GitHubIssueRepository } from '../../../infrastructure/github/repositories/GitHubIssueRepository';
import { ResourceStatus } from '../../../domain/resource-types';
import type { Issue } from '../../../domain/types';

// Mock tsyringe decorators
vi.mock('tsyringe', () => ({
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

describe('IssueService', () => {
  let service: IssueService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let mockIssueRepo: Mocked<GitHubIssueRepository>;

  const mockIssue: Issue = {
    id: 'issue-1',
    number: 1,
    title: 'Test Issue',
    description: 'Test description',
    status: ResourceStatus.ACTIVE,
    labels: ['bug', 'priority:high'],
    assignees: ['user1'],
    milestoneId: 'milestone-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    url: 'https://github.com/test-owner/test-repo/issues/1'
  };

  const mockClosedIssue: Issue = {
    ...mockIssue,
    id: 'issue-2',
    number: 2,
    title: 'Closed Issue',
    status: ResourceStatus.CLOSED,
    url: 'https://github.com/test-owner/test-repo/issues/2'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repositories
    mockIssueRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByMilestone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    } as unknown as Mocked<GitHubIssueRepository>;

    // Create mock Octokit
    const mockOctokit = {
      rest: {
        issues: {
          createComment: vi.fn() as any,
          updateComment: vi.fn() as any,
          deleteComment: vi.fn() as any,
          listComments: vi.fn() as any
        }
      }
    };

    // Create mock factory
    mockFactory = {
      createIssueRepository: vi.fn().mockReturnValue(mockIssueRepo),
      getConfig: vi.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' }),
      getOctokit: vi.fn().mockReturnValue(mockOctokit),
      graphql: vi.fn()
    } as unknown as Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new IssueService(mockFactory);
  });

  describe('createIssue', () => {
    it('should create an issue and return plain Issue object', async () => {
      mockIssueRepo.create.mockResolvedValue(mockIssue);

      const result = await service.createIssue({
        title: 'Test Issue',
        description: 'Test description',
        labels: ['bug'],
        priority: 'high'
      });

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(mockIssue);
      expect(mockIssueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Issue',
          labels: ['bug', 'priority:high']
        })
      );
    });

    it('should create an issue without optional fields', async () => {
      const simpleIssue: Issue = {
        ...mockIssue,
        labels: [],
        assignees: [],
        milestoneId: undefined
      };
      mockIssueRepo.create.mockResolvedValue(simpleIssue);

      const result = await service.createIssue({
        title: 'Simple Issue',
        description: 'Simple description'
      });

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(simpleIssue);
      expect(result.labels).toEqual([]);
    });
  });

  describe('listIssues', () => {
    it('should return plain Issue array', async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ status: 'all' });

      expect(result).toHaveLength(2);
      // Services now return plain objects for MCP compatibility
      expect(result[0]).toEqual(mockIssue);
      expect(result[1]).toEqual(mockClosedIssue);
    });

    it('should filter by status', async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const openIssues = await service.listIssues({ status: 'open' });
      expect(openIssues).toHaveLength(1);
      expect(openIssues[0].status).toBe(ResourceStatus.ACTIVE);

      const closedIssues = await service.listIssues({ status: 'closed' });
      expect(closedIssues).toHaveLength(1);
      expect(closedIssues[0].status).toBe(ResourceStatus.CLOSED);
    });

    it('should filter by labels', async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ labels: ['bug'] });
      expect(result).toHaveLength(1);
      expect(result[0].labels).toContain('bug');
    });

    it('should filter by assignee', async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ assignee: 'user1' });
      expect(result).toHaveLength(1);
      expect(result[0].assignees).toContain('user1');
    });

    it('should limit results', async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getIssue', () => {
    it('should return plain Issue object when found', async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);

      const result = await service.getIssue('issue-1');

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(mockIssue);
    });

    it('should return null when not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      const result = await service.getIssue('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateIssue', () => {
    it('should update issue and return plain Issue object', async () => {
      const updatedIssue: Issue = {
        ...mockIssue,
        title: 'Updated Issue'
      };
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.updateIssue('issue-1', {
        title: 'Updated Issue'
      });

      // Services now return plain objects for MCP compatibility
      expect(result.title).toBe('Updated Issue');
      expect(result).toEqual(updatedIssue);
    });

    it('should handle status updates', async () => {
      mockIssueRepo.update.mockResolvedValue(mockClosedIssue);

      const result = await service.updateIssue('issue-1', {
        status: 'closed'
      });

      expect(result.status).toBe(ResourceStatus.CLOSED);
    });

    it('should handle milestone removal', async () => {
      const issueWithoutMilestone: Issue = {
        ...mockIssue,
        milestoneId: undefined
      };
      mockIssueRepo.update.mockResolvedValue(issueWithoutMilestone);

      const result = await service.updateIssue('issue-1', {
        milestoneId: null
      });

      expect(result.milestoneId).toBeUndefined();
    });
  });

  describe('createIssueComment', () => {
    it('should create a comment and return IssueComment', async () => {
      const mockComment = {
        id: 1,
        body: 'Test comment',
        user: { login: 'user1' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const octokit = mockFactory.getOctokit() as any;
      octokit.rest.issues.createComment.mockResolvedValue({ data: mockComment });

      const result = await service.createIssueComment({
        issueNumber: 1,
        body: 'Test comment'
      });

      expect(result).toEqual({
        id: 1,
        body: 'Test comment',
        user: 'user1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });
    });
  });

  describe('listIssueComments', () => {
    it('should return array of IssueComment', async () => {
      const mockComments = [
        {
          id: 1,
          body: 'Comment 1',
          user: { login: 'user1' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          body: 'Comment 2',
          user: { login: 'user2' },
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z'
        }
      ];

      const octokit = mockFactory.getOctokit() as any;
      octokit.rest.issues.listComments.mockResolvedValue({ data: mockComments });

      const result = await service.listIssueComments({
        issueNumber: 1,
        limit: 10
      });

      expect(result).toHaveLength(2);
      expect(result[0].user).toBe('user1');
      expect(result[1].user).toBe('user2');
    });
  });

  describe('Draft Issues', () => {
    it('should create a draft issue', async () => {
      const mockResponse = {
        addProjectV2DraftIssue: {
          projectV2Item: {
            id: 'item-1',
            content: {
              id: 'draft-1',
              title: 'Draft Issue',
              body: 'Draft body'
            }
          }
        }
      };

      mockFactory.graphql.mockResolvedValue(mockResponse as any);

      const result = await service.createDraftIssue({
        projectId: 'project-1',
        title: 'Draft Issue',
        body: 'Draft body'
      });

      expect(result).toEqual({
        id: 'draft-1',
        title: 'Draft Issue',
        body: 'Draft body'
      });
    });

    it('should update a draft issue', async () => {
      const mockResponse = {
        updateProjectV2DraftIssue: {
          draftIssue: {
            id: 'draft-1',
            title: 'Updated Draft',
            body: 'Updated body'
          }
        }
      };

      mockFactory.graphql.mockResolvedValue(mockResponse as any);

      const result = await service.updateDraftIssue({
        draftIssueId: 'draft-1',
        title: 'Updated Draft',
        body: 'Updated body'
      });

      expect(result).toEqual({
        id: 'draft-1',
        title: 'Updated Draft',
        body: 'Updated body'
      });
    });

    it('should delete a draft issue', async () => {
      mockFactory.graphql.mockResolvedValue({} as any);

      const result = await service.deleteDraftIssue({
        draftIssueId: 'draft-1'
      });

      expect(result).toEqual({
        success: true,
        message: 'Draft issue draft-1 deleted successfully'
      });
    });
  });
});
