/**
 * Type guards for external data boundaries
 *
 * These guards provide type-safe access to external data (GitHub API responses,
 * cached resources, error objects) without using `as any` for property access.
 */
import { z } from 'zod';

// =============================================================================
// Project Item Type Guard
// =============================================================================

/**
 * Schema for GitHub project items with optional title and content
 */
const ProjectItemSchema = z.object({
  title: z.string().optional(),
  content: z.object({
    body: z.string().optional()
  }).optional()
});

export type ProjectItem = z.infer<typeof ProjectItemSchema>;

/**
 * Type guard for GitHub project items
 * Used when accessing items from project queries
 */
export function isProjectItem(data: unknown): data is ProjectItem {
  return ProjectItemSchema.safeParse(data).success;
}

// =============================================================================
// Cacheable Resource Type Guard
// =============================================================================

/**
 * Schema for cached resources with metadata
 */
const CacheableResourceSchema = z.object({
  updatedAt: z.string().optional(),
  version: z.number().optional()
});

export type CacheableResource = z.infer<typeof CacheableResourceSchema>;

/**
 * Type guard for cacheable resources
 * Used when extracting metadata from cached values
 */
export function isCacheableResource(data: unknown): data is CacheableResource {
  return typeof data === 'object' && data !== null;
}

// =============================================================================
// REST User Type Guard
// =============================================================================

/**
 * Schema for GitHub REST API user objects with avatar properties
 */
const RestUserPropertiesSchema = z.object({
  avatar_url: z.string().optional(),
  gravatar_id: z.string().nullable().optional(),
  url: z.string().optional()
});

export type RestUserProperties = z.infer<typeof RestUserPropertiesSchema>;

/**
 * Type guard for REST API user objects with avatar/url properties
 * Used when mapping REST API responses to internal types
 */
export function hasRestUserProperties(user: unknown): user is RestUserProperties {
  return typeof user === 'object' && user !== null;
}

// =============================================================================
// GitHub Error Type Guard
// =============================================================================

/**
 * Type guard for errors with a code property
 * Used when checking retryable error codes
 */
export function isGitHubErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' &&
         error !== null &&
         'code' in error &&
         typeof (error as { code: unknown }).code === 'string';
}
