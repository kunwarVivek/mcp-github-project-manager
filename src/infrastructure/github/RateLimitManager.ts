import { z } from "zod";
import { RateLimitError } from "../../domain/errors";
import { RATE_LIMIT_FLOOR } from "../../env";

/** GitHub rate-limit pools tracked separately: the GraphQL points budget and the REST (core) budget. */
export type RateLimitKind = "graphql" | "rest";

/** Last known quota for one pool. */
export interface RateLimitBudget {
  remaining: number;
  resetAt: Date;
}

export interface RateLimitManagerOptions {
  /** Wait for the reset once `remaining` falls below this. Defaults to `RATE_LIMIT_FLOOR`. */
  floor?: number;
  /** Longest wait `acquire` accepts; a longer reset throws `RateLimitError`. Default 60s. */
  maxWaitMs?: number;
}

/** The `rateLimit { remaining resetAt }` object GraphQL responses may carry. */
export interface GraphQLRateLimitField {
  remaining: number;
  resetAt: string;
}

/** Minimal shape of an Octokit instance's hook collection that we need. */
interface HookableOctokit {
  hook: {
    after(name: "request", fn: (response: { headers?: Record<string, unknown> }) => void): void;
    error(name: "request", fn: (error: unknown) => never): void;
  };
}

const DEFAULT_MAX_WAIT_MS = 60_000;

const ErrorWithHeaders = z.object({
  response: z.object({ headers: z.record(z.string(), z.unknown()) }),
});

function headerValue(headers: Record<string, unknown>, name: string): string | undefined {
  const value = headers[name];
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

/** Pull `response.headers` out of an Octokit request error, if present. */
function errorHeaders(error: unknown): Record<string, unknown> | undefined {
  const parsed = ErrorWithHeaders.safeParse(error);
  return parsed.success ? parsed.data.response.headers : undefined;
}

/**
 * Tracks GitHub rate-limit quota per pool from response headers and the GraphQL
 * `rateLimit` field, and gates every outgoing request on it: once a pool's
 * remaining quota drops below the floor, `acquire` waits for the reset (bounded
 * by `maxWaitMs`) instead of firing the request and eating a 403.
 *
 * No API calls of its own: quota is learned from the traffic already flowing.
 */
export class RateLimitManager {
  private readonly budgets = new Map<RateLimitKind, RateLimitBudget>();
  private readonly floor: number;
  private readonly maxWaitMs: number;

  constructor(options: RateLimitManagerOptions = {}) {
    this.floor = options.floor ?? RATE_LIMIT_FLOOR;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  }

  /** Last known quota for a pool, or undefined when nothing was observed yet. */
  getBudget(kind: RateLimitKind): RateLimitBudget | undefined {
    const budget = this.budgets.get(kind);
    return budget && { remaining: budget.remaining, resetAt: new Date(budget.resetAt) };
  }

  /** Record an authoritative quota reading for a pool. */
  record(kind: RateLimitKind, budget: RateLimitBudget): void {
    if (Number.isNaN(budget.resetAt.getTime()) || !Number.isFinite(budget.remaining)) return;
    this.budgets.set(kind, { remaining: budget.remaining, resetAt: budget.resetAt });
  }

  /**
   * Record quota from response headers. The pool comes from `x-ratelimit-resource`
   * (`graphql` or `core`); other resources (search, ...) are not tracked.
   */
  recordHeaders(headers: Record<string, unknown> | undefined): void {
    if (!headers) return;
    const resource = headerValue(headers, "x-ratelimit-resource");
    const kind: RateLimitKind | undefined =
      resource === "graphql" ? "graphql" : resource === "core" ? "rest" : undefined;
    const remaining = headerValue(headers, "x-ratelimit-remaining");
    const reset = headerValue(headers, "x-ratelimit-reset");
    if (!kind || remaining === undefined || reset === undefined) return;
    this.record(kind, {
      remaining: Number.parseInt(remaining, 10),
      resetAt: new Date(Number.parseInt(reset, 10) * 1000),
    });
  }

  /** Record quota from a GraphQL response's `rateLimit` field. */
  recordGraphQLRateLimit(rateLimit: GraphQLRateLimitField): void {
    this.record("graphql", {
      remaining: rateLimit.remaining,
      resetAt: new Date(rateLimit.resetAt),
    });
  }

  /**
   * Learn quota from every request an Octokit instance makes (REST and GraphQL,
   * successes and failures) by hooking its request pipeline.
   */
  observe(octokit: HookableOctokit): void {
    octokit.hook.after("request", (response) => {
      this.recordHeaders(response.headers);
    });
    octokit.hook.error("request", (error) => {
      this.recordHeaders(errorHeaders(error));
      throw error;
    });
  }

  /**
   * Call before a request costing `cost` points/requests. Returns immediately when
   * the pool is unknown or above the floor; otherwise waits for the reset.
   *
   * @throws RateLimitError when the reset is further away than `maxWaitMs`.
   */
  async acquire(kind: RateLimitKind, cost = 1): Promise<void> {
    const budget = this.budgets.get(kind);
    if (!budget) return;

    const waitMs = budget.resetAt.getTime() - Date.now();
    if (waitMs <= 0) {
      // The window rolled over; the stored reading is stale.
      this.budgets.delete(kind);
      return;
    }

    if (budget.remaining >= this.floor) {
      // Account for in-flight spend until the next authoritative reading arrives.
      budget.remaining -= cost;
      return;
    }

    if (waitMs > this.maxWaitMs) {
      throw new RateLimitError(
        `GitHub ${kind} rate limit nearly exhausted (${budget.remaining} remaining, floor ${this.floor}); ` +
          `reset in ${Math.ceil(waitMs / 1000)}s exceeds the ${Math.round(this.maxWaitMs / 1000)}s maximum wait`,
        budget.resetAt,
        { kind, remaining: budget.remaining, floor: this.floor }
      );
    }

    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    // Only discard the reading if nobody refreshed it while we slept.
    if (this.budgets.get(kind) === budget) this.budgets.delete(kind);
  }
}
