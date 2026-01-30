import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SprintPlanningService, SprintMetrics } from '../../../services/SprintPlanningService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { GitHubSprintRepository } from '../../../infrastructure/github/repositories/GitHubSprintRepository';
import { GitHubIssueRepository } from '../../../infrastructure/github/repositories/GitHubIssueRepository';
import { ResourceStatus, ResourceType } from '../../../domain/resource-types';
import { Sprint, Issue } from '../../../domain/types';

// Mock tsyringe decorators
jest.mock('tsyringe', () => ({
  injectable: () => (target: any) => target,
  inject: () => () => undefined,
}));

describe('SprintPlanningService', () => {
  let service: SprintPlanningService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockSprintRepo: jest.Mocked<GitHubSprintRepository>;
  let mockIssueRepo: jest.Mocked<GitHubIssueRepository>;

  const mockSprint: Sprint = {
    id: 'sprint-1',
    title: 'Sprint 1',
    description: 'First sprint',
    startDate: '2024-01-01',
    endDate: '2024-01-14',
    status: ResourceStatus.ACTIVE,
    issues: ['issue-1', 'issue-2'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
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
    jest.clearAllMocks();

    // Create mock repositories
    mockSprintRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findCurrent: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addIssue: jest.fn(),
      removeIssue: jest.fn(),
      getIssues: jest.fn()
    } as unknown as jest.Mocked<GitHubSprintRepository>;

    mockIssueRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as unknown as jest.Mocked<GitHubIssueRepository>;

    // Create mock factory
    mockFactory = {
      createSprintRepository: jest.fn().mockReturnValue(mockSprintRepo),
      createIssueRepository: jest.fn().mockReturnValue(mockIssueRepo),
      getConfig: jest.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' })
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new SprintPlanningService(mockFactory);
  });

  describe('planSprint', () => {
    it('should create a sprint and associate issues', async () => {
      const sprintData = {
        sprint: {
          title: 'Sprint 1',
          description: 'Test sprint',
          startDate: '2024-01-01',
          endDate: '2024-01-14',
          status: ResourceStatus.PLANNED,
          issues: []
        },
        issueIds: [1, 2]
      };

      mockSprintRepo.create.mockResolvedValue(mockSprint);
      mockIssueRepo.update.mockResolvedValue(mockIssue);

      const result = await service.planSprint(sprintData);

      expect(result).toEqual(mockSprint);
      expect(mockSprintRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sprint 1',
          issues: ['1', '2']
        })
      );
      expect(mockIssueRepo.update).toHaveBeenCalledTimes(2);
    });

    it('should throw ValidationError for invalid sprint data', async () => {
      const invalidData = {
        sprint: {
          title: '', // Invalid: empty title
          description: 'Test',
          startDate: '2024-01-01',
          endDate: '2024-01-14'
        },
        issueIds: []
      };

      await expect(service.planSprint(invalidData as any)).rejects.toThrow();
    });

    it('should throw ValidationError for invalid date format', async () => {
      const invalidData = {
        sprint: {
          title: 'Sprint 1',
          description: 'Test',
          startDate: 'not-a-date',
          endDate: '2024-01-14'
        },
        issueIds: []
      };

      await expect(service.planSprint(invalidData as any)).rejects.toThrow();
    });
  });

  describe('getSprintMetrics', () => {
    it('should calculate sprint metrics correctly', async () => {
      mockSprintRepo.findById.mockResolvedValue(mockSprint);
      mockIssueRepo.findById
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce(mockClosedIssue);

      const result = await service.getSprintMetrics('sprint-1');

      expect(result).toEqual(expect.objectContaining({
        id: 'sprint-1',
        title: 'Sprint 1',
        totalIssues: 2,
        completedIssues: 1,
        remainingIssues: 1,
        completionPercentage: 50,
        status: ResourceStatus.ACTIVE
      }));
    });

    it('should throw error when sprint not found', async () => {
      mockSprintRepo.findById.mockResolvedValue(null);

      await expect(service.getSprintMetrics('non-existent')).rejects.toThrow();
    });

    it('should include issues when requested', async () => {
      mockSprintRepo.findById.mockResolvedValue(mockSprint);
      mockIssueRepo.findById
        .mockResolvedValueOnce(mockIssue)
        .mockResolvedValueOnce(mockClosedIssue);

      const result = await service.getSprintMetrics('sprint-1', true);

      expect(result.issues).toBeDefined();
      expect(result.issues).toHaveLength(2);
    });

    it('should handle empty sprints correctly', async () => {
      const emptySprint = { ...mockSprint, issues: [] };
      mockSprintRepo.findById.mockResolvedValue(emptySprint);

      const result = await service.getSprintMetrics('sprint-1');

      expect(result.totalIssues).toBe(0);
      expect(result.completionPercentage).toBe(0);
    });
  });

  describe('getCurrentSprint', () => {
    it('should return current active sprint', async () => {
      mockSprintRepo.findCurrent.mockResolvedValue(mockSprint);
      mockSprintRepo.getIssues.mockResolvedValue([mockIssue]);

      const result = await service.getCurrentSprint(true);

      expect(result).toBeDefined();
      expect(result?.id).toBe('sprint-1');
      expect(mockSprintRepo.getIssues).toHaveBeenCalledWith('sprint-1');
    });

    it('should return null when no current sprint', async () => {
      mockSprintRepo.findCurrent.mockResolvedValue(null);

      const result = await service.getCurrentSprint();

      expect(result).toBeNull();
    });

    it('should not fetch issues when includeIssues is false', async () => {
      mockSprintRepo.findCurrent.mockResolvedValue(mockSprint);

      const result = await service.getCurrentSprint(false);

      expect(result).toEqual(mockSprint);
      expect(mockSprintRepo.getIssues).not.toHaveBeenCalled();
    });
  });

  describe('addIssuesToSprint', () => {
    it('should add issues to sprint successfully', async () => {
      mockSprintRepo.addIssue.mockResolvedValue(mockSprint);

      const result = await service.addIssuesToSprint({
        sprintId: 'sprint-1',
        issueIds: ['issue-3', 'issue-4']
      });

      expect(result.success).toBe(true);
      expect(result.addedIssues).toBe(2);
      expect(mockSprintRepo.addIssue).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      mockSprintRepo.addIssue
        .mockResolvedValueOnce(mockSprint)
        .mockRejectedValueOnce(new Error('Failed to add'));

      const result = await service.addIssuesToSprint({
        sprintId: 'sprint-1',
        issueIds: ['issue-3', 'issue-4']
      });

      expect(result.success).toBe(true);
      expect(result.addedIssues).toBe(1);
    });
  });

  describe('removeIssuesFromSprint', () => {
    it('should remove issues from sprint successfully', async () => {
      mockSprintRepo.removeIssue.mockResolvedValue(mockSprint);

      const result = await service.removeIssuesFromSprint({
        sprintId: 'sprint-1',
        issueIds: ['issue-1', 'issue-2']
      });

      expect(result.success).toBe(true);
      expect(result.removedIssues).toBe(2);
      expect(mockSprintRepo.removeIssue).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures gracefully', async () => {
      mockSprintRepo.removeIssue
        .mockResolvedValueOnce(mockSprint)
        .mockRejectedValueOnce(new Error('Failed to remove'));

      const result = await service.removeIssuesFromSprint({
        sprintId: 'sprint-1',
        issueIds: ['issue-1', 'issue-2']
      });

      expect(result.success).toBe(true);
      expect(result.removedIssues).toBe(1);
    });
  });

  describe('createSprint', () => {
    it('should create a sprint without issue association', async () => {
      mockSprintRepo.create.mockResolvedValue(mockSprint);

      const result = await service.createSprint({
        title: 'Sprint 1',
        description: 'Test sprint',
        startDate: '2024-01-01',
        endDate: '2024-01-14'
      });

      expect(result).toEqual(mockSprint);
      expect(mockSprintRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sprint 1',
          status: ResourceStatus.PLANNED,
          issues: []
        })
      );
    });

    it('should create a sprint with pre-defined issue IDs', async () => {
      mockSprintRepo.create.mockResolvedValue(mockSprint);

      await service.createSprint({
        title: 'Sprint 1',
        description: 'Test sprint',
        startDate: '2024-01-01',
        endDate: '2024-01-14',
        issueIds: ['issue-1', 'issue-2']
      });

      expect(mockSprintRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          issues: ['issue-1', 'issue-2']
        })
      );
    });
  });

  describe('listSprints', () => {
    const sprints: Sprint[] = [
      mockSprint,
      { ...mockSprint, id: 'sprint-2', status: ResourceStatus.PLANNED },
      { ...mockSprint, id: 'sprint-3', status: ResourceStatus.COMPLETED }
    ];

    it('should return all sprints when status is "all"', async () => {
      mockSprintRepo.findAll.mockResolvedValue(sprints);

      const result = await service.listSprints('all');

      expect(result).toHaveLength(3);
    });

    it('should filter by planned status', async () => {
      mockSprintRepo.findAll.mockResolvedValue(sprints);

      const result = await service.listSprints('planned');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.PLANNED);
    });

    it('should filter by active status', async () => {
      mockSprintRepo.findAll.mockResolvedValue(sprints);

      const result = await service.listSprints('active');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.ACTIVE);
    });

    it('should filter by completed status', async () => {
      mockSprintRepo.findAll.mockResolvedValue(sprints);

      const result = await service.listSprints('completed');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.COMPLETED);
    });
  });

  describe('updateSprint', () => {
    it('should update sprint properties', async () => {
      mockSprintRepo.update.mockResolvedValue({
        ...mockSprint,
        title: 'Updated Sprint'
      });

      const result = await service.updateSprint({
        sprintId: 'sprint-1',
        title: 'Updated Sprint'
      });

      expect(result.title).toBe('Updated Sprint');
      expect(mockSprintRepo.update).toHaveBeenCalledWith(
        'sprint-1',
        expect.objectContaining({ title: 'Updated Sprint' })
      );
    });

    it('should convert status strings to ResourceStatus', async () => {
      mockSprintRepo.update.mockResolvedValue({
        ...mockSprint,
        status: ResourceStatus.CLOSED
      });

      await service.updateSprint({
        sprintId: 'sprint-1',
        status: 'completed'
      });

      expect(mockSprintRepo.update).toHaveBeenCalledWith(
        'sprint-1',
        expect.objectContaining({ status: ResourceStatus.CLOSED })
      );
    });
  });

  describe('findSprints', () => {
    it('should find sprints with filters', async () => {
      mockSprintRepo.findAll.mockResolvedValue([mockSprint]);

      const result = await service.findSprints({ status: ResourceStatus.ACTIVE });

      expect(result).toEqual([mockSprint]);
      expect(mockSprintRepo.findAll).toHaveBeenCalledWith({ status: ResourceStatus.ACTIVE });
    });

    it('should find all sprints without filters', async () => {
      mockSprintRepo.findAll.mockResolvedValue([mockSprint]);

      const result = await service.findSprints();

      expect(result).toEqual([mockSprint]);
      expect(mockSprintRepo.findAll).toHaveBeenCalledWith(undefined);
    });
  });
});
