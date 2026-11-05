import { Octokit } from "@octokit/rest";
import {
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  type Mocked,
  type MockedClass,
  vi,
} from "vitest";
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
          listForRepo: vi.fn(),
        },
      },
    } as unknown as Mocked<Octokit>;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit);

    // Create configuration
    config = new GitHubConfig("test-owner", "test-repo");

    // Create repository instance
    repository = new GitHubIssueRepository(mockOctokit, config);
  });

  it("should create an instance correctly", () => {
    expect(repository).toBeDefined();
  });

  const graphqlMock = () => mockOctokit.graphql as unknown as Mock;

  describe("assignee resolution", () => {
    const issuePayload = {
      id: "I_1",
      number: 1,
      title: "T",
      body: "B",
      state: "OPEN",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      assignees: { nodes: [] },
      labels: { nodes: [] },
      milestone: null,
    };
    const userIds: Record<string, string> = { alice: "U_alice", bob: "U_bob" };

    const stubGraphql = () => {
      graphqlMock().mockImplementation((query: string, vars?: { login?: string }) => {
        if (query.includes("GetRepositoryNodeId")) {
          return Promise.resolve({ repository: { id: "R_repo" } });
        }
        if (query.includes("GetUserNodeId")) {
          const id = vars?.login ? userIds[vars.login] : undefined;
          return Promise.resolve({ user: id ? { id } : null });
        }
        if (query.includes("createIssue")) {
          return Promise.resolve({ createIssue: { issue: issuePayload } });
        }
        if (query.includes("updateIssue")) {
          return Promise.resolve({ updateIssue: { issue: issuePayload } });
        }
        return Promise.resolve({
          repository: { labels: { nodes: [], pageInfo: { hasNextPage: false } } },
        });
      });
    };

    const mutationInput = (name: "createIssue" | "updateIssue") => {
      const call = graphqlMock().mock.calls.find(([query]: unknown[]) =>
        String(query).includes(`${name}(input`)
      );
      return call?.[1]?.input;
    };
    const userLookups = () =>
      graphqlMock().mock.calls.filter(([query]: unknown[]) =>
        String(query).includes("GetUserNodeId")
      );

    it("create sends node IDs for logins", async () => {
      stubGraphql();
      await repository.create({ title: "T", description: "B", assignees: ["alice", "bob"] });
      expect(mutationInput("createIssue").assigneeIds).toEqual(["U_alice", "U_bob"]);
    });

    it("update sends node IDs for logins", async () => {
      stubGraphql();
      await repository.update("I_1", { assignees: ["alice"] });
      expect(mutationInput("updateIssue").assigneeIds).toEqual(["U_alice"]);
    });

    it("passes values that are already node IDs through without a lookup", async () => {
      stubGraphql();
      await repository.create({
        title: "T",
        description: "B",
        assignees: ["U_kgDOexisting", "bob"],
      });
      expect(mutationInput("createIssue").assigneeIds).toEqual(["U_kgDOexisting", "U_bob"]);
      expect(userLookups()).toHaveLength(1);
    });

    it("fails with a clear error naming unknown logins, before mutating", async () => {
      stubGraphql();
      await expect(
        repository.create({ title: "T", description: "B", assignees: ["alice", "ghost"] })
      ).rejects.toThrow(/not found: ghost/);
      expect(mutationInput("createIssue")).toBeUndefined();
    });

    it("keeps undefined assignees undefined on create and update (update must not clear)", async () => {
      stubGraphql();
      await repository.create({ title: "T", description: "B" });
      await repository.update("I_1", { title: "New" });
      expect(mutationInput("createIssue").assigneeIds).toBeUndefined();
      expect(mutationInput("updateIssue").assigneeIds).toBeUndefined();
      expect(userLookups()).toHaveLength(0);
    });

    it("looks up a login that merely resembles a legacy node-ID prefix", async () => {
      userIds.MDQ6abc = "U_mdq6abc";
      stubGraphql();
      await repository.create({
        title: "T",
        description: "B",
        assignees: ["MDQ6abc", "MDQ6VXNlcjE="],
      });
      expect(mutationInput("createIssue").assigneeIds).toEqual(["U_mdq6abc", "MDQ6VXNlcjE="]);
      expect(userLookups()).toHaveLength(1);
      delete userIds.MDQ6abc;
    });
  });

  describe("label resolution", () => {
    const issuePayload = {
      id: "I_1",
      number: 1,
      title: "T",
      body: "B",
      state: "OPEN",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      assignees: { nodes: [] },
      labels: { nodes: [] },
      milestone: null,
    };

    const stubGraphql = () => {
      graphqlMock().mockImplementation((query: string) => {
        if (query.includes("GetRepositoryNodeId")) {
          return Promise.resolve({ repository: { id: "R_repo" } });
        }
        if (query.includes("updateIssue(input")) {
          return Promise.resolve({ updateIssue: { issue: issuePayload } });
        }
        if (query.includes("createIssue(input")) {
          return Promise.resolve({ createIssue: { issue: issuePayload } });
        }
        return Promise.resolve({
          repository: {
            labels: { nodes: [{ id: "LA_bug", name: "bug" }], pageInfo: { hasNextPage: false } },
          },
        });
      });
    };
    const labelLookups = () =>
      graphqlMock().mock.calls.filter(([query]: unknown[]) =>
        String(query).includes("labels(first: $first")
      );
    const updateInput = () =>
      graphqlMock().mock.calls.find(([query]: unknown[]) =>
        String(query).includes("updateIssue(input")
      )?.[1]?.input;

    it("update without labels sends no labelIds and does no label lookup", async () => {
      stubGraphql();
      await repository.update("I_1", { title: "New" });
      expect(updateInput()).toBeDefined();
      expect(updateInput().labelIds).toBeUndefined();
      expect(labelLookups()).toHaveLength(0);
    });

    it("update with an explicit empty labels array sends labelIds: []", async () => {
      stubGraphql();
      await repository.update("I_1", { labels: [] });
      expect(updateInput().labelIds).toEqual([]);
    });

    it("update resolves label names to node IDs", async () => {
      stubGraphql();
      await repository.update("I_1", { labels: ["bug"] });
      expect(updateInput().labelIds).toEqual(["LA_bug"]);
    });
  });
});
