import { DomainError, ResourceNotFoundError, ValidationError, RateLimitError, UnauthorizedError, GitHubAPIError } from '../../domain/errors';
import { MCPErrorCode } from '../../domain/mcp-types';

export function mapErrorToMCPError(error: unknown): Error {
  if (error instanceof ValidationError) {
    return new DomainError(`${MCPErrorCode.VALIDATION_ERROR}: ${error.message}`);
  }
  if (error instanceof ResourceNotFoundError) {
    return new DomainError(`${MCPErrorCode.RESOURCE_NOT_FOUND}: ${error.message}`);
  }
  if (error instanceof RateLimitError) {
    return new DomainError(`${MCPErrorCode.RATE_LIMITED}: ${error.message}`);
  }
  if (error instanceof UnauthorizedError) {
    return new DomainError(`${MCPErrorCode.UNAUTHORIZED}: ${error.message}`);
  }
  if (error instanceof GitHubAPIError) {
    return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: GitHub API Error - ${error.message}`);
  }
  return new DomainError(`${MCPErrorCode.INTERNAL_ERROR}: ${error instanceof Error ? error.message : String(error)}`);
}
