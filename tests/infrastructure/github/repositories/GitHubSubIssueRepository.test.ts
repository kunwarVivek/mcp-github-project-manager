/**
 * Unit tests for GitHubSubIssueRepository
 *
 * Tests sub-issue operations:
 * - addSubIssue: Add issue as sub-issue of parent
 * - listSubIssues: List sub-issues with pagination and summary
 * - getParentIssue: Get parent issue if exists
 * - reprioritizeSubIssue: Reorder sub-issue in parent's list
 * - removeSubIssue: Remove sub-issue relationship
 */

import { GitHubSubIssueRepository } from '../../../../src/infrastructure/github/repositories/GitHubSubIssueRepository.js';
import { GitHubConfig } from '../../../../src/infrastructure/github/GitHubConfig.js';
import type { Octokit } from '@octokit/rest';

// Mock Octokit graphql method
const mockGraphql = jest.fn();

const mockOctokit = {
  graphql: mockGraphql,
  rest: {},
} as unknown as Octokit;

// Create a real GitHubConfig instance
const mockConfig = GitHubConfig.create('test-owner', 'test-repo', 'test-token');

describe('GitHubSubIssueRepository', () => {
  let repository: GitHubSubIssueRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new GitHubSubIssueRepository(mockOctokit, mockConfig);
  });

  describe('addSubIssue', () => {
    it('returns created relationship', async () => {
      mockGraphql.mockResolvedValueOnce({
        addSubIssue: {
          issue: {
            id: 'I_parent123',
            title: 'Parent Issue',
          },
          subIssue: {
            id: 'I_sub456',
            number: 123,
            title: 'Sub Issue',
            state: 'OPEN',
            url: 'https://github.com/test-owner/test-repo/issues/123',
          },
        },
      });

      const result = await repository.addSubIssue('I_parent123', 'I_sub456', false);

      expect(result.issue.id).toBe('I_parent123');
      expect(result.issue.title).toBe('Parent Issue');
      expect(result.subIssue.id).toBe('I_sub456');
      expect(result.subIssue.number).toBe(123);
      expect(result.subIssue.title).toBe('Sub Issue');
      expect(result.subIssue.state).toBe('OPEN');
      expect(result.subIssue.url).toBe('https://github.com/test-owner/test-repo/issues/123');
    });

    it('succeeds with replaceParent=true when issue has parent', async () => {
      mockGraphql.mockResolvedValueOnce({
        addSubIssue: {
          issue: {
            id: 'I_newParent',
            title: 'New Parent Issue',
          },
          subIssue: {
            id: 'I_child',
            number: 456,
            title: 'Child Issue',
            state: 'CLOSED',
            url: 'https://github.com/test-owner/test-repo/issues/456',
          },
        },
      });

      const result = await repository.addSubIssue('I_newParent', 'I_child', true);

      expect(result.issue.id).toBe('I_newParent');
      expect(result.subIssue.number).toBe(456);
      expect(result.subIssue.state).toBe('CLOSED');

      // Verify replaceParent was passed to mutation
      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.input.replaceParent).toBe(true);
    });

    it('handles GraphQL errors (issue not found)', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Issue with id I_invalid not found'));

      await expect(repository.addSubIssue('I_invalid', 'I_sub', false))
        .rejects.toThrow('Issue with id I_invalid not found');
    });

    it('includes sub_issues feature header in request', async () => {
      mockGraphql.mockResolvedValueOnce({
        addSubIssue: {
          issue: { id: 'I_p', title: 'P' },
          subIssue: { id: 'I_s', number: 1, title: 'S', state: 'OPEN', url: 'http://url' },
        },
      });

      await repository.addSubIssue('I_p', 'I_s', false);

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'GraphQL-Features': 'sub_issues' });
    });
  });

  describe('listSubIssues', () => {
    it('returns paginated list with summary', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          subIssues: {
            nodes: [
              { id: 'I_1', number: 1, title: 'First', state: 'OPEN', url: 'http://1' },
              { id: 'I_2', number: 2, title: 'Second', state: 'CLOSED', url: 'http://2' },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor123',
            },
            totalCount: 10,
          },
          subIssuesSummary: {
            total: 10,
            completed: 3,
            percentCompleted: 30,
          },
        },
      });

      const result = await repository.listSubIssues('I_parent', 50);

      expect(result.subIssues).toHaveLength(2);
      expect(result.subIssues[0].id).toBe('I_1');
      expect(result.subIssues[0].position).toBe(0);
      expect(result.subIssues[1].id).toBe('I_2');
      expect(result.subIssues[1].position).toBe(1);
      expect(result.summary.total).toBe(10);
      expect(result.summary.completed).toBe(3);
      expect(result.summary.percentCompleted).toBe(30);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.endCursor).toBe('cursor123');
      expect(result.totalCount).toBe(10);
    });

    it('handles empty result', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          subIssues: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 0,
          },
          subIssuesSummary: {
            total: 0,
            completed: 0,
            percentCompleted: 0,
          },
        },
      });

      const result = await repository.listSubIssues('I_empty');

      expect(result.subIssues).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.endCursor).toBeUndefined();
    });

    it('with cursor returns next page', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          subIssues: {
            nodes: [
              { id: 'I_3', number: 3, title: 'Third', state: 'OPEN', url: 'http://3' },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 3,
          },
          subIssuesSummary: {
            total: 3,
            completed: 1,
            percentCompleted: 33,
          },
        },
      });

      const result = await repository.listSubIssues('I_parent', 50, 'cursor123');

      expect(result.subIssues).toHaveLength(1);
      expect(result.subIssues[0].number).toBe(3);

      // Verify cursor was passed
      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.after).toBe('cursor123');
    });

    it('throws when issue not found', async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      await expect(repository.listSubIssues('I_invalid'))
        .rejects.toThrow('Issue with ID I_invalid not found');
    });

    it('limits first to 100', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          subIssues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 },
          subIssuesSummary: { total: 0, completed: 0, percentCompleted: 0 },
        },
      });

      await repository.listSubIssues('I_parent', 200);

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.first).toBe(100);
    });

    it('includes sub_issues feature header', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          subIssues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 },
          subIssuesSummary: { total: 0, completed: 0, percentCompleted: 0 },
        },
      });

      await repository.listSubIssues('I_parent');

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'GraphQL-Features': 'sub_issues' });
    });
  });

  describe('getParentIssue', () => {
    it('returns parent when exists', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          parent: {
            id: 'I_parent123',
            number: 100,
            title: 'Parent Issue',
            state: 'OPEN',
            url: 'https://github.com/test-owner/test-repo/issues/100',
          },
        },
      });

      const result = await repository.getParentIssue('I_child456');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('I_parent123');
      expect(result!.number).toBe(100);
      expect(result!.title).toBe('Parent Issue');
      expect(result!.state).toBe('OPEN');
      expect(result!.url).toBe('https://github.com/test-owner/test-repo/issues/100');
    });

    it('returns null when no parent', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          parent: null,
        },
      });

      const result = await repository.getParentIssue('I_orphan');

      expect(result).toBeNull();
    });

    it('throws when issue not found', async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      await expect(repository.getParentIssue('I_invalid'))
        .rejects.toThrow('Issue with ID I_invalid not found');
    });

    it('includes sub_issues feature header', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: { parent: null },
      });

      await repository.getParentIssue('I_child');

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'GraphQL-Features': 'sub_issues' });
    });
  });

  describe('reprioritizeSubIssue', () => {
    it('moves to beginning when afterId is null', async () => {
      mockGraphql.mockResolvedValueOnce({
        reprioritizeSubIssue: {
          issue: {
            id: 'I_parent',
            title: 'Parent',
          },
          subIssue: {
            id: 'I_sub',
            number: 123,
            title: 'Sub Issue',
            state: 'OPEN',
            url: 'http://url',
          },
        },
      });

      const result = await repository.reprioritizeSubIssue('I_parent', 'I_sub');

      expect(result.issue.id).toBe('I_parent');
      expect(result.subIssue.id).toBe('I_sub');

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.input.afterId).toBeNull();
    });

    it('moves after specific issue', async () => {
      mockGraphql.mockResolvedValueOnce({
        reprioritizeSubIssue: {
          issue: {
            id: 'I_parent',
            title: 'Parent',
          },
          subIssue: {
            id: 'I_sub2',
            number: 200,
            title: 'Second Sub',
            state: 'CLOSED',
            url: 'http://url2',
          },
        },
      });

      const result = await repository.reprioritizeSubIssue('I_parent', 'I_sub2', 'I_sub1');

      expect(result.subIssue.id).toBe('I_sub2');
      expect(result.subIssue.number).toBe(200);

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.input.afterId).toBe('I_sub1');
    });

    it('includes sub_issues feature header', async () => {
      mockGraphql.mockResolvedValueOnce({
        reprioritizeSubIssue: {
          issue: { id: 'I_p', title: 'P' },
          subIssue: { id: 'I_s', number: 1, title: 'S', state: 'OPEN', url: 'http://u' },
        },
      });

      await repository.reprioritizeSubIssue('I_p', 'I_s');

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'GraphQL-Features': 'sub_issues' });
    });
  });

  describe('removeSubIssue', () => {
    it('succeeds removing sub-issue', async () => {
      mockGraphql.mockResolvedValueOnce({
        removeSubIssue: {
          issue: { id: 'I_parent' },
          subIssue: { id: 'I_sub' },
        },
      });

      // Should not throw
      await repository.removeSubIssue('I_parent', 'I_sub');

      expect(mockGraphql).toHaveBeenCalledTimes(1);
      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.input.issueId).toBe('I_parent');
      expect(callArgs.input.subIssueId).toBe('I_sub');
    });

    it('handles not found error', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Sub-issue relationship not found'));

      await expect(repository.removeSubIssue('I_parent', 'I_invalid'))
        .rejects.toThrow('Sub-issue relationship not found');
    });

    it('includes sub_issues feature header', async () => {
      mockGraphql.mockResolvedValueOnce({
        removeSubIssue: {
          issue: { id: 'I_p' },
          subIssue: { id: 'I_s' },
        },
      });

      await repository.removeSubIssue('I_p', 'I_s');

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.headers).toEqual({ 'GraphQL-Features': 'sub_issues' });
    });
  });
});
