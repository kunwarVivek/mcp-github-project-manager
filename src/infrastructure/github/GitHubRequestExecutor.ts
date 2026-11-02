import { z } from "zod";
import { GitHubErrorHandler } from "./GitHubErrorHandler";
import { type RateLimitKind, RateLimitManager } from "./RateLimitManager";
import type { GitHubError, OctokitInstance } from "./types";

const MAX_ATTEMPTS = 3;

/** The `rateLimit { remaining resetAt }` selection GraphQL queries may include. */
const GraphQLResultRateLimit = z.object({
  rateLimit: z.object({ remaining: z.number(), resetAt: z.string() }),
});

/**
 * The one throttle/retry path for every GitHub call (REST and GraphQL, from the
 * factory and from repositories): gate on the shared `RateLimitManager` budget,
 * run the operation, retry retryable failures with GitHub-aware backoff, and
 * convert terminal failures to structured errors.
 */
export class GitHubRequestExecutor {
  private static readonly byOctokit = new WeakMap<object, GitHubRequestExecutor>();

  private readonly errorHandler = new GitHubErrorHandler();

  constructor(readonly rateLimiter: RateLimitManager = new RateLimitManager()) {}

  /**
   * The executor shared by everything built on `octokit`, created on first use
   * and wired to observe that instance's response headers. Sharing it is what
   * makes the repositories of one factory draw on a single rate-limit budget.
   */
  static for(octokit: OctokitInstance): GitHubRequestExecutor {
    let executor = GitHubRequestExecutor.byOctokit.get(octokit);
    if (!executor) {
      executor = new GitHubRequestExecutor();
      // Test doubles may not expose Octokit's hook collection; they have no headers to learn from.
      if (typeof octokit.hook?.after === "function") executor.rateLimiter.observe(octokit);
      GitHubRequestExecutor.byOctokit.set(octokit, executor);
    }
    return executor;
  }

  /** Run `operation` against the `kind` budget, retrying retryable failures. */
  async run<T>(
    kind: RateLimitKind,
    operation: () => Promise<T>,
    context: string,
    cost = 1
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      // Outside the try: a budget exhaustion is final, never retried.
      await this.rateLimiter.acquire(kind, cost);
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt >= MAX_ATTEMPTS - 1;
        if (!this.errorHandler.isRetryableError(error) || isLastAttempt) {
          throw this.errorHandler.handleError(
            error,
            isLastAttempt ? `${context} (max retries exceeded)` : context
          );
        }
        const headers = (error as GitHubError).response?.headers ?? {};
        await new Promise((resolve) =>
          setTimeout(resolve, this.errorHandler.calculateRetryDelay(headers))
        );
      }
    }
  }

  /** Run a GraphQL query through `run`, folding any `rateLimit` field into the budget. */
  graphql<T>(
    octokit: OctokitInstance,
    query: string,
    variables: Record<string, unknown>,
    context: string
  ): Promise<T> {
    return this.run(
      "graphql",
      async () => {
        const result = await octokit.graphql<T>(query, variables);
        const rateLimit = GraphQLResultRateLimit.safeParse(result);
        if (rateLimit.success) this.rateLimiter.recordGraphQLRateLimit(rateLimit.data.rateLimit);
        return result;
      },
      context
    );
  }
}
