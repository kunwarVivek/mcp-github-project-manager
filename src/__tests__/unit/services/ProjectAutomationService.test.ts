import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ProjectWorkflow, ProjectWorkflowRepository } from "../../../domain/automation-types";
import { ResourceNotFoundError } from "../../../domain/errors";
import type { ProjectRepository } from "../../../domain/types";
import { ProjectAutomationService } from "../../../services/ProjectAutomationService";

const PROJECT_ID = "PVT_kwDOLhQ7gc4AOEbH";
const WORKFLOW_ID = "PVW_kwDOLhQ7gc4AOEbH";

const workflow: ProjectWorkflow = {
  id: WORKFLOW_ID,
  name: "Auto-add issues",
  number: 3,
  enabled: true,
  projectId: PROJECT_ID,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-02-01T00:00:00Z"),
};

describe("ProjectAutomationService", () => {
  let workflowRepo: {
    findById: Mock;
    findByProject: Mock;
    delete: Mock;
  };
  let projectRepo: { findById: Mock };
  let service: ProjectAutomationService;

  beforeEach(() => {
    vi.clearAllMocks();

    workflowRepo = {
      findById: vi.fn(),
      findByProject: vi.fn(),
      delete: vi.fn(),
    };
    projectRepo = {
      findById: vi.fn().mockResolvedValue({ id: PROJECT_ID, fields: [] }),
    };

    service = new ProjectAutomationService(
      workflowRepo as unknown as ProjectWorkflowRepository,
      projectRepo as unknown as ProjectRepository,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    );
  });

  describe("listWorkflows", () => {
    it("returns the workflows of the project", async () => {
      workflowRepo.findByProject.mockResolvedValue([workflow]);

      await expect(service.listWorkflows(PROJECT_ID)).resolves.toEqual([workflow]);
      expect(workflowRepo.findByProject).toHaveBeenCalledWith(PROJECT_ID);
    });

    it("fails when the project does not exist", async () => {
      projectRepo.findById.mockResolvedValue(null);

      await expect(service.listWorkflows(PROJECT_ID)).rejects.toThrow(
        `project with ID ${PROJECT_ID} not found`
      );
      expect(workflowRepo.findByProject).not.toHaveBeenCalled();
    });

    it("rejects a missing project id", async () => {
      await expect(service.listWorkflows("")).rejects.toThrow("Project ID is required");
      expect(workflowRepo.findByProject).not.toHaveBeenCalled();
    });
  });

  describe("getWorkflowById", () => {
    it("returns the workflow", async () => {
      workflowRepo.findById.mockResolvedValue(workflow);

      await expect(service.getWorkflowById(WORKFLOW_ID)).resolves.toEqual(workflow);
    });

    it("fails for an unknown workflow id", async () => {
      workflowRepo.findById.mockResolvedValue(null);

      await expect(service.getWorkflowById(WORKFLOW_ID)).rejects.toThrow(
        `workflow with ID ${WORKFLOW_ID} not found`
      );
      await expect(service.getWorkflowById(WORKFLOW_ID)).rejects.toBeInstanceOf(
        ResourceNotFoundError
      );
    });

    it("rejects a missing workflow id", async () => {
      await expect(service.getWorkflowById("")).rejects.toThrow("Workflow ID is required");
      expect(workflowRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe("deleteWorkflow", () => {
    it("deletes the workflow through the repository", async () => {
      workflowRepo.delete.mockResolvedValue(undefined);

      await expect(service.deleteWorkflow(WORKFLOW_ID)).resolves.toBeUndefined();
      expect(workflowRepo.delete).toHaveBeenCalledWith(WORKFLOW_ID);
    });

    it("surfaces repository failures", async () => {
      workflowRepo.delete.mockRejectedValue(new Error("Could not resolve to a node"));

      await expect(service.deleteWorkflow(WORKFLOW_ID)).rejects.toThrow(
        "Could not resolve to a node"
      );
    });

    it("rejects a missing workflow id", async () => {
      await expect(service.deleteWorkflow("")).rejects.toThrow("Workflow ID is required");
      expect(workflowRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("tool-facing adapters", () => {
    it("serialises a workflow with ISO timestamps", async () => {
      workflowRepo.findById.mockResolvedValue(workflow);

      await expect(service.getWorkflowDTO(WORKFLOW_ID)).resolves.toEqual({
        id: WORKFLOW_ID,
        name: "Auto-add issues",
        number: 3,
        enabled: true,
        projectId: PROJECT_ID,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-02-01T00:00:00.000Z",
      });
    });

    it("serialises the workflow list", async () => {
      workflowRepo.findByProject.mockResolvedValue([workflow]);

      await expect(service.listWorkflowDTOs(PROJECT_ID)).resolves.toEqual([
        {
          id: WORKFLOW_ID,
          name: "Auto-add issues",
          number: 3,
          enabled: true,
          projectId: PROJECT_ID,
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-02-01T00:00:00.000Z",
        },
      ]);
    });
  });
});
