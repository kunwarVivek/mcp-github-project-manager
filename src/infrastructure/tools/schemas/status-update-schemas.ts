/**
 * Zod schemas for status update MCP tools.
 *
 * These schemas define the input and output types for:
 * - create_status_update (GHAPI-06)
 * - list_status_updates (GHAPI-07)
 * - get_status_update (GHAPI-08)
 */

import { z } from "zod";

// ============================================================================
// Status Update Status Enum
// ============================================================================

/**
 * Valid status values for project status updates.
 * Matches GitHub's ProjectV2StatusUpdateStatus enum.
 */
export const StatusUpdateStatusSchema = z.enum([
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "COMPLETE",
  "INACTIVE",
]);

export type StatusUpdateStatusType = z.infer<typeof StatusUpdateStatusSchema>;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Input schema for create_status_update tool.
 *
 * Creates a new status update for a GitHub project with optional
 * status indicator, start date, and target date.
 */
export const CreateStatusUpdateInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required"),
  /** Status update body - supports Markdown */
  body: z.string().min(1, "Status update body is required"),
  /** Optional status indicator */
  status: StatusUpdateStatusSchema.optional(),
  /** Optional start date in ISO 8601 format (YYYY-MM-DD) */
  startDate: z.string().optional(),
  /** Optional target date in ISO 8601 format (YYYY-MM-DD) */
  targetDate: z.string().optional(),
});

export type CreateStatusUpdateInput = z.infer<typeof CreateStatusUpdateInputSchema>;

/**
 * Input schema for list_status_updates tool.
 *
 * Lists status updates for a project with pagination support.
 */
export const ListStatusUpdatesInputSchema = z.object({
  /** Project node ID (e.g., 'PVT_kwDO...') */
  projectId: z.string().min(1, "Project ID is required"),
  /** Number of status updates to return (default: 10, max: 100) */
  first: z.number().int().positive().max(100).default(10).optional(),
  /** Cursor for pagination - from previous response's endCursor */
  after: z.string().optional(),
});

export type ListStatusUpdatesInput = z.infer<typeof ListStatusUpdatesInputSchema>;

/**
 * Input schema for get_status_update tool.
 *
 * Retrieves a single status update by its node ID.
 */
export const GetStatusUpdateInputSchema = z.object({
  /** Status update node ID */
  statusUpdateId: z.string().min(1, "Status update ID is required"),
});

export type GetStatusUpdateInput = z.infer<typeof GetStatusUpdateInputSchema>;

// ============================================================================
// Output Schemas
// ============================================================================

/**
 * Schema for status update creator information.
 */
export const StatusUpdateCreatorSchema = z.object({
  /** GitHub login of the creator */
  login: z.string(),
});

/**
 * Output schema for a single status update.
 *
 * Contains all fields returned by the GitHub GraphQL API for status updates.
 */
export const StatusUpdateOutputSchema = z.object({
  /** Node ID of the status update */
  id: z.string(),
  /** Raw Markdown body of the status update */
  body: z.string(),
  /** HTML-rendered body of the status update */
  bodyHTML: z.string(),
  /** Status indicator (may be null if not set) */
  status: StatusUpdateStatusSchema.nullable(),
  /** Start date in ISO 8601 format (may be null if not set) */
  startDate: z.string().nullable(),
  /** Target date in ISO 8601 format (may be null if not set) */
  targetDate: z.string().nullable(),
  /** ISO 8601 timestamp when the status update was created */
  createdAt: z.string(),
  /** Information about who created the status update */
  creator: StatusUpdateCreatorSchema,
});

export type StatusUpdateOutput = z.infer<typeof StatusUpdateOutputSchema>;

/**
 * Schema for pagination info in list responses.
 */
export const PageInfoSchema = z.object({
  /** Whether there are more results available */
  hasNextPage: z.boolean(),
  /** Cursor to use for fetching the next page (null if no more pages) */
  endCursor: z.string().nullable(),
});

/**
 * Output schema for list_status_updates tool.
 *
 * Returns a paginated list of status updates for a project.
 */
export const StatusUpdateListOutputSchema = z.object({
  /** Array of status updates */
  statusUpdates: z.array(StatusUpdateOutputSchema),
  /** Pagination information */
  pageInfo: PageInfoSchema,
  /** Total number of status updates for the project */
  totalCount: z.number(),
});

export type StatusUpdateListOutput = z.infer<typeof StatusUpdateListOutputSchema>;
