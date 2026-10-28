import { Octokit } from "@octokit/rest";
import { beforeEach, describe, expect, it, type Mocked, type MockedClass, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectRepository";

vi.mock("@octokit/rest");

/**
 * The configuration GitHub stores for a project view.
 *
 * `ProjectV2View` carries the server-side `filter` the view selects its
 * items with, the fields it groups by (`groupByFields`), the fields it
 * sorts by (`sortByFields`) and the fields it shows
 * (`configuration.visibleFields`). Reading them is what lets a caller use
 * a named view as a server-side pool.
 */
describe("GitHubProjectRepository - view configuration", () => {
  const PROJECT_ID = "PVT_kwDOLhQ7gc4AOEbH";

  let repository: GitHubProjectRepository;
  let mockOctokit: Mocked<Octokit>;
  let config: GitHubConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOctokit = {
      graphql: vi.fn(),
    } as unknown as Mocked<Octokit>;

    (Octokit as MockedClass<typeof Octokit>).mockImplementation(() => mockOctokit);

    config = new GitHubConfig("test-owner", "test-repo", "test-token");
    repository = new GitHubProjectRepository(mockOctokit, config);
  });

  const viewNode = {
    id: "PVTV_1",
    name: "Claiming pool",
    layout: "TABLE_LAYOUT",
    filter: 'status:"In Progress"',
    groupByFields: {
      nodes: [{ id: "PVTF_1", name: "Status" }],
    },
    sortByFields: {
      nodes: [{ direction: "DESC", field: { id: "PVTF_2", name: "Priority" } }],
    },
    configuration: {
      visibleFields: {
        nodes: [
          { id: "PVTF_3", name: "Title" },
          { id: "PVTF_1", name: "Status" },
        ],
      },
    },
  };

  it("returns the filter, the group-by fields and the sort fields of a view", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({
      node: { views: { nodes: [viewNode] } },
    });

    const [view] = await repository.listViews(PROJECT_ID);

    expect(view).toEqual({
      id: "PVTV_1",
      name: "Claiming pool",
      layout: "table",
      fields: [],
      sortBy: [{ field: "Priority", direction: "DESC" }],
      groupByFields: ["Status"],
      filter: 'status:"In Progress"',
      visibleFields: ["Title", "Status"],
      filters: [],
    });
  });

  it("asks the API for the view configuration", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({ node: { views: { nodes: [] } } });

    await repository.listViews(PROJECT_ID);

    const query = mockOctokit.graphql.mock.calls[0][0] as string;
    expect(query).toContain("filter");
    expect(query).toContain("groupByFields");
    expect(query).toContain("sortByFields");
    expect(query).toContain("visibleFields");
    // The field configuration is a union: every member has to be covered.
    expect(query).toContain("... on ProjectV2SingleSelectField");
    expect(query).toContain("... on ProjectV2MultiSelectField");
    expect(query).toContain("... on ProjectV2IterationField");
  });

  it("reports a view without a filter as having no filter", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        views: {
          nodes: [
            {
              ...viewNode,
              filter: null,
              groupByFields: { nodes: [] },
              sortByFields: { nodes: [] },
            },
          ],
        },
      },
    });

    const [view] = await repository.listViews(PROJECT_ID);

    expect(view.filter).toBeNull();
    expect(view.groupByFields).toEqual([]);
    expect(view.sortBy).toEqual([]);
  });

  it("narrows the views down to the one with the given name", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        views: {
          nodes: [viewNode, { ...viewNode, id: "PVTV_2", name: "Other pool" }],
        },
      },
    });

    const views = await repository.listViews(PROJECT_ID, { name: "Other pool" });

    expect(views).toHaveLength(1);
    expect(views[0].id).toBe("PVTV_2");
  });

  it("narrows the views down to the one with the given id", async () => {
    mockOctokit.graphql.mockResolvedValueOnce({
      node: {
        views: {
          nodes: [viewNode, { ...viewNode, id: "PVTV_2", name: "Other pool" }],
        },
      },
    });

    const views = await repository.listViews(PROJECT_ID, { viewId: "PVTV_1" });

    expect(views).toHaveLength(1);
    expect(views[0].id).toBe("PVTV_1");
  });
});
