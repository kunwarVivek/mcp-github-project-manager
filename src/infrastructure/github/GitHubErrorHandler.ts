import { GitHubError } from './types';

interface RetryDelay {
  jitter: number;
  baseDelay: number;
}

export class GitHubErrorHandler {
  private retryableStatusCodes = new Set([
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ]);

  private retryableErrorCodes = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'SOCKET_TIMEOUT',
  ]);

  private defaultRetryDelay = 1000; // 1 second
  private maxRetryDelay = 30000; // 30 seconds

  isRetryableError(error: unknown): boolean {
    if (!this.isGitHubError(error)) return false;

    // Check HTTP status codes
    const status = error.status || error.response?.status;
    if (status && this.retryableStatusCodes.has(status)) return true;

    // Check error codes
    const code = (error as any).code;
    if (code && this.retryableErrorCodes.has(code)) return true;

    // Check rate limit
    if (this.isRateLimitError(error)) return true;

    return false;
  }

  handleError(error: unknown, context?: string): Error {
    if (this.isGitHubError(error)) {
      const status = error.status || error.response?.status;
      const message = error.message || error.response?.data?.message || 'Unknown GitHub error';
      
      if (status === 403 && this.isRateLimitError(error)) {
        return new Error(`GitHub API rate limit exceeded. Reset at ${this.getRateLimitReset(error)}`);
      }
      
      const contextMessage = context ? ` while ${context}` : '';
      return new Error(`GitHub API error (${status})${contextMessage}: ${message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('Unknown error occurred');
  }

  calculateRetryDelay(headers: Record<string, string>): number {
    const { jitter, baseDelay } = this.getRetryDelayParams(headers);
    return Math.min(baseDelay + jitter, this.maxRetryDelay);
  }

  private getRetryDelayParams(headers: Record<string, string>): RetryDelay {
    // Use GitHub's rate limit reset if available
    const resetTimestamp = headers['x-ratelimit-reset'];
    if (resetTimestamp) {
      const resetTime = parseInt(resetTimestamp) * 1000;
      const now = Date.now();
      if (resetTime > now) {
        return {
          baseDelay: resetTime - now,
          jitter: Math.random() * 1000,
        };
      }
    }

    // Use exponential backoff with jitter
    const retryAfter = headers['retry-after'];
    const baseDelay = retryAfter ? parseInt(retryAfter) * 1000 : this.defaultRetryDelay;
    
    return {
      baseDelay,
      jitter: Math.random() * 100,
    };
  }

  private isGitHubError(error: unknown): error is GitHubError {
    if (!(error instanceof Error)) return false;
    return 'status' in error || 'response' in error;
  }

  private isRateLimitError(error: GitHubError): boolean {
    return (
      error.response?.headers?.['x-ratelimit-remaining'] === '0' ||
      error.response?.data?.message?.includes('rate limit')
    );
  }

  private getRateLimitReset(error: GitHubError): string {
    const resetTimestamp = error.response?.headers?.['x-ratelimit-reset'];
    if (!resetTimestamp) return 'unknown time';
    
    return new Date(parseInt(resetTimestamp) * 1000).toLocaleTimeString();
  }
}