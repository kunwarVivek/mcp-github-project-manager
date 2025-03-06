import { RequestError } from "@octokit/request-error";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
} from "../../domain/errors";

export class GitHubErrorHandler {
  /**
   * Map GitHub API errors to domain errors
   */
  static handleError(error: unknown, context: string): Error {
    if (error instanceof RequestError) {
      return this.mapRequestError(error, context);
    }

    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }

    return new Error(`${context}: An unexpected error occurred`);
  }

  private static mapRequestError(error: RequestError, context: string): Error {
    switch (error.status) {
      case 400:
        return new ValidationError(`${context}: ${error.message}`);
      case 401:
      case 403:
        return new UnauthorizedError(`${context}: ${error.message}`);
      case 404:
        return new NotFoundError(`${context}: ${error.message}`);
      case 422:
        return new ValidationError(
          `${context}: ${error.message}`,
          error.response?.data as Record<string, unknown>
        );
      case 429:
        return new RateLimitError(
          `${context}: Rate limit exceeded`,
          {
            limit: error.response?.headers?.["x-ratelimit-limit"],
            remaining: error.response?.headers?.["x-ratelimit-remaining"],
            reset: error.response?.headers?.["x-ratelimit-reset"],
          }
        );
      default:
        return new Error(`${context}: ${error.message}`);
    }
  }

  /**
   * Extract rate limit information from response headers
   */
  static extractRateLimitInfo(headers: Record<string, string>): {
    limit: number;
    remaining: number;
    reset: number;
  } {
    return {
      limit: parseInt(headers["x-ratelimit-limit"] || "0"),
      remaining: parseInt(headers["x-ratelimit-remaining"] || "0"),
      reset: parseInt(headers["x-ratelimit-reset"] || "0"),
    };
  }

  /**
   * Check if operation should be retried based on error
   */
  static shouldRetry(error: unknown): boolean {
    if (error instanceof RequestError) {
      // Retry on rate limits and server errors
      return error.status === 429 || error.status >= 500;
    }
    return false;
  }

  /**
   * Calculate retry delay based on rate limit headers
   */
  static calculateRetryDelay(headers: Record<string, string>): number {
    const rateLimitInfo = this.extractRateLimitInfo(headers);
    if (rateLimitInfo.remaining === 0 && rateLimitInfo.reset) {
      // Calculate delay until rate limit reset
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, (rateLimitInfo.reset - now) * 1000);
    }
    return 1000; // Default 1 second delay
  }
}