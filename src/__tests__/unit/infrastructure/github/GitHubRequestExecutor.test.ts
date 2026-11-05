import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { RateLimitError } from "../../../../domain/errors";
import { GitHubRequestExecutor } from "../../../../infrastructure/github/GitHubRequestExecutor";
import { RateLimitManager } from "../../../../infrastructure/github/RateLimitManager";
import type { OctokitInstance } from "../../../../infrastructure/github/types";
import { asOctokit } from "../../../helpers/mockTypes";

describe("GitHubRequestExecutor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function octokitWith(graphql: Mock): OctokitInstance {
    return asOctokit({ graphql });
  }

  it("retries a retryable failure and then succeeds", async () => {
    const executor = new GitHubRequestExecutor(new RateLimitManager({ floor: 0 }));
    const operation = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("bad gateway"), { status: 502 }))
      .mockResolvedValueOnce("ok");

    const result = executor.run("rest", operation, "testing");
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable failure", async () => {
    const executor = new GitHubRequestExecutor(new RateLimitManager({ floor: 0 }));
    const operation = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

    await expect(executor.run("rest", operation, "testing")).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("refuses to fire when the budget is exhausted beyond the maximum wait", async () => {
    const limiter = new RateLimitManager({ floor: 100, maxWaitMs: 1000 });
    limiter.record("graphql", { remaining: 0, resetAt: new Date(Date.now() + 120_000) });
    const graphql = vi.fn();
    const executor = new GitHubRequestExecutor(limiter);

    await expect(
      executor.graphql(octokitWith(graphql), "query", {}, "testing")
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(graphql).not.toHaveBeenCalled();
  });

  it("folds a GraphQL rateLimit field into the budget", async () => {
    const limiter = new RateLimitManager({ floor: 100 });
    const resetAt = new Date(Date.now() + 60_000);
    const graphql = vi.fn().mockResolvedValue({
      rateLimit: { remaining: 4321, resetAt: resetAt.toISOString() },
    });
    const executor = new GitHubRequestExecutor(limiter);

    await executor.graphql(octokitWith(graphql), "query", {}, "testing");

    expect(limiter.getBudget("graphql")).toEqual({ remaining: 4321, resetAt });
  });

  it("learns the budget from response headers through the Octokit hook", async () => {
    const hooks: { after?: (response: { headers: Record<string, string> }) => void } = {};
    const octokit = {
      hook: {
        after: (_name: string, fn: typeof hooks.after) => {
          hooks.after = fn;
        },
        error: vi.fn(),
      },
    } as unknown as OctokitInstance;

    const executor = GitHubRequestExecutor.for(octokit);
    const reset = Math.floor(Date.now() / 1000) + 60;
    hooks.after?.({
      headers: {
        "x-ratelimit-resource": "core",
        "x-ratelimit-remaining": "17",
        "x-ratelimit-reset": String(reset),
      },
    });

    expect(executor.rateLimiter.getBudget("rest")?.remaining).toBe(17);
    expect(GitHubRequestExecutor.for(octokit)).toBe(executor);
  });
});
