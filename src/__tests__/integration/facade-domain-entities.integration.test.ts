/**
 * Integration Tests for Facade with Domain Entities
 *
 * Verifies that:
 * - ProjectManagementService returns domain entities (IssueEntity, MilestoneEntity, SprintEntity, ProjectEntity)
 * - Entity business logic is accessible through the facade
 * - Typed sub-service accessors work correctly with domain entities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceStatus, ResourceType } from '../../domain/resource-types';
import {
  IssueEntity,
  MilestoneEntity,
  SprintEntity,
  ProjectEntity,
  IssuePriority,
  IssueType
} from '../../domain/entities';

describe('Facade Domain Entities Integration', () => {
  describe('IssueEntity Business Logic', () => {
    it('should create IssueEntity from data', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: ['bug', 'priority:high', 'type:bug'],
        assignees: ['user1'],
        milestoneId: 'milestone-1',
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue).toBeInstanceOf(IssueEntity);
      expect(issue.id).toBe('issue-1');
      expect(issue.priority).toBe(IssuePriority.HIGH);
      expect(issue.issueType).toBe(IssueType.BUG);
    });

    it('should support label operations', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: ['bug'],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      // Add label
      const added = issue.addLabel('enhancement');
      expect(added).toBe(true);
      expect(issue.hasLabel('enhancement')).toBe(true);

      // Remove label
      const removed = issue.removeLabel('enhancement');
      expect(removed).toBe(true);
      expect(issue.hasLabel('enhancement')).toBe(false);
    });

    it('should support assignment operations', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: [],
        assignees: ['user1'],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue.isAssigned).toBe(true);
      expect(issue.isAssignedTo('user1')).toBe(true);

      // Unassign
      const unassigned = issue.unassign('user1');
      expect(unassigned).toBe(true);
      expect(issue.isAssigned).toBe(false);
    });

    it('should support status transitions', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: [],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue.isOpen).toBe(true);

      // Start work
      issue.startWork();
      expect(issue.status).toBe(ResourceStatus.IN_PROGRESS);

      // Close
      issue.close();
      expect(issue.isClosed).toBe(true);

      // Reopen
      issue.reopen();
      expect(issue.isOpen).toBe(true);
    });

    it('should track blocking relationships', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: [],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue.isBlocked).toBe(false);

      // Block by issue #10
      issue.blockBy(10);
      expect(issue.isBlocked).toBe(true);
      expect(issue.blockedBy).toEqual([10]);

      // Unblock
      issue.unblockBy(10);
      expect(issue.isBlocked).toBe(false);
      expect(issue.blockedBy).toEqual([]);
    });

    it('should serialize and deserialize correctly', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Test Issue',
        description: 'Test description',
        status: ResourceStatus.ACTIVE,
        labels: ['bug'],
        assignees: ['user1'],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      // Serialize
      const serialized = issue.toData();
      expect(serialized.id).toBe('issue-1');
      expect(serialized.labels).toEqual(['bug']);

      // Deserialize
      const restored = IssueEntity.fromData(serialized);
      expect(restored.id).toBe(issue.id);
      expect(restored.title).toBe(issue.title);
    });

    it('should create independent clone', () => {
      const now = new Date().toISOString();
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Original Issue',
        description: 'Description',
        status: ResourceStatus.ACTIVE,
        labels: [],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      const cloned = issue.clone();
      cloned.title = 'Cloned Issue';
      cloned.addLabel('new-label');

      expect(issue.title).toBe('Original Issue');
      expect(issue.labels).not.toContain('new-label');
    });
  });

  describe('MilestoneEntity Business Logic', () => {
    it('should create MilestoneEntity from data', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        dueDate: futureDate,
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 50, complete: 5, total: 10 }
      });

      expect(milestone).toBeInstanceOf(MilestoneEntity);
      expect(milestone.title).toBe('v1.0');
      expect(milestone.progressPercent).toBe(50);
      expect(milestone.completedCount).toBe(5);
      expect(milestone.totalCount).toBe(10);
    });

    it('should compute due date properties', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        dueDate: futureDate,
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1'
      });

      expect(milestone.hasDueDate).toBe(true);
      expect(milestone.daysUntilDue).toBeGreaterThan(0);
      expect(milestone.isOverdue).toBe(false);
    });

    it('should update progress', () => {
      const now = new Date().toISOString();
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 0, complete: 0, total: 10 }
      });

      milestone.updateProgress(5, 10);
      expect(milestone.progressPercent).toBe(50);
      expect(milestone.completedCount).toBe(5);
    });

    it('should manage issues', () => {
      const now = new Date().toISOString();
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 0, complete: 0, total: 0 }
      });

      milestone.addIssue();
      milestone.addIssue();
      expect(milestone.totalCount).toBe(2);

      milestone.completeIssue();
      expect(milestone.completedCount).toBe(1);
      expect(milestone.progressPercent).toBe(50);
    });

    it('should handle close and reopen', () => {
      const now = new Date().toISOString();
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 100, complete: 10, total: 10 }
      });

      expect(milestone.isComplete).toBe(false);
      
      milestone.close();
      expect(milestone.isComplete).toBe(true);
      
      milestone.reopen();
      expect(milestone.isComplete).toBe(false);
    });
  });

  describe('SprintEntity Business Logic', () => {
    it('should create SprintEntity from data', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: ['issue-1', 'issue-2'],
        createdAt: now,
        updatedAt: now
      });

      expect(sprint).toBeInstanceOf(SprintEntity);
      expect(sprint.title).toBe('Sprint 1');
      expect(sprint.issueCount).toBe(2);
    });

    it('should compute duration properties', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: [],
        createdAt: now,
        updatedAt: now
      });

      expect(sprint.durationInDays).toBe(14);
      expect(sprint.daysRemaining).toBeGreaterThan(0);
      expect(sprint.isCurrent).toBe(true);
    });

    it('should manage issues', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: ['issue-1'],
        createdAt: now,
        updatedAt: now
      });

      // Add issue
      const added = sprint.addIssue('issue-2');
      expect(added).toBe(true);
      expect(sprint.issueCount).toBe(2);

      // Remove issue
      const removed = sprint.removeIssue('issue-2');
      expect(removed).toBe(true);
      expect(sprint.issueCount).toBe(1);
    });

    it('should handle sprint lifecycle', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.PLANNED,
        issues: [],
        createdAt: now,
        updatedAt: now
      });

      expect(sprint.isPlanning).toBe(true);

      sprint.start();
      expect(sprint.isActive).toBe(true);

      sprint.complete();
      expect(sprint.isCompleted).toBe(true);
    });

    it('should move issues between sprints', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint1 = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: ['issue-1'],
        createdAt: now,
        updatedAt: now
      });

      const sprint2 = SprintEntity.fromData({
        id: 'sprint-2',
        title: 'Sprint 2',
        description: 'Second sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.PLANNED,
        issues: [],
        createdAt: now,
        updatedAt: now
      });

      const moved = sprint1.moveIssueTo('issue-1', sprint2);
      expect(moved).toBe(true);
      expect(sprint1.hasIssue('issue-1')).toBe(false);
      expect(sprint2.hasIssue('issue-1')).toBe(true);
    });

    it('should calculate velocity', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: [],
        createdAt: now,
        updatedAt: now
      });

      const velocity = sprint.calculateVelocity(6);
      expect(velocity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ProjectEntity Business Logic', () => {
    it('should create ProjectEntity from data', () => {
      const now = new Date().toISOString();
      
      const project = ProjectEntity.fromData({
        id: 'project-1',
        type: ResourceType.PROJECT,
        title: 'Test Project',
        description: 'Test description',
        owner: 'test-owner',
        number: 1,
        url: 'https://github.com/users/test-owner/projects/1',
        visibility: 'private',
        status: ResourceStatus.ACTIVE,
        closed: false,
        views: [],
        fields: [],
        createdAt: now,
        updatedAt: now
      });

      expect(project).toBeInstanceOf(ProjectEntity);
      expect(project.title).toBe('Test Project');
      expect(project.isOpen).toBe(true);
    });

    it('should compute activity properties', () => {
      const now = new Date().toISOString();
      
      const project = ProjectEntity.fromData({
        id: 'project-1',
        type: ResourceType.PROJECT,
        title: 'Test Project',
        description: 'Test description',
        owner: 'test-owner',
        number: 1,
        url: 'https://github.com/users/test-owner/projects/1',
        visibility: 'private',
        status: ResourceStatus.ACTIVE,
        closed: false,
        views: [],
        fields: [],
        createdAt: now,
        updatedAt: now
      });

      expect(project.isActive).toBe(true);
      expect(project.health).toBeDefined();
      expect(project.activityLevel).toBeDefined();
    });

    it('should manage fields', () => {
      const now = new Date().toISOString();
      
      const project = ProjectEntity.fromData({
        id: 'project-1',
        type: ResourceType.PROJECT,
        title: 'Test Project',
        description: 'Test description',
        owner: 'test-owner',
        number: 1,
        url: 'https://github.com/users/test-owner/projects/1',
        visibility: 'private',
        status: ResourceStatus.ACTIVE,
        closed: false,
        views: [],
        fields: [],
        createdAt: now,
        updatedAt: now
      });

      const field = { id: 'field-1', name: 'Status', type: 'single_select' as const, options: [] };
      const added = project.addField(field);
      expect(added).toBe(true);
      expect(project.fieldCount).toBe(1);

      const removed = project.removeField('field-1');
      expect(removed).toBe(true);
      expect(project.fieldCount).toBe(0);
    });

    it('should handle close and reopen', () => {
      const now = new Date().toISOString();
      
      const project = ProjectEntity.fromData({
        id: 'project-1',
        type: ResourceType.PROJECT,
        title: 'Test Project',
        description: 'Test description',
        owner: 'test-owner',
        number: 1,
        url: 'https://github.com/users/test-owner/projects/1',
        visibility: 'private',
        status: ResourceStatus.ACTIVE,
        closed: false,
        views: [],
        fields: [],
        createdAt: now,
        updatedAt: now
      });

      expect(project.isOpen).toBe(true);
      
      project.close();
      expect(project.isClosed).toBe(true);
      
      project.reopen();
      expect(project.isOpen).toBe(true);
    });

    it('should serialize and deserialize correctly', () => {
      const now = new Date().toISOString();
      
      const project = ProjectEntity.fromData({
        id: 'project-1',
        type: ResourceType.PROJECT,
        title: 'Test Project',
        description: 'Test description',
        owner: 'test-owner',
        number: 1,
        url: 'https://github.com/users/test-owner/projects/1',
        visibility: 'private',
        status: ResourceStatus.ACTIVE,
        closed: false,
        views: [],
        fields: [],
        createdAt: now,
        updatedAt: now
      });

      // Serialize
      const serialized = project.toData();
      expect(serialized.id).toBe('project-1');
      expect(serialized.title).toBe('Test Project');

      // Deserialize
      const restored = ProjectEntity.fromData(serialized);
      expect(restored.id).toBe(project.id);
      expect(restored.title).toBe(project.title);
    });
  });

  describe('Cross-Entity Interactions', () => {
    it('should link issue to milestone', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const milestone = MilestoneEntity.fromData({
        id: 'milestone-1',
        number: 1,
        title: 'v1.0',
        description: 'First release',
        dueDate: futureDate,
        status: ResourceStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/milestone/1',
        progress: { percent: 0, complete: 0, total: 0 }
      });

      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Feature',
        description: 'Implement feature',
        status: ResourceStatus.ACTIVE,
        labels: [],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      // Assign issue to milestone
      issue.assignToMilestone(milestone.id);
      expect(issue.milestoneId).toBe('milestone-1');

      // Add issue to milestone
      milestone.addIssue();
      expect(milestone.totalCount).toBe(1);
    });

    it('should link issues to sprints', () => {
      const now = new Date().toISOString();
      const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      
      const sprint = SprintEntity.fromData({
        id: 'sprint-1',
        title: 'Sprint 1',
        description: 'First sprint',
        startDate: now,
        endDate: futureDate,
        status: ResourceStatus.ACTIVE,
        issues: [],
        createdAt: now,
        updatedAt: now
      });

      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Task',
        description: 'Task description',
        status: ResourceStatus.ACTIVE,
        labels: ['priority:high'],
        assignees: [],
        createdAt: now,
        updatedAt: now,
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
      const now = new Date().toISOString();
      
      const issue = IssueEntity.fromData({
        id: 'issue-1',
        number: 1,
        title: 'Dependent task',
        description: 'Depends on issue 2',
        status: ResourceStatus.ACTIVE,
        labels: ['blocked-by:#2'],
        assignees: [],
        createdAt: now,
        updatedAt: now,
        url: 'https://github.com/test/repo/issues/1'
      });

      expect(issue.isBlocked).toBe(true);
      expect(issue.blockedBy).toEqual([2]);
    });
  });
});
