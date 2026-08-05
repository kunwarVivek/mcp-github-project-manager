import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { LabelService } from '../../../services/LabelService';
import { GitHubRepositoryFactory } from '../../../infrastructure/github/GitHubRepositoryFactory';
import { DomainError } from '../../../domain/errors';

jest.mock('../../../infrastructure/github/GitHubRepositoryFactory');

describe('LabelService', () => {
  let service: LabelService;
  let mockFactory: jest.Mocked<GitHubRepositoryFactory>;
  let mockOctokit: {
    rest: {
      issues: {
        createLabel: jest.MockedFunction<any>;
        listLabelsForRepo: jest.MockedFunction<any>;
      };
    };
  };

  const config = { owner: 'testOwner', repo: 'testRepo' };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOctokit = {
      rest: {
        issues: {
          createLabel: jest.fn(),
          listLabelsForRepo: jest.fn(),
        },
      },
    };

    mockFactory = {
      getOctokit: jest.fn().mockReturnValue(mockOctokit),
      getConfig: jest.fn().mockReturnValue(config),
    } as unknown as jest.Mocked<GitHubRepositoryFactory>;

    service = new LabelService(mockFactory);
  });

  describe('createLabel', () => {
    it('should create a label with all fields', async () => {
      mockOctokit.rest.issues.createLabel.mockResolvedValueOnce({
        data: { id: 1, name: 'bug', color: 'ff0000', description: 'Bug reports' },
      });

      const result = await service.createLabel({
        name: 'bug', color: '#ff0000', description: 'Bug reports',
      });

      expect(result).toEqual({ id: 1, name: 'bug', color: 'ff0000', description: 'Bug reports' });
      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith({
        owner: 'testOwner', repo: 'testRepo',
        name: 'bug', color: 'ff0000', description: 'Bug reports',
      });
    });

    it('should strip hash from color', async () => {
      mockOctokit.rest.issues.createLabel.mockResolvedValueOnce({
        data: { id: 2, name: 'feat', color: '00ff00', description: '' },
      });

      await service.createLabel({ name: 'feat', color: '#00ff00' });

      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ color: '00ff00' })
      );
    });

    it('should use default color when none provided', async () => {
      mockOctokit.rest.issues.createLabel.mockResolvedValueOnce({
        data: { id: 3, name: 'chore', color: 'ededed', description: '' },
      });

      await service.createLabel({ name: 'chore' });

      expect(mockOctokit.rest.issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'ededed', description: '' })
      );
    });

    it('should handle null description in response', async () => {
      mockOctokit.rest.issues.createLabel.mockResolvedValueOnce({
        data: { id: 4, name: 'docs', color: '0000ff', description: null },
      });

      const result = await service.createLabel({ name: 'docs' });

      expect(result.description).toBe('');
    });

    it('should throw mapped error on API failure', async () => {
      mockOctokit.rest.issues.createLabel.mockRejectedValueOnce(
        new Error('Label already exists')
      );

      await expect(
        service.createLabel({ name: 'duplicate' })
      ).rejects.toThrow(DomainError);
    });
  });

  describe('listLabels', () => {
    it('should list labels with default limit', async () => {
      mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValueOnce({
        data: [
          { id: 1, name: 'bug', color: 'ff0000', description: 'Bug reports' },
          { id: 2, name: 'feature', color: '00ff00', description: null },
        ],
      });

      const result = await service.listLabels();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'bug', color: 'ff0000', description: 'Bug reports' });
      expect(result[1].description).toBe('');
      expect(mockOctokit.rest.issues.listLabelsForRepo).toHaveBeenCalledWith({
        owner: 'testOwner', repo: 'testRepo', per_page: 100,
      });
    });

    it('should use custom limit', async () => {
      mockOctokit.rest.issues.listLabelsForRepo.mockResolvedValueOnce({ data: [] });

      const result = await service.listLabels({ limit: 10 });

      expect(result).toEqual([]);
      expect(mockOctokit.rest.issues.listLabelsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 10 })
      );
    });

    it('should throw mapped error on API failure', async () => {
      mockOctokit.rest.issues.listLabelsForRepo.mockRejectedValueOnce(
        new Error('Not Found')
      );

      await expect(service.listLabels()).rejects.toThrow(DomainError);
    });
  });
});
