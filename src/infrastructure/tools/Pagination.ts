/**
 * Cursor-based pagination support for MCP tool results.
 *
 * Tools that return large result sets (list_issues, list_projects, etc.)
 * can use this utility to provide cursor-based pagination to clients.
 */

export interface PaginationParams {
  /** Maximum number of items per page. Clamped to MAX_PAGE_SIZE. */
  limit?: number;
  /** Opaque cursor string from a previous page's `nextCursor`. */
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  /** Total number of items available (if known). */
  totalCount?: number;
  /** Opaque cursor for the next page. Absent on the last page. */
  nextCursor?: string;
  /** Whether there are more items after this page. */
  hasMore: boolean;
  /** Current page number (1-indexed). */
  page: number;
  /** Items per page (actual count in this response). */
  pageSize: number;
}

/** Absolute maximum page size to prevent abuse. */
const MAX_PAGE_SIZE = 100;
/** Default page size when none specified. */
const DEFAULT_PAGE_SIZE = 25;

/**
 * Encode pagination state into an opaque cursor string.
 */
function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

/**
 * Decode an opaque cursor string back to pagination state.
 * Returns offset 0 for invalid/missing cursors.
 */
function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    return typeof parsed.o === 'number' && parsed.o >= 0 ? parsed.o : 0;
  } catch {
    return 0;
  }
}

/**
 * Apply pagination to an in-memory array.
 * Use this for results already fetched from GitHub API.
 */
export function paginate<T>(
  items: T[],
  params: PaginationParams = {},
): PaginatedResult<T> {
  const limit = Math.min(Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const offset = decodeCursor(params.cursor);
  const page = Math.floor(offset / limit) + 1;

  const pageItems = items.slice(offset, offset + limit);
  const hasMore = offset + limit < items.length;

  return {
    items: pageItems,
    totalCount: items.length,
    nextCursor: hasMore ? encodeCursor(offset + limit) : undefined,
    hasMore,
    page,
    pageSize: pageItems.length,
  };
}

/**
 * Parse pagination params from tool arguments.
 * Normalizes limit and cursor from raw tool input.
 */
export function parsePaginationParams(args: Record<string, unknown>): PaginationParams {
  return {
    limit: typeof args.limit === 'number' ? args.limit : undefined,
    cursor: typeof args.cursor === 'string' ? args.cursor : undefined,
  };
}
