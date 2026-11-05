import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitError } from "../../../../domain/errors";
import { RateLimitManager } from "../../../../infrastructure/github/RateLimitManager";

describe("RateLimitManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const inSeconds = (s: number) => new Date(Date.now() + s * 1000);

  it("passes immediately when the pool is unknown", async () => {
    const manager = new RateLimitManager({ floor: 100 });
    await expect(manager.acquire("graphql")).resolves.toBeUndefined();
  });

  it("passes immediately when remaining is at or above the floor", async () => {
    const manager = new RateLimitManager({ floor: 100 });
    manager.record("graphql", { remaining: 100, resetAt: inSeconds(30) });

    let done = false;
    void manager.acquire("graphql", 5).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(0);

    expect(done).toBe(true);
    expect(manager.getBudget("graphql")?.remaining).toBe(95);
  });

  it("waits for the reset when remaining is below the floor", async () => {
    const manager = new RateLimitManager({ floor: 100 });
    manager.record("graphql", { remaining: 99, resetAt: inSeconds(20) });

    let done = false;
    void manager.acquire("graphql").then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(19_000);
    expect(done).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(done).toBe(true);
    // The stale reading is dropped once the window rolls over.
    expect(manager.getBudget("graphql")).toBeUndefined();
  });

  it("throws RateLimitError with the reset date when the wait exceeds the maximum", async () => {
    const manager = new RateLimitManager({ floor: 100, maxWaitMs: 60_000 });
    const resetAt = inSeconds(120);
    manager.record("rest", { remaining: 0, resetAt });

    const error = await manager.acquire("rest").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).resetDate).toEqual(resetAt);
  });

  it("tracks the pools independently", async () => {
    const manager = new RateLimitManager({ floor: 100, maxWaitMs: 1000 });
    manager.record("graphql", { remaining: 0, resetAt: inSeconds(120) });

    await expect(manager.acquire("rest")).resolves.toBeUndefined();
    await expect(manager.acquire("graphql")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("learns the budget from response headers by resource", () => {
    const manager = new RateLimitManager({ floor: 100 });
    const reset = Math.floor(Date.now() / 1000) + 60;

    manager.recordHeaders({
      "x-ratelimit-resource": "graphql",
      "x-ratelimit-remaining": "42",
      "x-ratelimit-reset": String(reset),
    });
    manager.recordHeaders({
      "x-ratelimit-resource": "core",
      "x-ratelimit-remaining": "4000",
      "x-ratelimit-reset": String(reset),
    });
    manager.recordHeaders({
      "x-ratelimit-resource": "search",
      "x-ratelimit-remaining": "1",
      "x-ratelimit-reset": String(reset),
    });

    expect(manager.getBudget("graphql")).toEqual({
      remaining: 42,
      resetAt: new Date(reset * 1000),
    });
    expect(manager.getBudget("rest")?.remaining).toBe(4000);
  });

  it("learns the budget from the GraphQL rateLimit field", () => {
    const manager = new RateLimitManager({ floor: 100 });
    const resetAt = inSeconds(60);

    manager.recordGraphQLRateLimit({ remaining: 7, resetAt: resetAt.toISOString() });

    expect(manager.getBudget("graphql")).toEqual({ remaining: 7, resetAt });
  });
});
