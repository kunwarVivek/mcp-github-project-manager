import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type {
  GitHubProjectSearchRepository,
  ProjectItemNode,
} from "../../../infrastructure/github/repositories/GitHubProjectSearchRepository";
import { ProjectSearchService } from "../../../services/ProjectSearchService";
import { partialFake } from "../../helpers/aiFakes";

const pageInfo = { hasNextPage: false, endCursor: null };

const item = (
  id: string,
  type: "Issue" | "PullRequest" | "DraftIssue",
  extra: { labels?: string[]; assignees?: string[]; status?: string } = {}
): ProjectItemNode => ({
  id,
  content: {
    __typename: type,
    id: `content_${id}`,
    title: `Title ${id}`,
    labels: { nodes: (extra.labels ?? []).map((name) => ({ name })) },
    assignees: { nodes: (extra.assignees ?? []).map((login) => ({ login })) },
  },
  fieldValues: {
    nodes: extra.status ? [{ name: extra.status, field: { name: "Status" } }] : [],
  },
});

describe("ProjectSearchService", () => {
  const searchIssues = vi.fn();
  const listProjectItems = vi.fn();
  let service: ProjectSearchService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProjectSearchService(
      partialFake<GitHubRepositoryFactory>({
        createProjectSearchRepository: () =>
          partialFake<GitHubProjectSearchRepository>({ searchIssues, listProjectItems }),
      })
    );
  });

  describe("searchIssues", () => {
    it("flattens labels, assignees and repository and defaults the page size", async () => {
      searchIssues.mockResolvedValue({
        totalCount: 1,
        issues: [
          {
            id: "I_1",
            number: 1,
            title: "Bug",
            state: "OPEN",
            url: "u",
            labels: { nodes: [{ name: "bug" }] },
            assignees: { nodes: [{ login: "octocat" }] },
            repository: { nameWithOwner: "o/r" },
          },
        ],
        pageInfo,
      });

      const result = await service.searchIssues({ query: "is:issue" });

      expect(searchIssues).toHaveBeenCalledWith("is:issue", 20, undefined);
      expect(result).toEqual({
        totalCount: 1,
        issues: [
          {
            id: "I_1",
            number: 1,
            title: "Bug",
            state: "OPEN",
            url: "u",
            labels: ["bug"],
            assignees: ["octocat"],
            repository: "o/r",
          },
        ],
        pageInfo,
      });
    });
  });

  describe("filterProjectItems", () => {
    const items = [
      item("1", "Issue", { labels: ["bug"], assignees: ["octocat"], status: "Done" }),
      item("2", "Issue", { labels: ["feature"], status: "In Progress" }),
      item("3", "PullRequest", { labels: ["bug"], status: "Done" }),
      item("4", "DraftIssue"),
    ];

    const filter = async (
      f: Parameters<ProjectSearchService["filterProjectItems"]>[0]["filter"]
    ) => {
      listProjectItems.mockResolvedValue({ totalCount: 4, items, pageInfo });
      const result = await service.filterProjectItems({ projectId: "PVT_1", filter: f });
      return result.items.map((i) => i.id);
    };

    it("fetches with the default page size", async () => {
      await filter({});

      expect(listProjectItems).toHaveBeenCalledWith("PVT_1", 50, undefined);
    });

    it("returns everything for an empty filter, with counts before and after", async () => {
      listProjectItems.mockResolvedValue({ totalCount: 40, items, pageInfo });

      const result = await service.filterProjectItems({ projectId: "PVT_1", filter: {} });

      expect(result.totalCount).toBe(40);
      expect(result.filteredCount).toBe(4);
    });

    it("filters by content type", async () => {
      expect(await filter({ type: "PullRequest" })).toEqual(["3"]);
    });

    it("filters by the Status field", async () => {
      expect(await filter({ status: "Done" })).toEqual(["1", "3"]);
    });

    it("matches an item with at least one of the labels", async () => {
      expect(await filter({ labels: ["bug", "feature"] })).toEqual(["1", "2", "3"]);
    });

    it("filters by assignee", async () => {
      expect(await filter({ assignee: "octocat" })).toEqual(["1"]);
    });

    it("requires every given criterion", async () => {
      expect(await filter({ type: "Issue", status: "Done", labels: ["bug"] })).toEqual(["1"]);
    });

    it("falls back to draft defaults for items without content", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 1,
        items: [{ id: "PVTI_x", content: null, fieldValues: { nodes: [] } }],
        pageInfo,
      });

      const result = await service.filterProjectItems({ projectId: "PVT_1", filter: {} });

      expect(result.items[0]).toEqual({
        id: "PVTI_x",
        type: "DraftIssue",
        contentId: null,
        title: "Untitled",
        state: null,
        labels: [],
        fieldValues: {},
      });
    });
  });
});
