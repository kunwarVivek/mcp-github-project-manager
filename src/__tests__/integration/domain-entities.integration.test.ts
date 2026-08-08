/**
 * Integration Tests for Domain Entities
 *
 * Verifies that:
 * - Domain entities (IssueEntity, MilestoneEntity, SprintEntity) work correctly
 * - Entity business logic is consistent across different creation patterns
 * - Entity computed properties return correct values
 * - Entity serialization/deserialization roundtrips correctly
 * - Cross-entity interactions work as expected
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceStatus } from '../../domain/resource-types';
import { Issue, Milestone, Sprint } from '../../domain/types';
import {
  IssueEntity,
  IssuePriority,
  IssueType,
  MilestoneEntity,
  SprintEntity
} from '../../domain/entities';

describe('Domain Entities Integration', () => {
  // =========================================================================
  // IssueEntity Integration Tests
  // =========================================================================
  describe('IssueEntity', () => {
    const mockIssueData: Issue = {
      id: 'issue-123',
      number: 42,
      title: 'Fix critical bug',
      description: 'This bug causes data loss',
      status: ResourceStatus.ACTIVE,
      labels: ['bug', 'priority:critical', 'type:bug'],
      assignees: ['user1', 'user2'],
      milestoneId: 'milestone-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      url: 'https://github.com/test/repo/issues/42'
    };

    it('should create from data and preserve all properties', () => {
      const entity = IssueEntity.fromData(mockIssueData);

      expect(entity.id).toBe('issue-123');
      expect(entity.number).toBe(42);
      expect(entity.title).toBe('Fix critical bug');
      expect(entity.description).toBe('This bug causes data loss');
      expect(entity.status).toBe(ResourceStatus.ACTIVE);
      expect(entity.labels).toEqual(['bug', 'priority:critical', 'type:bug']);
      expect(entity.assignees).toEqual(['user1', 'user2']);
      expect(entity.milestoneId).toBe('milestone-1');
      expect(entity.url).toBe('https://github.com/test/repo/issues/42');
    });

    it('should compute priority from labels', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      expect(entity.priority).toBe(IssuePriority.CRITICAL);
    });

    it('should compute issue type from labels', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      expect(entity.issueType).toBe(IssueType.BUG);
    });

    it('should compute isOpen correctly', () => {
      const activeIssue = IssueEntity.fromData({ ...mockIssueData, status: ResourceStatus.ACTIVE });
      const inProgressIssue = IssueEntity.fromData({ ...mockIssueData, status: ResourceStatus.IN_PROGRESS });
      const closedIssue = IssueEntity.fromData({ ...mockIssueData, status: ResourceStatus.CLOSED });

      expect(activeIssue.isOpen).toBe(true);
      expect(inProgressIssue.isOpen).toBe(true);
      expect(closedIssue.isOpen).toBe(false);
    });

    it('should compute isStale correctly', () => {
      // Issue updated 20 days ago
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      
      const staleIssue = IssueEntity.fromData({
        ...mockIssueData,
        updatedAt: twentyDaysAgo.toISOString()
      });

      expect(staleIssue.isStale).toBe(true);
      expect(staleIssue.daysSinceUpdate).toBeGreaterThanOrEqual(20);
    });

    it('should add and remove labels with normalization', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      
      // Add new label (should be normalized to lowercase)
      const added = entity.addLabel('NEWLABEL');
      expect(added).toBe(true);
      expect(entity.labels).toContain('newlabel');
      
      // Try to add duplicate
      const duplicateAdded = entity.addLabel('newlabel');
      expect(duplicateAdded).toBe(false);
      
      // Remove label
      const removed = entity.removeLabel('newlabel');
      expect(removed).toBe(true);
      expect(entity.labels).not.toContain('newlabel');
    });

    it('should assign and unassign users', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      
      // Assign new user
      const assigned = entity.assignTo('user3');
      expect(assigned).toBe(true);
      expect(entity.assignees).toContain('user3');
      
      // Try to assign duplicate
      const duplicateAssigned = entity.assignTo('user3');
      expect(duplicateAssigned).toBe(false);
      
      // Unassign user
      const unassigned = entity.unassign('user1');
      expect(unassigned).toBe(true);
      expect(entity.assignees).not.toContain('user1');
    });

    it('should manage milestones', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      
      expect(entity.hasMilestone).toBe(true);
      expect(entity.milestoneId).toBe('milestone-1');
      
      // Remove from milestone
      entity.removeFromMilestone();
      expect(entity.hasMilestone).toBe(false);
      expect(entity.milestoneId).toBeUndefined();
      
      // Assign to new milestone
      entity.assignToMilestone('milestone-2');
      expect(entity.milestoneId).toBe('milestone-2');
    });

    it('should handle status transitions', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      
      expect(entity.isOpen).toBe(true);
      
      // Start work
      entity.startWork();
      expect(entity.status).toBe(ResourceStatus.IN_PROGRESS);
      
      // Close
      entity.close();
      expect(entity.isClosed).toBe(true);
      
      // Reopen
      entity.reopen();
      expect(entity.isOpen).toBe(true);
    });

    it('should track blocking relationships', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      
      expect(entity.isBlocked).toBe(false);
      expect(entity.blockedBy).toEqual([]);
      
      // Block by issue #10
      entity.blockBy(10);
      expect(entity.isBlocked).toBe(true);
      expect(entity.blockedBy).toEqual([10]);
      
      // Block by another issue
      entity.blockBy(20);
      expect(entity.blockedBy).toEqual([10, 20]);
      
      // Unblock issue #10
      entity.unblockBy(10);
      expect(entity.blockedBy).toEqual([20]);
    });

    it('should serialize and deserialize correctly', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      const serialized = entity.toData();
      
      expect(serialized).toEqual(mockIssueData);
      
      // Create new entity from serialized data
      const restored = IssueEntity.fromData(serialized);
      expect(restored.id).toBe(entity.id);
      expect(restored.title).toBe(entity.title);
      expect(restored.labels).toEqual(entity.labels);
    });

    it('should create a deep copy with clone', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      const cloned = entity.clone();
      
      // Modify cloned entity
      cloned.title = 'Modified Title';
      cloned.addLabel('new-label');
      
      // Original should be unchanged
      expect(entity.title).toBe('Fix critical bug');
      expect(entity.labels).not.toContain('new-label');
    });

    it('should return correct summary', () => {
      const entity = IssueEntity.fromData(mockIssueData);
      const summary = entity.toSummary();
      
      expect(summary.id).toBe('issue-123');
      expect(summary.number).toBe(42);
      expect(summary.title).toBe('Fix critical bug');
      expect(summary.priority).toBe(IssuePriority.CRITICAL);
      expect(summary.assignees).toEqual(['user1', 'user2']);
    });
  });

  // =========================================================================
  // MilestoneEntity Integration Tests
  // =========================================================================
  describe('MilestoneEntity', () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const pastDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const mockMilestoneData: Milestone = {
      id: 'milestone-456',
      number: 5,
      title: 'v2.0 Release',
      description: 'Major release with new features',
      dueDate: futureDate,
      status: ResourceStatus.ACTIVE,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      url: 'https://github.com/test/repo/milestone/5',
      progress: { percent: 60, complete: 6, total: 10 }
    };

    it('should create from data and preserve all properties', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);

      expect(entity.id).toBe('milestone-456');
      expect(entity.number).toBe(5);
      expect(entity.title).toBe('v2.0 Release');
      expect(entity.description).toBe('Major release with new features');
      expect(entity.dueDate).toBe(futureDate);
      expect(entity.status).toBe(ResourceStatus.ACTIVE);
      expect(entity.url).toBe('https://github.com/test/repo/milestone/5');
    });

    it('should compute progress correctly', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);

      expect(entity.progressPercent).toBe(60);
      expect(entity.completedCount).toBe(6);
      expect(entity.totalCount).toBe(10);
      expect(entity.hasIssues).toBe(true);
      expect(entity.allIssuesComplete).toBe(false);
    });

    it('should compute daysUntilDue correctly', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);

      expect(entity.hasDueDate).toBe(true);
      expect(entity.daysUntilDue).toBeGreaterThan(0);
      expect(entity.daysUntilDue).toBeLessThanOrEqual(14);
    });

    it('should detect overdue milestones', () => {
      const overdueMilestone: Milestone = {
        ...mockMilestoneData,
        dueDate: pastDate
      };
      const entity = MilestoneEntity.fromData(overdueMilestone);

      expect(entity.isOverdue).toBe(true);
      expect(entity.daysUntilDue).toBeLessThan(0);
    });

    it('should detect at-risk milestones', () => {
      // Milestone due in 3 days (within 7-day threshold)
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      const atRiskMilestone: Milestone = {
        ...mockMilestoneData,
        dueDate: threeDaysFromNow
      };
      const entity = MilestoneEntity.fromData(atRiskMilestone);

      expect(entity.isAtRisk).toBe(true);
    });

    it('should update progress correctly', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);
      
      entity.updateProgress(8, 10);
      
      expect(entity.completedCount).toBe(8);
      expect(entity.totalCount).toBe(10);
      expect(entity.progressPercent).toBe(80);
    });

    it('should throw on invalid progress values', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);
      
      expect(() => entity.updateProgress(-1, 10)).toThrow('cannot be negative');
      expect(() => entity.updateProgress(11, 10)).toThrow('cannot exceed total');
    });

    it('should manage issues in milestone', () => {
      const entity = MilestoneEntity.fromData({
        ...mockMilestoneData,
        progress: { percent: 0, complete: 0, total: 0 }
      });
      
      // Add issues
      entity.addIssue();
      entity.addIssue();
      entity.addIssue();
      
      expect(entity.totalCount).toBe(3);
      expect(entity.completedCount).toBe(0);
      
      // Complete an issue
      entity.completeIssue();
      expect(entity.completedCount).toBe(1);
      expect(entity.progressPercent).toBe(33); // 1/3 = 33%
    });

    it('should handle close and reopen lifecycle', () => {
      const entity = MilestoneEntity.fromData({
        ...mockMilestoneData,
        progress: { percent: 100, complete: 10, total: 10 }
      });
      
      expect(entity.isComplete).toBe(false);
      
      // Close
      entity.close();
      expect(entity.isComplete).toBe(true);
      expect(entity.status).toBe(ResourceStatus.COMPLETED);
      
      // Reopen
      entity.reopen();
      expect(entity.isComplete).toBe(false);
      expect(entity.status).toBe(ResourceStatus.ACTIVE);
    });

    it('should prevent close without all issues complete', () => {
      const entity = MilestoneEntity.fromData({
        ...mockMilestoneData,
        progress: { percent: 50, complete: 5, total: 10 }
      });
      
      expect(() => entity.close()).toThrow('Cannot close milestone');
      
      // Force close should work
      entity.close(true);
      expect(entity.isComplete).toBe(true);
    });

    it('should serialize and deserialize correctly', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);
      const serialized = entity.toData();
      
      expect(serialized).toEqual(mockMilestoneData);
      
      const restored = MilestoneEntity.fromData(serialized);
      expect(restored.id).toBe(entity.id);
      expect(restored.progressPercent).toBe(entity.progressPercent);
    });

    it('should return correct status summary', () => {
      const entity = MilestoneEntity.fromData(mockMilestoneData);
      const summary = entity.getStatusSummary();
      
      expect(summary.id).toBe('milestone-456');
      expect(summary.title).toBe('v2.0 Release');
      expect(summary.progress.complete).toBe(6);
      expect(summary.progress.total).toBe(10);
      expect(summary.canClose).toBe(false); // Not all issues complete
    });
  });

  // =========================================================================
  // SprintEntity Integration Tests
  // =========================================================================
  describe('SprintEntity', () => {
    const now = new Date();
    const startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
    const endDate = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString(); // 11 days from now

    const mockSprintData: Sprint = {
      id: 'sprint-789',
      title: 'Sprint 5',
      description: 'Q1 2024 Sprint',
      startDate,
      endDate,
      status: ResourceStatus.ACTIVE,
      issues: ['issue-1', 'issue-2', 'issue-3'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z'
    };

    it('should create from data and preserve all properties', () => {
      const entity = SprintEntity.fromData(mockSprintData);

      expect(entity.id).toBe('sprint-789');
      expect(entity.title).toBe('Sprint 5');
      expect(entity.description).toBe('Q1 2024 Sprint');
      expect(entity.startDate).toBe(startDate);
      expect(entity.endDate).toBe(endDate);
      expect(entity.status).toBe(ResourceStatus.ACTIVE);
      expect(entity.issues).toEqual(['issue-1', 'issue-2', 'issue-3']);
    });

    it('should compute duration correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.durationInDays).toBe(14); // 14-day sprint
    });

    it('should compute days remaining correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.daysRemaining).toBeGreaterThan(0);
      expect(entity.daysRemaining).toBeLessThanOrEqual(11);
    });

    it('should compute days elapsed correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.daysElapsed).toBeGreaterThanOrEqual(3);
    });

    it('should compute percent time elapsed', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.percentTimeElapsed).toBeGreaterThan(0);
      expect(entity.percentTimeElapsed).toBeLessThan(100);
    });

    it('should detect current sprint', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.isCurrent).toBe(true);
      expect(entity.isActive).toBe(true);
      expect(entity.isPlanning).toBe(false);
      expect(entity.isCompleted).toBe(false);
    });

    it('should track issues correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.issueCount).toBe(3);
      expect(entity.hasIssues).toBe(true);
      expect(entity.hasIssue('issue-1')).toBe(true);
      expect(entity.hasIssue('issue-999')).toBe(false);
    });

    it('should manage issue additions and removals', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      // Add new issue
      const added = entity.addIssue('issue-4');
      expect(added).toBe(true);
      expect(entity.issueCount).toBe(4);
      expect(entity.hasIssue('issue-4')).toBe(true);
      
      // Try to add duplicate
      const duplicateAdded = entity.addIssue('issue-4');
      expect(duplicateAdded).toBe(false);
      
      // Remove issue
      const removed = entity.removeIssue('issue-1');
      expect(removed).toBe(true);
      expect(entity.issueCount).toBe(3);
      expect(entity.hasIssue('issue-1')).toBe(false);
    });

    it('should compute available slots correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      expect(entity.canAcceptIssues).toBe(true);
      expect(entity.availableSlots).toBe(47); // 50 max - 3 current
    });

    it('should detect when to plan next sprint', () => {
      // Sprint ending in 1 day (within 2-day buffer)
      const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
      const endingSoonSprint: Sprint = {
        ...mockSprintData,
        endDate: oneDayFromNow
      };
      
      const entity = SprintEntity.fromData(endingSoonSprint);
      expect(entity.shouldPlanNext).toBe(true);
    });

    it('should handle sprint lifecycle transitions', () => {
      const plannedSprint: Sprint = {
        ...mockSprintData,
        status: ResourceStatus.PLANNED,
        startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      const entity = SprintEntity.fromData(plannedSprint);
      expect(entity.isPlanning).toBe(true);
      
      // Start sprint
      entity.start();
      expect(entity.isActive).toBe(true);
      
      // Complete sprint
      entity.complete();
      expect(entity.isCompleted).toBe(true);
    });

    it('should move issues between sprints', () => {
      const sprint1 = SprintEntity.fromData(mockSprintData);
      const sprint2 = SprintEntity.fromData({
        ...mockSprintData,
        id: 'sprint-790',
        title: 'Sprint 6',
        issues: []
      });
      
      expect(sprint1.hasIssue('issue-1')).toBe(true);
      expect(sprint2.hasIssue('issue-1')).toBe(false);
      
      // Move issue
      const moved = sprint1.moveIssueTo('issue-1', sprint2);
      
      expect(moved).toBe(true);
      expect(sprint1.hasIssue('issue-1')).toBe(false);
      expect(sprint2.hasIssue('issue-1')).toBe(true);
    });

    it('should calculate velocity', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      // 6 issues completed over 3 days = 2.0 velocity
      const velocity = entity.calculateVelocity(6);
      expect(velocity).toBe(2.0);
    });

    it('should estimate completion date', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      
      const estimated = entity.estimateCompletion(1);
      expect(estimated).not.toBeNull();
      expect(estimated!.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should serialize and deserialize correctly', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      const serialized = entity.toData();
      
      expect(serialized).toEqual(mockSprintData);
      
      const restored = SprintEntity.fromData(serialized);
      expect(restored.id).toBe(entity.id);
      expect(restored.issues).toEqual(entity.issues);
    });

    it('should return correct summary', () => {
      const entity = SprintEntity.fromData(mockSprintData);
      const summary = entity.toSummary();
      
      expect(summary.id).toBe('sprint-789');
      expect(summary.title).toBe('Sprint 5');
      expect(summary.issueCount).toBe(3);
      expect(summary.durationInDays).toBe(14);
    });
  });

  // =========================================================================
  // Cross-Entity Integration Tests
  // =========================================================================
  describe('Cross-Entity Interactions', () => {
    it('should link issues to milestones via entities', () => {
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        status: ResourceStatus.ACTIVE,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 0, complete: 0, total: 0 }
      });

      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Feature implementation',
        description: 'Implement feature',
        status: ResourceStatus.ACTIVE,
        labels: ['feature'],
        assignees: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/issues/1'
      });

      // Assign issue to milestone
      issue.assignToMilestone(milestone.id);
      expect(issue.milestoneId).toBe('milestone-1');
      expect(issue.hasMilestone).toBe(true);

      // Add issue to milestone
      milestone.addIssue();
      expect(milestone.totalCount).toBe(1);

      // Complete the issue
      milestone.completeIssue();
      expect(milestone.completedCount).toBe(1);
      expect(milestone.progressPercent).toBe(100);
    });

    it('should link issues to sprints via entities', () => {
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: ResourceStatus.ACTIVE,
        issues: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Sprint task',
        description: 'Task for sprint',
        status: ResourceStatus.ACTIVE,
        labels: ['priority:high'],
        assignees: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/issues/1'
      });

      // Check if issue can be added to sprint
      expect(issue.canBeAddedToSprint()).toBe(true);

      // Add issue to sprint
      const added = sprint.addIssue(issue.id);
      expect(added).toBe(true);
      expect(sprint.hasIssue(issue.id)).toBe(true);
    });

    it('should track blocked issues in sprint context', () => {
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'Test sprint',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        status: ResourceStatus.ACTIVE,
        issues: ['issue-1', 'issue-2'],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      });

      const issue1 = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Dependent task',
        description: 'Depends on issue 2',
        status: ResourceStatus.ACTIVE,
        labels: ['blocked-by:#2'],
        assignees: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue1.isBlocked).toBe(true);
      expect(issue1.blockedBy).toEqual([2]);
    });

    it('should handle milestone with multiple sprints worth of issues', () => {
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: ResourceStatus.ACTIVE,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 0, complete: 0, total: 0 }
      });

      // Simulate adding issues from multiple sprints
      for (let i = 0; i < 5; i++) {
        milestone.addIssue();
      }
      expect(milestone.totalCount).toBe(5);

      // Complete some issues
      milestone.completeIssue();
      milestone.completeIssue();
      expect(milestone.completedCount).toBe(2);
      expect(milestone.progressPercent).toBe(40);

      // Check if milestone can be closed
      expect(milestone.canClose()).toBe(false); // Not all issues complete
    });
  });
});
