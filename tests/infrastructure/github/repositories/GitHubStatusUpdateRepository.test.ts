/**
 * Unit tests for GitHubStatusUpdateRepository
 *
 * Tests status update operations:
 * - createStatusUpdate: Create new project status update
 * - listStatusUpdates: List status updates with pagination
 * - getStatusUpdate: Get single status update by ID
 */

import { GitHubStatusUpdateRepository } from '../../../../src/infrastructure/github/repositories/GitHubStatusUpdateRepository.js';
import { GitHubConfig } from '../../../../src/infrastructure/github/GitHubConfig.js';
import { StatusUpdateStatus } from '../../../../src/infrastructure/github/repositories/types.js';
import type { Octokit } from '@octokit/rest';

// Mock Octokit graphql method
const mockGraphql = jest.fn();

const mockOctokit = {
  graphql: mockGraphql,
  rest: {},
} as unknown as Octokit;

// Create a real GitHubConfig instance
const mockConfig = GitHubConfig.create('test-owner', 'test-repo', 'test-token');

describe('GitHubStatusUpdateRepository', () => {
  let repository: GitHubStatusUpdateRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new GitHubStatusUpdateRepository(mockOctokit, mockConfig);
  });

  describe('createStatusUpdate', () => {
    it('creates status update with body only', async () => {
      mockGraphql.mockResolvedValueOnce({
        createProjectV2StatusUpdate: {
          statusUpdate: {
            id: 'SU_123',
            body: 'Sprint is on track',
            bodyHTML: '<p>Sprint is on track</p>',
            status: StatusUpdateStatus.ON_TRACK,
            startDate: null,
            targetDate: null,
            createdAt: '2026-01-31T08:00:00Z',
            creator: { login: 'testuser' },
          },
        },
      });

      const result = await repository.createStatusUpdate('PVT_project123', 'Sprint is on track');

      expect(result.id).toBe('SU_123');
      expect(result.body).toBe('Sprint is on track');
      expect(result.bodyHTML).toBe('<p>Sprint is on track</p>');
      expect(result.status).toBe(StatusUpdateStatus.ON_TRACK);
      expect(result.startDate).toBeUndefined();
      expect(result.targetDate).toBeUndefined();
      expect(result.createdAt).toBe('2026-01-31T08:00:00Z');
      expect(result.creator.login).toBe('testuser');
    });

    it('creates status update with all options', async () => {
      mockGraphql.mockResolvedValueOnce({
        createProjectV2StatusUpdate: {
          statusUpdate: {
            id: 'SU_456',
            body: 'Project at risk due to dependencies',
            bodyHTML: '<p>Project at risk due to dependencies</p>',
            status: StatusUpdateStatus.AT_RISK,
            startDate: '2026-01-01',
            targetDate: '2026-03-31',
            createdAt: '2026-01-31T09:00:00Z',
            creator: { login: 'pm' },
          },
        },
      });

      const result = await repository.createStatusUpdate(
        'PVT_project456',
        'Project at risk due to dependencies',
        {
          status: StatusUpdateStatus.AT_RISK,
          startDate: '2026-01-01',
          targetDate: '2026-03-31',
        }
      );

      expect(result.id).toBe('SU_456');
      expect(result.status).toBe(StatusUpdateStatus.AT_RISK);
      expect(result.startDate).toBe('2026-01-01');
      expect(result.targetDate).toBe('2026-03-31');

      // Verify all options were passed
      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.input.projectId).toBe('PVT_project456');
      expect(callArgs.input.body).toBe('Project at risk due to dependencies');
      expect(callArgs.input.status).toBe(StatusUpdateStatus.AT_RISK);
      expect(callArgs.input.startDate).toBe('2026-01-01');
      expect(callArgs.input.targetDate).toBe('2026-03-31');
    });

    it('handles invalid project ID error', async () => {
      mockGraphql.mockRejectedValueOnce(new Error('Could not resolve to a node with the global id of PVT_invalid'));

      await expect(repository.createStatusUpdate('PVT_invalid', 'Test'))
        .rejects.toThrow('Could not resolve to a node');
    });

    it('creates status update with COMPLETE status', async () => {
      mockGraphql.mockResolvedValueOnce({
        createProjectV2StatusUpdate: {
          statusUpdate: {
            id: 'SU_done',
            body: 'Project completed successfully!',
            bodyHTML: '<p>Project completed successfully!</p>',
            status: StatusUpdateStatus.COMPLETE,
            startDate: '2025-06-01',
            targetDate: '2025-12-31',
            createdAt: '2025-12-31T23:59:00Z',
            creator: { login: 'lead' },
          },
        },
      });

      const result = await repository.createStatusUpdate(
        'PVT_done',
        'Project completed successfully!',
        { status: StatusUpdateStatus.COMPLETE }
      );

      expect(result.status).toBe(StatusUpdateStatus.COMPLETE);
    });
  });

  describe('listStatusUpdates', () => {
    it('returns paginated list', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          statusUpdates: {
            nodes: [
              {
                id: 'SU_1',
                body: 'Update 1',
                bodyHTML: '<p>Update 1</p>',
                status: StatusUpdateStatus.ON_TRACK,
                startDate: '2026-01-01',
                targetDate: '2026-02-01',
                createdAt: '2026-01-15T10:00:00Z',
                creator: { login: 'user1' },
              },
              {
                id: 'SU_2',
                body: 'Update 2',
                bodyHTML: '<p>Update 2</p>',
                status: StatusUpdateStatus.AT_RISK,
                startDate: null,
                targetDate: null,
                createdAt: '2026-01-14T09:00:00Z',
                creator: { login: 'user2' },
              },
            ],
            pageInfo: {
              hasNextPage: true,
              endCursor: 'cursor_abc',
            },
            totalCount: 5,
          },
        },
      });

      const result = await repository.listStatusUpdates('PVT_proj', 20);

      expect(result.statusUpdates).toHaveLength(2);
      expect(result.statusUpdates[0].id).toBe('SU_1');
      expect(result.statusUpdates[0].status).toBe(StatusUpdateStatus.ON_TRACK);
      expect(result.statusUpdates[0].startDate).toBe('2026-01-01');
      expect(result.statusUpdates[1].id).toBe('SU_2');
      expect(result.statusUpdates[1].startDate).toBeUndefined();
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.endCursor).toBe('cursor_abc');
      expect(result.totalCount).toBe(5);
    });

    it('handles empty result', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          statusUpdates: {
            nodes: [],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 0,
          },
        },
      });

      const result = await repository.listStatusUpdates('PVT_empty');

      expect(result.statusUpdates).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.endCursor).toBeUndefined();
    });

    it('with cursor for pagination', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          statusUpdates: {
            nodes: [
              {
                id: 'SU_3',
                body: 'Update 3',
                bodyHTML: '<p>Update 3</p>',
                status: StatusUpdateStatus.OFF_TRACK,
                startDate: null,
                targetDate: null,
                createdAt: '2026-01-13T08:00:00Z',
                creator: { login: 'user3' },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 3,
          },
        },
      });

      const result = await repository.listStatusUpdates('PVT_proj', 20, 'cursor_abc');

      expect(result.statusUpdates).toHaveLength(1);
      expect(result.statusUpdates[0].id).toBe('SU_3');

      // Verify cursor was passed
      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.after).toBe('cursor_abc');
    });

    it('throws when project not found', async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      await expect(repository.listStatusUpdates('PVT_invalid'))
        .rejects.toThrow('Project with ID PVT_invalid not found');
    });

    it('limits first to 100', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          statusUpdates: {
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      });

      await repository.listStatusUpdates('PVT_proj', 500);

      const callArgs = mockGraphql.mock.calls[0][1];
      expect(callArgs.first).toBe(100);
    });
  });

  describe('getStatusUpdate', () => {
    it('returns status update when exists', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          id: 'SU_single',
          body: 'Single update',
          bodyHTML: '<p>Single update</p>',
          status: StatusUpdateStatus.INACTIVE,
          startDate: '2025-01-01',
          targetDate: '2025-06-30',
          createdAt: '2025-01-15T12:00:00Z',
          creator: { login: 'admin' },
        },
      });

      const result = await repository.getStatusUpdate('SU_single');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('SU_single');
      expect(result!.body).toBe('Single update');
      expect(result!.status).toBe(StatusUpdateStatus.INACTIVE);
      expect(result!.startDate).toBe('2025-01-01');
      expect(result!.targetDate).toBe('2025-06-30');
      expect(result!.creator.login).toBe('admin');
    });

    it('returns null when not found', async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      const result = await repository.getStatusUpdate('SU_notfound');

      expect(result).toBeNull();
    });

    it('handles status update with null dates', async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          id: 'SU_nodates',
          body: 'No dates',
          bodyHTML: '<p>No dates</p>',
          status: StatusUpdateStatus.ON_TRACK,
          startDate: null,
          targetDate: null,
          createdAt: '2026-01-31T00:00:00Z',
          creator: { login: 'user' },
        },
      });

      const result = await repository.getStatusUpdate('SU_nodates');

      expect(result).not.toBeNull();
      expect(result!.startDate).toBeUndefined();
      expect(result!.targetDate).toBeUndefined();
    });
  });
});
