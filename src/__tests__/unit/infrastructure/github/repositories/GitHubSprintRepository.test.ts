import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextIterationStart } from "../../../../../infrastructure/github/repositories/GitHubSprintRepository";

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
