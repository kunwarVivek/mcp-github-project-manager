import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  fingerprintOf,
  IdempotencyConflictError,
  IdempotencyStore,
  isIdempotentCreate,
} from "../../../../infrastructure/idempotency/IdempotencyStore";

const HOUR = 60 * 60 * 1000;

function setup(opts: { maxEntries?: number } = {}) {
  let t = 1_000_000;
  const store = new IdempotencyStore({ now: () => t, ttlMs: 24 * HOUR, ...opts });
  return { store, advance: (ms: number) => (t += ms), now: () => t };
}

describe("fingerprintOf", () => {
  it("is key-order independent and ignores idempotencyKey/cursor", () => {
    const a = fingerprintOf("manage_issues", "create", { title: "x", b: { y: 1, z: 2 } });
    const b = fingerprintOf("manage_issues", "create", {
      b: { z: 2, y: 1 },
      title: "x",
      idempotencyKey: "k",
      cursor: "c",
    });
    expect(a).toBe(b);
  });

  it("differs by tool, action and args", () => {
    const base = fingerprintOf("t", "a", { x: 1 });
    expect(fingerprintOf("t2", "a", { x: 1 })).not.toBe(base);
    expect(fingerprintOf("t", "a2", { x: 1 })).not.toBe(base);
    expect(fingerprintOf("t", "a", { x: 2 })).not.toBe(base);
  });
});

describe("isIdempotentCreate", () => {
  it("is true only for the seven create kinds", () => {
    expect(isIdempotentCreate("manage_issues", "create")).toBe(true);
    expect(isIdempotentCreate("manage_issues", "add_sub_issue")).toBe(true);
    expect(isIdempotentCreate("manage_issues", "create_draft")).toBe(true);
    expect(isIdempotentCreate("manage_issues", "create_comment")).toBe(true);
    expect(isIdempotentCreate("manage_milestones", "create")).toBe(true);
    expect(isIdempotentCreate("manage_sprints", "create")).toBe(true);
    expect(isIdempotentCreate("manage_project", "create_field")).toBe(true);
    expect(isIdempotentCreate("manage_project", "create")).toBe(false);
    expect(isIdempotentCreate("manage_issues", "update")).toBe(false);
    expect(isIdempotentCreate("manage_prs", "create")).toBe(false);
  });
});

describe("IdempotencyStore", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it("runs fn each time when no key is given", async () => {
    const { store } = setup();
    let n = 0;
    const r1 = await store.run(undefined, "f", async () => ++n);
    const r2 = await store.run(undefined, "f", async () => ++n);
    expect([r1.value, r1.replayed, r2.value, r2.replayed]).toEqual([1, false, 2, false]);
  });
  it("shares an in-flight call", async () => {
    const { store } = setup();
    let calls = 0;
    let release!: (value: string) => void;
    const gate = new Promise<string>((resolve) => {
      release = resolve;
    });
    const fn = () => {
      calls++;
      return gate;
    };
    const p1 = store.run("k", "f", fn);
    const p2 = store.run("k", "f", fn);
    release("created");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(calls).toBe(1);
    expect(r1).toMatchObject({ value: "created", replayed: false });
    expect(r2).toMatchObject({ value: "created", replayed: true });
  });

  it("replays within the TTL with the cached value and summary", async () => {
    const { store, advance } = setup();
    let calls = 0;
    await store.run(
      "k",
      "f",
      async () => ({ id: ++calls }),
      (v) => ({ id: v.id })
    );
    advance(23 * HOUR);
    const again = await store.run("k", "f", async () => ({ id: ++calls }));
    expect(calls).toBe(1);
    expect(again).toEqual({ value: { id: 1 }, replayed: true, summary: { id: 1 } });
  });

  it("expires after the TTL", async () => {
    const { store, advance } = setup();
    let calls = 0;
    await store.run("k", "f", async () => ++calls);
    advance(24 * HOUR + 1);
    const again = await store.run("k", "f", async () => ++calls);
    expect(again).toMatchObject({ value: 2, replayed: false });
  });

  it("throws a conflict for the same key with a different fingerprint", async () => {
    const { store } = setup();
    await store.run("k", "f1", async () => 1);
    await expect(store.run("k", "f2", async () => 2)).rejects.toBeInstanceOf(
      IdempotencyConflictError
    );
  });

  it("does not cache failures", async () => {
    const { store } = setup();
    await expect(
      store.run("k", "f", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    const retry = await store.run("k", "f", async () => "ok");
    expect(retry).toMatchObject({ value: "ok", replayed: false });
  });

  it("evicts the oldest entry beyond maxEntries", async () => {
    const { store } = setup({ maxEntries: 2 });
    let calls = 0;
    await store.run("a", "f", async () => ++calls);
    await store.run("b", "f", async () => ++calls);
    await store.run("c", "f", async () => ++calls);
    const b = await store.run("b", "f", async () => ++calls);
    const a = await store.run("a", "f", async () => ++calls);
    expect(b.replayed).toBe(true);
    expect(a.replayed).toBe(false);
  });

  it("hydrates from audit log records so duplicates are refused after restart", async () => {
    const { store, now } = setup();
    const dir = await mkdtemp(join(tmpdir(), "idem-"));
    dirs.push(dir);
    const path = join(dir, "audit.jsonl");
    const rec = (over: Record<string, unknown>) =>
      JSON.stringify({
        ts: new Date(now() - HOUR).toISOString(),
        outcome: "success",
        idempotencyKey: "k1",
        fingerprint: "fp1",
        resultSummary: { number: 7 },
        ...over,
      });
    await writeFile(
      path,
      [
        rec({}),
        rec({ idempotencyKey: "old", ts: new Date(now() - 25 * HOUR).toISOString() }),
        rec({ idempotencyKey: "failed", outcome: "error" }),
        "not json",
        JSON.stringify({ ts: new Date(now()).toISOString(), outcome: "success" }),
      ].join("\n")
    );

    expect(await store.hydrateFromAuditLog(path)).toBe(1);
    expect(await store.hydrateFromAuditLog(join(dir, "missing.jsonl"))).toBe(0);

    let calls = 0;
    const replay = await store.run("k1", "fp1", async () => ++calls);
    expect(replay).toEqual({ replayed: true, summary: { number: 7 } });
    expect(calls).toBe(0);
    await expect(store.run("k1", "other", async () => ++calls)).rejects.toBeInstanceOf(
      IdempotencyConflictError
    );
    expect((await store.run("old", "fp1", async () => ++calls)).replayed).toBe(false);
  });
});
