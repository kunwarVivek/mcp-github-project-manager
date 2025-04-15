// Domain error types and error handling utilities
import { ResourceNotFoundError } from './resource-types';

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Re-export ResourceNotFoundError from resource-types.ts
export { ResourceNotFoundError };

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized access") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class RateLimitError extends Error {
  constructor(message = "Rate limit exceeded", public resetTime?: Date) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class IntegrationError extends Error {
  constructor(message: string, public source?: string) {
    super(message);
    this.name = "IntegrationError";
  }
}

export class GitHubAPIError extends Error {
  constructor(message: string, public status?: number, public response?: any) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

export class MCPProtocolError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = "MCPProtocolError";
  }
}

export function isErrorType<T extends Error>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

export function unwrapError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}