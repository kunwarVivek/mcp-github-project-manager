import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleLogger, redactSecrets } from "../../../../infrastructure/logger/index";
import { traceContext } from "../../../../infrastructure/observability/CorrelationContext";

describe("redactSecrets", () => {
  it("redacts credential-shaped keys regardless of casing or separators", () => {
    const redacted = redactSecrets({
      GITHUB_TOKEN: "ghp_realtoken",
      githubToken: "ghp_realtoken",
      "github-token": "ghp_realtoken",
      apiKey: "sk-real",
      API_KEY: "sk-real",
      clientSecret: "shh",
      authorization: "Bearer real",
      password: "hunter2",
    }) as Record<string, unknown>;

    for (const value of Object.values(redacted)) {
      expect(value).toBe("[REDACTED]");
    }
  });

  it('leaves non-secret keys alone, including ones merely containing "key"', () => {
    expect(redactSecrets({ owner: "me", repo: "proj", keywords: ["a"], monkey: "ok" })).toEqual({
      owner: "me",
      repo: "proj",
      keywords: ["a"],
      monkey: "ok",
    });
  });

  it("redacts nested and array-nested secrets", () => {
    expect(
      redactSecrets({ github: { config: { token: "ghp_x" } }, agents: [{ apiKey: "sk" }] })
    ).toEqual({ github: { config: { token: "[REDACTED]" } }, agents: [{ apiKey: "[REDACTED]" }] });
  });

  it("matches whole key segments so token-usage counters stay visible", () => {
    expect(
      redactSecrets({ inputTokens: 5, maxTokens: 9, outputTokens: 1, token: "x", secretKey: "y" })
    ).toEqual({
      inputTokens: 5,
      maxTokens: 9,
      outputTokens: 1,
      token: "[REDACTED]",
      secretKey: "[REDACTED]",
    });
  });

  it("does not mark repeated non-circular references as [Circular]", () => {
    const shared = { owner: "me" };
    expect(redactSecrets({ a: shared, b: shared, c: [shared, shared] })).toEqual({
      a: { owner: "me" },
      b: { owner: "me" },
      c: [{ owner: "me" }, { owner: "me" }],
    });
  });

  it("scrubs secret-shaped string values under innocuous keys", () => {
    expect(redactSecrets({ header: "Bearer abcdef123456", note: "ghp_abcdefghijklmnop" })).toEqual({
      header: "Bearer [REDACTED]",
      note: "[REDACTED]",
    });
  });

  it("does not hang on circular references", () => {
    const cyclic: Record<string, unknown> = { token: "ghp_x" };
    cyclic.self = cyclic;
    expect(redactSecrets(cyclic)).toEqual({ token: "[REDACTED]", self: "[Circular]" });
  });

  it("flattens Errors instead of dropping them", () => {
    const result = redactSecrets(new Error("boom")) as Record<string, unknown>;
    expect(result.name).toBe("Error");
    expect(result.message).toBe("boom");
  });

  it("passes primitives through untouched", () => {
    expect(redactSecrets("plain")).toBe("plain");
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBeNull();
  });
});

describe("ConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never writes a token to stderr", () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    new ConsoleLogger("TEST", { level: "debug" }).debug("booting", {
      github: { owner: "me", token: "ghp_SUPERSECRET" },
    });

    const output = written.join("");
    expect(output).not.toContain("ghp_SUPERSECRET");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("me");
  });

  it("writes to stderr, never stdout (stdout carries the MCP protocol)", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    vi.spyOn(process.stderr, "write").mockReturnValue(true);
    new ConsoleLogger("TEST").info("hello", { a: 1 });
    expect(stdout).not.toHaveBeenCalled();
  });

  it("filters by level", () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    const logger = new ConsoleLogger("T", { level: "warn" });
    logger.debug("d-msg");
    logger.info("i-msg");
    logger.warn("w-msg");
    logger.error("e-msg");

    const output = written.join("");
    expect(output).not.toContain("d-msg");
    expect(output).not.toContain("i-msg");
    expect(output).toContain("w-msg");
    expect(output).toContain("e-msg");
  });

  it("redacts secret-shaped values in the message string", () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });

    new ConsoleLogger("T", { level: "debug" }).info(
      "auth failed ghp_abcdefghijklmnopqrstuvwxyz0123 Bearer abcdef123456 github_pat_11ABCDEFG0123456789_xyz"
    );

    const output = written.join("");
    expect(output).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123");
    expect(output).not.toContain("abcdef123456");
    expect(output).not.toContain("github_pat_11ABCDEFG");
    expect(output).toContain("Bearer [REDACTED]");
  });

  it("emits JSON with the active correlationId when format is json", () => {
    const written: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    const logger = new ConsoleLogger("J", { format: "json", level: "info" });

    traceContext.run({ correlationId: "corr-1", startTime: Date.now(), operation: "op" }, () => {
      logger.info("inside", { token: "ghp_x", count: 2 });
    });
    logger.info("outside");

    const [inside, outside] = written.map((line) => JSON.parse(line));
    expect(inside).toMatchObject({
      level: "info",
      correlationId: "corr-1",
      operation: "op",
      message: "[J] inside",
      data: { token: "[REDACTED]", count: 2 },
    });
    expect(outside.correlationId).toBe("no-trace");
  });
});
