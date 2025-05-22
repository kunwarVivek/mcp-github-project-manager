import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GitHubConfig } from '../../infrastructure/github/GitHubConfig';

// Skip these tests in CI environment unless credentials are available
const shouldSkip = process.env.GITHUB_TOKEN === undefined;

// This is an integration test suite that requires actual GitHub credentials
(shouldSkip ? describe.skip : describe)('GitHubProjectManager Integration', () => {
  let config: GitHubConfig;
  
  beforeEach(() => {
    // Use environment variables or default test values
    const owner = process.env.GITHUB_OWNER || 'test-owner';
    const repo = process.env.GITHUB_REPO || 'test-repo';
    const token = process.env.GITHUB_TOKEN || 'test-token';
    
    config = new GitHubConfig(owner, repo, token);
  });
  
  it('should create proper config from environment variables', () => {
    expect(config).toBeDefined();
    expect(config.owner).toBeDefined();
    expect(config.repo).toBeDefined();
    expect(config.token).toBeDefined();
  });
});