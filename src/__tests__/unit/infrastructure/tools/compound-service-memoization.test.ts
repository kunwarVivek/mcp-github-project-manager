import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GitHubAuth,
  GitHubAuthSource,
} from "../../../../infrastructure/github/auth/GitHubAuth";
import { executeManageProject } from "../../../../infrastructure/tools/compound/compound-executors";

const updateProject = vi.fn();
const createProjectManagementService = vi.fn(() => ({ projects: { updateProject } }));

vi.mock("../../../../container", () => ({
  createProjectManagementService: (...args: unknown[]) =>
    createProjectManagementService(...(args as [])),
}));

let currentSource: GitHubAuthSource = "env";
vi.mock("../../../../infrastructure/github/auth/resolveGitHubAuth", () => ({
  resolveGitHubAuth: (): GitHubAuth => ({
    mode: currentSource === "oauth-store" ? "oauth-user" : "token",
    source: currentSource,
    octokitAuth: () => ({}),
    getToken: async () => "t",
  }),
}));

const update = () => executeManageProject({ action: "update", projectId: "P_1", title: "x" });

describe("compound executor service lifetime", () => {
  beforeEach(() => {
    updateProject.mockReset().mockResolvedValue({ id: "P_1" });
  });

  // Regression: the service (and with it the Octokit whose rate-limit budget
  // GitHubRequestExecutor learns) was rebuilt on every call, so v4.0.0's
  // proactive budgeting never carried from one tool call to the next.
  it("reuses one service across calls with the same credential, and rebuilds when the credential tier changes", async () => {
    await update();
    await update();
    expect(createProjectManagementService).toHaveBeenCalledTimes(1);

    currentSource = "oauth-store"; // e.g. `auth login` performed after start
    await update();
    await update();
    expect(createProjectManagementService).toHaveBeenCalledTimes(2);
    expect(updateProject).toHaveBeenCalledTimes(4);
  });
});
