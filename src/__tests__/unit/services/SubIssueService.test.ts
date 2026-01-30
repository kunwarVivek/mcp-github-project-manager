import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SubIssueService } from '../../../services/SubIssueService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { ResourceStatus } from '../../../domain/resource-types';
import { ResourceNotFoundError, DomainError } from '../../../domain/errors';
import { Issue } from '../../../domain/types';

// Mock the factory
jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('SubIssueService', () => {
  let service: SubIssueService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockIssueRepo: {
    findById: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    findAll: jest.MockedFunction<any>;
  };
  let mockMilestoneRepo: {
    findById: jest.MockedFunction<any>;
  };

  const mockIssue: Issue = {
    id: 'issue-1',
    number: 1,
    title: 'Test Issue',
    description: 'Test description',
    status: ResourceStatus.ACTIVE,
    labels: [],
    assignees: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    url: 'https://github.com/test/repo/issues/1',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repositories
    mockIssueRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      findAll: jest.fn(),
    };

    mockMilestoneRepo = {
      findById: jest.fn(),
    };

    // Create mock factory
    mockFactory = {
      createIssueRepository: jest.fn().mockReturnValue(mockIssueRepo),
      createMilestoneRepository: jest.fn().mockReturnValue(mockMilestoneRepo),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new SubIssueService(mockFactory);
  });

  describe('updateIssueStatus', () => {
    it('should update issue status successfully', async () => {
      const updatedIssue = { ...mockIssue, status: ResourceStatus.CLOSED };
      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.updateIssueStatus('issue-1', ResourceStatus.CLOSED);

      expect(result.status).toBe(ResourceStatus.CLOSED);
      expect(mockIssueRepo.findById).toHaveBeenCalledWith('issue-1');
      expect(mockIssueRepo.update).toHaveBeenCalledWith('issue-1', { status: ResourceStatus.CLOSED });
    });

    it('should throw error when issue not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.updateIssueStatus('non-existent', ResourceStatus.CLOSED))
        .rejects.toThrow(DomainError);
    });
  });

  describe('addIssueDependency', () => {
    it('should add dependency label to issue', async () => {
      const dependentIssue = { ...mockIssue, id: 'issue-2' };
      mockIssueRepo.findById
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce(dependentIssue);
      mockIssueRepo.update.mockResolvedValue({ ...mockIssue, labels: ['depends-on:issue-2'] });

      await service.addIssueDependency('issue-1', 'issue-2');

      expect(mockIssueRepo.update).toHaveBeenCalledWith('issue-1', {
        labels: ['depends-on:issue-2']
      });
    });

    it('should not duplicate dependency label', async () => {
      const issueWithDependency = { ...mockIssue, labels: ['depends-on:issue-2'] };
      const dependentIssue = { ...mockIssue, id: 'issue-2' };
      mockIssueRepo.findById
        .mockResolvedValueOnce(issueWithDependency)
        .mockResolvedValueOnce(dependentIssue);

      await service.addIssueDependency('issue-1', 'issue-2');

      // Update should not be called since label already exists
      expect(mockIssueRepo.update).not.toHaveBeenCalled();
    });

    it('should throw error when source issue not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.addIssueDependency('non-existent', 'issue-2'))
        .rejects.toThrow(DomainError);
    });

    it('should throw error when dependency target not found', async () => {
      mockIssueRepo.findById
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce(null);

      await expect(service.addIssueDependency('issue-1', 'non-existent'))
        .rejects.toThrow(DomainError);
    });
  });

  describe('getIssueDependencies', () => {
    it('should return dependency IDs from labels', async () => {
      const issueWithDeps = {
        ...mockIssue,
        labels: ['depends-on:issue-2', 'bug', 'depends-on:issue-3']
      };
      mockIssueRepo.findById.mockResolvedValue(issueWithDeps);

      const result = await service.getIssueDependencies('issue-1');

      expect(result).toEqual(['issue-2', 'issue-3']);
    });

    it('should return empty array when no dependencies', async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);

      const result = await service.getIssueDependencies('issue-1');

      expect(result).toEqual([]);
    });

    it('should throw error when issue not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.getIssueDependencies('non-existent'))
        .rejects.toThrow(DomainError);
    });
  });

  describe('assignIssueToMilestone', () => {
    it('should assign issue to milestone successfully', async () => {
      const mockMilestone = {
        id: 'milestone-1',
        title: 'v1.0',
        status: ResourceStatus.ACTIVE,
      };
      const updatedIssue = { ...mockIssue, milestoneId: 'milestone-1' };

      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockMilestoneRepo.findById.mockResolvedValue(mockMilestone);
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.assignIssueToMilestone('issue-1', 'milestone-1');

      expect(result.milestoneId).toBe('milestone-1');
      expect(mockIssueRepo.update).toHaveBeenCalledWith('issue-1', { milestoneId: 'milestone-1' });
    });

    it('should throw error when issue not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.assignIssueToMilestone('non-existent', 'milestone-1'))
        .rejects.toThrow(DomainError);
    });

    it('should throw error when milestone not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockMilestoneRepo.findById.mockResolvedValue(null);

      await expect(service.assignIssueToMilestone('issue-1', 'non-existent'))
        .rejects.toThrow(DomainError);
    });
  });

  describe('getIssueHistory', () => {
    it('should return history entries for issue', async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);

      const result = await service.getIssueHistory('issue-1');

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('created');
      expect(result[1].action).toBe('updated');
    });

    it('should throw error when issue not found', async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.getIssueHistory('non-existent'))
        .rejects.toThrow(DomainError);
    });
  });
});
