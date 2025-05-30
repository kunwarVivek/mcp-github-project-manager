import { Octokit } from "@octokit/rest";
import { OctokitInstance } from "../types";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resetDate: Date;
}

export interface PaginationOptions {
  perPage?: number;
  page?: number;
  maxItems?: number;
  maxPages?: number;
}

export class GitHubApiUtil {
  private static instance: GitHubApiUtil;
  private rateLimitWarningThreshold: number = 50; // Warn when less than 50 requests remain
  private minRequestDelay: number = 100; // Minimum ms between requests to avoid hammering the API

  private constructor() {}

  public static getInstance(): GitHubApiUtil {
    if (!GitHubApiUtil.instance) {
      GitHubApiUtil.instance = new GitHubApiUtil();
    }
    return GitHubApiUtil.instance;
  }

  /**
   * Get current rate limit information from GitHub
   */
  public async getRateLimit(octokit: OctokitInstance): Promise<RateLimitInfo> {
    try {
      // Check if octokit.rest exists before trying to use it
      if (octokit.rest && octokit.rest.rateLimit) {
        const response = await octokit.rest.rateLimit.get();
        const { limit, remaining, reset, used } = response.data.rate;
        
        return {
          limit,
          remaining, 
          reset,
          used,
          resetDate: new Date(reset * 1000)
        };
      } else {
        // For tests or other environments where rateLimit might not be available
        return this.getDefaultRateLimitInfo();
      }
    } catch (error) {
      process.stderr.write(`Failed to get rate limit info: ${error instanceof Error ? error.message : String(error)}\n`);
      // Return default values if we can't get rate limit info
      return this.getDefaultRateLimitInfo();
    }
  }
  
  private getDefaultRateLimitInfo(): RateLimitInfo {
    return {
      limit: 5000,
      remaining: 5000,
      reset: Math.floor(Date.now() / 1000) + 3600,
      used: 0,
      resetDate: new Date(Date.now() + 3600000)
    };
  }

  /**
   * Check if we're approaching the rate limit and should throttle requests
   */
  public async shouldThrottle(octokit: OctokitInstance): Promise<boolean> {
    const rateLimitInfo = await this.getRateLimit(octokit);
    return rateLimitInfo.remaining < this.rateLimitWarningThreshold;
  }

  /**
   * Calculate delay for next request based on rate limit
   */
  public async calculateRequestDelay(octokit: OctokitInstance): Promise<number> {
    const rateLimitInfo = await this.getRateLimit(octokit);
    
    // If we're approaching the limit, calculate time to wait
    if (rateLimitInfo.remaining < this.rateLimitWarningThreshold) {
      const resetTime = rateLimitInfo.resetDate.getTime();
      const now = Date.now();
      
      if (resetTime > now) {
        const timeToReset = resetTime - now;
        const requestsLeft = Math.max(1, rateLimitInfo.remaining);
        // Distribute remaining requests over the time until reset
        return Math.max(this.minRequestDelay, timeToReset / requestsLeft);
      }
    }
    
    return this.minRequestDelay;
  }

  /**
   * Execute a paginated request with proper handling of rate limits
   */
  public async paginateRequest<T>(
    requestFn: (options: { page: number; per_page: number }) => Promise<{ data: T[] }>,
    options: PaginationOptions = {}
  ): Promise<T[]> {
    const {
      perPage = 100,
      page = 1,
      maxItems = 1000,
      maxPages = 10
    } = options;

    let currentPage = page;
    let allResults: T[] = [];
    let hasMorePages = true;

    while (hasMorePages && currentPage <= maxPages && allResults.length < maxItems) {
      // Add a small delay between requests
      if (currentPage > page) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestDelay));
      }

      const response = await requestFn({
        page: currentPage,
        per_page: perPage
      });

      const results = response.data;
      allResults = [...allResults, ...results];

      // Check if we have more pages
      hasMorePages = results.length === perPage;
      currentPage++;
      
      // Check if we've reached the max items
      if (allResults.length >= maxItems) {
        allResults = allResults.slice(0, maxItems);
        break;
      }
    }

    return allResults;
  }

  /**
   * Helper method for GraphQL pagination using cursor-based pagination
   */
  public async paginateGraphQL<T>(
    queryFn: (options: { cursor?: string; pageSize: number }) => Promise<{
      pageInfo: { hasNextPage: boolean; endCursor?: string };
      nodes: T[];
    }>,
    options: { 
      pageSize?: number; 
      maxItems?: number; 
      initialCursor?: string 
    } = {}
  ): Promise<T[]> {
    const {
      pageSize = 100,
      maxItems = 1000,
      initialCursor = undefined
    } = options;

    let cursor = initialCursor;
    let allResults: T[] = [];
    let hasNextPage = true;

    while (hasNextPage && allResults.length < maxItems) {
      // Add a small delay between requests
      if (allResults.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.minRequestDelay));
      }

      const response = await queryFn({
        cursor,
        pageSize: Math.min(pageSize, maxItems - allResults.length)
      });

      allResults = [...allResults, ...response.nodes];
      
      hasNextPage = response.pageInfo.hasNextPage && response.nodes.length > 0;
      cursor = response.pageInfo.endCursor;
      
      // Check if we've reached the max items
      if (allResults.length >= maxItems) {
        allResults = allResults.slice(0, maxItems);
        break;
      }
    }

    return allResults;
  }

  /**
   * Set the rate limit warning threshold
   */
  public setRateLimitWarningThreshold(threshold: number): void {
    this.rateLimitWarningThreshold = threshold;
  }

  /**
   * Set the minimum delay between requests
   */
  public setMinRequestDelay(delayMs: number): void {
    this.minRequestDelay = delayMs;
  }
}