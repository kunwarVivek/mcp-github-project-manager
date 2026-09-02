/**
 * Per-tool execution telemetry: latency histograms and error counters.
 *
 * Singleton — mirrors ToolRegistry's lifecycle. Bounded latency buffer
 * (last 1000 samples per tool) keeps memory predictable.
 */

const MAX_LATENCY_SAMPLES = 1000;

export interface ToolMetrics {
  toolName: string;
  totalCalls: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastCalledAt?: string;
}

interface ToolBucket {
  calls: number;
  errors: number;
  latencies: number[];
  lastCalledAt?: string;
}

export class ToolTelemetry {
  private static _instance: ToolTelemetry;
  private buckets = new Map<string, ToolBucket>();

  static getInstance(): ToolTelemetry {
    if (!ToolTelemetry._instance) {
      ToolTelemetry._instance = new ToolTelemetry();
    }
    return ToolTelemetry._instance;
  }

  /**
   * Record a single tool invocation.
   */
  recordCall(toolName: string, latencyMs: number, isError: boolean): void {
    let bucket = this.buckets.get(toolName);
    if (!bucket) {
      bucket = { calls: 0, errors: 0, latencies: [] };
      this.buckets.set(toolName, bucket);
    }
    bucket.calls++;
    if (isError) bucket.errors++;
    bucket.lastCalledAt = new Date().toISOString();

    // Ring-buffer: drop oldest when full
    if (bucket.latencies.length >= MAX_LATENCY_SAMPLES) {
      bucket.latencies.shift();
    }
    bucket.latencies.push(latencyMs);
  }

  /**
   * Return metrics for every tool that has been called at least once.
   */
  getMetrics(): ToolMetrics[] {
    const out: ToolMetrics[] = [];
    for (const [toolName, bucket] of this.buckets) {
      out.push(this.buildMetrics(toolName, bucket));
    }
    return out.sort((a, b) => a.toolName.localeCompare(b.toolName));
  }

  /**
   * Return metrics for a single tool, or undefined if never called.
   */
  getToolMetrics(toolName: string): ToolMetrics | undefined {
    const bucket = this.buckets.get(toolName);
    if (!bucket) return undefined;
    return this.buildMetrics(toolName, bucket);
  }

  /**
   * Clear all recorded telemetry.
   */
  reset(): void {
    this.buckets.clear();
  }

  // ── internals ──────────────────────────────────────────────────────

  private buildMetrics(toolName: string, bucket: ToolBucket): ToolMetrics {
    const sorted = bucket.latencies.slice().sort((a, b) => a - b);
    const avg = sorted.length > 0
      ? sorted.reduce((s, v) => s + v, 0) / sorted.length
      : 0;
    const p95 = sorted.length > 0
      ? sorted[Math.min(Math.ceil(sorted.length * 0.95) - 1, sorted.length - 1)]
      : 0;

    return {
      toolName,
      totalCalls: bucket.calls,
      errorCount: bucket.errors,
      avgLatencyMs: Math.round(avg * 100) / 100,
      p95LatencyMs: p95,
      lastCalledAt: bucket.lastCalledAt,
    };
  }
}
