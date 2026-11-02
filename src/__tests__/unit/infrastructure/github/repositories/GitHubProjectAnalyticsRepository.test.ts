import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import {
  GitHubProjectAnalyticsRepository,
  toAnalyticsItem,
} from "../../../../../infrastructure/github/repositories/GitHubProjectAnalyticsRepository";
import type { OctokitInstance } from "../../../../../infrastructure/github/types";
import { MAX_CONNECTION_PAGES } from "../../../../../infrastructure/github/util/paginate";
import { partialFake } from "../../../../helpers/aiFakes";

describe("GitHubProjectAnalyticsRepository", () => {
  let graphql: Mock;
  let repository: GitHubProjectAnalyticsRepository;

  beforeEach(() => {
    graphql = vi.fn();
    repository = new GitHubProjectAnalyticsRepository(
      partialFake<OctokitInstance>({ graphql: graphql as never }),
      new GitHubConfig("owner", "repo", { kind: "pat", token: "test-token" })
    );
  });

  const page = (ids: string[], endCursor: string | null) => ({
    node: {
      items: {
        nodes: ids.map((id) => ({ id, createdAt: "2026-03-01T00:00:00Z", content: null })),
        pageInfo: { hasNextPage: endCursor !== null, endCursor },
      },
    },
  });

  it("follows the cursor across pages", async () => {
    graphql.mockResolvedValueOnce(page(["a", "b"], "c1")).mockResolvedValueOnce(page(["c"], null));

    const result = await repository.listItems("PVT_1");

    expect(result.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(result.truncated).toBe(false);
    expect(graphql.mock.calls.map(([, v]) => v.after)).toEqual([null, "c1"]);
    expect(graphql.mock.calls[0][1]).toMatchObject({ projectId: "PVT_1", first: 100 });
  });

  it("stops at the page cap and reports truncation", async () => {
    graphql.mockResolvedValue(page(["x"], "more"));

    const result = await repository.listItems("PVT_1");

    expect(graphql).toHaveBeenCalledTimes(MAX_CONNECTION_PAGES);
    expect(result.items).toHaveLength(MAX_CONNECTION_PAGES);
    expect(result.truncated).toBe(true);
  });

  it("is not truncated when the last allowed page is also the last page", async () => {
    for (let i = 1; i < MAX_CONNECTION_PAGES; i++) {
      graphql.mockResolvedValueOnce(page(["x"], `c${i}`));
    }
    graphql.mockResolvedValueOnce(page(["last"], null));

    const result = await repository.listItems("PVT_1");

    expect(result.items).toHaveLength(MAX_CONNECTION_PAGES);
    expect(result.truncated).toBe(false);
  });

  it("throws when the project does not exist", async () => {
    graphql.mockResolvedValueOnce({ node: null });

    await expect(repository.listItems("PVT_gone")).rejects.toThrow("Project 'PVT_gone' not found");
  });
});

describe("toAnalyticsItem", () => {
  it("maps content, status, points, iteration and milestone", () => {
    const item = toAnalyticsItem({
      id: "PVTI_1",
      createdAt: "2026-03-02T00:00:00Z",
      updatedAt: "2026-03-09T00:00:00Z",
      content: {
        __typename: "Issue",
        createdAt: "2026-03-01T00:00:00Z",
        closedAt: "2026-03-08T00:00:00Z",
        state: "CLOSED",
        milestone: { title: "M1", dueOn: null, state: "OPEN" },
      },
      fieldValues: {
        nodes: [
          null,
          {
            __typename: "ProjectV2ItemFieldSingleSelectValue",
            name: "Done",
            field: { name: "Status" },
          },
          {
            __typename: "ProjectV2ItemFieldSingleSelectValue",
            name: "High",
            field: { name: "Priority" },
          },
          { __typename: "ProjectV2ItemFieldNumberValue", number: 8, field: { name: "Size" } },
          {
            __typename: "ProjectV2ItemFieldNumberValue",
            number: 3,
            field: { name: "Story Points" },
          },
          {
            __typename: "ProjectV2ItemFieldIterationValue",
            iterationId: "it-1",
            title: "Sprint 1",
            startDate: "2026-03-02",
            duration: 14,
          },
        ],
      },
    });

    expect(item).toEqual({
      id: "PVTI_1",
      type: "ISSUE",
      createdAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-09T00:00:00Z",
      closedAt: "2026-03-08T00:00:00Z",
      state: "CLOSED",
      status: "Done",
      points: 3,
      iteration: { id: "it-1", title: "Sprint 1", startDate: "2026-03-02", duration: 14 },
      milestone: { title: "M1", dueOn: null, state: "OPEN" },
      fields: { Status: "Done", Priority: "High" },
    });
  });

  it("maps an item with no content or field values to nulls", () => {
    expect(toAnalyticsItem({ id: "PVTI_2", createdAt: "2026-03-01T00:00:00Z" })).toMatchObject({
      type: "UNKNOWN",
      closedAt: null,
      status: null,
      points: null,
      iteration: null,
      milestone: null,
      fields: {},
    });
  });
});
