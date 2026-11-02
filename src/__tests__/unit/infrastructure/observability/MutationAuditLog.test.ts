import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startTrace } from "../../../../infrastructure/observability/CorrelationContext";
import {
  type AuditSink,
  createMutationAuditLog,
  type MutationAuditRecord,
} from "../../../../infrastructure/observability/MutationAuditLog";

async function readLines(path: string): Promise<MutationAuditRecord[]> {
  const text = await readFile(path, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MutationAuditRecord);
}

describe("MutationAuditLog", () => {
  let dir: string;
  let path: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "audit-"));
    path = join(dir, "nested", "mutations.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes one JSONL record with the documented shape (creating directories)", async () => {
    const log = createMutationAuditLog({ enabled: true, path });

    log.recordMutation({
      tool: "github_project",
      action: "create",
      target: "project:12",
      outcome: "success",
      durationMs: 42,
      args: { title: "Roadmap" },
      actor: "agent-7",
      correlationId: "corr-1",
    });
    await log.close();

    const [record] = await readLines(path);
    expect(record).toMatchObject({
      correlationId: "corr-1",
      actor: "agent-7",
      tool: "github_project",
      action: "create",
      target: "project:12",
      outcome: "success",
      durationMs: 42,
      args: { title: "Roadmap" },
    });
    expect(new Date(record.ts).toISOString()).toBe(record.ts);
    expect(record).not.toHaveProperty("error");
  });

  it("defaults actor to 'token' and takes the correlation id from the active trace", async () => {
    const log = createMutationAuditLog({ enabled: true, path });

    await startTrace("op", async () => {
      log.recordMutation({
        tool: "t",
        action: "a",
        target: "x",
        outcome: "error",
        durationMs: 1,
        error: new Error("boom"),
      });
    });
    log.recordMutation({ tool: "t", action: "a", target: "x", outcome: "success", durationMs: 1 });
    await log.close();

    const [inTrace, outside] = await readLines(path);
    expect(inTrace.actor).toBe("token");
    expect(inTrace.correlationId).not.toBe("none");
    expect(inTrace.error).toBe("boom");
    expect(outside.correlationId).toBe("none");
  });

  it("redacts secrets in args and error text", async () => {
    const log = createMutationAuditLog({ enabled: true, path });

    log.recordMutation({
      tool: "t",
      action: "a",
      target: "x",
      outcome: "error",
      durationMs: 1,
      args: { token: "ghp_abcdefghijklmnop1234", nested: { apiKey: "sk-secret" }, title: "ok" },
      error: "failed with Bearer abcdefghijklmnop",
    });
    await log.close();

    const raw = await readFile(path, "utf8");
    expect(raw).not.toContain("ghp_abcdefghijklmnop1234");
    expect(raw).not.toContain("sk-secret");
    const [record] = await readLines(path);
    expect(record.args).toMatchObject({ token: "[REDACTED]", title: "ok" });
    expect(record.error).toBe("failed with Bearer [REDACTED]");
  });

  it("is a no-op when disabled", async () => {
    const log = createMutationAuditLog({ enabled: false, path });

    log.recordMutation({ tool: "t", action: "a", target: "x", outcome: "success", durationMs: 1 });
    await log.close();

    expect(log.enabled).toBe(false);
    await expect(readdir(dir)).resolves.toEqual([]);
  });

  it("rotates by size and keeps at most `keep` files", async () => {
    const log = createMutationAuditLog({ enabled: true, path, maxBytes: 400, keep: 2 });

    for (let i = 0; i < 12; i++) {
      log.recordMutation({
        tool: "t",
        action: "a",
        target: `item:${i}`,
        outcome: "success",
        durationMs: i,
      });
      await log.flush();
    }
    await log.close();

    const files = (await readdir(join(dir, "nested"))).sort();
    expect(files).toEqual(["mutations.jsonl", "mutations.jsonl.1", "mutations.jsonl.2"]);
    const current = await readLines(path);
    expect(current.at(-1)?.target).toBe("item:11");
    const newestRotated = await readLines(`${path}.1`);
    expect(Number(newestRotated.at(-1)?.target.split(":")[1])).toBeLessThan(
      Number(current[0].target.split(":")[1])
    );
  });

  it("serializes concurrent records without losing or interleaving any", async () => {
    const log = createMutationAuditLog({ enabled: true, path });

    for (let i = 0; i < 100; i++) {
      log.recordMutation({
        tool: "t",
        action: "a",
        target: `item:${i}`,
        outcome: "success",
        durationMs: i,
      });
    }
    await log.close();

    const records = await readLines(path);
    expect(records.map((r) => r.target)).toEqual(
      Array.from({ length: 100 }, (_, i) => `item:${i}`)
    );
  });

  it("never throws into the caller when the file cannot be written", async () => {
    const blocker = join(dir, "blocker");
    await writeFile(blocker, "i am a file");
    const log = createMutationAuditLog({ enabled: true, path: join(blocker, "x", "audit.jsonl") });

    expect(() =>
      log.recordMutation({ tool: "t", action: "a", target: "x", outcome: "success", durationMs: 1 })
    ).not.toThrow();
    await expect(log.flush()).resolves.toBeUndefined();
    await expect(log.close()).resolves.toBeUndefined();
  });

  it("never throws when the sink itself throws or args are unserializable", async () => {
    const throwing: AuditSink = {
      append() {
        throw new Error("sink down");
      },
      flush: () => Promise.reject(new Error("flush down")),
      close: () => Promise.reject(new Error("close down")),
    };
    const log = createMutationAuditLog({ enabled: true }, throwing);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() =>
      log.recordMutation({
        tool: "t",
        action: "a",
        target: "x",
        outcome: "success",
        durationMs: 1,
        args: circular,
      })
    ).not.toThrow();
    await expect(log.flush()).resolves.toBeUndefined();
    await expect(log.close()).resolves.toBeUndefined();
  });

  describe("trackMutation", () => {
    it("records success with duration and returns the result", async () => {
      const log = createMutationAuditLog({ enabled: true, path });

      const result = await log.trackMutation(
        { tool: "t", action: "a", target: "x", args: { n: 1 } },
        async () => "done"
      );
      await log.close();

      expect(result).toBe("done");
      const [record] = await readLines(path);
      expect(record.outcome).toBe("success");
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("records the failure and rethrows the original error", async () => {
      const log = createMutationAuditLog({ enabled: true, path });
      const failure = new Error("nope");

      await expect(
        log.trackMutation({ tool: "t", action: "a", target: "x" }, async () => {
          throw failure;
        })
      ).rejects.toBe(failure);
      await log.close();

      const [record] = await readLines(path);
      expect(record).toMatchObject({ outcome: "error", error: "nope" });
    });
  });
});
