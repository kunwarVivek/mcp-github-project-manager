import { Octokit } from '@octokit/rest';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface RateLimitStatus {
  core: RateLimitInfo;
  graphql: RateLimitInfo;
  search: RateLimitInfo;
  /** remaining < 10% of limit across core/graphql */
  isLow: boolean;
  /** remaining < 5% of limit across core/graphql */
  isCritical: boolean;
  /** ms until core reset */
  resetIn: number;
}

/**
 * Monitors GitHub API rate limits and provides backoff recommendations.
 * Caches rate limit info to avoid extra API calls.
 */
export class RateLimitManager {
  private cachedStatus: RateLimitStatus | null = null;
  private cacheExpiry = 0;
  private readonly cacheTtlMs = 30_000; // 30s cache
  private readonly octokit: Octokit;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  /**
   * Get current rate limit status. Caches for 30s.
   */
  async getStatus(): Promise<RateLimitStatus> {
    if (this.cachedStatus && Date.now() < this.cacheExpiry) {
      return this.cachedStatus;
    }

    const { data } = await this.octokit.rest.rateLimit.get();

    const toInfo = (r: { limit: number; remaining: number; reset: number; used: number }): RateLimitInfo => ({
      limit: r.limit,
      remaining: r.remaining,
      reset: new Date(r.reset * 1000),
      used: r.used,
    });

    const defaultResource = { limit: 5000, remaining: 5000, reset: 0, used: 0 };
    const core = toInfo(data.resources.core);
    const graphql = toInfo(data.resources.graphql ?? defaultResource);
    const search = toInfo(data.resources.search ?? defaultResource);

    const minRatio = Math.min(
      core.remaining / core.limit,
      graphql.remaining / graphql.limit,
    );

    this.cachedStatus = {
      core,
      graphql,
      search,
      isLow: minRatio < 0.1,
      isCritical: minRatio < 0.05,
      resetIn: Math.max(0, core.reset.getTime() - Date.now()),
    };
    this.cacheExpiry = Date.now() + this.cacheTtlMs;
    return this.cachedStatus;
  }

  /**
   * Calculate backoff delay based on current rate limit status.
   * Returns 0 if no backoff needed.
   */
  async getBackoffMs(): Promise<number> {
    const status = await this.getStatus();
    if (status.isCritical) {
      // Back off until reset + small buffer, capped at 60s
      return Math.min(status.resetIn + 1000, 60_000);
    }
    if (status.isLow) {
      // Slow down proportionally to remaining quota
      const minRemaining = Math.min(status.core.remaining, status.graphql.remaining);
      return Math.max(100, Math.floor(1000 / (minRemaining + 1)));
    }
    return 0;
  }

  /**
   * Wait if rate-limited. Call before making API requests.
   */
  async waitIfNeeded(): Promise<void> {
    const backoff = await this.getBackoffMs();
    if (backoff > 0) {
      await new Promise<void>(r => setTimeout(r, backoff));
    }
  }

  /**
   * Update cached status from response headers.
   * Call this after every GitHub API response to stay up-to-date
   * without extra API calls.
   */
  updateFromHeaders(headers: Record<string, string | undefined>): void {
    const remaining = headers['x-ratelimit-remaining'];
    const limit = headers['x-ratelimit-limit'];
    const reset = headers['x-ratelimit-reset'];

    if (remaining && limit && reset && this.cachedStatus) {
      this.cachedStatus.core = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000),
        used: parseInt(limit, 10) - parseInt(remaining, 10),
      };
      const minRatio = Math.min(
        this.cachedStatus.core.remaining / this.cachedStatus.core.limit,
        this.cachedStatus.graphql.remaining / this.cachedStatus.graphql.limit,
      );
      this.cachedStatus.isLow = minRatio < 0.1;
      this.cachedStatus.isCritical = minRatio < 0.05;
      this.cachedStatus.resetIn = Math.max(0, this.cachedStatus.core.reset.getTime() - Date.now());
    }
  }

  /** Invalidate cached status. */
  invalidateCache(): void {
    this.cachedStatus = null;
    this.cacheExpiry = 0;
  }
}
