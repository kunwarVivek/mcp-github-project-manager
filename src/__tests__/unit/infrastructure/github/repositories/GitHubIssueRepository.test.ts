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

  describe("create", () => {
    // Routes each GraphQL call by its content, so the assertions below can
    // inspect exactly what ends up in the mutation input.
    const stubGraphql = () => {
      (mockOctokit.graphql as any).mockImplementation((query: string) => {
        if (query.includes("GetRepositoryNodeId")) {
          return Promise.resolve({ repository: { id: "R_repo123" } });
        }
        if (query.includes("GetLabelIds")) {
          return Promise.resolve({
            repository: { labels: { nodes: [{ id: "LA_bug", name: "bug" }] } },
          });
        }
        if (query.includes("GetAssigneeIds")) {
          return Promise.resolve({
            repository: {
              assignableUsers: { nodes: [{ id: "U_alice", login: "alice" }] },
            },
          });
        }
        return Promise.resolve({
          createIssue: {
            issue: {
              id: "I_1",
              number: 1,
              title: "Test",
              body: "Body",
              state: "OPEN",
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
              assignees: { nodes: [{ login: "alice" }] },
              labels: { nodes: [{ name: "bug" }] },
              milestone: null,
            },
          },
        });
      });
    };

    const mutationInput = () => {
      const call = (mockOctokit.graphql as any).mock.calls.find(
        ([query]: [string]) => query.includes("createIssue")
      );
      return call?.[1]?.input;
    };

    it("passes node IDs — not names — to createIssue", async () => {
      stubGraphql();

      await repository.create({
        title: "Test",
        description: "Body",
        labels: ["bug"],
        assignees: ["alice"],
      });

      // Regression guard: passing names here makes GitHub reject the mutation
      // with "Could not resolve to a node with the global id of '<name>'".
      expect(mutationInput()).toEqual(
        expect.objectContaining({
          repositoryId: "R_repo123",
          labelIds: ["LA_bug"],
          assigneeIds: ["U_alice"],
        })
      );
    });

    it("skips labels that do not exist instead of failing", async () => {
      stubGraphql();

      await repository.create({
        title: "Test",
        description: "Body",
        labels: ["bug", "does-not-exist"],
      });

      expect(mutationInput().labelIds).toEqual(["LA_bug"]);
    });
  });
});