import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

const serverModule = vi.hoisted(() => ({ loads: 0 }));
const runAuthCli = vi.hoisted(() => vi.fn());

// Evaluating the server module is what boots the MCP server and validates its
// required config, so counting factory runs counts server boots.
vi.mock("../../index", () => {
  serverModule.loads += 1;
  return {};
});
vi.mock("../../auth-cli", () => ({ runAuthCli }));

describe("process entry routing", () => {
  const originalArgv = process.argv;
  const originalExitCode = process.exitCode;
  let stdoutWrite: MockInstance<typeof process.stdout.write>;

  beforeEach(() => {
    serverModule.loads = 0;
    runAuthCli.mockReset();
    vi.resetModules();
    stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    stdoutWrite.mockRestore();
  });

  it("runs `auth ...` without booting the server and without touching stdout", async () => {
    process.argv = ["node", "bin", "auth", "login", "--scopes", "repo"];
    runAuthCli.mockResolvedValue(0);

    await import("../../bin");

    expect(runAuthCli).toHaveBeenCalledWith(["login", "--scopes", "repo"]);
    expect(serverModule.loads).toBe(0);
    expect(stdoutWrite).not.toHaveBeenCalled();
  });

  it("propagates the auth command's failure as the process exit code", async () => {
    process.argv = ["node", "bin", "auth", "status"];
    runAuthCli.mockResolvedValue(1);

    await import("../../bin");

    expect(process.exitCode).toBe(1);
  });

  it("boots the server for anything that is not an auth command", async () => {
    process.argv = ["node", "bin", "--owner", "me"];

    await import("../../bin");

    expect(serverModule.loads).toBe(1);
    expect(runAuthCli).not.toHaveBeenCalled();
  });
});
