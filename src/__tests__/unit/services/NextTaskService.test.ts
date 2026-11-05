import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceStatus } from "../../../domain/resource-types";
import type { Issue, IssueDependency } from "../../../domain/types";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubIssueRepository } from "../../../infrastructure/github/repositories/GitHubIssueRepository";
import type {
  GitHubProjectSearchRepository,
  ProjectItemFieldValueNode,
  ProjectItemNode,
} from "../../../infrastructure/github/repositories/GitHubProjectSearchRepository";
import { NextTaskService } from "../../../services/NextTaskService";
import { partialFake } from "../../helpers/aiFakes";

const pageInfo = { hasNextPage: false, endCursor: null };

const select = (field: string, name: string): ProjectItemFieldValueNode => ({
  __typename: "ProjectV2ItemFieldSingleSelectValue",
  name,
  field: { name: field },
});
const num = (field: string, value: number): ProjectItemFieldValueNode => ({
  __typename: "ProjectV2ItemFieldNumberValue",
  number: value,
  field: { name: field },
});

function item(
  id: string,
  extra: {
    labels?: string[];
    assignees?: string[];
    state?: string;
    fields?: ProjectItemFieldValueNode[];
    type?: "Issue" | "DraftIssue";
  } = {}
): ProjectItemNode {
  return {
    id: `item_${id}`,
    content: {
      __typename: extra.type ?? "Issue",
      id: `issue_${id}`,
      title: `Title ${id}`,
      state: extra.state ?? "OPEN",
      labels: { nodes: (extra.labels ?? []).map((name) => ({ name })) },
      assignees: { nodes: (extra.assignees ?? []).map((login) => ({ login })) },
    },
    fieldValues: { nodes: extra.fields ?? [] },
  };
}

function blocker(number: number, state: string): IssueDependency {
  return {
    issueId: "x",
    issueNumber: 1,
    blockingIssueId: `b${number}`,
    blockingIssueNumber: number,
    state,
    source: "native",
  };
}

describe("NextTaskService", () => {
  const listProjectItems = vi.fn();
  const findAll = vi.fn();
  const findById = vi.fn();
  const listBlockers = vi.fn();
  let service: NextTaskService;

  beforeEach(() => {
    vi.resetAllMocks();
    listBlockers.mockResolvedValue([]);
    service = new NextTaskService(
      partialFake<GitHubRepositoryFactory>({
        createProjectSearchRepository: () =>
          partialFake<GitHubProjectSearchRepository>({ listProjectItems }),
        createIssueRepository: () =>
          partialFake<GitHubIssueRepository>({ findAll, findById, listBlockers }),
      })
    );
  });

  describe("project items", () => {
    it("ranks by priority, then complexity, then estimate, keeping board order last", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 5,
        pageInfo,
        items: [
          item("low", { fields: [select("Priority", "Low")] }),
          item("high-complex", {
            fields: [select("Priority", "High"), num("Complexity", 8)],
          }),
          item("high-simple", {
            fields: [select("Priority", "High"), num("Complexity", 2)],
          }),
          item("critical", { labels: ["priority: critical"] }),
          item("none"),
        ],
      });

      const result = await service.recommend({ projectId: "P1", limit: 10 });

      expect(result.source).toBe("project");
      expect(result.recommendations.map((r) => r.id)).toEqual([
        "issue_critical",
        "issue_high-simple",
        "issue_high-complex",
        "issue_low",
        "issue_none",
      ]);
      const top = result.recommendations[0];
      expect(top.priority).toBe("critical");
      expect(top.reason).toContain("critical priority");
      const simple = result.recommendations[1];
      expect(simple.complexity).toBe(2);
      expect(simple.reason).toContain("complexity 2/10");
    });

    it("omits complexity, hours and priority the project does not carry", async () => {
      listProjectItems.mockResolvedValue({ totalCount: 1, pageInfo, items: [item("a")] });

      const [task] = (await service.recommend({ projectId: "P1" })).recommendations;

      expect(task.complexity).toBeUndefined();
      expect(task.estimatedHours).toBeUndefined();
      expect(task.estimate).toBeUndefined();
      expect(task.priority).toBeUndefined();
    });

    it("reads hours from an Estimated Hours field and a plain Estimate separately", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 2,
        pageInfo,
        items: [
          item("hours", { fields: [num("Estimated Hours", 6)] }),
          item("points", { fields: [num("Estimate", 3)] }),
        ],
      });

      const result = await service.recommend({ projectId: "P1" });
      const byId = Object.fromEntries(result.recommendations.map((r) => [r.id, r]));

      expect(byId.issue_hours.estimatedHours).toBe(6);
      expect(byId.issue_points.estimatedHours).toBeUndefined();
      expect(byId.issue_points.estimate).toBe(3);
    });

    it("excludes closed items, finished statuses and draft issues", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 4,
        pageInfo,
        items: [
          item("open"),
          item("closed", { state: "CLOSED" }),
          item("done", { fields: [select("Status", "Done")] }),
          item("draft", { type: "DraftIssue" }),
        ],
      });

      const result = await service.recommend({ projectId: "P1" });

      expect(result.recommendations.map((r) => r.id)).toEqual(["issue_open"]);
    });

    it("skips items blocked by an open issue but not by closed ones", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 3,
        pageInfo,
        items: [
          item("blocked", { fields: [select("Priority", "High")] }),
          item("unblocked-by-closed", { fields: [select("Priority", "Medium")] }),
          item("free"),
        ],
      });
      listBlockers.mockImplementation(async (id: string) => {
        if (id === "issue_blocked") return [blocker(7, "OPEN")];
        if (id === "issue_unblocked-by-closed") return [blocker(8, "CLOSED")];
        return [];
      });

      const result = await service.recommend({ projectId: "P1" });

      expect(result.recommendations.map((r) => r.id)).toEqual([
        "issue_unblocked-by-closed",
        "issue_free",
      ]);
      expect(result.blockedCount).toBe(1);
      expect(result.recommendations[0].dependencies).toEqual([8]);
    });

    it("keeps blocked items and names the blockers when excludeBlocked is false", async () => {
      listProjectItems.mockResolvedValue({ totalCount: 1, pageInfo, items: [item("blocked")] });
      listBlockers.mockResolvedValue([blocker(7, "OPEN")]);

      const result = await service.recommend({ projectId: "P1", excludeBlocked: false });

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].reason).toContain("blocked by open issue(s) #7");
      expect(result.blockedCount).toBe(0);
    });

    it("resolves the state of a label-emulated blocker", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 2,
        pageInfo,
        items: [item("a"), item("b")],
      });
      listBlockers.mockImplementation(async (id: string) => [
        {
          issueId: "x",
          issueNumber: 1,
          blockingIssueId: null,
          blockingIssueNumber: id === "issue_a" ? 5 : 6,
          source: "label",
        } satisfies IssueDependency,
      ]);
      findById.mockImplementation(async (id: string) =>
        id === "5" ? { status: ResourceStatus.CLOSED } : { status: ResourceStatus.ACTIVE }
      );

      const result = await service.recommend({ projectId: "P1" });

      expect(result.recommendations.map((r) => r.id)).toEqual(["issue_a"]);
    });

    it("applies the assignee, feature, skill, phase and complexity filters", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 4,
        pageInfo,
        items: [
          item("mine-feat", {
            assignees: ["alice"],
            labels: ["feature:auth", "typescript"],
            fields: [num("Complexity", 3), select("Status", "In Progress")],
          }),
          item("mine-too-complex", {
            assignees: ["alice"],
            labels: ["feature:auth"],
            fields: [num("Complexity", 9)],
          }),
          item("other-user", { assignees: ["bob"], labels: ["feature:auth"] }),
          item("mine-other-feature", { assignees: ["alice"], labels: ["feature:billing"] }),
        ],
      });

      const result = await service.recommend({
        projectId: "P1",
        assignee: "alice",
        featureId: "auth",
        maxComplexity: 5,
        currentPhase: "development",
        teamSkills: ["TypeScript"],
      });

      expect(result.recommendations.map((r) => r.id)).toEqual(["issue_mine-feat"]);
      expect(result.recommendations[0].reason).toContain("matches team skills (typescript)");
    });

    it("ranks a team-skill match above a non-match of the same priority", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 2,
        pageInfo,
        items: [item("plain"), item("skilled", { labels: ["react"] })],
      });

      const result = await service.recommend({ projectId: "P1", teamSkills: ["react"] });

      expect(result.recommendations.map((r) => r.id)).toEqual(["issue_skilled", "issue_plain"]);
    });

    it("honours the limit while still skipping blocked items", async () => {
      listProjectItems.mockResolvedValue({
        totalCount: 3,
        pageInfo,
        items: [item("a"), item("b"), item("c")],
      });
      listBlockers.mockImplementation(async (id: string) =>
        id === "issue_a" ? [blocker(1, "OPEN")] : []
      );

      const result = await service.recommend({ projectId: "P1", limit: 1 });

      expect(result.recommendations.map((r) => r.id)).toEqual(["issue_b"]);
    });

    it("returns no recommendations for an empty project", async () => {
      listProjectItems.mockResolvedValue({ totalCount: 0, pageInfo, items: [] });

      const result = await service.recommend({ projectId: "P1" });

      expect(result).toEqual({
        recommendations: [],
        candidateCount: 0,
        blockedCount: 0,
        source: "project",
      });
    });

    it("pages through every item page", async () => {
      listProjectItems
        .mockResolvedValueOnce({
          totalCount: 2,
          pageInfo: { hasNextPage: true, endCursor: "c1" },
          items: [item("a")],
        })
        .mockResolvedValueOnce({ totalCount: 2, pageInfo, items: [item("b")] });

      const result = await service.recommend({ projectId: "P1" });

      expect(result.recommendations).toHaveLength(2);
      expect(listProjectItems).toHaveBeenLastCalledWith("P1", 100, "c1");
    });
  });

  describe("repository issues", () => {
    const issue = (n: number, extra: Partial<Issue> = {}): Issue => ({
      id: `I_${n}`,
      number: n,
      title: `Issue ${n}`,
      description: `Body ${n}`,
      status: ResourceStatus.ACTIVE,
      assignees: [],
      labels: [],
      createdAt: `2026-01-0${n}T00:00:00Z`,
      updatedAt: `2026-01-0${n}T00:00:00Z`,
      url: "u",
      ...extra,
    });

    it("uses the repository issues without a project, oldest first among equals", async () => {
      findAll.mockResolvedValue([
        issue(3),
        issue(1),
        issue(2, { status: ResourceStatus.CLOSED }),
        issue(4, { labels: ["priority:high"] }),
      ]);

      const result = await service.recommend({});

      expect(result.source).toBe("repository");
      expect(listProjectItems).not.toHaveBeenCalled();
      expect(result.recommendations.map((r) => r.id)).toEqual(["I_4", "I_1", "I_3"]);
      expect(result.recommendations[0].description).toBe("Body 4");
    });

    it("returns no recommendations for a repository without issues", async () => {
      findAll.mockResolvedValue([]);

      const result = await service.recommend({});

      expect(result.recommendations).toEqual([]);
      expect(result.candidateCount).toBe(0);
    });
  });
});
