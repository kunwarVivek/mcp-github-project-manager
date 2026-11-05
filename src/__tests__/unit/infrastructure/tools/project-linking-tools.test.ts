import { type Mock, vi } from "vitest";

/**
 * Unit tests for project linking MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with a mocked linking repository)
 */

import type { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import {
  executeLinkProjectToRepository,
  executeLinkProjectToTeam,
  executeListLinkedRepositories,
  executeListLinkedTeams,
  executeUnlinkProjectFromRepository,
  executeUnlinkProjectFromTeam,
  linkProjectToRepositoryTool,
  linkProjectToTeamTool,
  listLinkedRepositoriesTool,
  listLinkedTeamsTool,
  unlinkProjectFromRepositoryTool,
  unlinkProjectFromTeamTool,
} from "../../../../infrastructure/tools/project-linking-tools";
import {
  LinkProjectToRepositoryInputSchema,
  LinkProjectToTeamInputSchema,
  ListLinkedRepositoriesInputSchema,
  ListLinkedTeamsInputSchema,
  UnlinkProjectFromRepositoryInputSchema,
  UnlinkProjectFromTeamInputSchema,
} from "../../../../infrastructure/tools/schemas/project-template-linking-schemas";
import { createGitHubFactory } from "../../../../infrastructure/tools/tool-factory";
import { partialFake } from "../../../helpers/aiFakes";

vi.mock("../../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: vi.fn(),
}));

describe("Project Linking Tools", () => {
  describe("Input Schemas", () => {
    describe("LinkProjectToRepositoryInputSchema", () => {
      it("rejects missing required fields", () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects missing projectId", () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          owner: "octocat",
          repo: "hello-world",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing owner", () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          repo: "hello-world",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing repo", () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid input", () => {
        const result = LinkProjectToRepositoryInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
          repo: "hello-world",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.owner).toBe("octocat");
          expect(result.data.repo).toBe("hello-world");
        }
      });
    });

    describe("UnlinkProjectFromRepositoryInputSchema", () => {
      it("rejects missing required fields", () => {
        const result = UnlinkProjectFromRepositoryInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("accepts valid input", () => {
        const result = UnlinkProjectFromRepositoryInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
          repo: "hello-world",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.owner).toBe("octocat");
          expect(result.data.repo).toBe("hello-world");
        }
      });
    });

    describe("LinkProjectToTeamInputSchema", () => {
      it("rejects missing required fields", () => {
        const result = LinkProjectToTeamInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects missing projectId", () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          org: "octocat-org",
          teamSlug: "engineering",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing org", () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          teamSlug: "engineering",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing teamSlug", () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid input with teamSlug", () => {
        const result = LinkProjectToTeamInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
          teamSlug: "engineering",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.org).toBe("octocat-org");
          expect(result.data.teamSlug).toBe("engineering");
        }
      });
    });

    describe("UnlinkProjectFromTeamInputSchema", () => {
      it("rejects missing required fields", () => {
        const result = UnlinkProjectFromTeamInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("accepts valid input", () => {
        const result = UnlinkProjectFromTeamInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
          teamSlug: "engineering",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.org).toBe("octocat-org");
          expect(result.data.teamSlug).toBe("engineering");
        }
      });
    });

    describe("ListLinkedRepositoriesInputSchema", () => {
      it("rejects missing projectId", () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("accepts valid projectId with defaults applied", () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it("accepts pagination parameters", () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          first: 50,
          after: "cursor123",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(50);
          expect(result.data.after).toBe("cursor123");
        }
      });

      it("rejects invalid first value exceeding max", () => {
        const result = ListLinkedRepositoriesInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          first: 200,
        });
        expect(result.success).toBe(false);
      });
    });

    describe("ListLinkedTeamsInputSchema", () => {
      it("rejects missing projectId", () => {
        const result = ListLinkedTeamsInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("accepts valid projectId with defaults applied", () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it("accepts pagination parameters", () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          first: 30,
          after: "cursor456",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.first).toBe(30);
          expect(result.data.after).toBe("cursor456");
        }
      });

      it("rejects negative first value", () => {
        const result = ListLinkedTeamsInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          first: -5,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Tool Definitions", () => {
    it("linkProjectToRepositoryTool has correct name and title", () => {
      expect(linkProjectToRepositoryTool.name).toBe("link_project_to_repository");
      expect(linkProjectToRepositoryTool.title).toBe("Link Project to Repository");
    });

    it("linkProjectToRepositoryTool has updateIdempotent annotation", () => {
      expect(linkProjectToRepositoryTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("unlinkProjectFromRepositoryTool has correct name and title", () => {
      expect(unlinkProjectFromRepositoryTool.name).toBe("unlink_project_from_repository");
      expect(unlinkProjectFromRepositoryTool.title).toBe("Unlink Project from Repository");
    });

    it("unlinkProjectFromRepositoryTool has delete annotation with destructiveHint", () => {
      expect(unlinkProjectFromRepositoryTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("linkProjectToTeamTool has correct name and title", () => {
      expect(linkProjectToTeamTool.name).toBe("link_project_to_team");
      expect(linkProjectToTeamTool.title).toBe("Link Project to Team");
    });

    it("linkProjectToTeamTool has updateIdempotent annotation", () => {
      expect(linkProjectToTeamTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("unlinkProjectFromTeamTool has correct name and title", () => {
      expect(unlinkProjectFromTeamTool.name).toBe("unlink_project_from_team");
      expect(unlinkProjectFromTeamTool.title).toBe("Unlink Project from Team");
    });

    it("unlinkProjectFromTeamTool has delete annotation", () => {
      expect(unlinkProjectFromTeamTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("listLinkedRepositoriesTool has correct name and title", () => {
      expect(listLinkedRepositoriesTool.name).toBe("list_linked_repositories");
      expect(listLinkedRepositoriesTool.title).toBe("List Linked Repositories");
    });

    it("listLinkedRepositoriesTool has readOnly annotation", () => {
      expect(listLinkedRepositoriesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("listLinkedTeamsTool has correct name and title", () => {
      expect(listLinkedTeamsTool.name).toBe("list_linked_teams");
      expect(listLinkedTeamsTool.title).toBe("List Linked Teams");
    });

    it("listLinkedTeamsTool has readOnly annotation", () => {
      expect(listLinkedTeamsTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("all tools have output schemas defined", () => {
      expect(linkProjectToRepositoryTool.outputSchema).toBeDefined();
      expect(unlinkProjectFromRepositoryTool.outputSchema).toBeDefined();
      expect(linkProjectToTeamTool.outputSchema).toBeDefined();
      expect(unlinkProjectFromTeamTool.outputSchema).toBeDefined();
      expect(listLinkedRepositoriesTool.outputSchema).toBeDefined();
      expect(listLinkedTeamsTool.outputSchema).toBeDefined();
    });

    it("all tools have examples", () => {
      expect(linkProjectToRepositoryTool.examples).toBeDefined();
      expect(linkProjectToRepositoryTool.examples?.length).toBeGreaterThan(0);
      expect(unlinkProjectFromRepositoryTool.examples).toBeDefined();
      expect(linkProjectToTeamTool.examples).toBeDefined();
      expect(unlinkProjectFromTeamTool.examples).toBeDefined();
      expect(listLinkedRepositoriesTool.examples).toBeDefined();
      expect(listLinkedTeamsTool.examples).toBeDefined();
    });
  });

  describe("Executors", () => {
    let linkingRepo: Record<
      | "linkRepository"
      | "unlinkRepository"
      | "linkTeam"
      | "unlinkTeam"
      | "listRepositories"
      | "listTeams",
      Mock
    >;

    beforeEach(() => {
      vi.resetAllMocks();

      linkingRepo = {
        linkRepository: vi.fn(),
        unlinkRepository: vi.fn(),
        linkTeam: vi.fn(),
        unlinkTeam: vi.fn(),
        listRepositories: vi.fn(),
        listTeams: vi.fn(),
      };
      vi.mocked(createGitHubFactory).mockReturnValue(
        partialFake<GitHubRepositoryFactory>({
          createProjectLinkingRepository: vi.fn().mockReturnValue(linkingRepo),
        })
      );
    });

    describe("executeLinkProjectToRepository", () => {
      it("links the repository and formats the result", async () => {
        linkingRepo.linkRepository.mockResolvedValue({
          id: "R_kgTest123",
          name: "hello-world",
          nameWithOwner: "octocat/hello-world",
          url: "https://github.com/octocat/hello-world",
          description: "Test repository",
        });

        const input = LinkProjectToRepositoryInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
          repo: "hello-world",
        });
        const result = await executeLinkProjectToRepository(input);

        expect(linkingRepo.linkRepository).toHaveBeenCalledWith(
          "PVT_kwDOTest123",
          "octocat",
          "hello-world"
        );
        expect(result.structuredContent).toEqual({
          id: "R_kgTest123",
          name: "hello-world",
          nameWithOwner: "octocat/hello-world",
          url: "https://github.com/octocat/hello-world",
          description: "Test repository",
        });
        expect(result.content[0].text).toContain("Linked repository");
        expect(result.content[0].text).toContain("octocat/hello-world");
      });

      it("propagates repo not found errors", async () => {
        linkingRepo.linkRepository.mockRejectedValue(
          new Error("Repository octocat/nonexistent-repo not found")
        );

        const input = LinkProjectToRepositoryInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
          repo: "nonexistent-repo",
        });

        await expect(executeLinkProjectToRepository(input)).rejects.toThrow(
          "Repository octocat/nonexistent-repo not found"
        );
      });
    });

    describe("executeUnlinkProjectFromRepository", () => {
      it("unlinks the repository and returns success", async () => {
        const input = UnlinkProjectFromRepositoryInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          owner: "octocat",
          repo: "hello-world",
        });
        const result = await executeUnlinkProjectFromRepository(input);

        expect(linkingRepo.unlinkRepository).toHaveBeenCalledWith(
          "PVT_kwDOTest123",
          "octocat",
          "hello-world"
        );
        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.message).toContain("Successfully unlinked");
        expect(result.structuredContent.message).toContain("octocat/hello-world");
        expect(result.content[0].text).toContain("Successfully unlinked");
      });
    });

    describe("executeLinkProjectToTeam", () => {
      it("links the team and formats the result", async () => {
        linkingRepo.linkTeam.mockResolvedValue({
          id: "T_kwTest123",
          name: "Engineering Team",
          slug: "engineering",
          description: "The engineering team",
        });

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
          teamSlug: "engineering",
        });
        const result = await executeLinkProjectToTeam(input);

        expect(linkingRepo.linkTeam).toHaveBeenCalledWith(
          "PVT_kwDOTest123",
          "octocat-org",
          "engineering"
        );
        expect(result.structuredContent.id).toBe("T_kwTest123");
        expect(result.structuredContent.description).toBe("The engineering team");
        expect(result.content[0].text).toContain("Linked team");
        expect(result.content[0].text).toContain("Engineering Team");
      });

      it("propagates team not found errors", async () => {
        linkingRepo.linkTeam.mockRejectedValue(
          new Error("Team nonexistent-team not found in organization octocat-org")
        );

        const input = LinkProjectToTeamInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
          teamSlug: "nonexistent-team",
        });

        await expect(executeLinkProjectToTeam(input)).rejects.toThrow(
          "Team nonexistent-team not found in organization octocat-org"
        );
      });
    });

    describe("executeUnlinkProjectFromTeam", () => {
      it("unlinks the team and returns success", async () => {
        const input = UnlinkProjectFromTeamInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          org: "octocat-org",
          teamSlug: "engineering",
        });
        const result = await executeUnlinkProjectFromTeam(input);

        expect(linkingRepo.unlinkTeam).toHaveBeenCalledWith(
          "PVT_kwDOTest123",
          "octocat-org",
          "engineering"
        );
        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.message).toContain("engineering");
        expect(result.content[0].text).toContain("Successfully unlinked");
      });
    });

    describe("executeListLinkedRepositories", () => {
      it("returns the paginated list of linked repositories", async () => {
        linkingRepo.listRepositories.mockResolvedValue({
          repositories: [
            {
              id: "R_kg1",
              name: "repo-one",
              nameWithOwner: "org/repo-one",
              url: "https://github.com/org/repo-one",
              description: "First repository",
            },
            {
              id: "R_kg2",
              name: "repo-two",
              nameWithOwner: "org/repo-two",
              url: "https://github.com/org/repo-two",
              description: null,
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "cursor456" },
          totalCount: 5,
        });

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: "PVT_kwDOTest123",
          first: 10,
          after: "cursor123",
        });
        const result = await executeListLinkedRepositories(input);

        expect(linkingRepo.listRepositories).toHaveBeenCalledWith({
          projectId: "PVT_kwDOTest123",
          first: 10,
          after: "cursor123",
        });
        expect(result.structuredContent.repositories).toHaveLength(2);
        expect(result.structuredContent.repositories[1].description).toBeNull();
        expect(result.structuredContent.pageInfo.endCursor).toBe("cursor456");
        expect(result.structuredContent.totalCount).toBe(5);
        expect(result.content[0].text).toContain("Found 5 linked repositories, returning 2");
      });

      it("propagates project not found errors", async () => {
        linkingRepo.listRepositories.mockRejectedValue(
          new Error("Project PVT_nonexistent not found")
        );

        const input = ListLinkedRepositoriesInputSchema.parse({
          projectId: "PVT_nonexistent",
        });

        await expect(executeListLinkedRepositories(input)).rejects.toThrow(
          "Project PVT_nonexistent not found"
        );
      });
    });

    describe("executeListLinkedTeams", () => {
      it("returns the paginated list of linked teams", async () => {
        linkingRepo.listTeams.mockResolvedValue({
          teams: [
            { id: "T_kw1", name: "Engineering", slug: "engineering", description: "Eng" },
            { id: "T_kw2", name: "Design", slug: "design", description: null },
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
          totalCount: 2,
        });

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: "PVT_kwDOTest123",
        });
        const result = await executeListLinkedTeams(input);

        expect(linkingRepo.listTeams).toHaveBeenCalledWith({
          projectId: "PVT_kwDOTest123",
          first: 20,
          after: undefined,
        });
        expect(result.structuredContent.teams).toHaveLength(2);
        expect(result.structuredContent.teams[1].description).toBeNull();
        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.content[0].text).toContain("Found 2 linked teams");
      });

      it("propagates project not found errors", async () => {
        linkingRepo.listTeams.mockRejectedValue(new Error("Project PVT_nonexistent not found"));

        const input = ListLinkedTeamsInputSchema.parse({
          projectId: "PVT_nonexistent",
        });

        await expect(executeListLinkedTeams(input)).rejects.toThrow(
          "Project PVT_nonexistent not found"
        );
      });
    });
  });
});
