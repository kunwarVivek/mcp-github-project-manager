import { beforeEach, describe, expect, it } from "vitest";
import { traceContext } from "../../../../infrastructure/observability/CorrelationContext";
import {
  AIServiceFactory,
  usageMeteringMiddleware,
} from "../../../../services/ai/AIServiceFactory";
import { must } from "../../../helpers/must";

/**
 * Server-side token metering.
 *
 * SCOPE (deliberately narrow): this meters tokens *this server* spends calling
 * a provider on an agent's behalf. It does NOT observe tokens the agent's own
 * runtime spends — that traffic never reaches this process. `record_usage`
 * remains the only channel for agent-side spend.
 */
describe("AI usage metering middleware", () => {
  let factory: AIServiceFactory;

  beforeEach(() => {
    factory = AIServiceFactory.getInstance();
  });

  function trace(agentId: string | undefined, usage: { tokens: number } | undefined) {
    return { correlationId: "test", startTime: Date.now(), operation: "test", agentId, usage };
  }

  async function meter(
    usageFromProvider: unknown,
    store: ReturnType<typeof trace> | undefined
  ): Promise<void> {
    const call = () =>
      (
        usageMeteringMiddleware.wrapGenerate as unknown as (a: {
          doGenerate: () => Promise<unknown>;
        }) => Promise<unknown>
      )({
        doGenerate: async () => ({ usage: usageFromProvider }),
      });
    if (store) await traceContext.run(store, call);
    else await call();
  }

  it("accumulates provider-reported tokens into the trace context", async () => {
    const usage = { tokens: 0 };
    await meter(
      { inputTokens: { total: 100 }, outputTokens: { total: 50 } },
      trace("agent-1", usage)
    );
    expect(usage.tokens).toBe(150);
  });

  it("accumulates across multiple AI calls in one tool call", async () => {
    const usage = { tokens: 0 };
    const store = trace("agent-1", usage);
    await meter({ inputTokens: { total: 10 }, outputTokens: { total: 5 } }, store);
    await meter({ inputTokens: { total: 20 }, outputTokens: { total: 1 } }, store);
    expect(usage.tokens).toBe(36);
  });

  it("never throws when the provider reports no usage at all", async () => {
    const usage = { tokens: 0 };
    await expect(meter(undefined, trace("agent-1", usage))).resolves.toBeUndefined();
    expect(usage.tokens).toBe(0);
  });

  it("does not throw when there is no trace context", async () => {
    await expect(
      meter({ inputTokens: { total: 5 }, outputTokens: { total: 5 } }, undefined)
    ).resolves.toBeUndefined();
  });

  it("treats usage.inputTokens/outputTokens as objects carrying .total", () => {
    // Regression guard: ai@7 reports usage as
    //   inputTokens: { total, noCache, cacheRead, cacheWrite }
    //   outputTokens: { total, text, reasoning }
    // Reading them as plain numbers yields NaN and silently poisons the budget.
    const usageShape = {
      inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 50, text: 50, reasoning: 0 },
    };
    const tokens = (usageShape.inputTokens?.total ?? 0) + (usageShape.outputTokens?.total ?? 0);
    expect(tokens).toBe(150);
    expect(Number.isNaN(tokens)).toBe(false);
  });

  it("coalesces missing usage fields to 0 rather than NaN", () => {
    const partial: { inputTokens?: { total?: number }; outputTokens?: { total?: number } } = {};
    const tokens = (partial.inputTokens?.total ?? 0) + (partial.outputTokens?.total ?? 0);
    expect(tokens).toBe(0);
    expect(Number.isNaN(tokens)).toBe(false);
  });

  it("is a no-op with no trace context at all", () => {
    expect(traceContext.getStore()).toBeUndefined();
    expect(() => factory.getModel("main")).not.toThrow();
  });

  it("exposes getModel without changing its contract", () => {
    // Wrapping must not alter the null-when-unconfigured behaviour.
    expect(() => factory.getModel("main")).not.toThrow();
  });

  it("is a no-op when a trace exists but carries no agent", async () => {
    await traceContext.run(trace(undefined, undefined), async () => {
      expect(traceContext.getStore()?.agentId).toBeUndefined();
      expect(traceContext.getStore()?.usage).toBeUndefined();
    });
  });

  it("keeps the accumulator isolated between concurrent traces", async () => {
    const a = { tokens: 0 };
    const b = { tokens: 0 };
    await Promise.all([
      traceContext.run(trace("agent-a", a), async () => {
        await new Promise((r) => setTimeout(r, 5));
        must(must(traceContext.getStore(), "trace store").usage, "usage").tokens += 10;
      }),
      traceContext.run(trace("agent-b", b), async () => {
        must(must(traceContext.getStore(), "trace store").usage, "usage").tokens += 99;
      }),
    ]);
    expect(a.tokens).toBe(10);
    expect(b.tokens).toBe(99);
  });

  describe("wrapStream", () => {
    async function drain(
      parts: unknown[],
      store: ReturnType<typeof trace> | undefined
    ): Promise<unknown[]> {
      const call = async () => {
        const { stream } = await (
          usageMeteringMiddleware.wrapStream as unknown as (a: {
            doStream: () => Promise<{ stream: ReadableStream<unknown> }>;
          }) => Promise<{ stream: ReadableStream<unknown> }>
        )({
          doStream: async () => ({
            stream: new ReadableStream({
              start(controller) {
                for (const p of parts) controller.enqueue(p);
                controller.close();
              },
            }),
          }),
        });
        const out: unknown[] = [];
        for await (const chunk of stream) out.push(chunk);
        return out;
      };
      return store ? traceContext.run(store, call) : call();
    }

    const finish = {
      type: "finish",
      usage: { inputTokens: { total: 70 }, outputTokens: { total: 30 } },
    };

    it("accumulates usage reported on the finish part and passes every part through", async () => {
      const usage = { tokens: 0 };
      const parts = [{ type: "text-delta", delta: "hi" }, finish];
      const out = await drain(parts, trace("agent-1", usage));
      expect(out).toEqual(parts);
      expect(usage.tokens).toBe(100);
    });

    it("does not meter before the stream finishes", async () => {
      const usage = { tokens: 0 };
      await drain([{ type: "text-delta", delta: "hi" }], trace("agent-1", usage));
      expect(usage.tokens).toBe(0);
    });

    it("is a pass-through with no trace context", async () => {
      expect(await drain([finish], undefined)).toEqual([finish]);
    });
  });

  it("meters the MCP sampling fallback model", async () => {
    factory.setSamplingProvider(async () => ({
      role: "assistant",
      content: { type: "text", text: "x".repeat(40) },
    }));
    const model = must(Reflect.get(factory, "samplingModel"), "sampling model") as {
      doGenerate: (o: unknown) => Promise<unknown>;
    };
    try {
      const usage = { tokens: 0 };
      await traceContext.run(trace("agent-1", usage), () =>
        model.doGenerate({
          prompt: [{ role: "user", content: [{ type: "text", text: "y".repeat(8) }] }],
        })
      );
      // 8 input chars -> 2 tokens, 40 output chars -> 10 tokens (4 chars/token estimate)
      expect(usage.tokens).toBe(12);
    } finally {
      Reflect.set(factory, "samplingModel", null);
    }
  });
});
