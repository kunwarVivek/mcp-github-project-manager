import { describe, expect, it } from "vitest";
import { ToolTelemetry } from "../../../../infrastructure/tools/ToolTelemetry";

describe("ToolTelemetry", () => {
  describe("recordCall", () => {
    it("tracks call count per tool independently", () => {
      const telemetry = new ToolTelemetry();
      telemetry.recordCall("tool_a", 10, false);
      telemetry.recordCall("tool_a", 20, false);
      telemetry.recordCall("tool_b", 5, false);

      expect(telemetry.getToolMetrics("tool_a")?.totalCalls).toBe(2);
      expect(telemetry.getToolMetrics("tool_b")?.totalCalls).toBe(1);
    });

    it("stamps lastCalledAt with a timestamp on every call", () => {
      const telemetry = new ToolTelemetry();
      const before = Date.now();

      telemetry.recordCall("tool_a", 5, false);

      const metrics = telemetry.getToolMetrics("tool_a");
      expect(metrics?.lastCalledAt).toBeDefined();
      expect(new Date(metrics!.lastCalledAt!).getTime()).toBeGreaterThanOrEqual(before);
    });

    it("increments errorCount only for failed calls", () => {
      const telemetry = new ToolTelemetry();
      telemetry.recordCall("tool_a", 10, false);
      telemetry.recordCall("tool_a", 20, true);
      telemetry.recordCall("tool_a", 30, true);

      const metrics = telemetry.getToolMetrics("tool_a");
      expect(metrics?.totalCalls).toBe(3);
      expect(metrics?.errorCount).toBe(2);
    });
  });

  describe("getMetrics", () => {
    it("returns metrics for every recorded tool, sorted by name", () => {
      const telemetry = new ToolTelemetry();
      telemetry.recordCall("zebra_tool", 10, false);
      telemetry.recordCall("alpha_tool", 20, false);

      const metrics = telemetry.getMetrics();
      expect(metrics.map((m) => m.toolName)).toEqual(["alpha_tool", "zebra_tool"]);
      expect(metrics).toHaveLength(2);
    });

    it("returns an empty array when nothing has been recorded", () => {
      const telemetry = new ToolTelemetry();
      expect(telemetry.getMetrics()).toEqual([]);
    });
  });

  describe("getToolMetrics", () => {
    it("returns the metrics object for a single named tool", () => {
      const telemetry = new ToolTelemetry();
      telemetry.recordCall("tool_a", 15, false);

      const metrics = telemetry.getToolMetrics("tool_a");
      expect(metrics).toMatchObject({ toolName: "tool_a", totalCalls: 1, errorCount: 0 });
    });

    it("returns undefined for a tool that was never called", () => {
      const telemetry = new ToolTelemetry();
      expect(telemetry.getToolMetrics("missing_tool")).toBeUndefined();
    });
  });

  describe("p95 latency calculation", () => {
    it("sorts samples before computing the 95th percentile and the average", () => {
      const telemetry = new ToolTelemetry();
      // A shuffled permutation of 1..20 proves the samples get sorted, not
      // read in insertion order.
      const latencies = [15, 3, 20, 1, 18, 7, 12, 2, 19, 9, 4, 16, 6, 11, 14, 8, 17, 5, 13, 10];
      for (const latency of latencies) {
        telemetry.recordCall("tool_a", latency, false);
      }

      const metrics = telemetry.getToolMetrics("tool_a");
      // sorted = [1..20]; ceil(20 * 0.95) - 1 = 18 (0-indexed) => value 19.
      expect(metrics?.p95LatencyMs).toBe(19);
      // avg(1..20) = 210 / 20 = 10.5
      expect(metrics?.avgLatencyMs).toBe(10.5);
    });
  });

  describe("ring buffer eviction", () => {
    it("keeps only the most recent 1000 latency samples per tool", () => {
      const telemetry = new ToolTelemetry();
      // Record 1005 calls with strictly increasing latencies (0..1004). The
      // ring buffer caps at 1000 samples, so the oldest 5 (0..4) must be
      // evicted, leaving samples 5..1004.
      for (let i = 0; i < 1005; i++) {
        telemetry.recordCall("tool_a", i, false);
      }

      const metrics = telemetry.getToolMetrics("tool_a");
      // totalCalls is a separate counter from the bounded latency buffer, so
      // eviction of samples must never drop recorded call counts.
      expect(metrics?.totalCalls).toBe(1005);
      // p95 over the surviving [5..1004] window (1000 samples):
      // ceil(1000 * 0.95) - 1 = 949 (0-indexed) => value 5 + 949 = 954.
      expect(metrics?.p95LatencyMs).toBe(954);
    });
  });

  describe("reset", () => {
    it("clears all recorded telemetry", () => {
      const telemetry = new ToolTelemetry();
      telemetry.recordCall("tool_a", 10, false);

      telemetry.reset();

      expect(telemetry.getMetrics()).toEqual([]);
      expect(telemetry.getToolMetrics("tool_a")).toBeUndefined();
    });
  });

  describe("getInstance", () => {
    it("returns the same instance across repeated calls", () => {
      const a = ToolTelemetry.getInstance();
      const b = ToolTelemetry.getInstance();
      expect(a).toBe(b);
    });
  });
});
