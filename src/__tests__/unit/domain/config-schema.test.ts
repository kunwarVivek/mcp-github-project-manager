import { describe, expect, it } from "vitest";
import { validateConfig } from "../../../domain/config-schema";

const requiredGithub = {
  GITHUB_TOKEN: "ghp_test",
  GITHUB_OWNER: "owner",
  GITHUB_REPO: "repo",
};

describe("config-schema boolean flags", () => {
  // Regression: z.coerce.boolean() applies JS truthiness, so the string "false"
  // parsed to `true` — a fail-open default for WEBHOOK_ALLOW_UNSIGNED.
  it.each([
    ["false", false],
    ["FALSE", false],
    ["0", false],
    ["no", false],
    ["", false],
    ["true", true],
    ["TRUE", true],
    ["1", true],
  ])("WEBHOOK_ALLOW_UNSIGNED=%s -> %s", (raw, expected) => {
    const cfg = validateConfig({ ...requiredGithub, WEBHOOK_ALLOW_UNSIGNED: raw });
    expect(cfg.webhook?.WEBHOOK_ALLOW_UNSIGNED).toBe(expected);
  });

  it("WEBHOOK_ALLOW_UNSIGNED defaults to false when unset", () => {
    const cfg = validateConfig({ ...requiredGithub });
    expect(cfg.webhook?.WEBHOOK_ALLOW_UNSIGNED).toBe(false);
  });

  it("SYNC_ENABLED=false disables sync", () => {
    const cfg = validateConfig({ ...requiredGithub, SYNC_ENABLED: "false" });
    expect(cfg.sync?.SYNC_ENABLED).toBe(false);
  });

  it("SYNC_ENABLED defaults to true when unset", () => {
    const cfg = validateConfig({ ...requiredGithub });
    expect(cfg.sync?.SYNC_ENABLED).toBe(true);
  });

  it("still rejects a missing GitHub token", () => {
    expect(() => validateConfig({ GITHUB_OWNER: "o", GITHUB_REPO: "r" })).toThrow(/GITHUB_TOKEN/);
  });

  it("accepts complete GitHub App credentials without a token", () => {
    const cfg = validateConfig({
      GITHUB_OWNER: "o",
      GITHUB_REPO: "r",
      GITHUB_APP_ID: "1",
      GITHUB_APP_PRIVATE_KEY: "key",
      GITHUB_APP_INSTALLATION_ID: "2",
    });
    expect(cfg.github.GITHUB_TOKEN).toBeUndefined();
  });

  it("rejects partial App credentials without a token", () => {
    expect(() =>
      validateConfig({ GITHUB_OWNER: "o", GITHUB_REPO: "r", GITHUB_APP_ID: "1" })
    ).toThrow(/GITHUB_TOKEN/);
  });

  it("defaults the webhook bind host to loopback and events auth to closed", () => {
    const cfg = validateConfig({ ...requiredGithub });
    expect(cfg.webhook?.WEBHOOK_HOST).toBe("127.0.0.1");
    expect(cfg.webhook?.EVENTS_ALLOW_UNAUTHENTICATED).toBe(false);
    expect(cfg.webhook?.WEBHOOK_TRUSTED_PROXIES).toBe("");
  });

  it("EVENTS_ALLOW_UNAUTHENTICATED=false stays closed", () => {
    const cfg = validateConfig({ ...requiredGithub, EVENTS_ALLOW_UNAUTHENTICATED: "false" });
    expect(cfg.webhook?.EVENTS_ALLOW_UNAUTHENTICATED).toBe(false);
  });

  it("parses the observability and runtime options", () => {
    const cfg = validateConfig({
      ...requiredGithub,
      AUDIT_LOG_ENABLED: "true",
      RATE_LIMIT_FLOOR: "250",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
      EVENT_RETENTION_DAYS: "14",
      AGENT_RECLAIM_INTERVAL_MS: "0",
    });
    expect(cfg.observability).toMatchObject({
      AUDIT_LOG_ENABLED: true,
      AUDIT_LOG_PATH: ".mcp-audit/mutations.jsonl",
      OTEL_SERVICE_NAME: "mcp-github-project-manager",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
      RATE_LIMIT_FLOOR: 250,
    });
    expect(cfg.sync?.EVENT_RETENTION_DAYS).toBe(14);
    expect(cfg.agent?.AGENT_RECLAIM_INTERVAL_MS).toBe(0);
  });

  it("treats empty-string values as unset", () => {
    const cfg = validateConfig({ ...requiredGithub, EVENT_RETENTION_DAYS: "", WEBHOOK_HOST: "" });
    expect(cfg.sync?.EVENT_RETENTION_DAYS).toBe(7);
    expect(cfg.webhook?.WEBHOOK_HOST).toBe("127.0.0.1");
  });
});
