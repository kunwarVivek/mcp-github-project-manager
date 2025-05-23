import { GitHubError } from './types';
import { ResourceNotFoundError } from '../../domain/errors';
import { MCPErrorCode } from '../../domain/mcp-types';
import { ResourceType } from '../../domain/resource-types';

export class GitHubApiError extends Error {
  constructor(
    public readonly message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly mcpErrorCode: MCPErrorCode = MCPErrorCode.INTERNAL_ERROR,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class GitHubRateLimitError extends GitHubApiError {
  constructor(
    message: string,
    public readonly resetDate: Date,
    details?: Record<string, any>
  ) {
    super(
      message,
      429,
      'RATE_LIMIT_EXCEEDED',
      MCPErrorCode.RATE_LIMITED,
      {
        resetAt: resetDate.toISOString(),
        resetAtFormatted: resetDate.toLocaleString(),
        ...details
      }
    );
    this.name = 'GitHubRateLimitError';
  }
}

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
    'EAI_AGAIN',
  ]);

  private defaultRetryDelay = 1000; // 1 second
  private maxRetryDelay = 30000; // 30 seconds

  /**
   * Determine if an error should be retried
   */
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

  /**
   * Handle GitHub API errors by converting them to structured error types
   */
  handleError(error: unknown, context?: string): Error {
    if (this.isGitHubError(error)) {
      const status = error.status || error.response?.status;
      const message = error.message || error.response?.data?.message || 'Unknown GitHub error';
      const contextMessage = context ? ` while ${context}` : '';

      // Handle rate limit errors
      if (status === 429 || this.isRateLimitError(error)) {
        const resetTimestamp = error.response?.headers?.['x-ratelimit-reset'];
        const resetDate = resetTimestamp
          ? new Date(parseInt(resetTimestamp) * 1000)
          : new Date(Date.now() + 60000); // Default to 1 minute from now

        return new GitHubRateLimitError(
          `GitHub API rate limit exceeded${contextMessage}. Reset at ${resetDate.toLocaleTimeString()}`,
          resetDate
        );
      }

      // Handle not found errors
      if (status === 404) {
        const resourceType = this.extractResourceType(error);
        const resourceId = this.extractResourceId(error);

        if (resourceType && resourceId) {
          return new ResourceNotFoundError(resourceType, resourceId);
        }

        return new GitHubApiError(
          `Resource not found${contextMessage}: ${message}`,
          status,
          'NOT_FOUND',
          MCPErrorCode.RESOURCE_NOT_FOUND
        );
      }

      // Handle authentication errors
      if (status === 401) {
        return new GitHubApiError(
          `Authentication failed${contextMessage}: ${message}`,
          status,
          'UNAUTHORIZED',
          MCPErrorCode.UNAUTHORIZED
        );
      }

      // Handle permission errors
      if (status === 403 && !this.isRateLimitError(error)) {
        return new GitHubApiError(
          `Permission denied${contextMessage}: ${message}`,
          status,
          'FORBIDDEN',
          MCPErrorCode.UNAUTHORIZED
        );
      }

      // Handle validation errors
      if (status === 422) {
        const errors = error.response?.data?.errors || [];
        const details = errors.length > 0 ? { validationErrors: errors } : undefined;

        return new GitHubApiError(
          `Validation error${contextMessage}: ${message}`,
          status,
          'VALIDATION_FAILED',
          MCPErrorCode.VALIDATION_ERROR,
          details
        );
      }

      // Handle other API errors
      return new GitHubApiError(
        `GitHub API error (${status})${contextMessage}: ${message}`,
        status,
        error.response?.data?.error || 'API_ERROR',
        this.mapStatusToMCPErrorCode(status)
      );
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(`Unknown error occurred${context ? ` while ${context}` : ''}`);
  }

  /**
   * Calculate delay for retry based on headers and error type
   */
  calculateRetryDelay(headers: Record<string, string>): number {
    const { jitter, baseDelay } = this.getRetryDelayParams(headers);
    return Math.min(baseDelay + jitter, this.maxRetryDelay);
  }

  /**
   * Extract parameters for calculating retry delay
   */
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
      jitter: Math.random() * (baseDelay * 0.1), // 10% jitter
    };
  }

  /**
   * Check if error is a GitHub API error
   */
  private isGitHubError(error: unknown): error is GitHubError {
    if (!(error instanceof Error)) return false;
    return 'status' in error || 'response' in error;
  }

  /**
   * Check if error is due to rate limiting
   */
  private isRateLimitError(error: GitHubError): boolean {
    return (
      error.response?.headers?.['x-ratelimit-remaining'] === '0' ||
      error.response?.data?.message?.includes('rate limit') ||
      error.message?.includes('rate limit')
    );
  }

  /**
   * Extract resource type from error
   */
  private extractResourceType(error: GitHubError): ResourceType | null {
    // Try to determine the resource type from the URL
    const url = error.response?.url || '';

    if (url.includes('/issues/')) return ResourceType.ISSUE;
    if (url.includes('/milestones/')) return ResourceType.MILESTONE;
    if (url.includes('/projects/')) return ResourceType.PROJECT;
    if (url.includes('/pulls/')) return ResourceType.PULL_REQUEST;
    if (url.includes('/comments/')) return ResourceType.COMMENT;
    if (url.includes('/labels/')) return ResourceType.LABEL;

    // Use NotFoundError for unrecognized resource types
    return null;
  }

  /**
   * Extract resource ID from error
   */
  private extractResourceId(error: GitHubError): string | null {
    // Try to determine the resource ID from the URL
    const url = error.response?.url || '';
    const urlParts = url.split('/');

    // The ID is usually the last part of the URL
    if (urlParts.length > 0) {
      const lastPart = urlParts[urlParts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        return lastPart;
      }
    }

    return null;
  }

  /**
   * Map HTTP status code to MCP error code
   */
  private mapStatusToMCPErrorCode(status?: number): MCPErrorCode {
    if (!status) return MCPErrorCode.INTERNAL_ERROR;

    switch (true) {
      case status === 400:
        return MCPErrorCode.VALIDATION_ERROR;
      case status === 401 || status === 403:
        return MCPErrorCode.UNAUTHORIZED;
      case status === 404:
        return MCPErrorCode.RESOURCE_NOT_FOUND;
      case status === 429:
        return MCPErrorCode.RATE_LIMITED;
      case status >= 500:
        return MCPErrorCode.INTERNAL_ERROR;
      default:
        return MCPErrorCode.INTERNAL_ERROR;
    }
  }
}