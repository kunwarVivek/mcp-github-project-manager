import { describe, expect, it, type Mock, vi } from "vitest";
import {
  type ConnectionPage,
  collectConnection,
  MAX_CONNECTION_PAGES,
} from "../../../../infrastructure/github/util/paginate";
import type { ILogger } from "../../../../infrastructure/logger";

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ILogger & { warn: Mock };
}

describe("collectConnection", () => {
  it("follows endCursor across pages and concatenates the nodes", async () => {
    const pages: Record<string, ConnectionPage<number>> = {
      first: { nodes: [1, 2], pageInfo: { hasNextPage: true, endCursor: "c1" } },
      c1: { nodes: [3], pageInfo: { hasNextPage: true, endCursor: "c2" } },
      c2: { nodes: [4], pageInfo: { hasNextPage: false, endCursor: null } },
    };
    const fetchPage = vi.fn(async (after: string | null) => pages[after ?? "first"]);

    const result = await collectConnection(fetchPage, makeLogger(), "numbers");

    expect(result).toEqual([1, 2, 3, 4]);
    expect(fetchPage.mock.calls.map(([after]) => after)).toEqual([null, "c1", "c2"]);
  });

  it("returns what it has when the parent disappears", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ nodes: [1], pageInfo: { hasNextPage: true, endCursor: "c1" } })
      .mockResolvedValueOnce(null);

    expect(await collectConnection(fetchPage, makeLogger(), "numbers")).toEqual([1]);
  });

  it("stops at the page cap and logs that the result is truncated", async () => {
    const logger = makeLogger();
    const fetchPage = vi.fn(async () => ({
      nodes: [0],
      pageInfo: { hasNextPage: true, endCursor: "more" },
    }));

    const result = await collectConnection(fetchPage, logger, "numbers");

    expect(fetchPage).toHaveBeenCalledTimes(MAX_CONNECTION_PAGES);
    expect(result).toHaveLength(MAX_CONNECTION_PAGES);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("numbers truncated"));
  });
});
