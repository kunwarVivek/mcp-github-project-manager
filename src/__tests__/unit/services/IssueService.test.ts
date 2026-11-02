import { beforeEach, describe, expect, it, type Mocked, vi } from "vitest";
import { ResourceStatus } from "../../../domain/resource-types";
import type { Issue } from "../../../domain/types";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubDraftIssueRepository } from "../../../infrastructure/github/repositories/GitHubDraftIssueRepository";
import type { GitHubIssueCommentRepository } from "../../../infrastructure/github/repositories/GitHubIssueCommentRepository";
import type { GitHubIssueRepository } from "../../../infrastructure/github/repositories/GitHubIssueRepository";
import { IssueService } from "../../../services/IssueService";

// Mock tsyringe decorators
vi.mock("tsyringe", () => ({
  injectable:
    () =>
    <T>(target: T) =>
      target,
  inject: () => () => undefined,
}));

describe("IssueService", () => {
  let service: IssueService;
  let mockFactory: Mocked<GitHubRepositoryFactory>;
  let mockIssueRepo: Mocked<GitHubIssueRepository>;
  let mockCommentRepo: Mocked<GitHubIssueCommentRepository>;
  let mockDraftRepo: Mocked<GitHubDraftIssueRepository>;

  const mockIssue: Issue = {
    id: "issue-1",
    number: 1,
    title: "Test Issue",
    description: "Test description",
    status: ResourceStatus.ACTIVE,
    labels: ["bug", "priority:high"],
    assignees: ["user1"],
    milestoneId: "milestone-1",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    url: "https://github.com/test-owner/test-repo/issues/1",
  };

  const mockClosedIssue: Issue = {
    ...mockIssue,
    id: "issue-2",
    number: 2,
    title: "Closed Issue",
    status: ResourceStatus.CLOSED,
    url: "https://github.com/test-owner/test-repo/issues/2",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repositories
    mockIssueRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByMilestone: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<GitHubIssueRepository>;

    mockCommentRepo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    } as unknown as Mocked<GitHubIssueCommentRepository>;

    mockDraftRepo = {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as Mocked<GitHubDraftIssueRepository>;

    mockFactory = {
      createIssueRepository: vi.fn().mockReturnValue(mockIssueRepo),
      createIssueCommentRepository: vi.fn().mockReturnValue(mockCommentRepo),
      createDraftIssueRepository: vi.fn().mockReturnValue(mockDraftRepo),
    } as unknown as Mocked<GitHubRepositoryFactory>;

    service = new IssueService(mockFactory);
  });

  describe("createIssue", () => {
    it("should create an issue and return plain Issue object", async () => {
      mockIssueRepo.create.mockResolvedValue(mockIssue);

      const result = await service.createIssue({
        title: "Test Issue",
        description: "Test description",
        labels: ["bug"],
        priority: "high",
      });

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(mockIssue);
      expect(mockIssueRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test Issue",
          labels: ["bug", "priority:high"],
        })
      );
    });

    it("should create an issue without optional fields", async () => {
      const simpleIssue: Issue = {
        ...mockIssue,
        labels: [],
        assignees: [],
        milestoneId: undefined,
      };
      mockIssueRepo.create.mockResolvedValue(simpleIssue);

      const result = await service.createIssue({
        title: "Simple Issue",
        description: "Simple description",
      });

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(simpleIssue);
      expect(result.labels).toEqual([]);
    });
  });

  describe("listIssues", () => {
    it("should return plain Issue array", async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ status: "all" });

      expect(result).toHaveLength(2);
      // Services now return plain objects for MCP compatibility
      expect(result[0]).toEqual(mockIssue);
      expect(result[1]).toEqual(mockClosedIssue);
    });

    it("should filter by status", async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const openIssues = await service.listIssues({ status: "open" });
      expect(openIssues).toHaveLength(1);
      expect(openIssues[0].status).toBe(ResourceStatus.ACTIVE);

      const closedIssues = await service.listIssues({ status: "closed" });
      expect(closedIssues).toHaveLength(1);
      expect(closedIssues[0].status).toBe(ResourceStatus.CLOSED);
    });

    it("should filter by labels", async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ labels: ["bug"] });
      expect(result).toHaveLength(1);
      expect(result[0].labels).toContain("bug");
    });

    it("should filter by assignee", async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ assignee: "user1" });
      expect(result).toHaveLength(1);
      expect(result[0].assignees).toContain("user1");
    });

    it("should limit results", async () => {
      mockIssueRepo.findAll.mockResolvedValue([mockIssue, mockClosedIssue]);

      const result = await service.listIssues({ limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe("getIssue", () => {
    it("should return plain Issue object when found", async () => {
      mockIssueRepo.findById.mockResolvedValue(mockIssue);

      const result = await service.getIssue("issue-1");

      // Services now return plain objects for MCP compatibility
      expect(result).toEqual(mockIssue);
    });

    it("should return null when not found", async () => {
      mockIssueRepo.findById.mockResolvedValue(null);

      const result = await service.getIssue("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("updateIssue", () => {
    it("should update issue and return plain Issue object", async () => {
      const updatedIssue: Issue = {
        ...mockIssue,
        title: "Updated Issue",
      };
      mockIssueRepo.update.mockResolvedValue(updatedIssue);

      const result = await service.updateIssue("issue-1", {
        title: "Updated Issue",
      });

      // Services now return plain objects for MCP compatibility
      expect(result.title).toBe("Updated Issue");
      expect(result).toEqual(updatedIssue);
    });

    it("should handle status updates", async () => {
      mockIssueRepo.update.mockResolvedValue(mockClosedIssue);

      const result = await service.updateIssue("issue-1", {
        status: "closed",
      });

      expect(result.status).toBe(ResourceStatus.CLOSED);
    });

    it("should handle milestone removal", async () => {
      const issueWithoutMilestone: Issue = {
        ...mockIssue,
        milestoneId: undefined,
      };
      mockIssueRepo.update.mockResolvedValue(issueWithoutMilestone);

      const result = await service.updateIssue("issue-1", {
        milestoneId: null,
      });

      expect(result.milestoneId).toBeUndefined();
    });
  });

  describe("issue comments", () => {
    const comment = {
      id: 1,
      body: "Test comment",
      user: "user1",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };

    it("creates, updates and lists comments through the repository", async () => {
      mockCommentRepo.create.mockResolvedValue(comment);
      mockCommentRepo.update.mockResolvedValue(comment);
      mockCommentRepo.list.mockResolvedValue([comment]);

      expect(await service.createIssueComment({ issueNumber: 1, body: "Test comment" })).toEqual(
        comment
      );
      expect(mockCommentRepo.create).toHaveBeenCalledWith(1, "Test comment");

      expect(await service.updateIssueComment({ commentId: 1, body: "Test comment" })).toEqual(
        comment
      );
      expect(mockCommentRepo.update).toHaveBeenCalledWith(1, "Test comment");

      expect(await service.listIssueComments({ issueNumber: 1 })).toEqual([comment]);
      expect(mockCommentRepo.list).toHaveBeenLastCalledWith(1, 30);
      await service.listIssueComments({ issueNumber: 1, limit: 10 });
      expect(mockCommentRepo.list).toHaveBeenLastCalledWith(1, 10);
    });

    it("confirms comment deletion", async () => {
      mockCommentRepo.delete.mockResolvedValue();

      expect(await service.deleteIssueComment({ commentId: 4 })).toEqual({
        success: true,
        message: "Comment 4 deleted successfully",
      });
      expect(mockCommentRepo.delete).toHaveBeenCalledWith(4);
    });
  });

  describe("Draft Issues", () => {
    const draft = { id: "draft-1", title: "Draft Issue", body: "Draft body" };

    it("creates and updates a draft issue through the repository", async () => {
      mockDraftRepo.create.mockResolvedValue(draft);
      mockDraftRepo.update.mockResolvedValue(draft);

      const createData = { projectId: "project-1", title: "Draft Issue", body: "Draft body" };
      expect(await service.createDraftIssue(createData)).toEqual(draft);
      expect(mockDraftRepo.create).toHaveBeenCalledWith(createData);

      const updateData = { draftIssueId: "draft-1", title: "Draft Issue" };
      expect(await service.updateDraftIssue(updateData)).toEqual(draft);
      expect(mockDraftRepo.update).toHaveBeenCalledWith(updateData);
    });

    it("confirms draft issue deletion", async () => {
      mockDraftRepo.delete.mockResolvedValue();

      expect(await service.deleteDraftIssue({ draftIssueId: "draft-1" })).toEqual({
        success: true,
        message: "Draft issue draft-1 deleted successfully",
      });
      expect(mockDraftRepo.delete).toHaveBeenCalledWith("draft-1");
    });
  });
});
