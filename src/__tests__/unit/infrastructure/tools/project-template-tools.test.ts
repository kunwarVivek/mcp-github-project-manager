import { type Mock, vi } from "vitest";

/**
 * Unit tests for project template MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with a mocked template repository)
 */

import type { GitHubRepositoryFactory } from "../../../../infrastructure/github/GitHubRepositoryFactory";
import {
  copyProjectFromTemplateTool,
  executeCopyProjectFromTemplate,
  executeListOrganizationTemplates,
  executeMarkProjectAsTemplate,
  executeUnmarkProjectAsTemplate,
  listOrganizationTemplatesTool,
  markProjectAsTemplateTool,
  unmarkProjectAsTemplateTool,
} from "../../../../infrastructure/tools/project-template-tools";
import {
  CopyProjectFromTemplateInputSchema,
  ListOrganizationTemplatesInputSchema,
  MarkProjectAsTemplateInputSchema,
  UnmarkProjectAsTemplateInputSchema,
} from "../../../../infrastructure/tools/schemas/project-template-linking-schemas";
import { createGitHubFactory } from "../../../../infrastructure/tools/tool-factory";
import { partialFake } from "../../../helpers/aiFakes";

vi.mock("../../../../infrastructure/tools/tool-factory", () => ({
  createGitHubFactory: vi.fn(),
}));

describe("Project Template Tools", () => {
  describe("Input Schemas", () => {
    describe("MarkProjectAsTemplateInputSchema", () => {
      it("rejects missing projectId", () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects empty projectId", () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({
          projectId: "",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid projectId", () => {
        const result = MarkProjectAsTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
        }
      });
    });

    describe("UnmarkProjectAsTemplateInputSchema", () => {
      it("rejects missing projectId", () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects empty projectId", () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({
          projectId: "",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid projectId", () => {
        const result = UnmarkProjectAsTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest456",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest456");
        }
      });
    });

    describe("CopyProjectFromTemplateInputSchema", () => {
      it("rejects missing required fields", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects missing projectId", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          targetOwner: "my-org",
          title: "New Project",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing targetOwner", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          title: "New Project",
        });
        expect(result.success).toBe(false);
      });

      it("rejects missing title", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          targetOwner: "my-org",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid required fields with default includeDraftIssues", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          targetOwner: "my-org",
          title: "New Project",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe("PVT_kwDOTest123");
          expect(result.data.targetOwner).toBe("my-org");
          expect(result.data.title).toBe("New Project");
          expect(result.data.includeDraftIssues).toBe(false); // default
        }
      });

      it("accepts all valid fields including optional includeDraftIssues", () => {
        const result = CopyProjectFromTemplateInputSchema.safeParse({
          projectId: "PVT_kwDOTest123",
          targetOwner: "my-org",
          title: "New Project",
          includeDraftIssues: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeDraftIssues).toBe(true);
        }
      });
    });

    describe("ListOrganizationTemplatesInputSchema", () => {
      it("rejects missing org", () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it("rejects empty org", () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: "",
        });
        expect(result.success).toBe(false);
      });

      it("accepts valid org with defaults applied", () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: "my-organization",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.org).toBe("my-organization");
          expect(result.data.first).toBe(20); // default
          expect(result.data.after).toBeUndefined();
        }
      });

      it("accepts pagination parameters", () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: "my-organization",
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
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: "my-organization",
          first: 200, // exceeds max of 100
        });
        expect(result.success).toBe(false);
      });

      it("rejects negative first value", () => {
        const result = ListOrganizationTemplatesInputSchema.safeParse({
          org: "my-organization",
          first: -1,
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Tool Definitions", () => {
    it("markProjectAsTemplateTool has correct name and title", () => {
      expect(markProjectAsTemplateTool.name).toBe("mark_project_as_template");
      expect(markProjectAsTemplateTool.title).toBe("Mark Project as Template");
    });

    it("markProjectAsTemplateTool has updateIdempotent annotation", () => {
      expect(markProjectAsTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("unmarkProjectAsTemplateTool has correct name and title", () => {
      expect(unmarkProjectAsTemplateTool.name).toBe("unmark_project_as_template");
      expect(unmarkProjectAsTemplateTool.title).toBe("Unmark Project as Template");
    });

    it("unmarkProjectAsTemplateTool has updateIdempotent annotation", () => {
      expect(unmarkProjectAsTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("copyProjectFromTemplateTool has correct name and title", () => {
      expect(copyProjectFromTemplateTool.name).toBe("copy_project_from_template");
      expect(copyProjectFromTemplateTool.title).toBe("Copy Project from Template");
    });

    it("copyProjectFromTemplateTool has create annotation", () => {
      expect(copyProjectFromTemplateTool.annotations).toEqual({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      });
    });

    it("listOrganizationTemplatesTool has correct name and title", () => {
      expect(listOrganizationTemplatesTool.name).toBe("list_organization_templates");
      expect(listOrganizationTemplatesTool.title).toBe("List Organization Templates");
    });

    it("listOrganizationTemplatesTool has readOnly annotation", () => {
      expect(listOrganizationTemplatesTool.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    });

    it("all tools have output schemas defined", () => {
      expect(markProjectAsTemplateTool.outputSchema).toBeDefined();
      expect(unmarkProjectAsTemplateTool.outputSchema).toBeDefined();
      expect(copyProjectFromTemplateTool.outputSchema).toBeDefined();
      expect(listOrganizationTemplatesTool.outputSchema).toBeDefined();
    });

    it("all tools have examples", () => {
      expect(markProjectAsTemplateTool.examples).toBeDefined();
      expect(markProjectAsTemplateTool.examples?.length).toBeGreaterThan(0);
      expect(unmarkProjectAsTemplateTool.examples).toBeDefined();
      expect(copyProjectFromTemplateTool.examples).toBeDefined();
      expect(copyProjectFromTemplateTool.examples?.length).toBe(2); // Two examples
      expect(listOrganizationTemplatesTool.examples).toBeDefined();
      expect(listOrganizationTemplatesTool.examples?.length).toBe(2); // Two examples
    });
  });

  describe("Executors", () => {
    let templateRepo: Record<
      "markAsTemplate" | "unmarkAsTemplate" | "copyFromTemplate" | "listOrganizationTemplates",
      Mock
    >;

    beforeEach(() => {
      vi.resetAllMocks();

      templateRepo = {
        markAsTemplate: vi.fn(),
        unmarkAsTemplate: vi.fn(),
        copyFromTemplate: vi.fn(),
        listOrganizationTemplates: vi.fn(),
      };
      vi.mocked(createGitHubFactory).mockReturnValue(
        partialFake<GitHubRepositoryFactory>({
          createProjectTemplateRepository: vi.fn().mockReturnValue(templateRepo),
        })
      );
    });

    describe("executeMarkProjectAsTemplate", () => {
      it("returns the project with isTemplate=true", async () => {
        templateRepo.markAsTemplate.mockResolvedValue({
          id: "PVT_kwDOTest123",
          title: "Test Template",
          url: "https://github.com/orgs/testorg/projects/1",
        });

        const input = MarkProjectAsTemplateInputSchema.parse({
          projectId: "PVT_kwDOTest123",
        });
        const result = await executeMarkProjectAsTemplate(input);

        expect(templateRepo.markAsTemplate).toHaveBeenCalledWith("PVT_kwDOTest123");
        expect(result.structuredContent).toEqual({
          id: "PVT_kwDOTest123",
          title: "Test Template",
          isTemplate: true,
          url: "https://github.com/orgs/testorg/projects/1",
        });
        expect(result.content[0].text).toContain("Marked project");
      });
    });

    describe("executeUnmarkProjectAsTemplate", () => {
      it("returns the project with isTemplate=false", async () => {
        templateRepo.unmarkAsTemplate.mockResolvedValue({
          id: "PVT_kwDOTest123",
          title: "Test Project",
          url: "https://github.com/orgs/testorg/projects/1",
        });

        const input = UnmarkProjectAsTemplateInputSchema.parse({
          projectId: "PVT_kwDOTest123",
        });
        const result = await executeUnmarkProjectAsTemplate(input);

        expect(result.structuredContent.id).toBe("PVT_kwDOTest123");
        expect(result.structuredContent.title).toBe("Test Project");
        expect(result.structuredContent.isTemplate).toBe(false);
        expect(result.content[0].text).toContain("Removed template status");
      });
    });

    describe("executeCopyProjectFromTemplate", () => {
      it("copies from the template and formats the new project", async () => {
        templateRepo.copyFromTemplate.mockResolvedValue({
          id: "PVT_kwDONew456",
          title: "Q1 2025 Sprint Board",
          number: 5,
          url: "https://github.com/orgs/my-org/projects/5",
          createdAt: "2026-01-31T10:00:00Z",
        });

        const input = CopyProjectFromTemplateInputSchema.parse({
          projectId: "PVT_kwDOTemplate123",
          targetOwner: "my-org",
          title: "Q1 2025 Sprint Board",
          includeDraftIssues: true,
        });
        const result = await executeCopyProjectFromTemplate(input);

        expect(templateRepo.copyFromTemplate).toHaveBeenCalledWith({
          projectId: "PVT_kwDOTemplate123",
          targetOwner: "my-org",
          title: "Q1 2025 Sprint Board",
          includeDraftIssues: true,
        });
        expect(result.structuredContent.id).toBe("PVT_kwDONew456");
        expect(result.structuredContent.number).toBe(5);
        expect(result.structuredContent.createdAt).toBe("2026-01-31T10:00:00Z");
        expect(result.content[0].text).toContain("Created project");
        expect(result.content[0].text).toContain("#5");
      });

      it("propagates org not found errors", async () => {
        templateRepo.copyFromTemplate.mockRejectedValue(
          new Error("Organization 'nonexistent-org' not found")
        );

        const input = CopyProjectFromTemplateInputSchema.parse({
          projectId: "PVT_kwDOTemplate123",
          targetOwner: "nonexistent-org",
          title: "New Project",
        });

        await expect(executeCopyProjectFromTemplate(input)).rejects.toThrow(
          "Organization 'nonexistent-org' not found"
        );
      });
    });

    describe("executeListOrganizationTemplates", () => {
      const template = (id: string, title: string, shortDescription: string | null) => ({
        id,
        title,
        url: `https://github.com/orgs/my-org/projects/${id}`,
        number: 1,
        shortDescription,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      });

      it("formats the templates with isTemplate=true and a page-local count", async () => {
        templateRepo.listOrganizationTemplates.mockResolvedValue({
          templates: [
            template("PVT_1", "Template 1", "First"),
            template("PVT_3", "Template 2", null),
          ],
          pageInfo: { hasNextPage: false, endCursor: null },
        });

        const input = ListOrganizationTemplatesInputSchema.parse({ org: "my-org" });
        const result = await executeListOrganizationTemplates(input);

        expect(result.structuredContent.templates).toHaveLength(2);
        expect(result.structuredContent.templates[0].title).toBe("Template 1");
        expect(result.structuredContent.templates[0].isTemplate).toBe(true);
        expect(result.structuredContent.templates[1].shortDescription).toBeNull();
        expect(result.structuredContent.totalCount).toBe(2);
        expect(result.content[0].text).toContain("Found 2 template(s)");
      });

      it("returns an empty list when the page holds no templates", async () => {
        templateRepo.listOrganizationTemplates.mockResolvedValue({
          templates: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        });

        const input = ListOrganizationTemplatesInputSchema.parse({ org: "my-org" });
        const result = await executeListOrganizationTemplates(input);

        expect(result.structuredContent.templates).toHaveLength(0);
        expect(result.structuredContent.totalCount).toBe(0);
        expect(result.content[0].text).toContain("Found 0 template(s)");
      });

      it("passes pagination through", async () => {
        templateRepo.listOrganizationTemplates.mockResolvedValue({
          templates: [template("PVT_4", "Template 4", "Page 2 template")],
          pageInfo: { hasNextPage: true, endCursor: "cursor456" },
        });

        const input = ListOrganizationTemplatesInputSchema.parse({
          org: "my-org",
          first: 10,
          after: "cursor123",
        });
        const result = await executeListOrganizationTemplates(input);

        expect(templateRepo.listOrganizationTemplates).toHaveBeenCalledWith({
          org: "my-org",
          first: 10,
          after: "cursor123",
        });
        expect(result.structuredContent.pageInfo.hasNextPage).toBe(true);
        expect(result.structuredContent.pageInfo.endCursor).toBe("cursor456");
      });

      it("propagates org not found errors", async () => {
        templateRepo.listOrganizationTemplates.mockRejectedValue(
          new Error("Organization 'nonexistent-org' not found")
        );

        const input = ListOrganizationTemplatesInputSchema.parse({ org: "nonexistent-org" });

        await expect(executeListOrganizationTemplates(input)).rejects.toThrow(
          "Organization 'nonexistent-org' not found"
        );
      });
    });
  });
});
