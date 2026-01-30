import { ToolAnnotations } from "../ToolValidator.js";

/**
 * Standard annotation patterns for tool behavior classification.
 * Based on MCP specification 2025-11-25.
 *
 * These patterns help MCP clients understand tool behavior for:
 * - Permission prompts (destructive operations need confirmation)
 * - Retry logic (idempotent operations are safe to retry)
 * - Caching (read-only operations can be cached)
 * - Rate limiting (external operations may be rate-limited)
 */
export const ANNOTATION_PATTERNS = {
  /**
   * Read-only tools (queries) - safe to call repeatedly
   * Examples: get_project, list_issues, get_field_value
   */
  readOnly: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true, // Safe to retry
    openWorldHint: true, // GitHub API is external
  } as ToolAnnotations,

  /**
   * Create operations - adds new resources
   * Examples: create_project, create_issue, create_milestone
   */
  create: {
    readOnlyHint: false,
    destructiveHint: false, // Creates, doesn't destroy
    idempotentHint: false, // Multiple calls create multiple resources
    openWorldHint: true,
  } as ToolAnnotations,

  /**
   * Idempotent update operations - same args = same result
   * Examples: set_field_value, update_project (setting to specific state)
   */
  updateIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  } as ToolAnnotations,

  /**
   * Non-idempotent update operations - may have cumulative effects
   * Examples: add_issue_comment (adds new comment each time)
   */
  updateNonIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } as ToolAnnotations,

  /**
   * Delete operations - removes resources
   * Examples: delete_project, delete_issue, remove_project_item
   */
  delete: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true, // Deleting twice = same as once
    openWorldHint: true,
  } as ToolAnnotations,

  /**
   * AI-powered operations - may be slow, not deterministic
   * Examples: generate_prd, analyze_task_complexity
   */
  aiOperation: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false, // AI output may vary
    openWorldHint: true, // May call external AI services
  } as ToolAnnotations,
} as const;

/**
 * Type for annotation pattern keys
 */
export type AnnotationPatternKey = keyof typeof ANNOTATION_PATTERNS;

/**
 * Re-export ToolAnnotations for convenience
 */
export { ToolAnnotations } from "../ToolValidator.js";
