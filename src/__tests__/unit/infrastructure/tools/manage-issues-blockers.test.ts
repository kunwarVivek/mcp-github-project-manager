import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeManageIssues } from "../../../../infrastructure/tools/compound/compound-executors";

/**
 * `manage_issues remove_blocker` must answer with a payload.
 *
 * The service method resolves to `undefined`; passing that straight through
 * produced an MCP result with no content block at all, which the client
 * rejected as an invalid tools/call result even though the edge had been
 * removed on GitHub.
 */

const removeIssueBlocker = vi.fn();
const addIssueBlocker = vi.fn();

vi.mock("../../../../container", () => ({
  createProjectManagementService: vi.fn(() => ({
    removeIssueBlocker,
    addIssueBlocker,
  })),
}));

describe("manage_issues blocker actions", () => {
  beforeEach(() => {
    removeIssueBlocker.mockReset().mockResolvedValue(undefined);
    addIssueBlocker.mockReset();
  });

  it("remove_blocker removes the edge and returns a payload naming it", async () => {
    const result = await executeManageIssues({
      action: "remove_blocker",
      issueId: "I_blocked",
      blockingIssueId: "I_blocker",
    } as Parameters<typeof executeManageIssues>[0]);

    expect(removeIssueBlocker).toHaveBeenCalledWith("I_blocked", "I_blocker");
    expect(result).toEqual({
      success: true,
      issueId: "I_blocked",
      blockingIssueId: "I_blocker",
      message: "Blocker removed",
    });
  });

  it("remove_blocker still requires both issues", async () => {
    await expect(
      executeManageIssues({
        action: "remove_blocker",
        issueId: "I_blocked",
      } as Parameters<typeof executeManageIssues>[0])
    ).rejects.toThrow("blockingIssueId is required for remove_blocker");
    expect(removeIssueBlocker).not.toHaveBeenCalled();
  });
});
