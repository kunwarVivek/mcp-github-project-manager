import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

const GITHUB_TOKEN = `ghp_${"a1B2c3D4e5".repeat(4).slice(0, 36)}`;

vi.mock("../../../../cli", () => ({
  parseCommandLineArgs: () => ({
    verbose: false,
    envFile: undefined,
    token: undefined,
    owner: undefined,
    repo: undefined,
  }),
}));

vi.mock("../../../../domain/config-schema", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  validateConfig: () => {
    throw new Error(`Invalid GITHUB_TOKEN value ${GITHUB_TOKEN} rejected by schema`);
  },
  validateConfigWarnings: () => [`deprecated credential ${GITHUB_TOKEN} still in use`],
}));

describe("env startup configuration errors", () => {
  let stderrSpy: MockInstance<typeof process.stderr.write>;
  let exitSpy: MockInstance<typeof process.exit>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("scrubs credential-shaped values from [CONFIG] errors and warnings, keeping the message", async () => {
    await import("../../../../env");

    const text = stderrSpy.mock.calls.map((call) => String(call[0])).join("");
    expect(text).toContain("[CONFIG] Invalid GITHUB_TOKEN value");
    expect(text).toContain("rejected by schema");
    expect(text).toContain("[CONFIG WARNING] deprecated credential");
    expect(text).toContain("still in use");
    expect(text).not.toContain(GITHUB_TOKEN);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
