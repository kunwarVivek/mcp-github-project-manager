import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  executeManageIssues,
  executeManageProject,
  executeManageSprints,
} from "../../../../infrastructure/tools/compound/compound-executors";

const createIssue = vi.fn();
const updateProject = vi.fn();
const closeProject = vi.fn();
const reopenProject = vi.fn();
const deleteSprint = vi.fn();

vi.mock("../../../../container", () => ({
  createProjectManagementService: vi.fn(() => ({
    issues: { createIssue },
    projects: { updateProject, closeProject, reopenProject },
    sprints: { deleteSprint },
  })),
}));

let keySeed = 0;
const freshKey = () => `test-key-${process.pid}-${++keySeed}`;

describe("compound executors", () => {
  beforeEach(() => {
    createIssue.mockReset().mockResolvedValue({ id: "I_1", number: 1, title: "T" });
    updateProject.mockReset().mockResolvedValue({ id: "P_1" });
    closeProject.mockReset().mockResolvedValue({ id: "P_1", closed: true });
    reopenProject.mockReset().mockResolvedValue({ id: "P_1", closed: false });
    deleteSprint.mockReset().mockResolvedValue({ success: true, message: "deleted" });
  });

  describe("idempotencyKey", () => {
    it("creates once and replays the first result for the same key and arguments", async () => {
      const idempotencyKey = freshKey();
      const args = { action: "create", title: "T", idempotencyKey } as const;

      const first = await executeManageIssues(args);
      const second = await executeManageIssues(args);

      expect(createIssue).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ id: "I_1", number: 1, title: "T" });
      expect(second).toEqual({ id: "I_1", number: 1, title: "T", replayed: true });
    });

    it("rejects a reused key with different arguments", async () => {
      const idempotencyKey = freshKey();
      await executeManageIssues({ action: "create", title: "A", idempotencyKey });

      await expect(
        executeManageIssues({ action: "create", title: "B", idempotencyKey })
      ).rejects.toThrow(/already used with different arguments/);
      expect(createIssue).toHaveBeenCalledTimes(1);
    });

    it("ignores the key on actions that are not creates", async () => {
      const idempotencyKey = freshKey();
      await executeManageProject({
        action: "update",
        projectId: "P_1",
        title: "x",
        idempotencyKey,
      });
      await executeManageProject({
        action: "update",
        projectId: "P_1",
        title: "x",
        idempotencyKey,
      });

      expect(updateProject).toHaveBeenCalledTimes(2);
    });
  });

  describe("project update", () => {
    it("routes closed:true to closeProject and closed:false to reopenProject", async () => {
      await executeManageProject({ action: "update", projectId: "P_1", closed: true });
      await executeManageProject({ action: "update", projectId: "P_1", status: "active" });

      expect(closeProject).toHaveBeenCalledWith("P_1");
      expect(reopenProject).toHaveBeenCalledWith("P_1");
      expect(updateProject).not.toHaveBeenCalled();
    });

    it("maps shortDescription to description", async () => {
      await executeManageProject({
        action: "update",
        projectId: "P_1",
        shortDescription: "short",
      });

      expect(updateProject).toHaveBeenCalledWith({
        projectId: "P_1",
        title: undefined,
        description: "short",
        visibility: undefined,
      });
    });
  });

  describe("sprint delete", () => {
    it("refuses without confirm: true", async () => {
      await expect(executeManageSprints({ action: "delete", sprintId: "S_1" })).rejects.toThrow(
        /confirm: true/
      );
      expect(deleteSprint).not.toHaveBeenCalled();
    });

    it("deletes when confirmed", async () => {
      const result = await executeManageSprints({
        action: "delete",
        sprintId: "S_1",
        confirm: true,
      });

      expect(deleteSprint).toHaveBeenCalledWith({ sprintId: "S_1" });
      expect(result).toEqual({ success: true, message: "deleted" });
    });
  });
});
