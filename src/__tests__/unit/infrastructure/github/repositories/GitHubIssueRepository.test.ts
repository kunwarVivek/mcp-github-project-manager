import { beforeEach, describe, expect, it, vi, type Mocked, type MockedClass, } from 'vitest';
import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubIssueRepository } from "../../../../../infrastructure/github/repositories/GitHubIssueRepository";

// Mock Octokit
vi.mock("@octokit/rest");

describe("GitHubIssueRepository", () => {
  let repository: GitHubIssueRepository;
  let mockOctokit: Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Create mock Octokit instance with GraphQL method
    mockOctokit = {
      graphql: vi.fn(),
      rest: {
        issues: {
          create: vi.fn(),
          update: vi.fn(),
          get: vi.fn(),
          list: vi.fn(),
          listForRepo: vi.fn()
        }
      }
    } as any;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(
      () => mockOctokit
    );

    // Create configuration
    config = new GitHubConfig("test-owner", "test-repo", "test-token");

    // Create repository instance
    repository = new GitHubIssueRepository(mockOctokit, config);
  });

  it("should create an instance correctly", () => {
    expect(repository).toBeDefined();
  });
});