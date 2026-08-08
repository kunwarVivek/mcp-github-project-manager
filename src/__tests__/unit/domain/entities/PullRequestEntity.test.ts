import { describe, it, expect, beforeEach } from 'vitest';
import {
  PullRequestEntity,
  PullRequestState,
  ReviewState,
  MergeMethod
} from '../../../../domain/entities/PullRequestEntity';

describe('PullRequestEntity', () => {
  const mockPRData = {
    id: 123,
    number: 42,
    title: 'Add new feature',
    description: 'This PR adds a new feature',
    state: 'open' as const,
    author: 'testuser',
    head: 'feature-branch',
    base: 'main',
    url: 'https://github.com/test/repo/pull/42',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    isDraft: false,
  };

  describe('Factory Methods', () => {
    it('should create from data', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      expect(pr).toBeInstanceOf(PullRequestEntity);
      expect(pr.id).toBe(123);
      expect(pr.number).toBe(42);
      expect(pr.title).toBe('Add new feature');
      expect(pr.state).toBe(PullRequestState.OPEN);
    });

    it('should create with defaults', () => {
      const pr = PullRequestEntity.create({
        title: 'New PR',
        author: 'testuser',
        head: 'feature',
        base: 'main',
        url: 'https://github.com/test/repo/pull/1',
      });

      expect(pr.title).toBe('New PR');
      expect(pr.state).toBe(PullRequestState.OPEN);
      expect(pr.isDraft).toBe(false);
    });

    it('should handle merged state', () => {
      const pr = PullRequestEntity.fromData({
        ...mockPRData,
        merged: true,
      });

      expect(pr.state).toBe(PullRequestState.MERGED);
      expect(pr.isMerged).toBe(true);
    });
  });

  describe('Computed Properties', () => {
    it('should compute isOpen correctly', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      expect(pr.isOpen).toBe(true);
      expect(pr.isClosed).toBe(false);
      expect(pr.isMerged).toBe(false);
    });

    it('should compute canBeMerged correctly', () => {
      const openPR = PullRequestEntity.fromData(mockPRData);
      expect(openPR.canBeMerged).toBe(true);

      const draftPR = PullRequestEntity.fromData({
        ...mockPRData,
        isDraft: true,
      });
      expect(draftPR.canBeMerged).toBe(false);

      const mergedPR = PullRequestEntity.fromData({
        ...mockPRData,
        merged: true,
      });
      expect(mergedPR.canBeMerged).toBe(false);
    });

    it('should compute approvals correctly', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.reviews = [
        { id: 1, user: 'reviewer1', state: ReviewState.APPROVED, body: '' },
        { id: 2, user: 'reviewer2', state: ReviewState.APPROVED, body: '' },
        { id: 3, user: 'reviewer3', state: ReviewState.CHANGES_REQUESTED, body: 'Need changes' },
      ];

      expect(pr.approvals).toBe(2);
      expect(pr.changeRequests).toBe(1);
      expect(pr.isApproved).toBe(true);
      expect(pr.hasChangesRequested).toBe(true);
    });

    it('should compute age correctly', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      expect(pr.ageInDays).toBeGreaterThanOrEqual(0);
    });

    it('should detect stale PRs', () => {
      const pr = PullRequestEntity.fromData({
        ...mockPRData,
        updatedAt: '2024-01-01T00:00:00Z', // 15+ days ago
      });
      expect(pr.isStale).toBe(true);
    });
  });

  describe('Business Logic', () => {
    it('should mark as ready for review', () => {
      const pr = PullRequestEntity.fromData({
        ...mockPRData,
        isDraft: true,
      });

      pr.markReadyForReview();
      expect(pr.isDraft).toBe(false);
    });

    it('should convert to draft', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      pr.convertToDraft();
      expect(pr.isDraft).toBe(true);
    });

    it('should close the PR', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      pr.close();
      expect(pr.state).toBe(PullRequestState.CLOSED);
      expect(pr.closedAt).toBeDefined();
    });

    it('should merge the PR', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.approve('reviewer1');

      pr.merge('abc123');
      expect(pr.state).toBe(PullRequestState.MERGED);
      expect(pr.mergedAt).toBeDefined();
      expect(pr.mergeCommitSha).toBe('abc123');
    });

    it('should reopen the PR', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.close();

      pr.reopen();
      expect(pr.isOpen).toBe(true);
    });

    it('should reject merge when not approved', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      expect(() => pr.merge('abc123')).toThrow('not approved');
    });

    it('should reject merge when changes requested', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.approve('reviewer1'); // Approve first
      pr.requestChanges('reviewer2', 'Please fix'); // Then request changes

      expect(() => pr.merge('abc123')).toThrow('changes requested');
    });

    it('should reject merge for draft PR', () => {
      const pr = PullRequestEntity.fromData({
        ...mockPRData,
        isDraft: true,
      });

      expect(() => pr.merge('abc123')).toThrow('draft');
    });
  });

  describe('Review Operations', () => {
    it('should add a review', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      pr.approve('reviewer1', 'Looks good!');
      expect(pr.reviews).toHaveLength(1);
      expect(pr.reviews[0].state).toBe(ReviewState.APPROVED);
    });

    it('should request changes', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      pr.requestChanges('reviewer1', 'Please fix the tests');
      expect(pr.hasChangesRequested).toBe(true);
    });

    it('should reject change request without body', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      expect(() => pr.requestChanges('reviewer1', '')).toThrow('reason');
    });

    it('should replace existing review from same user', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      pr.approve('reviewer1');
      pr.requestChanges('reviewer1', 'Actually, need changes');

      expect(pr.reviews).toHaveLength(1);
      expect(pr.reviews[0].state).toBe(ReviewState.CHANGES_REQUESTED);
    });
  });

  describe('Label Operations', () => {
    it('should add a label', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      const added = pr.addLabel('bug');
      expect(added).toBe(true);
      expect(pr.labels).toContain('bug');
    });

    it('should not add duplicate label', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.addLabel('bug');

      const added = pr.addLabel('bug');
      expect(added).toBe(false);
      expect(pr.labels).toHaveLength(1);
    });

    it('should remove a label', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.addLabel('bug');

      const removed = pr.removeLabel('bug');
      expect(removed).toBe(true);
      expect(pr.labels).not.toContain('bug');
    });

    it('should check if PR has label', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.addLabel('bug');

      expect(pr.hasLabel('bug')).toBe(true);
      expect(pr.hasLabel('feature')).toBe(false);
    });
  });

  describe('Assignment Operations', () => {
    it('should assign a user', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      const assigned = pr.assignTo('user1');
      expect(assigned).toBe(true);
      expect(pr.assignees).toContain('user1');
    });

    it('should not assign duplicate user', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.assignTo('user1');

      const assigned = pr.assignTo('user1');
      expect(assigned).toBe(false);
      expect(pr.assignees).toHaveLength(1);
    });

    it('should unassign a user', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.assignTo('user1');

      const unassigned = pr.unassign('user1');
      expect(unassigned).toBe(true);
      expect(pr.assignees).not.toContain('user1');
    });
  });

  describe('Issue Linking', () => {
    it('should link an issue', () => {
      const pr = PullRequestEntity.fromData(mockPRData);

      const linked = pr.linkIssue(10);
      expect(linked).toBe(true);
      expect(pr.linkedIssues).toContain(10);
    });

    it('should not link duplicate issue', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.linkIssue(10);

      const linked = pr.linkIssue(10);
      expect(linked).toBe(false);
      expect(pr.linkedIssues).toHaveLength(1);
    });

    it('should unlink an issue', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      pr.linkIssue(10);

      const unlinked = pr.unlinkIssue(10);
      expect(unlinked).toBe(true);
      expect(pr.linkedIssues).not.toContain(10);
    });
  });

  describe('Serialization', () => {
    it('should serialize to plain object', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      const serialized = pr.toData();

      expect(serialized.id).toBe(123);
      expect(serialized.number).toBe(42);
      expect(serialized.state).toBe('open');
    });

    it('should create deep copy with clone', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      const cloned = pr.clone();

      cloned.title = 'Modified Title';
      cloned.addLabel('new-label');

      expect(pr.title).toBe('Add new feature');
      expect(pr.labels).not.toContain('new-label');
    });

    it('should generate summary', () => {
      const pr = PullRequestEntity.fromData(mockPRData);
      const summary = pr.toSummary();

      expect(summary.number).toBe(42);
      expect(summary.isOpen).toBe(true);
      expect(summary.isDraft).toBe(false);
    });
  });

  describe('Branch Name Generation', () => {
    it('should generate branch name from title', () => {
      const pr = PullRequestEntity.fromData({
        ...mockPRData,
        title: 'Add New Feature!',
      });

      expect(pr.toBranchName()).toBe('add-new-feature');
    });
  });
});
