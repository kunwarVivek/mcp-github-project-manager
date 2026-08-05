import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PullRequestService } from '../../../services/PullRequestService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { DomainError } from '../../../domain/errors';

jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('PullRequestService', () => {
  let service: PullRequestService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockOctokit: {
    rest: {
      pulls: {
        create: jest.MockedFunction<any>;
        get: jest.MockedFunction<any>;
        list: jest.MockedFunction<any>;
        update: jest.MockedFunction<any>;
        merge: jest.MockedFunction<any>;
        listReviews: jest.MockedFunction<any>;
        createReview: jest.MockedFunction<any>;
      };
    };
  };

  const config = { owner: 'testOwner', repo: 'testRepo' };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        pulls: {
          create: jest.fn(),
          get: jest.fn(),
          list: jest.fn(),
          update: jest.fn(),
          merge: jest.fn(),
          listReviews: jest.fn(),
          createReview: jest.fn(),
        },
      },
    };

    mockFactory = {
      getOctokit: jest.fn().mockReturnValue(mockOctokit),
      getConfig: jest.fn().mockReturnValue(config),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    service = new PullRequestService(mockFactory);
  });

  describe('createPullRequest', () => {
    it('should create a pull request with required fields', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValueOnce({
        data: { number: 1, id: 100, title: 'Feature', state: 'open', html_url: 'https://github.com/pr/1' },
      });

      const result = await service.createPullRequest({
        title: 'Feature', head: 'feature-branch', base: 'main',
      });

      expect(result).toEqual({
        number: 1, id: 100, title: 'Feature', state: 'open', url: 'https://github.com/pr/1',
      });
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'testOwner', repo: 'testRepo',
        title: 'Feature', body: '', head: 'feature-branch', base: 'main', draft: false,
      });
    });

    it('should create a draft pull request', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValueOnce({
        data: { number: 2, id: 101, title: 'WIP', state: 'open', html_url: 'https://github.com/pr/2' },
      });

      const result = await service.createPullRequest({
        title: 'WIP', head: 'wip-branch', base: 'main', draft: true,
      });

      expect(result.number).toBe(2);
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({ draft: true })
      );
    });

    it('should throw mapped error on API failure', async () => {
      mockOctokit.rest.pulls.create.mockRejectedValueOnce(new Error('Conflict'));

      await expect(
        service.createPullRequest({ title: 'PR', head: 'h', base: 'b' })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('getPullRequest', () => {
    it('should return full PR details', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValueOnce({
        data: {
          number: 1, title: 'PR', state: 'open', body: 'desc',
          head: { ref: 'feature' }, base: { ref: 'main' },
          user: { login: 'alice' }, merged: false,
          html_url: 'https://github.com/pr/1',
        },
      });

      const result = await service.getPullRequest({ pullNumber: 1 });

      expect(result).toEqual({
        number: 1, title: 'PR', state: 'open', body: 'desc',
        head: 'feature', base: 'main', user: 'alice', merged: false,
        url: 'https://github.com/pr/1',
      });
    });

    it('should default user to unknown when null', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValueOnce({
        data: {
          number: 1, title: 'PR', state: 'open', body: null,
          head: { ref: 'f' }, base: { ref: 'm' },
          user: null, merged: false, html_url: 'url',
        },
      });

      const result = await service.getPullRequest({ pullNumber: 1 });
      expect(result.user).toBe('unknown');
      expect(result.body).toBe('');
    });
  });

  describe('listPullRequests', () => {
    it('should list PRs with defaults', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValueOnce({
        data: [
          { number: 1, title: 'A', state: 'open', user: { login: 'bob' }, html_url: 'url1' },
          { number: 2, title: 'B', state: 'closed', user: null, html_url: 'url2' },
        ],
      });

      const result = await service.listPullRequests({});

      expect(result).toHaveLength(2);
      expect(result[1].user).toBe('unknown');
      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'open', per_page: 30 })
      );
    });

    it('should pass custom state and limit', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValueOnce({ data: [] });

      const result = await service.listPullRequests({ state: 'closed', limit: 5 });

      expect(result).toEqual([]);
      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'closed', per_page: 5 })
      );
    });
  });

  describe('updatePullRequest', () => {
    it('should update PR fields', async () => {
      mockOctokit.rest.pulls.update.mockResolvedValueOnce({
        data: { number: 1, title: 'Updated', state: 'open', html_url: 'url' },
      });

      const result = await service.updatePullRequest({
        pullNumber: 1, title: 'Updated', state: 'open',
      });

      expect(result).toEqual({ number: 1, title: 'Updated', state: 'open', url: 'url' });
    });
  });

  describe('mergePullRequest', () => {
    it('should merge with default method', async () => {
      mockOctokit.rest.pulls.merge.mockResolvedValueOnce({
        data: { merged: true, message: 'Merged', sha: 'abc123' },
      });

      const result = await service.mergePullRequest({ pullNumber: 1 });

      expect(result).toEqual({ merged: true, message: 'Merged', sha: 'abc123' });
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'merge' })
      );
    });

    it('should merge with squash method', async () => {
      mockOctokit.rest.pulls.merge.mockResolvedValueOnce({
        data: { merged: true, message: 'Squashed', sha: 'def456' },
      });

      const result = await service.mergePullRequest({
        pullNumber: 2, mergeMethod: 'squash', commitTitle: 'feat: squash',
      });

      expect(result.merged).toBe(true);
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith(
        expect.objectContaining({ merge_method: 'squash', commit_title: 'feat: squash' })
      );
    });

    it('should throw mapped error on merge conflict', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValueOnce(new Error('Merge conflict'));

      await expect(
        service.mergePullRequest({ pullNumber: 1 })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('listPullRequestReviews', () => {
    it('should list reviews for a PR', async () => {
      mockOctokit.rest.pulls.listReviews.mockResolvedValueOnce({
        data: [
          { id: 10, user: { login: 'reviewer' }, state: 'APPROVED', body: 'LGTM' },
          { id: 11, user: null, state: 'COMMENTED', body: null },
        ],
      });

      const result = await service.listPullRequestReviews({ pullNumber: 1 });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 10, user: 'reviewer', state: 'APPROVED', body: 'LGTM' });
      expect(result[1].user).toBe('unknown');
      expect(result[1].body).toBe('');
    });
  });

  describe('createPullRequestReview', () => {
    it('should create an approval review', async () => {
      mockOctokit.rest.pulls.createReview.mockResolvedValueOnce({
        data: { id: 20, user: { login: 'alice' }, state: 'APPROVED', body: 'Looks good' },
      });

      const result = await service.createPullRequestReview({
        pullNumber: 1, event: 'APPROVE', body: 'Looks good',
      });

      expect(result).toEqual({ id: 20, user: 'alice', state: 'APPROVED', body: 'Looks good' });
    });

    it('should throw mapped error on review failure', async () => {
      mockOctokit.rest.pulls.createReview.mockRejectedValueOnce(new Error('Forbidden'));

      await expect(
        service.createPullRequestReview({ pullNumber: 1, event: 'APPROVE' })
      ).rejects.toThrow(DomainError);
    });
  });
});
