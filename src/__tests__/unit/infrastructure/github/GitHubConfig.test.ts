import { describe, expect, it } from '@jest/globals';
import { GitHubConfig } from '../../../../infrastructure/github/GitHubConfig';

describe('GitHubConfig', () => {
  const owner = 'test-owner';
  const repo = 'test-repo';
  const token = 'test-token';

  it('should create a config instance with all properties', () => {
    const config = new GitHubConfig(owner, repo, token);

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
    expect(config.token).toBe(token);
  });

  it('should not allow modification of properties', () => {
    const config = new GitHubConfig(owner, repo, token);

    expect(() => {
      (config as any).owner = 'new-owner';
    }).toThrow();

    expect(() => {
      (config as any).repo = 'new-repo';
    }).toThrow();

    expect(() => {
      (config as any).token = 'new-token';
    }).toThrow();

    expect(config.owner).toBe(owner);
    expect(config.repo).toBe(repo);
    expect(config.token).toBe(token);
  });

  it('should throw error if owner is empty', () => {
    expect(() => {
      new GitHubConfig('', repo, token);
    }).toThrow('Owner is required');
  });

  it('should throw error if repo is empty', () => {
    expect(() => {
      new GitHubConfig(owner, '', token);
    }).toThrow('Repository is required');
  });

  it('should throw error if token is empty', () => {
    expect(() => {
      new GitHubConfig(owner, repo, '');
    }).toThrow('Token is required');
  });
});