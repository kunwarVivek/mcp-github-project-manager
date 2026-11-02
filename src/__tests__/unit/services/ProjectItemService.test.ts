import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectItemRepository } from "../../../infrastructure/github/repositories/GitHubProjectItemRepository";
import { ProjectItemService } from "../../../services/ProjectItemService";
import { partialFake } from "../../helpers/aiFakes";

describe("ProjectItemService", () => {
  const resolveRepositoryId = vi.fn();
  const convertDraftIssue = vi.fn();
  const updateItemPosition = vi.fn();
  let service: ProjectItemService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new ProjectItemService(
      partialFake<GitHubRepositoryFactory>({
        createProjectItemRepository: () =>
          partialFake<GitHubProjectItemRepository>({
            resolveRepositoryId,
            convertDraftIssue,
            updateItemPosition,
          }),
      })
    );
  });

  describe("convertDraftIssue", () => {
    it("converts into the repository resolved from owner/name", async () => {
      resolveRepositoryId.mockResolvedValue("R_1");
      const converted = {
        itemId: "PVTI_1",
        issueId: "I_1",
        issueNumber: 5,
        title: "T",
        url: "u",
        repository: "my-org/my-repo",
      };
      convertDraftIssue.mockResolvedValue(converted);

      const result = await service.convertDraftIssue({
        itemId: "PVTI_draft",
        owner: "my-org",
        repo: "my-repo",
      });

      expect(resolveRepositoryId).toHaveBeenCalledWith("my-org", "my-repo");
      expect(convertDraftIssue).toHaveBeenCalledWith("PVTI_draft", "R_1");
      expect(result).toBe(converted);
    });

    it("does not convert when the repository cannot be resolved", async () => {
      resolveRepositoryId.mockRejectedValue(new Error("Repository 'a/b' not found"));

      await expect(
        service.convertDraftIssue({ itemId: "PVTI_draft", owner: "a", repo: "b" })
      ).rejects.toThrow("not found");
      expect(convertDraftIssue).not.toHaveBeenCalled();
    });
  });

  describe("updateItemPosition", () => {
    it("reports the first position when there is no afterId", async () => {
      updateItemPosition.mockResolvedValue(undefined);

      const result = await service.updateItemPosition({ projectId: "PVT_1", itemId: "PVTI_1" });

      expect(updateItemPosition).toHaveBeenCalledWith("PVT_1", "PVTI_1", undefined);
      expect(result).toEqual({ success: true, itemId: "PVTI_1", position: "first" });
    });

    it("reports the item it was placed after", async () => {
      updateItemPosition.mockResolvedValue(undefined);

      const result = await service.updateItemPosition({
        projectId: "PVT_1",
        itemId: "PVTI_1",
        afterId: "PVTI_0",
      });

      expect(updateItemPosition).toHaveBeenCalledWith("PVT_1", "PVTI_1", "PVTI_0");
      expect(result.position).toBe("after PVTI_0");
    });
  });
});
