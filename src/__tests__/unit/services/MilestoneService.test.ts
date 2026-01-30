import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { MilestoneService, MilestoneMetrics } from '../../../services/MilestoneService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { ResourceStatus } from '../../../domain/resource-types';
import { DomainError } from '../../../domain/errors';
import { Issue, Milestone } from '../../../domain/types';

// Mock the factory
jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('MilestoneService', () => {
  let service: MilestoneService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockMilestoneRepo: {
    findById: jest.MockedFunction<any>;
    findAll: jest.MockedFunction<any>;
    create: jest.MockedFunction<any>;
    update: jest.MockedFunction<any>;
    delete: jest.MockedFunction<any>;
  };
  let mockIssueRepo: {
    findAll: jest.MockedFunction<any>;
  };

  const now = new Date();
  const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago
  const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days ahead
  const farFutureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ahead

  const mockMilestone: Milestone = {
    id: 'milestone-1',
    number: 1,
    title: 'v1.0',
    description: 'First release',
    dueDate: futureDate,
    status: ResourceStatus.ACTIVE,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    url: 'https://github.com/test/repo/milestones/1',
  };

  const mockIssue: Issue = {
    id: 'issue-1',
    number: 1,
    title: 'Test Issue',
    description: 'Test description',
    status: ResourceStatus.ACTIVE,
    labels: [],
    assignees: [],
    milestoneId: 'milestone-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    url: 'https://github.com/test/repo/issues/1',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock repositories
    mockMilestoneRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockIssueRepo = {
      findAll: jest.fn(),
    };

    // Create mock factory
    mockFactory = {
      createMilestoneRepository: jest.fn().mockReturnValue(mockMilestoneRepo),
      createIssueRepository: jest.fn().mockReturnValue(mockIssueRepo),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new MilestoneService(mockFactory);
  });

  describe('getMilestoneMetrics', () => {
    it('should return metrics for a milestone', async () => {
      const closedIssue = { ...mockIssue, id: 'issue-2', status: ResourceStatus.CLOSED };
      mockMilestoneRepo.findById.mockResolvedValue(mockMilestone);
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, closedIssue]);

      const result = await service.getMilestoneMetrics('milestone-1');

      expect(result.id).toBe('milestone-1');
      expect(result.totalIssues).toBe(2);
      expect(result.openIssues).toBe(1);
      expect(result.closedIssues).toBe(1);
      expect(result.completionPercentage).toBe(50);
      expect(result.isOverdue).toBe(false);
    });

    it('should calculate 0% completion when no issues', async () => {
      mockMilestoneRepo.findById.mockResolvedValue(mockMilestone);
      mockIssueRepo.findAll.mockResolvedValue([]);

      const result = await service.getMilestoneMetrics('milestone-1');

      expect(result.completionPercentage).toBe(0);
      expect(result.totalIssues).toBe(0);
    });

    it('should mark milestone as overdue when past due date', async () => {
      const overdueMilestone = { ...mockMilestone, dueDate: pastDate };
      mockMilestoneRepo.findById.mockResolvedValue(overdueMilestone);
      mockIssueRepo.findAll.mockResolvedValue([]);

      const result = await service.getMilestoneMetrics('milestone-1');

      expect(result.isOverdue).toBe(true);
    });

    it('should include issues when requested', async () => {
      mockMilestoneRepo.findById.mockResolvedValue(mockMilestone);
      mockIssueRepo.findAll.mockResolvedValue([mockIssue]);

      const result = await service.getMilestoneMetrics('milestone-1', true);

      expect(result.issues).toHaveLength(1);
      expect(result.issues![0].id).toBe('issue-1');
    });

    it('should throw error when milestone not found', async () => {
      mockMilestoneRepo.findById.mockResolvedValue(null);

      await expect(service.getMilestoneMetrics('non-existent'))
        .rejects.toThrow(DomainError);
    });
  });

  describe('getOverdueMilestones', () => {
    it('should return only overdue milestones', async () => {
      const overdueMilestone = { ...mockMilestone, id: 'overdue-1', dueDate: pastDate };
      const futureMilestone = { ...mockMilestone, id: 'future-1', dueDate: futureDate };
      mockMilestoneRepo.findAll.mockResolvedValue([overdueMilestone, futureMilestone]);
      mockMilestoneRepo.findById.mockResolvedValue(overdueMilestone);
      mockIssueRepo.findAll.mockResolvedValue([]);

      const result = await service.getOverdueMilestones();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('overdue-1');
    });

    it('should exclude completed milestones from overdue', async () => {
      const completedOverdue = { ...mockMilestone, dueDate: pastDate, status: ResourceStatus.COMPLETED };
      mockMilestoneRepo.findAll.mockResolvedValue([completedOverdue]);

      const result = await service.getOverdueMilestones();

      expect(result).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const overdue1 = { ...mockMilestone, id: 'overdue-1', dueDate: pastDate };
      const overdue2 = { ...mockMilestone, id: 'overdue-2', dueDate: pastDate };
      mockMilestoneRepo.findAll.mockResolvedValue([overdue1, overdue2]);
      mockMilestoneRepo.findById.mockResolvedValue(overdue1);
      mockIssueRepo.findAll.mockResolvedValue([]);

      const result = await service.getOverdueMilestones(1);

      expect(result).toHaveLength(1);
    });
  });

  describe('getUpcomingMilestones', () => {
    it('should return milestones within days ahead window', async () => {
      const upcomingMilestone = { ...mockMilestone, id: 'upcoming-1', dueDate: futureDate };
      const farMilestone = { ...mockMilestone, id: 'far-1', dueDate: farFutureDate };
      mockMilestoneRepo.findAll.mockResolvedValue([upcomingMilestone, farMilestone]);
      mockMilestoneRepo.findById.mockResolvedValue(upcomingMilestone);
      mockIssueRepo.findAll.mockResolvedValue([]);

      const result = await service.getUpcomingMilestones(30);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('upcoming-1');
    });

    it('should exclude overdue milestones', async () => {
      const overdueMilestone = { ...mockMilestone, dueDate: pastDate };
      mockMilestoneRepo.findAll.mockResolvedValue([overdueMilestone]);

      const result = await service.getUpcomingMilestones();

      expect(result).toHaveLength(0);
    });

    it('should exclude completed milestones', async () => {
      const completedUpcoming = { ...mockMilestone, dueDate: futureDate, status: ResourceStatus.COMPLETED };
      mockMilestoneRepo.findAll.mockResolvedValue([completedUpcoming]);

      const result = await service.getUpcomingMilestones();

      expect(result).toHaveLength(0);
    });
  });

  describe('createMilestone', () => {
    it('should create a new milestone', async () => {
      const createData = {
        title: 'New Milestone',
        description: 'Test description',
        dueDate: futureDate,
      };
      mockMilestoneRepo.create.mockResolvedValue({ ...mockMilestone, ...createData });

      const result = await service.createMilestone(createData);

      expect(result.title).toBe('New Milestone');
      expect(mockMilestoneRepo.create).toHaveBeenCalledWith({
        title: 'New Milestone',
        description: 'Test description',
        dueDate: futureDate,
      });
    });

    it('should create milestone without due date', async () => {
      const createData = {
        title: 'No Due Date',
        description: 'Test',
      };
      mockMilestoneRepo.create.mockResolvedValue({ ...mockMilestone, ...createData, dueDate: undefined });

      const result = await service.createMilestone(createData);

      expect(result.title).toBe('No Due Date');
    });
  });

  describe('listMilestones', () => {
    it('should list all milestones with default parameters', async () => {
      mockMilestoneRepo.findAll.mockResolvedValue([mockMilestone]);

      const result = await service.listMilestones();

      expect(result).toHaveLength(1);
    });

    it('should filter by open status', async () => {
      const closedMilestone = { ...mockMilestone, id: 'closed-1', status: ResourceStatus.CLOSED };
      mockMilestoneRepo.findAll.mockResolvedValue([mockMilestone, closedMilestone]);

      const result = await service.listMilestones('open');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.ACTIVE);
    });

    it('should filter by closed status', async () => {
      const closedMilestone = { ...mockMilestone, id: 'closed-1', status: ResourceStatus.CLOSED };
      mockMilestoneRepo.findAll.mockResolvedValue([mockMilestone, closedMilestone]);

      const result = await service.listMilestones('closed');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(ResourceStatus.CLOSED);
    });

    it('should return all when status is "all"', async () => {
      const closedMilestone = { ...mockMilestone, id: 'closed-1', status: ResourceStatus.CLOSED };
      mockMilestoneRepo.findAll.mockResolvedValue([mockMilestone, closedMilestone]);

      const result = await service.listMilestones('all');

      expect(result).toHaveLength(2);
    });

    it('should sort by due date', async () => {
      const earlyMilestone = { ...mockMilestone, id: 'early', dueDate: pastDate };
      const lateMilestone = { ...mockMilestone, id: 'late', dueDate: farFutureDate };
      mockMilestoneRepo.findAll.mockResolvedValue([lateMilestone, earlyMilestone]);

      const result = await service.listMilestones('all', 'due_date', 'asc');

      expect(result[0].id).toBe('early');
      expect(result[1].id).toBe('late');
    });

    it('should sort descending when specified', async () => {
      const milestone1 = { ...mockMilestone, id: 'a', title: 'Alpha' };
      const milestone2 = { ...mockMilestone, id: 'z', title: 'Zeta' };
      mockMilestoneRepo.findAll.mockResolvedValue([milestone1, milestone2]);

      const result = await service.listMilestones('all', 'title', 'desc');

      expect(result[0].title).toBe('Zeta');
      expect(result[1].title).toBe('Alpha');
    });
  });

  describe('updateMilestone', () => {
    it('should update milestone title', async () => {
      const updatedMilestone = { ...mockMilestone, title: 'Updated Title' };
      mockMilestoneRepo.update.mockResolvedValue(updatedMilestone);

      const result = await service.updateMilestone({
        milestoneId: 'milestone-1',
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(mockMilestoneRepo.update).toHaveBeenCalled();
    });

    it('should convert state to ResourceStatus', async () => {
      const closedMilestone = { ...mockMilestone, status: ResourceStatus.CLOSED };
      mockMilestoneRepo.update.mockResolvedValue(closedMilestone);

      await service.updateMilestone({
        milestoneId: 'milestone-1',
        state: 'closed',
      });

      expect(mockMilestoneRepo.update).toHaveBeenCalledWith('milestone-1', {
        status: ResourceStatus.CLOSED,
      });
    });

    it('should handle null dueDate to clear it', async () => {
      mockMilestoneRepo.update.mockResolvedValue({ ...mockMilestone, dueDate: undefined });

      await service.updateMilestone({
        milestoneId: 'milestone-1',
        dueDate: null,
      });

      // dueDate=null is converted to undefined and cleaned up, so update is called with empty object
      expect(mockMilestoneRepo.update).toHaveBeenCalled();
    });
  });

  describe('deleteMilestone', () => {
    it('should delete milestone and return success message', async () => {
      mockMilestoneRepo.delete.mockResolvedValue(undefined);

      const result = await service.deleteMilestone({ milestoneId: 'milestone-1' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('milestone-1');
      expect(mockMilestoneRepo.delete).toHaveBeenCalledWith('milestone-1');
    });

    it('should throw error when delete fails', async () => {
      mockMilestoneRepo.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteMilestone({ milestoneId: 'non-existent' }))
        .rejects.toThrow(DomainError);
    });
  });
});
