import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ProjectTemplateService } from "../../../services/ProjectTemplateService";
import { type AsyncFn, asFactory } from "../../helpers/mockTypes";

describe("ProjectTemplateService", () => {
  let service: ProjectTemplateService;
  let mockProjectRepo: Record<
    "findById" | "createView" | "listViews" | "updateView" | "updateField" | "deleteView",
    Mock<AsyncFn>
  >;
  let mockTemplateRepo: Record<
    | "getReadme"
    | "updateReadme"
    | "markAsTemplate"
    | "unmarkAsTemplate"
    | "copyFromTemplate"
    | "listOrganizationTemplates",
    Mock<AsyncFn>
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectRepo = {
      findById: vi.fn(),
      createView: vi.fn(),
      listViews: vi.fn(async () => []),
      updateView: vi.fn(async () => ({ id: "VIEW_1", name: "Board", layout: "board" })),
      updateField: vi.fn(),
      deleteView: vi.fn(),
    };

    mockTemplateRepo = {
      getReadme: vi.fn(),
      updateReadme: vi.fn(),
      markAsTemplate: vi.fn(),
      unmarkAsTemplate: vi.fn(),
      copyFromTemplate: vi.fn(),
      listOrganizationTemplates: vi.fn(),
    };

    const mockFactory = {
      createProjectRepository: vi.fn().mockReturnValue(mockProjectRepo),
      createProjectTemplateRepository: vi.fn().mockReturnValue(mockTemplateRepo),
    };

    service = new ProjectTemplateService(asFactory(mockFactory));
  });

  it("should be properly initialized", () => {
    expect(service).toBeDefined();
  });

  describe("getProjectReadme", () => {
    it("should get project README successfully", async () => {
      mockTemplateRepo.getReadme.mockResolvedValueOnce("# Project README");

      const result = await service.getProjectReadme({ projectId: "PROJECT_123" });

      expect(result).toEqual({ readme: "# Project README" });
      expect(mockTemplateRepo.getReadme).toHaveBeenCalledWith("PROJECT_123");
    });

    it("should handle repository errors", async () => {
      mockTemplateRepo.getReadme.mockRejectedValueOnce(new Error("GraphQL error"));

      await expect(service.getProjectReadme({ projectId: "PROJECT_123" })).rejects.toThrow(
        "GraphQL error"
      );
    });
  });

  describe("updateProjectReadme", () => {
    it("should update project README successfully", async () => {
      const result = await service.updateProjectReadme({
        projectId: "PROJECT_123",
        readme: "# Updated README",
      });

      expect(result).toEqual({
        success: true,
        message: "Project README updated successfully",
      });
      expect(mockTemplateRepo.updateReadme).toHaveBeenCalledWith("PROJECT_123", "# Updated README");
    });

    it("should handle update errors", async () => {
      mockTemplateRepo.updateReadme.mockRejectedValueOnce(new Error("Update failed"));

      await expect(
        service.updateProjectReadme({
          projectId: "PROJECT_123",
          readme: "# Test",
        })
      ).rejects.toThrow("Update failed");
    });
  });

  describe("template operations", () => {
    it("marks and unmarks a project as a template", async () => {
      const project = { id: "PVT_1", title: "Tpl", url: "https://github.com/orgs/o/projects/1" };
      mockTemplateRepo.markAsTemplate.mockResolvedValueOnce(project);
      mockTemplateRepo.unmarkAsTemplate.mockResolvedValueOnce(project);

      expect(await service.markProjectAsTemplate({ projectId: "PVT_1" })).toBe(project);
      expect(await service.unmarkProjectAsTemplate({ projectId: "PVT_1" })).toBe(project);
      expect(mockTemplateRepo.markAsTemplate).toHaveBeenCalledWith("PVT_1");
      expect(mockTemplateRepo.unmarkAsTemplate).toHaveBeenCalledWith("PVT_1");
    });

    it("copies from a template without draft issues by default", async () => {
      await service.copyProjectFromTemplate({
        projectId: "PVT_tpl",
        targetOwner: "my-org",
        title: "Q1 Board",
      });

      expect(mockTemplateRepo.copyFromTemplate).toHaveBeenCalledWith({
        projectId: "PVT_tpl",
        targetOwner: "my-org",
        title: "Q1 Board",
        includeDraftIssues: false,
      });
    });

    it("lists organization templates with a default page size of 20", async () => {
      await service.listOrganizationTemplates({ org: "my-org" });

      expect(mockTemplateRepo.listOrganizationTemplates).toHaveBeenCalledWith({
        org: "my-org",
        first: 20,
        after: undefined,
      });
    });

    it("maps template repository errors", async () => {
      mockTemplateRepo.listOrganizationTemplates.mockRejectedValueOnce(
        new Error("Organization 'ghost' not found")
      );

      await expect(service.listOrganizationTemplates({ org: "ghost" })).rejects.toThrow(
        "Organization 'ghost' not found"
      );
    });
  });

  describe("listProjectFields", () => {
    it("should list project fields successfully", async () => {
      const mockFields = [
        { id: "FIELD_1", name: "Status", type: "single_select" as const },
        { id: "FIELD_2", name: "Priority", type: "single_select" as const },
      ];

      mockProjectRepo.findById.mockResolvedValueOnce({
        id: "PROJECT_123",
        fields: mockFields,
      });

      const result = await service.listProjectFields({ projectId: "PROJECT_123" });

      expect(result).toEqual(mockFields);
      expect(mockProjectRepo.findById).toHaveBeenCalledWith("PROJECT_123");
    });

    it("should return empty array when project has no fields", async () => {
      mockProjectRepo.findById.mockResolvedValueOnce({
        id: "PROJECT_123",
        fields: undefined,
      });

      const result = await service.listProjectFields({ projectId: "PROJECT_123" });

      expect(result).toEqual([]);
    });

    it("should throw error when project not found", async () => {
      mockProjectRepo.findById.mockResolvedValueOnce(null);

      await expect(service.listProjectFields({ projectId: "NONEXISTENT" })).rejects.toThrow();
    });
  });

  describe("updateProjectField", () => {
    it("should update field name successfully", async () => {
      const updatedField = { id: "FIELD_1", name: "New Name", type: "text" as const };
      mockProjectRepo.updateField.mockResolvedValueOnce(updatedField);

      const result = await service.updateProjectField({
        projectId: "PROJECT_123",
        fieldId: "FIELD_1",
        name: "New Name",
      });

      expect(result).toEqual(updatedField);
      expect(mockProjectRepo.updateField).toHaveBeenCalledWith("PROJECT_123", "FIELD_1", {
        name: "New Name",
      });
    });

    it("should update field options successfully", async () => {
      const updatedField = {
        id: "FIELD_1",
        name: "Status",
        type: "single_select" as const,
        options: [
          { id: "", name: "Open", color: "green" },
          { id: "", name: "Closed", color: "red" },
        ],
      };
      mockProjectRepo.updateField.mockResolvedValueOnce(updatedField);

      const result = await service.updateProjectField({
        projectId: "PROJECT_123",
        fieldId: "FIELD_1",
        options: [
          { name: "Open", color: "green" },
          { name: "Closed", color: "red" },
        ],
      });

      expect(result).toEqual(updatedField);
    });
  });

  describe("createProjectView", () => {
    it("should create a board view successfully", async () => {
      const newView = {
        id: "VIEW_1",
        name: "Sprint Board",
        layout: "board" as const,
        fields: [],
        sortBy: [],
        filters: [],
      };
      mockProjectRepo.createView.mockResolvedValueOnce(newView);

      const result = await service.createProjectView({
        projectId: "PROJECT_123",
        name: "Sprint Board",
        layout: "board",
      });

      expect(result).toEqual(newView);
      expect(mockProjectRepo.createView).toHaveBeenCalledWith(
        "PROJECT_123",
        "Sprint Board",
        "board"
      );
    });

    it("should create a table view successfully", async () => {
      const newView = {
        id: "VIEW_2",
        name: "All Items",
        layout: "table" as const,
        fields: [],
        sortBy: [],
        filters: [],
      };
      mockProjectRepo.createView.mockResolvedValueOnce(newView);

      const result = await service.createProjectView({
        projectId: "PROJECT_123",
        name: "All Items",
        layout: "table",
      });

      expect(result).toEqual(newView);
    });
  });

  describe("listProjectViews", () => {
    it("should list project views through the repository", async () => {
      const views = [
        { id: "VIEW_1", name: "Board", layout: "board" },
        { id: "VIEW_2", name: "Table", layout: "table" },
      ];
      mockProjectRepo.listViews.mockResolvedValueOnce(views);

      const result = await service.listProjectViews({ projectId: "PROJECT_123" });

      expect(mockProjectRepo.listViews).toHaveBeenCalledWith("PROJECT_123", {
        name: undefined,
        viewId: undefined,
      });
      expect(result).toEqual(views);
    });

    it("should pass a view selection through to the repository", async () => {
      const views = [{ id: "VIEW_2", name: "Claiming pool", layout: "table" }];
      mockProjectRepo.listViews.mockResolvedValueOnce(views);

      const result = await service.listProjectViews({
        projectId: "PROJECT_123",
        name: "Claiming pool",
      });

      expect(mockProjectRepo.listViews).toHaveBeenCalledWith("PROJECT_123", {
        name: "Claiming pool",
        viewId: undefined,
      });
      expect(result).toEqual(views);
    });

    it("should return empty array when project has no views", async () => {
      mockProjectRepo.listViews.mockResolvedValueOnce([]);

      const result = await service.listProjectViews({ projectId: "PROJECT_123" });

      expect(result).toEqual([]);
    });
  });

  describe("updateProjectView", () => {
    it("should update view name through the repository", async () => {
      mockProjectRepo.updateView.mockResolvedValueOnce({
        id: "VIEW_1",
        name: "Updated Board",
        layout: "board",
      });

      const result = await service.updateProjectView({
        projectId: "PROJECT_123",
        viewId: "VIEW_1",
        name: "Updated Board",
      });

      expect(mockProjectRepo.updateView).toHaveBeenCalledWith("PROJECT_123", "VIEW_1", {
        name: "Updated Board",
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: "VIEW_1",
          name: "Updated Board",
          layout: "board",
        })
      );
    });

    it("should update view layout through the repository", async () => {
      mockProjectRepo.updateView.mockResolvedValueOnce({
        id: "VIEW_1",
        name: "Sprint View",
        layout: "table",
      });

      const result = await service.updateProjectView({
        projectId: "PROJECT_123",
        viewId: "VIEW_1",
        layout: "table",
      });

      expect(mockProjectRepo.updateView).toHaveBeenCalledWith("PROJECT_123", "VIEW_1", {
        layout: "table",
      });
      expect(result.layout).toBe("table");
    });
  });

  describe("deleteProjectView", () => {
    it("should delete view successfully", async () => {
      mockProjectRepo.deleteView.mockResolvedValueOnce(undefined);

      const result = await service.deleteProjectView({
        projectId: "PROJECT_123",
        viewId: "VIEW_1",
      });

      expect(result).toEqual({
        success: true,
        message: "View VIEW_1 deleted successfully from project PROJECT_123",
      });
      expect(mockProjectRepo.deleteView).toHaveBeenCalledWith("PROJECT_123", "VIEW_1");
    });

    it("should handle delete errors", async () => {
      mockProjectRepo.deleteView.mockRejectedValueOnce(new Error("Delete failed"));

      await expect(
        service.deleteProjectView({
          projectId: "PROJECT_123",
          viewId: "VIEW_1",
        })
      ).rejects.toThrow();
    });
  });
});
