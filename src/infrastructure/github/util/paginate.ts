import type { ILogger } from "../../logger";

/** Hard cap on pages read from one connection (100 nodes each). */
export const MAX_CONNECTION_PAGES = 10;

export interface ConnectionPage<T> {
  nodes: T[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

/**
 * Read a GraphQL connection to the end, following `pageInfo`.
 *
 * `fetchPage` receives the cursor to continue after (`null` for the first
 * page) and returns the connection, or `null`/`undefined` when its parent is
 * missing. Stops after {@link MAX_CONNECTION_PAGES} pages and logs a warning
 * rather than looping without bound on a pathological connection.
 */
export async function collectConnection<T>(
  fetchPage: (after: string | null) => Promise<ConnectionPage<T> | null | undefined>,
  logger: ILogger,
  description: string
): Promise<T[]> {
  const all: T[] = [];
  let after: string | null = null;

  for (let page = 1; page <= MAX_CONNECTION_PAGES; page++) {
    const connection = await fetchPage(after);
    if (!connection) return all;

    all.push(...(connection.nodes ?? []));

    if (!connection.pageInfo?.hasNextPage) return all;
    after = connection.pageInfo.endCursor;
    if (!after) return all;
  }

  logger.warn(
    `${description} truncated after ${MAX_CONNECTION_PAGES} pages (${all.length} nodes); more exist`
  );
  return all;
}
