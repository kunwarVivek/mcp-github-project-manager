import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from "vitest";
import { DomainError } from "../../../domain/errors";
import { ResourceStatus } from "../../../domain/resource-types";
import type { Issue } from "../../../domain/types";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import { mapTimelineToHistory, SubIssueService } from "../../../services/SubIssueService";
import type { AsyncFn } from "../../helpers/mockTypes";

// Mock the factory
vi.mock("../../../infrastructure/github/GitHubRepositoryFactory");

describe("SubIssueService", () => {
  let service: SubIssueService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let mockIssueRepo: {
    findById: Mock<AsyncFn>;
    update: Mock<AsyncFn>;
    findAll: Mock<AsyncFn>;
  };
  let mockMilestoneRepo: {
    findById: Mock<AsyncFn>;
  };
  let mockSubIssueRepo: {
    getIssueNodeId: Mock<AsyncFn>;
    addSubIssue: Mock<AsyncFn>;
    listSubIssues: Mock<AsyncFn>;
    getParentIssue: Mock<AsyncFn>;
    reprioritizeSubIssue: Mock<AsyncFn>;
    removeSubIssue: Mock<AsyncFn>;
    getIssueTimeline: Mock<AsyncFn>;
  };

  const mockIssue: Issue = {
    id: "issue-1",
    number: 1,
    title: "Test Issue",
    description: "Test description",
    status: ResourceStatus.ACTIVE,
    labels: [],
    assignees: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
    url: "https://github.com/test/repo/issues/1",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repositories
    mockIssueRepo = {
      findById: vi.fn(),
      update: vi.fn(),
      findAll: vi.fn(),
    };

    mockMilestoneRepo = {
      findById: vi.fn(),
    };

    mockSubIssueRepo = {
      getIssueNodeId: vi.fn(),
      addSubIssue: vi.fn(),
      listSubIssues: vi.fn(),
      getParentIssue: vi.fn(),
      reprioritizeSubIssue: vi.fn(),
      removeSubIssue: vi.fn(),
      getIssueTimeline: vi.fn(),
    };

    // Create mock factory
    mockFactory = {
      createIssueRepository: vi.fn().mockReturnValue(mockIssueRepo),
      createMilestoneRepository: vi.fn().mockReturnValue(mockMilestoneRepo),
      createSubIssueRepository: vi.fn().mockReturnValue(mockSubIssueRepo),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    // Create service with mock factory
    service = new SubIssueService(mockFactory);
  });

  describe("updateIssueStatus", () => {
    it("should update issue status successfully", async () => {
      const updatedIssue = { ...mockIssue, status: ResourceStatus.CLOSED };
      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.updateIssueStatus("issue-1", ResourceStatus.CLOSED);

      expect(result.status).toBe(ResourceStatus.CLOSED);
      expect(mockIssueRepo.findById).toHaveBeenCalledWith("issue-1");
      expect(mockIssueRepo.update).toHaveBeenCalledWith("issue-1", {
        status: ResourceStatus.CLOSED,
      });
    });

    it("should throw error when issue not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateIssueStatus("non-existent", ResourceStatus.CLOSED)
      ).rejects.toThrow(DomainError);
    });
  });

  describe("addIssueDependency", () => {
    it("should add dependency label to issue", async () => {
      const dependentIssue = { ...mockIssue, id: "issue-2" };
      mockIssueRepo.findById.mockResolvedValueOnce(mockIssue).mockResolvedValueOnce(dependentIssue);
      mockIssueRepo.update.mockResolvedValue({ ...mockIssue, labels: ["depends-on:issue-2"] });

      await service.addIssueDependency("issue-1", "issue-2");

      expect(mockIssueRepo.update).toHaveBeenCalledWith("issue-1", {
        labels: ["depends-on:issue-2"],
      });
    });

    it("should not duplicate dependency label", async () => {
      const issueWithDependency = { ...mockIssue, labels: ["depends-on:issue-2"] };
      const dependentIssue = { ...mockIssue, id: "issue-2" };
      mockIssueRepo.findById
        .mockResolvedValueOnce(issueWithDependency)
        .mockResolvedValueOnce(dependentIssue);

      await service.addIssueDependency("issue-1", "issue-2");

      // Update should not be called since label already exists
      expect(mockIssueRepo.update).not.toHaveBeenCalled();
    });

    it("should throw error when source issue not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.addIssueDependency("non-existent", "issue-2")).rejects.toThrow(
        DomainError
      );
    });

    it("should throw error when dependency target not found", async () => {
      mockIssueRepo.findById.mockResolvedValueOnce(mockIssue).mockResolvedValueOnce(null);

      await expect(service.addIssueDependency("issue-1", "non-existent")).rejects.toThrow(
        DomainError
      );
    });
  });

  describe("getIssueDependencies", () => {
    it("should return dependency IDs from labels", async () => {
      const issueWithDeps = {
        ...mockIssue,
        labels: ["depends-on:issue-2", "bug", "depends-on:issue-3"],
      };
      mockIssueRepo.findById.mockResolvedValue(issueWithDeps);

      const result = await service.getIssueDependencies("issue-1");

      expect(result).toEqual(["issue-2", "issue-3"]);
    });

    it("should return empty array when no dependencies", async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);

      const result = await service.getIssueDependencies("issue-1");

      expect(result).toEqual([]);
    });

    it("should throw error when issue not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.getIssueDependencies("non-existent")).rejects.toThrow(DomainError);
    });
  });

  describe("assignIssueToMilestone", () => {
    it("should assign issue to milestone successfully", async () => {
      const mockMilestone = {
        id: "milestone-1",
        title: "v1.0",
        status: ResourceStatus.ACTIVE,
      };
      const updatedIssue = { ...mockIssue, milestoneId: "milestone-1" };

      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockMilestoneRepo.findById.mockResolvedValue(mockMilestone);
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.assignIssueToMilestone("issue-1", "milestone-1");

      expect(result.milestoneId).toBe("milestone-1");
      expect(mockIssueRepo.update).toHaveBeenCalledWith("issue-1", { milestoneId: "milestone-1" });
    });

    it("should throw error when issue not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.assignIssueToMilestone("non-existent", "milestone-1")).rejects.toThrow(
        DomainError
      );
    });

    it("should throw error when milestone not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockMilestoneRepo.findById.mockResolvedValue(null);

      await expect(service.assignIssueToMilestone("issue-1", "non-existent")).rejects.toThrow(
        DomainError
      );
    });
  });

  describe("getIssueHistory", () => {
    it("reads the timeline of the issue by number and maps it", async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);
      mockSubIssueRepo.getIssueTimeline.mockResolvedValue([
        {
          __typename: "ClosedEvent",
          id: "CE_1",
          createdAt: "2024-01-03T00:00:00Z",
          actor: { login: "octocat" },
          stateReason: "COMPLETED",
        },
      ]);

      const result = await service.getIssueHistory("issue-1");

      expect(mockSubIssueRepo.getIssueTimeline).toHaveBeenCalledWith(mockIssue.number);
      expect(result).toEqual([
        {
          id: "CE_1",
          action: "closed",
          timestamp: "2024-01-03T00:00:00Z",
          actor: "octocat",
          changes: { stateReason: "COMPLETED" },
        },
      ]);
    });

    it("should throw error when issue not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      await expect(service.getIssueHistory("non-existent")).rejects.toThrow(DomainError);
      expect(mockSubIssueRepo.getIssueTimeline).not.toHaveBeenCalled();
    });
  });

  describe("mapTimelineToHistory", () => {
    const base = { id: "N_1", createdAt: "2024-02-01T00:00:00Z", actor: { login: "alice" } };

    it.each([
      [{ __typename: "LabeledEvent", label: { name: "bug" } }, "labeled", { label: "bug" }],
      [{ __typename: "UnlabeledEvent", label: { name: "bug" } }, "unlabeled", { label: "bug" }],
      [
        { __typename: "AssignedEvent", assignee: { login: "bob" } },
        "assigned",
        { assignee: "bob" },
      ],
      [
        { __typename: "UnassignedEvent", assignee: { login: "bob" } },
        "unassigned",
        { assignee: "bob" },
      ],
      [
        { __typename: "ClosedEvent", stateReason: "NOT_PLANNED" },
        "closed",
        { stateReason: "NOT_PLANNED" },
      ],
      [{ __typename: "ReopenedEvent" }, "reopened", {}],
      [{ __typename: "MilestonedEvent", milestoneTitle: "v1" }, "milestoned", { milestone: "v1" }],
      [
        { __typename: "DemilestonedEvent", milestoneTitle: "v1" },
        "demilestoned",
        { milestone: "v1" },
      ],
      [
        { __typename: "RenamedTitleEvent", previousTitle: "a", currentTitle: "b" },
        "renamed",
        { title: { from: "a", to: "b" } },
      ],
      [
        { __typename: "AddedToProjectV2Event", project: { title: "Roadmap" } },
        "added_to_project",
        { project: "Roadmap" },
      ],
      [
        { __typename: "RemovedFromProjectV2Event", project: { title: "Roadmap" } },
        "removed_from_project",
        { project: "Roadmap" },
      ],
      [
        {
          __typename: "ProjectV2ItemStatusChangedEvent",
          project: { title: "Roadmap" },
          previousStatus: "Todo",
          status: "Done",
        },
        "project_status_changed",
        { project: "Roadmap", status: { from: "Todo", to: "Done" } },
      ],
      [
        {
          __typename: "CrossReferencedEvent",
          source: { __typename: "PullRequest", number: 7, title: "Fix", url: "http://pr" },
        },
        "cross_referenced",
        { source: { type: "PullRequest", number: 7, title: "Fix", url: "http://pr" } },
      ],
      [{ __typename: "IssueComment", url: "http://c" }, "commented", { url: "http://c" }],
      [
        { __typename: "SubIssueAddedEvent", subIssue: { number: 2, title: "Sub" } },
        "sub_issue_added",
        { subIssue: { number: 2, title: "Sub" } },
      ],
      [
        { __typename: "SubIssueRemovedEvent", subIssue: { number: 2, title: "Sub" } },
        "sub_issue_removed",
        { subIssue: { number: 2, title: "Sub" } },
      ],
      [
        { __typename: "ParentIssueAddedEvent", parent: { number: 1, title: "P" } },
        "parent_issue_added",
        { parent: { number: 1, title: "P" } },
      ],
      [
        { __typename: "ParentIssueRemovedEvent", parent: { number: 1, title: "P" } },
        "parent_issue_removed",
        { parent: { number: 1, title: "P" } },
      ],
    ])("maps %j", (partial, action, changes) => {
      const [entry] = mapTimelineToHistory([{ ...base, ...partial }]);
      expect(entry).toEqual({
        id: "N_1",
        action,
        timestamp: "2024-02-01T00:00:00Z",
        actor: "alice",
        changes,
      });
    });

    it("uses the comment author as actor and 'unknown' when there is none", () => {
      const [comment, ghost] = mapTimelineToHistory([
        { __typename: "IssueComment", id: "C_1", createdAt: "t", author: { login: "carol" } },
        { __typename: "ReopenedEvent", id: "R_1", createdAt: "t", actor: null },
      ]);
      expect(comment.actor).toBe("carol");
      expect(ghost.actor).toBe("unknown");
    });

    it("skips unknown event kinds without throwing", () => {
      expect(
        mapTimelineToHistory([
          { __typename: "SomeFutureEvent", id: "X", createdAt: "t" },
          { __typename: "ReopenedEvent", id: "R_1", createdAt: "t" },
        ])
      ).toHaveLength(1);
    });
  });

  describe("sub-issue hierarchy", () => {
    const subIssueResult = {
      issue: { id: "I_parent", title: "Parent" },
      subIssue: { id: "I_sub", number: 2, title: "Sub", state: "OPEN" as const, url: "http://u" },
    };

    beforeEach(() => {
      mockSubIssueRepo.getIssueNodeId.mockImplementation(async (n: unknown) => `I_${n}`);
    });

    it("addSubIssue resolves both numbers to node IDs and forwards replaceParent", async () => {
      mockSubIssueRepo.addSubIssue.mockResolvedValue(subIssueResult);

      const result = await service.addSubIssue(1, 2, true);

      expect(result).toBe(subIssueResult);
      expect(mockSubIssueRepo.addSubIssue).toHaveBeenCalledWith("I_1", "I_2", true);
    });

    it("addSubIssue defaults replaceParent to false", async () => {
      mockSubIssueRepo.addSubIssue.mockResolvedValue(subIssueResult);

      await service.addSubIssue(1, 2);

      expect(mockSubIssueRepo.addSubIssue).toHaveBeenCalledWith("I_1", "I_2", false);
    });

    it("listSubIssues forwards node ID, page size and cursor", async () => {
      mockSubIssueRepo.listSubIssues.mockResolvedValue({ subIssues: [] });

      await service.listSubIssues(7, 5, "cursor");
      await service.listSubIssues(7);

      expect(mockSubIssueRepo.listSubIssues).toHaveBeenNthCalledWith(1, "I_7", 5, "cursor");
      expect(mockSubIssueRepo.listSubIssues).toHaveBeenNthCalledWith(2, "I_7", 20, undefined);
    });

    it("getParentIssue returns null when there is no parent", async () => {
      mockSubIssueRepo.getParentIssue.mockResolvedValue(null);

      expect(await service.getParentIssue(3)).toBeNull();
      expect(mockSubIssueRepo.getParentIssue).toHaveBeenCalledWith("I_3");
    });

    it("reprioritizeSubIssue resolves the optional after-issue only when given", async () => {
      mockSubIssueRepo.reprioritizeSubIssue.mockResolvedValue(subIssueResult);

      await service.reprioritizeSubIssue(1, 2);
      await service.reprioritizeSubIssue(1, 2, 3);

      expect(mockSubIssueRepo.reprioritizeSubIssue).toHaveBeenNthCalledWith(
        1,
        "I_1",
        "I_2",
        undefined
      );
      expect(mockSubIssueRepo.reprioritizeSubIssue).toHaveBeenNthCalledWith(2, "I_1", "I_2", "I_3");
    });

    it("removeSubIssue unlinks using node IDs", async () => {
      mockSubIssueRepo.removeSubIssue.mockResolvedValue(undefined);

      await service.removeSubIssue(1, 2);

      expect(mockSubIssueRepo.removeSubIssue).toHaveBeenCalledWith("I_1", "I_2");
    });

    it("maps node ID resolution failures", async () => {
      mockSubIssueRepo.getIssueNodeId.mockRejectedValue(new Error("Issue #9 not found"));

      await expect(service.addSubIssue(9, 2)).rejects.toThrow();
      expect(mockSubIssueRepo.addSubIssue).not.toHaveBeenCalled();
    });
  });
});
