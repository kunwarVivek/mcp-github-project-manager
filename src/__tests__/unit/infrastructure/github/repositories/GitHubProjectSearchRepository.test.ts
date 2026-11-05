import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectSearchRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectSearchRepository";
import type { OctokitInstance } from "../../../../../infrastructure/github/types";
import { partialFake } from "../../../../helpers/aiFakes";

describe("GitHubProjectSearchRepository", () => {
  let graphql: Mock;
  let repository: GitHubProjectSearchRepository;

  beforeEach(() => {
    graphql = vi.fn();
    repository = new GitHubProjectSearchRepository(
      partialFake<OctokitInstance>({ graphql: graphql as never }),
      new GitHubConfig("owner", "repo")
    );
  });

  describe("searchIssues", () => {
    const issueNode = {
      id: "I_1",
      number: 1,
      title: "Bug",
      state: "OPEN",
      url: "https://github.com/o/r/issues/1",
      labels: { nodes: [{ name: "bug" }] },
      assignees: { nodes: [{ login: "octocat" }] },
      repository: { nameWithOwner: "o/r" },
    };

    it("passes the query and page arguments through", async () => {
      graphql.mockResolvedValueOnce({
        search: {
          issueCount: 0,
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

      await repository.searchIssues("is:issue AND label:bug", 10, "cursor_1");

      expect(graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ query: "is:issue AND label:bug", first: 10, after: "cursor_1" })
      );
    });

    it("drops nodes that are not issues", async () => {
      graphql.mockResolvedValueOnce({
        search: {
          issueCount: 3,
          nodes: [issueNode, {}, { ...issueNode, id: "" }],
          pageInfo: { hasNextPage: true, endCursor: "next" },
        },
      });

      const page = await repository.searchIssues("is:issue", 20);

      expect(page.totalCount).toBe(3);
      expect(page.issues).toEqual([issueNode]);
      expect(page.pageInfo).toEqual({ hasNextPage: true, endCursor: "next" });
    });
  });

  describe("listProjectItems", () => {
    it("returns the page of items", async () => {
      const item = { id: "PVTI_1", content: null, fieldValues: { nodes: [] } };
      graphql.mockResolvedValueOnce({
        node: {
          items: {
            totalCount: 7,
            nodes: [item],
            pageInfo: { hasNextPage: true, endCursor: "c" },
          },
        },
      });

      const page = await repository.listProjectItems("PVT_1", 50, "prev");

      expect(graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ projectId: "PVT_1", first: 50, after: "prev" })
      );
      expect(page).toEqual({
        totalCount: 7,
        items: [item],
        pageInfo: { hasNextPage: true, endCursor: "c" },
      });
    });

    it("selects every member of the project field union", async () => {
      graphql.mockResolvedValueOnce({
        node: {
          items: {
            totalCount: 0,
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });

      await repository.listProjectItems("PVT_1", 50);

      const query = graphql.mock.calls[0][0] as string;
      for (const member of [
        "ProjectV2Field",
        "ProjectV2SingleSelectField",
        "ProjectV2MultiSelectField",
        "ProjectV2IterationField",
      ]) {
        expect(query).toContain(`... on ${member} {`);
      }
    });

    it("throws when the project does not exist", async () => {
      graphql.mockResolvedValueOnce({ node: null });

      await expect(repository.listProjectItems("PVT_gone", 50)).rejects.toThrow(
        "Project 'PVT_gone' not found"
      );
    });
  });
});
