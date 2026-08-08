import { mapErrorToMCPError } from './ErrorMapper';

/**
 * Wraps an async function with standard MCP error mapping.
 *
 * Eliminates the repeated try { ... } catch { throw mapErrorToMCPError(error) }
 * boilerplate found across ~113 service methods.
 *
 * @example
 * // Before (repeated 113 times across the codebase):
 * async getIssue(issueId: string): Promise<Issue | null> {
 *   try {
 *     return await this.issueRepo.findById(issueId);
 *   } catch (error) {
 *     throw mapErrorToMCPError(error);
 *   }
 * }
 *
 * // After:
 * async getIssue(issueId: string): Promise<Issue | null> {
 *   return safeCall(() => this.issueRepo.findById(issueId));
 * }
 */
export async function safeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapErrorToMCPError(error);
  }
}
