import { describe, expect, it } from "vitest";
import {
  initTelemetry,
  shutdownTelemetry,
  withSpan,
} from "../../../../infrastructure/observability/otel";

describe("otel (disabled)", () => {
  it("initTelemetry is a no-op without an endpoint", async () => {
    await expect(initTelemetry({})).resolves.toBe(false);
    await expect(initTelemetry({ endpoint: "" })).resolves.toBe(false);
  });

  it("withSpan just runs fn without a span and returns its value", async () => {
    const seen: unknown[] = [];

    const result = await withSpan("op", { a: 1 }, (span) => {
      seen.push(span);
      return Promise.resolve(7);
    });

    expect(result).toBe(7);
    expect(seen).toEqual([undefined]);
  });

  it("withSpan propagates errors unchanged", async () => {
    const failure = new Error("boom");

    await expect(
      withSpan("op", {}, () => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });

  it("shutdownTelemetry resolves when never started", async () => {
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });
});
