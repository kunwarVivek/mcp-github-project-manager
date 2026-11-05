import { vi } from "vitest";

/**
 * Unit tests for GitHubProjectTemplateRepository (mocked GraphQL)
 *
 * Tests README access and template operations.
 */

import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import { GitHubProjectTemplateRepository } from "../../../../../infrastructure/github/repositories/GitHubProjectTemplateRepository";
import { octokitWithGraphql } from "../../../../helpers/aiFakes";

const mockGraphql = vi.fn();
const mockOctokit = octokitWithGraphql(mockGraphql);
const mockConfig = new GitHubConfig("test-owner", "test-repo");

describe("GitHubProjectTemplateRepository", () => {
  let repository: GitHubProjectTemplateRepository;

  beforeEach(() => {
    vi.resetAllMocks();
    repository = new GitHubProjectTemplateRepository(mockOctokit, mockConfig);
  });

  describe("README", () => {
    it("returns the README text", async () => {
      mockGraphql.mockResolvedValueOnce({ node: { readme: "# Hello" } });

      expect(await repository.getReadme("PROJECT_123")).toBe("# Hello");
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("query($projectId: ID!)"),
        expect.objectContaining({ projectId: "PROJECT_123" })
      );
    });

    it("returns an empty string for a null README or missing project", async () => {
      mockGraphql.mockResolvedValueOnce({ node: { readme: null } });
      expect(await repository.getReadme("PROJECT_123")).toBe("");

      mockGraphql.mockResolvedValueOnce({ node: null });
      expect(await repository.getReadme("MISSING")).toBe("");
    });

    it("sends the update mutation", async () => {
      mockGraphql.mockResolvedValueOnce({
        updateProjectV2: { projectV2: { id: "PROJECT_123", readme: "# Updated" } },
      });

      await repository.updateReadme("PROJECT_123", "# Updated");

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: UpdateProjectV2Input!)"),
        expect.objectContaining({ input: { projectId: "PROJECT_123", readme: "# Updated" } })
      );
    });
  });

  describe("mark / unmark", () => {
    it("marks a project as a template", async () => {
      mockGraphql.mockResolvedValueOnce({
        markProjectV2AsTemplate: {
          projectV2: { id: "PVT_1", title: "Tpl", url: "https://github.com/orgs/o/projects/1" },
        },
      });

      const result = await repository.markAsTemplate("PVT_1");

      expect(result).toEqual({
        id: "PVT_1",
        title: "Tpl",
        url: "https://github.com/orgs/o/projects/1",
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("markProjectV2AsTemplate"),
        expect.objectContaining({ input: { projectId: "PVT_1" } })
      );
    });

    it("unmarks a project as a template", async () => {
      mockGraphql.mockResolvedValueOnce({
        unmarkProjectV2AsTemplate: {
          projectV2: { id: "PVT_1", title: "Proj", url: "https://github.com/orgs/o/projects/1" },
        },
      });

      const result = await repository.unmarkAsTemplate("PVT_1");

      expect(result.title).toBe("Proj");
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("unmarkProjectV2AsTemplate"),
        expect.objectContaining({ input: { projectId: "PVT_1" } })
      );
    });
  });

  describe("copyFromTemplate", () => {
    it("resolves the target org ID, then copies", async () => {
      mockGraphql.mockResolvedValueOnce({ organization: { id: "O_org1" } }).mockResolvedValueOnce({
        copyProjectV2: {
          projectV2: {
            id: "PVT_new",
            title: "Q1 Board",
            number: 7,
            url: "https://github.com/orgs/o/projects/7",
            createdAt: "2025-01-01T00:00:00Z",
          },
        },
      });

      const result = await repository.copyFromTemplate({
        projectId: "PVT_tpl",
        targetOwner: "my-org",
        title: "Q1 Board",
        includeDraftIssues: true,
      });

      expect(mockGraphql).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("ResolveOrganizationId"),
        expect.objectContaining({ login: "my-org" })
      );
      expect(mockGraphql).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("copyProjectV2"),
        expect.objectContaining({
          input: {
            projectId: "PVT_tpl",
            ownerId: "O_org1",
            title: "Q1 Board",
            includeDraftIssues: true,
          },
        })
      );
      expect(result).toEqual({
        id: "PVT_new",
        title: "Q1 Board",
        number: 7,
        url: "https://github.com/orgs/o/projects/7",
        createdAt: "2025-01-01T00:00:00Z",
      });
    });

    it("throws when the target organization does not exist", async () => {
      mockGraphql.mockResolvedValueOnce({ organization: null });

      await expect(
        repository.copyFromTemplate({
          projectId: "PVT_tpl",
          targetOwner: "ghost",
          title: "x",
          includeDraftIssues: false,
        })
      ).rejects.toThrow("Organization 'ghost' not found");
    });
  });

  describe("listOrganizationTemplates", () => {
    const node = (id: string, template: boolean) => ({
      id,
      title: `Project ${id}`,
      number: 1,
      shortDescription: null,
      url: `https://github.com/orgs/o/projects/${id}`,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-02T00:00:00Z",
      template,
    });

    it("keeps only template projects and passes pagination through", async () => {
      mockGraphql.mockResolvedValueOnce({
        organization: {
          projectsV2: {
            nodes: [node("A", true), node("B", false), node("C", true)],
            pageInfo: { hasNextPage: true, endCursor: "cursor456" },
          },
        },
      });

      const result = await repository.listOrganizationTemplates({
        org: "my-org",
        first: 20,
        after: "cursor123",
      });

      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("ListOrganizationTemplates"),
        expect.objectContaining({ orgLogin: "my-org", first: 20, after: "cursor123" })
      );
      expect(result.templates.map((t) => t.id)).toEqual(["A", "C"]);
      expect(result.pageInfo).toEqual({ hasNextPage: true, endCursor: "cursor456" });
    });

    it("throws when the organization does not exist", async () => {
      mockGraphql.mockResolvedValueOnce({ organization: null });

      await expect(
        repository.listOrganizationTemplates({ org: "ghost", first: 20 })
      ).rejects.toThrow("Organization 'ghost' not found");
    });
  });
});
