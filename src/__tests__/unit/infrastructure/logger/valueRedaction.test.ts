import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsoleLogger,
  redactSecretPatterns,
  redactSecrets,
} from "../../../../infrastructure/logger/index";
import { StructuredLogger } from "../../../../infrastructure/logger/StructuredLogger";

const b62 = (n: number): string => "aZ09".repeat(Math.ceil(n / 4)).slice(0, n);

const b64url = (text: string): string => Buffer.from(text).toString("base64url");
const jwt = (): string =>
  `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url('{"sub":"1234567890"}')}.${b64url("signature-bytes")}`;

const FAMILIES: ReadonlyArray<{ name: string; secret: string; marker: string }> = [
  { name: "ghp", secret: `ghp_${b62(36)}`, marker: "ghp_[REDACTED]" },
  { name: "gho", secret: `gho_${b62(36)}`, marker: "gho_[REDACTED]" },
  { name: "ghu", secret: `ghu_${b62(36)}`, marker: "ghu_[REDACTED]" },
  { name: "ghs", secret: `ghs_${b62(36)}`, marker: "ghs_[REDACTED]" },
  { name: "ghr", secret: `ghr_${b62(36)}`, marker: "ghr_[REDACTED]" },
  {
    name: "github_pat",
    secret: `github_pat_${b62(22)}_${b62(59)}`,
    marker: "github_pat_[REDACTED]",
  },
  {
    name: "jwt",
    secret: jwt(),
    marker: "eyJ[REDACTED JWT]",
  },
  { name: "anthropic", secret: `sk-ant-api03-${b62(40)}`, marker: "sk-ant-[REDACTED]" },
  { name: "openai", secret: `sk-${b62(48)}`, marker: "sk-[REDACTED]" },
  { name: "openai-proj", secret: `sk-proj-${b62(48)}`, marker: "sk-proj-[REDACTED]" },
  { name: "google", secret: `AIza${b62(35)}`, marker: "AIza[REDACTED]" },
];

describe("redactSecretPatterns", () => {
  for (const { name, secret, marker } of FAMILIES) {
    it(`redacts ${name} tokens and keeps the kind marker`, () => {
      const out = redactSecretPatterns(`request failed with ${secret} (retrying)`);
      expect(out).toBe(`request failed with ${marker} (retrying)`);
    });
  }

  it("redacts Authorization header values of any length and scheme casing", () => {
    expect(redactSecretPatterns("Authorization: Bearer abc")).toBe(
      "Authorization: Bearer [REDACTED]"
    );
    expect(redactSecretPatterns('headers {"authorization":"Basic dXNlcjpwYXNz"}')).toBe(
      'headers {"authorization":"Basic [REDACTED]"}'
    );
    expect(redactSecretPatterns(`sent bearer ${b62(40)} upstream`)).toBe(
      "sent bearer [REDACTED] upstream"
    );
  });

  it("redacts a PEM private key block, including an unterminated one", () => {
    const body = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\nabcdef==";
    const pem = `-----BEGIN ${"RSA "}PRIVATE KEY-----\n${body}\n-----END ${"RSA "}PRIVATE KEY-----`;
    expect(redactSecretPatterns(`key=${pem} after`)).toBe("key=[REDACTED PRIVATE KEY BLOCK] after");
    const out = redactSecretPatterns(`x -----BEGIN PRIVATE KEY-----\n${body}`);
    expect(out).toBe("x [REDACTED PRIVATE KEY BLOCK]");
    expect(out).not.toContain("MIIEvQ");
  });

  it("redacts several secrets in one string", () => {
    const out = redactSecretPatterns(
      `a=${FAMILIES[0].secret} b=${FAMILIES.find((f) => f.name === "google")?.secret}`
    );
    expect(out).toBe("a=ghp_[REDACTED] b=AIza[REDACTED]");
  });

  it("leaves near-misses alone", () => {
    const nearMisses = [
      "sketch",
      "sk-abcde",
      "task-management-service-configuration-name-1",
      "123e4567-e89b-12d3-a456-426614174000",
      "9fceb02d0ae598e95dc970b74767f19372d61af8",
      "ghp_short",
      "AIzaTooShort",
      "eyJ.too.short",
      "Basic usage of the logger",
      "Bearer token missing",
      "-----BEGIN CERTIFICATE-----",
    ];
    for (const text of nearMisses) {
      expect(redactSecretPatterns(text)).toBe(text);
    }
  });

  it("does not treat a longer identifier as containing a token", () => {
    const text = `x${FAMILIES[0].secret}`;
    expect(redactSecretPatterns(text)).toBe(text);
  });

  it("handles pathological input in linear time", () => {
    const inputs = [
      `sk-${"a".repeat(1_000_000)}`,
      `${"Bearer ".repeat(100_000)}`,
      `Bearer${" ".repeat(1_000_000)}x`,
      `${"-----BEGIN PRIVATE KEY-----".repeat(20_000)}`,
      `eyJ${"a".repeat(500_000)}.${"b".repeat(500_000)}`,
      `${"ghp_".repeat(250_000)}`,
      `${"AIza".repeat(250_000)}`,
    ];
    const start = performance.now();
    for (const input of inputs) {
      redactSecretPatterns(input);
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe("redactSecrets string handling", () => {
  it("redacts string values at any depth and inside Errors", () => {
    const secret = FAMILIES[0].secret;
    const err = new Error(`boom ${secret}`);
    const out = redactSecrets({ a: { b: [`x ${secret}`] }, err }) as {
      a: { b: string[] };
      err: { message: string; stack: string };
    };
    expect(out.a.b[0]).toBe("x ghp_[REDACTED]");
    expect(out.err.message).toBe("boom ghp_[REDACTED]");
    expect(out.err.stack).not.toContain(secret);
  });
});

describe("log sinks", () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    StructuredLogger.resetInstance();
  });

  for (const { name, secret } of FAMILIES) {
    it(`ConsoleLogger redacts ${name} in message, string vararg and nested value`, () => {
      new ConsoleLogger("T").error(`failed with ${secret}`, `raw ${secret}`, {
        detail: { note: `see ${secret}` },
      });
      expect(written.join("")).not.toContain(secret);
      expect(written.join("")).toContain("[REDACTED");
    });

    it(`StructuredLogger json format redacts ${name} in message, context and error`, () => {
      vi.stubEnv("LOG_FORMAT", "json");
      StructuredLogger.resetInstance();
      StructuredLogger.getInstance().error(`failed with ${secret}`, new Error(`inner ${secret}`), {
        detail: `ctx ${secret}`,
      });
      const output = written.join("");
      expect(output).not.toContain(secret);
      const entry = JSON.parse(output) as { message: string; error: { message: string } };
      expect(entry.message).toContain("[REDACTED");
      expect(entry.error.message).toContain("[REDACTED");
    });

    it(`StructuredLogger text format redacts ${name}`, () => {
      vi.stubEnv("LOG_FORMAT", "text");
      StructuredLogger.resetInstance();
      StructuredLogger.getInstance().warn(`m ${secret}`, { c: secret });
      expect(written.join("")).not.toContain(secret);
    });
  }

  it("keeps non-secret message text intact", () => {
    new ConsoleLogger("T").info("sketch of 9fceb02d0ae598e95dc970b74767f19372d61af8");
    expect(written.join("")).toBe("[T] sketch of 9fceb02d0ae598e95dc970b74767f19372d61af8\n");
  });
});
