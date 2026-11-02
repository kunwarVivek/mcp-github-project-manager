import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ResourceType } from "../../../domain/resource-types";
import { ProjectLinkingService } from "../../../services/ProjectLinkingService";
import { type AsyncFn, asFactory } from "../../helpers/mockTypes";

type LinkingRepoMethod =
  | "addItem"
  | "removeItem"
  | "archiveItem"
  | "unarchiveItem"
  | "listItems"
  | "linkRepository"
  | "unlinkRepository"
  | "linkTeam"
  | "unlinkTeam"
  | "listRepositories"
  | "listTeams";

describe("ProjectLinkingService", () => {
  let service: ProjectLinkingService;
  let repo: Record<LinkingRepoMethod, Mock<AsyncFn>>;

  beforeEach(() => {
    vi.clearAllMocks();

    repo = {
      addItem: vi.fn(),
      removeItem: vi.fn(),
      archiveItem: vi.fn(),
      unarchiveItem: vi.fn(),
      listItems: vi.fn(),
      linkRepository: vi.fn(),
      unlinkRepository: vi.fn(),
      linkTeam: vi.fn(),
      unlinkTeam: vi.fn(),
      listRepositories: vi.fn(),
      listTeams: vi.fn(),
    };

    service = new ProjectLinkingService(
      asFactory({ createProjectLinkingRepository: vi.fn().mockReturnValue(repo) })
    );
  });

  describe("addProjectItem", () => {
    it("builds an issue ProjectItem from the repository result", async () => {
      repo.addItem.mockResolvedValueOnce({ itemId: "ITEM_123", contentId: "ISSUE_456" });

      const result = await service.addProjectItem({
        projectId: "PROJECT_123",
        contentId: "ISSUE_456",
        contentType: "issue",
      });

      expect(repo.addItem).toHaveBeenCalledWith("PROJECT_123", "ISSUE_456");
      expect(result).toEqual(
        expect.objectContaining({
          id: "ITEM_123",
          contentId: "ISSUE_456",
          contentType: ResourceType.ISSUE,
          projectId: "PROJECT_123",
          fieldValues: {},
        })
      );
    });

    it("marks pull request content as a pull request", async () => {
      repo.addItem.mockResolvedValueOnce({ itemId: "ITEM_789", contentId: "PR_101" });

      const result = await service.addProjectItem({
        projectId: "PROJECT_123",
        contentId: "PR_101",
        contentType: "pull_request",
      });

      expect(result.contentType).toBe(ResourceType.PULL_REQUEST);
    });

    it("maps repository errors", async () => {
      repo.addItem.mockRejectedValueOnce(new Error("Content not found"));

      await expect(
        service.addProjectItem({
          projectId: "PROJECT_123",
          contentId: "NONEXISTENT",
          contentType: "issue",
        })
      ).rejects.toThrow("Content not found");
    });
  });

  describe("item removal and archiving", () => {
    it("removes an item", async () => {
      const result = await service.removeProjectItem({
        projectId: "PROJECT_123",
        itemId: "ITEM_123",
      });

      expect(repo.removeItem).toHaveBeenCalledWith("PROJECT_123", "ITEM_123");
      expect(result).toEqual({
        success: true,
        message: "Item ITEM_123 has been removed from project PROJECT_123",
      });
    });

    it("archives an item", async () => {
      const result = await service.archiveProjectItem({
        projectId: "PROJECT_123",
        itemId: "ITEM_123",
      });

      expect(repo.archiveItem).toHaveBeenCalledWith("PROJECT_123", "ITEM_123");
      expect(result).toEqual({
        success: true,
        message: "Item ITEM_123 has been archived in project PROJECT_123",
      });
    });

    it("unarchives an item", async () => {
      const result = await service.unarchiveProjectItem({
        projectId: "PROJECT_123",
        itemId: "ITEM_123",
      });

      expect(repo.unarchiveItem).toHaveBeenCalledWith("PROJECT_123", "ITEM_123");
      expect(result).toEqual({
        success: true,
        message: "Item ITEM_123 has been unarchived in project PROJECT_123",
      });
    });

    it("maps errors from the repository", async () => {
      repo.removeItem.mockRejectedValueOnce(new Error("Item not found"));

      await expect(
        service.removeProjectItem({ projectId: "PROJECT_123", itemId: "NONEXISTENT" })
      ).rejects.toThrow("Item not found");
    });
  });

  describe("listProjectItems", () => {
    it("defaults the limit to 50", async () => {
      repo.listItems.mockResolvedValueOnce([]);

      await service.listProjectItems({ projectId: "PROJECT_123" });

      expect(repo.listItems).toHaveBeenCalledWith("PROJECT_123", 50);
    });

    it("passes an explicit limit and returns the repository items", async () => {
      const items = [{ id: "ITEM_1" }];
      repo.listItems.mockResolvedValueOnce(items);

      const result = await service.listProjectItems({ projectId: "PROJECT_123", limit: 10 });

      expect(repo.listItems).toHaveBeenCalledWith("PROJECT_123", 10);
      expect(result).toBe(items);
    });
  });

  describe("repository and team links", () => {
    it("links a repository", async () => {
      const linked = { id: "R_1", name: "hello-world" };
      repo.linkRepository.mockResolvedValueOnce(linked);

      const result = await service.linkProjectToRepository({
        projectId: "PVT_1",
        owner: "octocat",
        repo: "hello-world",
      });

      expect(repo.linkRepository).toHaveBeenCalledWith("PVT_1", "octocat", "hello-world");
      expect(result).toBe(linked);
    });

    it("reports the unlinked repository in the message", async () => {
      const result = await service.unlinkProjectFromRepository({
        projectId: "PVT_1",
        owner: "octocat",
        repo: "hello-world",
      });

      expect(repo.unlinkRepository).toHaveBeenCalledWith("PVT_1", "octocat", "hello-world");
      expect(result).toEqual({
        success: true,
        message: "Successfully unlinked repository octocat/hello-world from project",
      });
    });

    it("links a team", async () => {
      const linked = { id: "T_1", slug: "engineering" };
      repo.linkTeam.mockResolvedValueOnce(linked);

      const result = await service.linkProjectToTeam({
        projectId: "PVT_1",
        org: "octocat-org",
        teamSlug: "engineering",
      });

      expect(repo.linkTeam).toHaveBeenCalledWith("PVT_1", "octocat-org", "engineering");
      expect(result).toBe(linked);
    });

    it("reports the unlinked team in the message", async () => {
      const result = await service.unlinkProjectFromTeam({
        projectId: "PVT_1",
        org: "octocat-org",
        teamSlug: "engineering",
      });

      expect(repo.unlinkTeam).toHaveBeenCalledWith("PVT_1", "octocat-org", "engineering");
      expect(result).toEqual({
        success: true,
        message: "Successfully unlinked team engineering from project",
      });
    });

    it("lists linked repositories with a default page size of 20", async () => {
      await service.listLinkedRepositories({ projectId: "PVT_1" });

      expect(repo.listRepositories).toHaveBeenCalledWith({
        projectId: "PVT_1",
        first: 20,
        after: undefined,
      });
    });

    it("lists linked teams with the given pagination", async () => {
      await service.listLinkedTeams({ projectId: "PVT_1", first: 5, after: "cursor" });

      expect(repo.listTeams).toHaveBeenCalledWith({
        projectId: "PVT_1",
        first: 5,
        after: "cursor",
      });
    });
  });
});
