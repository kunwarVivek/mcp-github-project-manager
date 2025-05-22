import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubIssueRepository } from "../../../../../infrastructure/github/repositories/GitHubIssueRepository";
import { ResourceType, ResourceStatus } from "../../../../../domain/resource-types";
import { Issue } from "../../../../../domain/types";

// Mock Octokit
jest.mock("@octokit/rest");

describe("GitHubIssueRepository", () => {
  let repository: GitHubIssueRepository;
  let mockOctokit: jest.Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock Octokit instance with GraphQL method
    mockOctokit = {
      graphql: jest.fn(),
      rest: {
        issues: {
          create: jest.fn(),
          update: jest.fn(),
          get: jest.fn(),
          list: jest.fn(),
          listForRepo: jest.fn()
        }
      }
    } as any;

    (Octokit as jest.MockedClass<typeof Octokit>).mockImplementation(
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