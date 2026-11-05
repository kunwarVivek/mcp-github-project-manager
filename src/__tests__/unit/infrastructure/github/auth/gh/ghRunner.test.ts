import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFileSync = vi.hoisted(() => vi.fn());
const spawnSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFileSync, spawnSync }));

const { systemGhRunner } = await import("../../../../../../infrastructure/github/auth/gh/ghRunner");

describe("systemGhRunner", () => {
  // NB: block bodies are required. An arrow with an implicit return hands the
  // mock back to Vitest, which treats a returned function as a teardown callback.
  beforeEach(() => {
    execFileSync.mockReset();
    spawnSync.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("capture never shells out: execFileSync with an argument array, bounded, stderr discarded", () => {
    execFileSync.mockReturnValue("gho_x\n");
    const result = systemGhRunner.capture(["auth", "token"]);

    expect(result).toEqual({ status: "ok", stdout: "gho_x\n" });
    const [bin, args, opts] = execFileSync.mock.calls[0];
    expect(bin).toBe("gh");
    expect(args).toEqual(["auth", "token"]);
    // stderr discarded so a gh error can never reach stdout and corrupt the MCP
    // protocol stream; bounded so a hung binary can't stall startup.
    expect(opts.stdio).toEqual(["ignore", "pipe", "ignore"]);
    expect(opts.timeout).toBeGreaterThan(0);
  });

  it("capture reports a missing binary distinctly from a failing gh", () => {
    execFileSync.mockImplementation(() => {
      throw Object.assign(new Error("spawn gh ENOENT"), { code: "ENOENT" });
    });
    expect(systemGhRunner.capture(["--version"])).toEqual({ status: "missing" });

    execFileSync.mockImplementation(() => {
      throw new Error("exit 1");
    });
    expect(systemGhRunner.capture(["auth", "token"])).toEqual({ status: "failed" });
  });

  it("interactive inherits stdin/stderr and sends gh's stdout to OUR stderr (fd 2)", () => {
    spawnSync.mockReturnValue({ status: 0 });
    expect(systemGhRunner.interactive(["auth", "login"])).toEqual({ status: "exited", code: 0 });
    const [bin, args, opts] = spawnSync.mock.calls[0];
    expect(bin).toBe("gh");
    expect(args).toEqual(["auth", "login"]);
    expect(opts.stdio).toEqual(["inherit", 2, "inherit"]);
  });

  it("interactive maps a missing binary and a signal exit", () => {
    spawnSync.mockReturnValue({ error: Object.assign(new Error("x"), { code: "ENOENT" }) });
    expect(systemGhRunner.interactive(["auth", "login"])).toEqual({ status: "missing" });
    spawnSync.mockReturnValue({ status: null });
    expect(systemGhRunner.interactive(["auth", "login"])).toEqual({ status: "exited", code: 1 });
  });
});
