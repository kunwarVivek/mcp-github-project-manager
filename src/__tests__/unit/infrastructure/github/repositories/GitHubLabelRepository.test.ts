import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubLabelRepository } from "../../../../../infrastructure/github/repositories/GitHubLabelRepository";
import { asOctokit, type RestCallFn } from "../../../../helpers/mockTypes";

describe("GitHubLabelRepository", () => {
  let repository: GitHubLabelRepository;
  let issues: Record<"createLabel" | "listLabelsForRepo", Mock<RestCallFn>>;

  beforeEach(() => {
    issues = {
      createLabel: vi.fn<RestCallFn>(),
      listLabelsForRepo: vi.fn<RestCallFn>(),
    };
    repository = new GitHubLabelRepository(
      asOctokit({ rest: { issues } }),
      new GitHubConfig("testOwner", "testRepo")
    );
  });

  describe("create", () => {
    it("creates a label with all fields", async () => {
      issues.createLabel.mockResolvedValueOnce({
        data: { id: 1, name: "bug", color: "ff0000", description: "Bug reports" },
      });

      const result = await repository.create({
        name: "bug",
        color: "#ff0000",
        description: "Bug reports",
      });

      expect(result).toEqual({ id: 1, name: "bug", color: "ff0000", description: "Bug reports" });
      expect(issues.createLabel).toHaveBeenCalledWith({
        owner: "testOwner",
        repo: "testRepo",
        name: "bug",
        color: "ff0000",
        description: "Bug reports",
      });
    });

    it("defaults the color and description", async () => {
      issues.createLabel.mockResolvedValueOnce({
        data: { id: 3, name: "chore", color: "ededed", description: null },
      });

      const result = await repository.create({ name: "chore" });

      expect(result.description).toBe("");
      expect(issues.createLabel).toHaveBeenCalledWith(
        expect.objectContaining({ color: "ededed", description: "" })
      );
    });

    it("rejects on API failure", async () => {
      issues.createLabel.mockRejectedValueOnce(new Error("Label already exists"));

      await expect(repository.create({ name: "duplicate" })).rejects.toThrow();
    });
  });

  describe("list", () => {
    it("lists labels with the default page size and normalizes null descriptions", async () => {
      issues.listLabelsForRepo.mockResolvedValueOnce({
        data: [
          { id: 1, name: "bug", color: "ff0000", description: "Bug reports" },
          { id: 2, name: "feature", color: "00ff00", description: null },
        ],
      });

      const result = await repository.list();

      expect(result).toEqual([
        { id: 1, name: "bug", color: "ff0000", description: "Bug reports" },
        { id: 2, name: "feature", color: "00ff00", description: "" },
      ]);
      expect(issues.listLabelsForRepo).toHaveBeenCalledWith({
        owner: "testOwner",
        repo: "testRepo",
        per_page: 100,
      });
    });

    it("honors a custom limit", async () => {
      issues.listLabelsForRepo.mockResolvedValueOnce({ data: [] });

      await repository.list(10);

      expect(issues.listLabelsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ per_page: 10 })
      );
    });
  });
});
