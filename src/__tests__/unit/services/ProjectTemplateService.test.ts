import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ProjectTemplateService } from "../../../services/ProjectTemplateService";
import { type AsyncFn, asFactory, type GraphqlFn } from "../../helpers/mockTypes";

describe("ProjectTemplateService", () => {
  let service: ProjectTemplateService;
  let mockGraphql: Mock<GraphqlFn>;
  let mockProjectRepo: Record<
    "findById" | "createView" | "listViews" | "updateView" | "updateField" | "deleteView",
    Mock<AsyncFn>
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock GraphQL function
    mockGraphql = vi.fn<GraphqlFn>();

    // Create mock project repository
    mockProjectRepo = {
      findById: vi.fn(),
      createView: vi.fn(),
      listViews: vi.fn(async () => []),
      updateView: vi.fn(async () => ({ id: "VIEW_1", name: "Board", layout: "board" })),
      updateField: vi.fn(),
      deleteView: vi.fn(),
    };

    // Create mock factory
    const mockFactory = {
      graphql: mockGraphql,
      createProjectRepository: vi.fn().mockReturnValue(mockProjectRepo),
    };

    // Create service with mock factory
    service = new ProjectTemplateService(asFactory(mockFactory));
  });

  it("should be properly initialized", () => {
    expect(service).toBeDefined();
  });

  describe("getProjectReadme", () => {
    it("should get project README successfully", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          readme: "# Project README\n\nThis is the project description.",
        },
      });

      const result = await service.getProjectReadme({ projectId: "PROJECT_123" });

      expect(result).toEqual({
        readme: "# Project README\n\nThis is the project description.",
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("query($projectId: ID!)"),
        expect.objectContaining({ projectId: "PROJECT_123" })
      );
    });

    it("should return empty string when README is null", async () => {
      mockGraphql.mockResolvedValueOnce({
        node: {
          readme: null,
        },
      });

      const result = await service.getProjectReadme({ projectId: "PROJECT_123" });

      expect(result).toEqual({ readme: "" });
    });

    it("should handle GraphQL errors", async () => {
      mockGraphql.mockRejectedValueOnce(new Error("GraphQL error"));

      await expect(service.getProjectReadme({ projectId: "PROJECT_123" })).rejects.toThrow();
    });
  });

  describe("updateProjectReadme", () => {
    it("should update project README successfully", async () => {
      mockGraphql.mockResolvedValueOnce({
        updateProjectV2: {
          projectV2: {
            id: "PROJECT_123",
            readme: "# Updated README",
          },
        },
      });

      const result = await service.updateProjectReadme({
        projectId: "PROJECT_123",
        readme: "# Updated README",
      });

      expect(result).toEqual({
        success: true,
        message: "Project README updated successfully",
      });
      expect(mockGraphql).toHaveBeenCalledWith(
        expect.stringContaining("mutation($input: UpdateProjectV2Input!)"),
        expect.objectContaining({
          input: {
            projectId: "PROJECT_123",
            readme: "# Updated README",
          },
        })
      );
    });

    it("should handle update errors", async () => {
      mockGraphql.mockRejectedValueOnce(new Error("Update failed"));

      await expect(
        service.updateProjectReadme({
          projectId: "PROJECT_123",
          readme: "# Test",
        })
      ).rejects.toThrow();
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
