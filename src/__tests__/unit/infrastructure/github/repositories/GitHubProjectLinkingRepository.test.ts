import { vi } from "vitest";

/**
 * Unit tests for GitHubProjectLinkingRepository (mocked GraphQL)
 *
 * Tests project item operations and repository/team linking.
 */

import { ResourceType } from "../../../../../domain/resource-types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectLinkingRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectLinkingRepository";
import { octokitWithGraphql } from "../../../../helpers/aiFakes";

const mockGraphql = vi.fn();
const mockOctokit = octokitWithGraphql(mockGraphql);
const mockConfig = new GitHubConfig("test-owner", "test-repo");

describe("GitHubProjectLinkingRepository", () => {
  let repository: GitHubProjectLinkingRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new GitHubProjectLinkingRepository(mockOctokit, mockConfig);
  });

  describe("addItem", () => {
    it("adds content to the project and returns item and content IDs", async () => {
      mockGraphql.mockResolvedValueOnce({
        addProjectV2ItemById: {
          item: { id: "ITEM_123", content: { id: "ISSUE_456", title: "Test Issue" } },
        },
      });

      const result = await repository.addItem("PROJECT_123", "ISSUE_456");

      expect(result).toEqual({ itemId: "ITEM_123", contentId: "ISSUE_456" });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: AddProjectV2ItemByIdInput!)"),
        expect.objectContaining({ input: { projectId: "PROJECT_123", contentId: "ISSUE_456" } })
      );
    });

    it("retries transient 'temporary conflict' errors", async () => {
      mockGraphql
        .mockRejectedValueOnce(new Error("temporary conflict, try again"))
        .mockResolvedValueOnce({
          addProjectV2ItemById: {
            item: { id: "ITEM_1", content: { id: "ISSUE_1", title: "Issue" } },
          },
        });

      const result = await repository.addItem("PROJECT_123", "ISSUE_1");

      expect(result.itemId).toBe("ITEM_1");
    });

    it("does not retry other errors", async () => {
      mockGraphql.mockRejectedValue(new Error("Content not found"));

      await expect(repository.addItem("PROJECT_123", "NONEXISTENT")).rejects.toThrow(
        "Content not found"
      );
    });
  });

  describe("removeItem / archiveItem / unarchiveItem", () => {
    it("sends the delete mutation", async () => {
      mockGraphql.mockResolvedValueOnce({ deleteProjectV2Item: { deletedItemId: "ITEM_123" } });

      await repository.removeItem("PROJECT_123", "ITEM_123");

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: DeleteProjectV2ItemInput!)"),
        expect.objectContaining({ input: { projectId: "PROJECT_123", itemId: "ITEM_123" } })
      );
    });

    it("sends the archive mutation", async () => {
      mockGraphql.mockResolvedValueOnce({
        archiveProjectV2Item: { item: { id: "ITEM_123", isArchived: true } },
      });

      await repository.archiveItem("PROJECT_123", "ITEM_123");

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: ArchiveProjectV2ItemInput!)"),
        expect.objectContaining({ input: { projectId: "PROJECT_123", itemId: "ITEM_123" } })
      );
    });

    it("sends the unarchive mutation", async () => {
      mockGraphql.mockResolvedValueOnce({
        unarchiveProjectV2Item: { item: { id: "ITEM_123", isArchived: false } },
      });

      await repository.unarchiveItem("PROJECT_123", "ITEM_123");

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: UnarchiveProjectV2ItemInput!)"),
        expect.objectContaining({ input: { projectId: "PROJECT_123", itemId: "ITEM_123" } })
      );
    });
  });

  describe("listItems", () => {
    it("maps content types and text/date/single-select field values", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          items: {
            nodes: [
              {
                id: "ITEM_1",
                content: { id: "ISSUE_1", title: "Issue 1", __typename: "Issue" },
                fieldValues: {
                  nodes: [
                    { text: "Some text", field: { id: "FIELD_1", name: "Description" } },
                    { date: "2025-01-15", field: { id: "FIELD_DUE", name: "Due Date" } },
                    { name: "In Progress", field: { id: "FIELD_STATUS", name: "Status" } },
                  ],
                },
              },
              {
                id: "ITEM_2",
                content: { id: "PR_1", title: "PR 1", __typename: "PullRequest" },
                fieldValues: { nodes: [] },
              },
            ],
          },
        },
      });

      const result = await repository.listItems("PROJECT_123", 10);

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ projectId: "PROJECT_123", limit: 10 })
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: "ITEM_1",
          contentId: "ISSUE_1",
          title: "Issue 1",
          contentType: ResourceType.ISSUE,
          projectId: "PROJECT_123",
        })
      );
      expect(result[0].fieldValues).toEqual({
        FIELD_1: "Some text",
        FIELD_DUE: "2025-01-15",
        FIELD_STATUS: "In Progress",
      });
      expect(result[1].contentType).toBe(ResourceType.PULL_REQUEST);
    });

    it("defaults items without content to an issue with empty content ID", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: { items: { nodes: [{ id: "ITEM_1", fieldValues: { nodes: [] } }] } },
      });

      const result = await repository.listItems("PROJECT_123", 50);

      expect(result[0].contentId).toBe("");
      expect(result[0].contentType).toBe(ResourceType.ISSUE);
    });

    it("returns an empty array when the project is not found", async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      expect(await repository.listItems("NONEXISTENT", 50)).toEqual([]);
    });
  });

  describe("linkRepository / unlinkRepository", () => {
    it("resolves the repository ID with the requested owner, not the configured one", async () => {
      mockGraphql
        .mockResolvedValueOnce({ repository: { id: "R_kgTest123" } })
        .mockResolvedValueOnce({
          linkProjectV2ToRepository: {
            repository: {
              id: "R_kgTest123",
              name: "hello-world",
              nameWithOwner: "octocat/hello-world",
              url: "https://github.com/octocat/hello-world",
              description: null,
            },
          },
        });

      const result = await repository.linkRepository("PVT_1", "octocat", "hello-world");

      expect(mockGraphql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("ResolveRepositoryId"),
        expect.objectContaining({ repoOwner: "octocat", repoName: "hello-world" })
      );
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("linkProjectV2ToRepository"),
        expect.objectContaining({ input: { projectId: "PVT_1", repositoryId: "R_kgTest123" } })
      );
      expect(result).toEqual({
        id: "R_kgTest123",
        name: "hello-world",
        nameWithOwner: "octocat/hello-world",
        url: "https://github.com/octocat/hello-world",
        description: null,
      });
    });

    it("throws when the repository does not exist", async () => {
      mockGraphql.mockResolvedValueOnce({ repository: null });

      await expect(repository.linkRepository("PVT_1", "octocat", "missing")).rejects.toThrow(
        "Repository octocat/missing not found"
      );
    });

    it("unlinks by resolved repository ID", async () => {
      mockGraphql
        .mockResolvedValueOnce({ repository: { id: "R_kgTest123" } })
        .mockResolvedValueOnce({
          unlinkProjectV2FromRepository: { repository: { id: "R_kgTest123" } },
        });

      await repository.unlinkRepository("PVT_1", "octocat", "hello-world");

      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("unlinkProjectV2FromRepository"),
        expect.objectContaining({ input: { projectId: "PVT_1", repositoryId: "R_kgTest123" } })
      );
    });
  });

  describe("linkTeam / unlinkTeam", () => {
    it("resolves the team ID and links it", async () => {
      mockGraphql
        .mockResolvedValueOnce({ organization: { team: { id: "T_kwTest123" } } })
        .mockResolvedValueOnce({
          linkProjectV2ToTeam: {
            team: {
              id: "T_kwTest123",
              name: "Engineering Team",
              slug: "engineering",
              description: null,
            },
          },
        });

      const result = await repository.linkTeam("PVT_1", "octocat-org", "engineering");

      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("linkProjectV2ToTeam"),
        expect.objectContaining({ input: { projectId: "PVT_1", teamId: "T_kwTest123" } })
      );
      expect(result.slug).toBe("engineering");
    });

    it("throws when the organization does not exist", async () => {
      mockGraphql.mockResolvedValueOnce({ organization: null });

      await expect(repository.linkTeam("PVT_1", "ghost-org", "eng")).rejects.toThrow(
        "Organization ghost-org not found"
      );
    });

    it("throws when the team does not exist", async () => {
      mockGraphql.mockResolvedValueOnce({ organization: { team: null } });

      await expect(repository.unlinkTeam("PVT_1", "octocat-org", "ghost")).rejects.toThrow(
        "Team ghost not found in organization octocat-org"
      );
    });

    it("unlinks by resolved team ID", async () => {
      mockGraphql
        .mockResolvedValueOnce({ organization: { team: { id: "T_kwTest123" } } })
        .mockResolvedValueOnce({ unlinkProjectV2FromTeam: { team: { id: "T_kwTest123" } } });

      await repository.unlinkTeam("PVT_1", "octocat-org", "engineering");

      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("unlinkProjectV2FromTeam"),
        expect.objectContaining({ input: { projectId: "PVT_1", teamId: "T_kwTest123" } })
      );
    });
  });

  describe("listRepositories / listTeams", () => {
    it("maps linked repositories with pagination", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          repositories: {
            nodes: [
              {
                id: "R_1",
                name: "repo",
                nameWithOwner: "o/repo",
                url: "https://github.com/o/repo",
                description: "d",
              },
            ],
            pageInfo: { hasNextPage: true, endCursor: "c1" },
            totalCount: 5,
          },
        },
      });

      const result = await repository.listRepositories({
        projectId: "PVT_1",
        first: 1,
        after: "c0",
      });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("ListLinkedRepositories"),
        expect.objectContaining({ projectId: "PVT_1", first: 1, after: "c0" })
      );
      expect(result.repositories[0].nameWithOwner).toBe("o/repo");
      expect(result.pageInfo).toEqual({ hasNextPage: true, endCursor: "c1" });
      expect(result.totalCount).toBe(5);
    });

    it("throws when the project is not found (repositories)", async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      await expect(repository.listRepositories({ projectId: "X", first: 20 })).rejects.toThrow(
        "Project X not found"
      );
    });

    it("maps linked teams with pagination", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          teams: {
            nodes: [{ id: "T_1", name: "Eng", slug: "eng", description: null }],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 1,
          },
        },
      });

      const result = await repository.listTeams({ projectId: "PVT_1", first: 20 });

      expect(result.teams).toEqual([{ id: "T_1", name: "Eng", slug: "eng", description: null }]);
      expect(result.totalCount).toBe(1);
    });

    it("throws when the project is not found (teams)", async () => {
      mockGraphql.mockResolvedValueOnce({ node: null });

      await expect(repository.listTeams({ projectId: "X", first: 20 })).rejects.toThrow(
        "Project X not found"
      );
    });
  });
});
