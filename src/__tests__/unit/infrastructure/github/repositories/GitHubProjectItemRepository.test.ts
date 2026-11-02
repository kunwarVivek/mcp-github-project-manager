import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectItemRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectItemRepository";
import type { OctokitInstance } from "../../../../../infrastructure/github/types";
import { partialFake } from "../../../../helpers/aiFakes";

describe("GitHubProjectItemRepository", () => {
  let graphql: Mock;
  let repository: GitHubProjectItemRepository;

  beforeEach(() => {
    graphql = vi.fn();
    repository = new GitHubProjectItemRepository(
      partialFake<OctokitInstance>({ graphql: graphql as never }),
      new GitHubConfig("configured-owner", "configured-repo", { kind: "pat", token: "test-token" })
    );
  });

  describe("resolveRepositoryId", () => {
    it("looks up the requested repository, not the configured one", async () => {
      graphql.mockResolvedValueOnce({ repository: { id: "R_kgDOTarget" } });

      const id = await repository.resolveRepositoryId("my-org", "my-repo");

      expect(id).toBe("R_kgDOTarget");
      expect(graphql).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ repoOwner: "my-org", repoName: "my-repo" })
      );
    });

    it("throws when the repository does not exist", async () => {
      graphql.mockResolvedValueOnce({ repository: null });

      await expect(repository.resolveRepositoryId("ghost", "repo")).rejects.toThrow(
        "Repository 'ghost/repo' not found"
      );
    });
  });

  describe("convertDraftIssue", () => {
    it("sends the item and repository ids and maps the converted issue", async () => {
      graphql.mockResolvedValueOnce({
        convertProjectV2DraftIssueItemToIssue: {
          item: {
            id: "PVTI_1",
            content: {
              id: "I_1",
              number: 42,
              title: "Converted",
              url: "https://github.com/my-org/my-repo/issues/42",
              repository: { nameWithOwner: "my-org/my-repo" },
            },
          },
        },
      });

      const result = await repository.convertDraftIssue("PVTI_draft", "R_1");

      expect(graphql).toHaveBeenCalledWith(
        expect.stringContaining("convertProjectV2DraftIssueItemToIssue"),
        expect.objectContaining({ input: { itemId: "PVTI_draft", repositoryId: "R_1" } })
      );
      expect(result).toEqual({
        itemId: "PVTI_1",
        issueId: "I_1",
        issueNumber: 42,
        title: "Converted",
        url: "https://github.com/my-org/my-repo/issues/42",
        repository: "my-org/my-repo",
      });
    });

    it("throws when the item did not become an issue", async () => {
      graphql.mockResolvedValueOnce({
        convertProjectV2DraftIssueItemToIssue: { item: { id: "PVTI_1", content: null } },
      });

      await expect(repository.convertDraftIssue("PVTI_1", "R_1")).rejects.toThrow(
        "was not converted to an issue"
      );
    });
  });

  describe("updateItemPosition", () => {
    it("omits afterId to move the item to the first position", async () => {
      graphql.mockResolvedValueOnce({ updateProjectV2ItemPosition: { items: { nodes: [] } } });

      await repository.updateItemPosition("PVT_1", "PVTI_1");

      const variables = graphql.mock.calls[0][1] as { input: Record<string, unknown> };
      expect(variables.input).toEqual({ projectId: "PVT_1", itemId: "PVTI_1" });
    });

    it("sends afterId when given", async () => {
      graphql.mockResolvedValueOnce({ updateProjectV2ItemPosition: { items: { nodes: [] } } });

      await repository.updateItemPosition("PVT_1", "PVTI_1", "PVTI_0");

      const variables = graphql.mock.calls[0][1] as { input: Record<string, unknown> };
      expect(variables.input).toEqual({ projectId: "PVT_1", itemId: "PVTI_1", afterId: "PVTI_0" });
    });
  });
});
