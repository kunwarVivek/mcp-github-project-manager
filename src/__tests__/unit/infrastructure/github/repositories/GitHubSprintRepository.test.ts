import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationError } from "../../../../../domain/errors";
import { ResourceNotFoundError } from "../../../../../domain/resource-types";
import { GitHubConfig } from "../../../../../infrastructure/github/GitHubConfig";
import {
  GitHubSprintRepository,
  nextIterationStart,
} from "../../../../../infrastructure/github/repositories/GitHubSprintRepository";
import { asOctokit } from "../../../../helpers/mockTypes";

/**
 * GitHub keeps ONE iteration per start date. An iteration that overlaps an
 * existing one is silently dropped by the API - the mutation succeeds, the
 * response does not contain the new iteration, and the caller gets
 * "Iteration X was not found after creation".
 *
 * This was found by running the live-API E2E suite for the first time: the
 * second sprint of a project always failed, the first one worked.
 */
describe("nextIterationStart", () => {
  // The function clamps to today (GitHub drops an iteration that starts in the
  // past), so the fixed dates below are only meaningful against a fixed clock.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the requested start when the field has no iterations", () => {
    const start = nextIterationStart("2026-10-21T00:00:00.000Z", []);
    expect(start.toISOString().slice(0, 10)).toBe("2026-10-21");
  });

  it("starts after the last iteration when the requested start overlaps it", () => {
    const start = nextIterationStart("2026-10-21T00:00:00.000Z", [
      { startDate: "2026-10-21", duration: 14 },
    ]);
    // The existing iteration runs 2026-10-21 .. 2026-11-04.
    expect(start.toISOString().slice(0, 10)).toBe("2026-11-04");
  });

  it("keeps a later requested start", () => {
    const start = nextIterationStart("2026-12-01T00:00:00.000Z", [
      { startDate: "2026-10-21", duration: 14 },
    ]);
    expect(start.toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("accounts for every existing iteration, not just the first", () => {
    const start = nextIterationStart("2026-10-21T00:00:00.000Z", [
      { startDate: "2026-10-21", duration: 14 },
      { startDate: "2026-11-04", duration: 14 },
    ]);
    expect(start.toISOString().slice(0, 10)).toBe("2026-11-18");
  });

  it("never starts in the past - GitHub silently drops such an iteration", () => {
    // Verified against the live API: an iteration whose start date is before
    // today comes back as an empty list, and the caller gets
    // "Iteration X was not found after creation".
    const start = nextIterationStart("2020-01-01T00:00:00.000Z", []);
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    expect(start.getTime()).toBe(todayUtc.getTime());
  });

  it("ignores the time of day", () => {
    const start = nextIterationStart("2026-10-21T17:45:12.345Z", []);
    expect(start.toISOString().slice(0, 10)).toBe("2026-10-21");
  });
});

describe("GitHubSprintRepository", () => {
  interface TestIteration {
    id: string;
    title: string;
    startDate: string;
    duration: number;
  }

  const iteration = (id: string, startDate: string): TestIteration => ({
    id,
    title: `Sprint ${id}`,
    startDate,
    duration: 14,
  });

  /** Answers the iteration-field query and records every call. */
  function makeRepository(iterations: TestIteration[], mutation?: unknown) {
    const graphql = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
      if (query.includes("updateProjectV2Field")) return mutation;
      return {
        repository: {
          projectsV2: {
            nodes: [
              {
                id: "PVT_1",
                fields: {
                  nodes: [{ id: "PVTIF_1", name: "Sprint", configuration: { iterations } }],
                },
              },
            ],
          },
        },
      };
    });
    const repository = new GitHubSprintRepository(
      asOctokit({ graphql }),
      new GitHubConfig("test-owner", "test-repo", { kind: "pat", token: "test-token" })
    );
    return { repository, graphql };
  }

  describe("findById", () => {
    it("resolves an iteration with one query and no mutation", async () => {
      const { repository, graphql } = makeRepository([
        iteration("a1", "2026-10-01"),
        iteration("b2", "2026-10-15"),
      ]);

      const sprint = await repository.findById("b2");

      expect(sprint?.id).toBe("b2");
      expect(sprint?.title).toBe("Sprint b2");
      expect(graphql).toHaveBeenCalledTimes(1);
    });

    it("returns null for an unknown iteration", async () => {
      const { repository } = makeRepository([iteration("a1", "2026-10-01")]);
      expect(await repository.findById("zzz")).toBeNull();
    });
  });

  describe("delete", () => {
    it("rewrites the iteration field without the deleted iteration, keeping the others' ids", async () => {
      const { repository, graphql } = makeRepository(
        [iteration("a1", "2026-10-01"), iteration("b2", "2026-10-15")],
        {
          updateProjectV2Field: {
            projectV2Field: { configuration: { iterations: [{ id: "a1" }] } },
          },
        }
      );

      await repository.delete("b2");

      const call = graphql.mock.calls.find(([query]) => query.includes("updateProjectV2Field"));
      expect(call?.[1]).toMatchObject({
        input: {
          fieldId: "PVTIF_1",
          iterationConfiguration: {
            startDate: "2026-10-01",
            duration: 14,
            iterations: [{ id: "a1", title: "Sprint a1", startDate: "2026-10-01", duration: 14 }],
          },
        },
      });
    });

    it("throws when GitHub still lists the iteration after the update", async () => {
      const { repository } = makeRepository([iteration("a1", "2026-10-01")], {
        updateProjectV2Field: {
          projectV2Field: { configuration: { iterations: [{ id: "a1" }] } },
        },
      });

      await expect(repository.delete("a1")).rejects.toBeInstanceOf(IntegrationError);
    });

    it("throws not-found and sends no mutation for an unknown iteration", async () => {
      const { repository, graphql } = makeRepository([iteration("a1", "2026-10-01")]);

      await expect(repository.delete("zzz")).rejects.toBeInstanceOf(ResourceNotFoundError);
      expect(graphql).toHaveBeenCalledTimes(1);
    });
  });
});
