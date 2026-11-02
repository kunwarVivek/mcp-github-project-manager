import { describe, expect, it, vi } from "vitest";
import type { AnalyticsItem } from "../../../domain/analytics-types";
import type { GitHubRepositoryFactory } from "../../../infrastructure/github/GitHubRepositoryFactory";
import type { GitHubProjectAnalyticsRepository } from "../../../infrastructure/github/repositories/GitHubProjectAnalyticsRepository";
import {
  AnalyticsService,
  bucketStart,
  chooseUnit,
  computeBurndown,
  computeCycleTime,
  computeSummary,
  computeThroughput,
  computeVelocity,
  isItemDone,
  percentile,
  selectIteration,
} from "../../../services/AnalyticsService";
import { partialFake } from "../../helpers/aiFakes";

// Wednesday 2026-03-18 12:00 UTC
const NOW = new Date("2026-03-18T12:00:00Z");

const S1 = { id: "it-1", title: "Sprint 1", startDate: "2026-03-02", duration: 14 };
const S2 = { id: "it-2", title: "Sprint 2", startDate: "2026-03-16", duration: 14 };

let seq = 0;
function item(overrides: Partial<AnalyticsItem> = {}): AnalyticsItem {
  seq++;
  return {
    id: `item-${seq}`,
    type: "ISSUE",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
    closedAt: null,
    state: "OPEN",
    status: "Todo",
    points: null,
    iteration: null,
    milestone: null,
    fields: {},
    ...overrides,
  };
}

function closed(closedAt: string, overrides: Partial<AnalyticsItem> = {}): AnalyticsItem {
  return item({ closedAt, state: "CLOSED", status: "Done", ...overrides });
}

describe("isItemDone / chooseUnit", () => {
  it("treats closed content or a finished status as done", () => {
    expect(isItemDone(item())).toBe(false);
    expect(isItemDone(closed("2026-03-05T00:00:00Z"))).toBe(true);
    expect(isItemDone(item({ status: "done" }))).toBe(true);
    expect(isItemDone(item({ state: "MERGED" }))).toBe(true);
  });

  it("uses points only when some item has an estimate", () => {
    expect(chooseUnit([item(), item()])).toBe("items");
    expect(chooseUnit([item(), item({ points: 3 })])).toBe("points");
  });
});

describe("percentile", () => {
  it("interpolates and handles empty input", () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([1, 2, 3, 4, 10], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 10], 90)).toBeCloseTo(7.6);
  });
});

describe("computeVelocity", () => {
  const items = [
    closed("2026-03-05T00:00:00Z", { points: 3, iteration: S1 }),
    closed("2026-03-10T00:00:00Z", { points: 5, iteration: S1 }),
    item({ points: 2, iteration: S1 }),
    closed("2026-03-17T10:00:00Z", { points: 4, iteration: S2 }),
    item({ points: 1, iteration: S2 }),
    item({ points: 9 }),
    item({ points: 7, iteration: { ...S1, id: "it-3", title: "Future", startDate: "2026-04-01" } }),
  ];

  it("reports committed and completed per started iteration, oldest first", () => {
    const result = computeVelocity(items, 6, NOW);

    expect(result.unit).toBe("points");
    expect(result.iterations).toEqual([
      expect.objectContaining({
        iterationId: "it-1",
        inProgress: false,
        endDate: "2026-03-15",
        committedItems: 3,
        completedItems: 2,
        committedPoints: 10,
        completedPoints: 8,
      }),
      expect.objectContaining({
        iterationId: "it-2",
        inProgress: true,
        committedItems: 2,
        completedItems: 1,
        committedPoints: 5,
        completedPoints: 4,
      }),
    ]);
    expect(result.averageCompleted).toBe(8);
  });

  it("keeps only the last N iterations", () => {
    const result = computeVelocity(items, 1, NOW);
    expect(result.iterations.map((i) => i.iterationId)).toEqual(["it-2"]);
    expect(result.averageCompleted).toBeNull();
  });

  it("falls back to item counts without a points field", () => {
    const plain = [closed("2026-03-05T00:00:00Z", { iteration: S1 }), item({ iteration: S1 })];
    const result = computeVelocity(plain, 6, NOW);
    expect(result.unit).toBe("items");
    expect(result.averageCompleted).toBe(1);
  });

  it("is empty for no data", () => {
    expect(computeVelocity([], 6, NOW)).toEqual({
      unit: "items",
      iterations: [],
      averageCompleted: null,
    });
  });
});

describe("selectIteration / computeBurndown", () => {
  const items = [
    closed("2026-03-17T10:00:00Z", { points: 4, iteration: S2 }),
    item({ points: 1, iteration: S2 }),
    item({ points: 8, iteration: S1 }),
  ];

  it("selects the current iteration by default and by id or title", () => {
    expect(selectIteration(items, undefined, NOW)?.id).toBe("it-2");
    expect(selectIteration(items, "it-1", NOW)?.id).toBe("it-1");
    expect(selectIteration(items, "sprint 1", NOW)?.id).toBe("it-1");
    expect(selectIteration(items, "nope", NOW)).toBeNull();
    expect(selectIteration([], undefined, NOW)).toBeNull();
  });

  it("falls back to the latest started iteration between sprints", () => {
    expect(selectIteration(items, undefined, new Date("2026-04-20T00:00:00Z"))?.id).toBe("it-2");
  });

  it("burns remaining work per day and leaves future days null", () => {
    const { unit, totalScope, days } = computeBurndown(items, S2, NOW);

    expect(unit).toBe("points");
    expect(totalScope).toBe(5);
    expect(days).toHaveLength(14);
    expect(days.slice(0, 4).map((d) => [d.date, d.remaining])).toEqual([
      ["2026-03-16", 5],
      ["2026-03-17", 1],
      ["2026-03-18", 1],
      ["2026-03-19", null],
    ]);
    expect(days[0].ideal).toBeCloseTo(4.64);
    expect(days[13]).toMatchObject({ date: "2026-03-29", ideal: 0, remaining: null });
  });

  it("returns zero scope for an iteration without items", () => {
    const { totalScope, days } = computeBurndown([], S2, NOW);
    expect(totalScope).toBe(0);
    expect(days.every((d) => d.ideal === 0)).toBe(true);
  });
});

describe("computeCycleTime", () => {
  const created = "2026-03-01T00:00:00Z";
  const done = (days: number) =>
    closed(new Date(Date.parse(created) + days * 86_400_000).toISOString(), { createdAt: created });

  it("computes mean, median, p90, min and max over items closed in the window", () => {
    const items = [done(1), done(2), done(3), done(4), done(10), item()];
    // closed long before the window
    items.push(closed("2025-01-10T00:00:00Z", { createdAt: "2025-01-01T00:00:00Z" }));

    expect(computeCycleTime(items, 30, NOW)).toEqual({
      count: 5,
      meanDays: 4,
      medianDays: 3,
      p90Days: 7.6,
      minDays: 1,
      maxDays: 10,
    });
  });

  it("returns nulls when nothing finished", () => {
    expect(computeCycleTime([item()], 30, NOW)).toEqual({
      count: 0,
      meanDays: null,
      medianDays: null,
      p90Days: null,
      minDays: null,
      maxDays: null,
    });
  });
});

describe("computeThroughput", () => {
  const items = [
    closed("2026-03-05T00:00:00Z", { points: 3 }),
    closed("2026-03-10T09:00:00Z"),
    closed("2026-03-11T09:00:00Z"),
    closed("2026-03-17T10:00:00Z", { points: 2 }),
    closed("2026-02-01T00:00:00Z"),
    item(),
  ];

  it("buckets closed items per Monday-based week, including empty buckets", () => {
    const { buckets, totalClosed } = computeThroughput(items, 14, "week", NOW);

    expect(buckets).toEqual([
      { bucketStart: "2026-03-02", closedItems: 1, closedPoints: 3 },
      { bucketStart: "2026-03-09", closedItems: 2, closedPoints: 0 },
      { bucketStart: "2026-03-16", closedItems: 1, closedPoints: 2 },
    ]);
    expect(totalClosed).toBe(4);
  });

  it("supports day and month buckets", () => {
    expect(computeThroughput(items, 2, "day", NOW).buckets.map((b) => b.bucketStart)).toEqual([
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
    ]);
    expect(computeThroughput(items, 30, "month", NOW).buckets).toEqual([
      { bucketStart: "2026-02-01", closedItems: 0, closedPoints: 0 },
      { bucketStart: "2026-03-01", closedItems: 4, closedPoints: 5 },
    ]);
  });

  it("reports zero-filled buckets for no data", () => {
    const { buckets, totalClosed } = computeThroughput([], 7, "week", NOW);
    expect(totalClosed).toBe(0);
    expect(buckets.every((b) => b.closedItems === 0)).toBe(true);
  });

  it("starts weeks on Monday", () => {
    expect(bucketStart(new Date("2026-03-22T10:00:00Z"), "week").toISOString()).toBe(
      "2026-03-16T00:00:00.000Z"
    );
  });
});

describe("computeSummary", () => {
  it("counts by status, type and field and lists overdue open milestones", () => {
    const overdue = { title: "M1", dueOn: "2026-03-01T00:00:00Z", state: "OPEN" };
    const items = [
      item({ status: "Todo", fields: { Status: "Todo", Priority: "High" }, milestone: overdue }),
      closed("2026-03-05T00:00:00Z", {
        status: "Done",
        fields: { Status: "Done", Priority: "High" },
        milestone: overdue,
      }),
      item({
        type: "DRAFT_ISSUE",
        status: null,
        milestone: { title: "M2", dueOn: "2027-01-01T00:00:00Z", state: "OPEN" },
      }),
    ];

    expect(computeSummary(items, NOW)).toEqual({
      openItems: 2,
      closedItems: 1,
      byType: { ISSUE: 2, DRAFT_ISSUE: 1 },
      byStatus: { Todo: 1, Done: 1, "(none)": 1 },
      byField: { Status: { Todo: 1, Done: 1 }, Priority: { High: 2 } },
      totalPoints: null,
      completedPoints: null,
      overdueMilestones: [{ title: "M1", dueOn: "2026-03-01T00:00:00Z", openItems: 1 }],
    });
  });

  it("handles an empty project", () => {
    expect(computeSummary([], NOW)).toMatchObject({
      openItems: 0,
      closedItems: 0,
      byStatus: {},
      overdueMilestones: [],
    });
  });
});

describe("AnalyticsService", () => {
  function serviceWith(items: AnalyticsItem[], truncated: boolean) {
    const listItems = vi.fn().mockResolvedValue({ items, truncated });
    const factory = partialFake<GitHubRepositoryFactory>({
      createProjectAnalyticsRepository: () =>
        partialFake<GitHubProjectAnalyticsRepository>({ listItems }),
    });
    return { service: new AnalyticsService(factory, () => NOW), listItems };
  }

  it("applies defaults and carries the truncated flag on every result", async () => {
    const { service, listItems } = serviceWith(
      [closed("2026-03-17T10:00:00Z", { iteration: S2, points: 2 })],
      true
    );

    const velocity = await service.sprintVelocity({ projectId: "P1" });
    const burndown = await service.sprintBurndown({ projectId: "P1" });
    const cycle = await service.cycleTime({ projectId: "P1" });
    const throughput = await service.throughput({ projectId: "P1" });
    const summary = await service.projectSummary({ projectId: "P1" });

    expect(listItems).toHaveBeenCalledWith("P1");
    for (const result of [velocity, burndown, cycle, throughput, summary]) {
      expect(result).toMatchObject({
        projectId: "P1",
        truncated: true,
        itemCount: 1,
        generatedAt: NOW.toISOString(),
      });
    }
    expect(cycle.sinceDays).toBe(30);
    expect(throughput.bucket).toBe("week");
    expect(burndown.iteration?.id).toBe("it-2");
  });

  it("returns an empty burndown when the project has no iterations", async () => {
    const { service } = serviceWith([], false);
    expect(await service.sprintBurndown({ projectId: "P1" })).toMatchObject({
      iteration: null,
      days: [],
      truncated: false,
    });
  });

  it("rejects non-positive windows", async () => {
    const { service } = serviceWith([], false);
    await expect(service.cycleTime({ projectId: "P1", sinceDays: 0 })).rejects.toThrow("sinceDays");
    await expect(service.sprintVelocity({ projectId: "P1", lastN: -1 })).rejects.toThrow("lastN");
  });
});
