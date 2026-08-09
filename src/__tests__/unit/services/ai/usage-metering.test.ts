import { describe, expect, it, beforeEach } from 'vitest';
import { traceContext } from '../../../../infrastructure/observability/CorrelationContext';
import {
  AIServiceFactory,
  usageMeteringMiddleware,
} from '../../../../services/ai/AIServiceFactory';

/**
 * Server-side token metering.
 *
 * SCOPE (deliberately narrow): this meters tokens *this server* spends calling
 * a provider on an agent's behalf. It does NOT observe tokens the agent's own
 * runtime spends — that traffic never reaches this process. `record_usage`
 * remains the only channel for agent-side spend.
 */
describe('AI usage metering middleware', () => {
  let factory: AIServiceFactory;

  beforeEach(() => {
    factory = AIServiceFactory.getInstance();
  });

  function trace(agentId: string | undefined, usage: { tokens: number } | undefined) {
    return { correlationId: 'test', startTime: Date.now(), operation: 'test', agentId, usage };
  }

  async function meter(
    usageFromProvider: unknown,
    store: ReturnType<typeof trace> | undefined,
  ): Promise<void> {
    const call = () =>
      (usageMeteringMiddleware.wrapGenerate as unknown as (a: {
        doGenerate: () => Promise<unknown>;
      }) => Promise<unknown>)({
        doGenerate: async () => ({ usage: usageFromProvider }),
      });
    if (store) await traceContext.run(store, call);
    else await call();
  }

  it('accumulates provider-reported tokens into the trace context', async () => {
    const usage = { tokens: 0 };
    await meter(
      { inputTokens: { total: 100 }, outputTokens: { total: 50 } },
      trace('agent-1', usage),
    );
    expect(usage.tokens).toBe(150);
  });

  it('accumulates across multiple AI calls in one tool call', async () => {
    const usage = { tokens: 0 };
    const store = trace('agent-1', usage);
    await meter({ inputTokens: { total: 10 }, outputTokens: { total: 5 } }, store);
    await meter({ inputTokens: { total: 20 }, outputTokens: { total: 1 } }, store);
    expect(usage.tokens).toBe(36);
  });

  it('never throws when the provider reports no usage at all', async () => {
    const usage = { tokens: 0 };
    await expect(meter(undefined, trace('agent-1', usage))).resolves.toBeUndefined();
    expect(usage.tokens).toBe(0);
  });

  it('does not throw when there is no trace context', async () => {
    await expect(
      meter({ inputTokens: { total: 5 }, outputTokens: { total: 5 } }, undefined),
    ).resolves.toBeUndefined();
  });

  it('treats usage.inputTokens/outputTokens as objects carrying .total', () => {
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

  it('coalesces missing usage fields to 0 rather than NaN', () => {
    const partial: { inputTokens?: { total?: number }; outputTokens?: { total?: number } } = {};
    const tokens = (partial.inputTokens?.total ?? 0) + (partial.outputTokens?.total ?? 0);
    expect(tokens).toBe(0);
    expect(Number.isNaN(tokens)).toBe(false);
  });

  it('is a no-op with no trace context at all', () => {
    expect(traceContext.getStore()).toBeUndefined();
    expect(() => factory.getModel('main')).not.toThrow();
  });

  it('exposes getModel without changing its contract', () => {
    // Wrapping must not alter the null-when-unconfigured behaviour.
    expect(() => factory.getModel('main')).not.toThrow();
  });

  it('is a no-op when a trace exists but carries no agent', async () => {
    await traceContext.run(trace(undefined, undefined), async () => {
      expect(traceContext.getStore()?.agentId).toBeUndefined();
      expect(traceContext.getStore()?.usage).toBeUndefined();
    });
  });

  it('keeps the accumulator isolated between concurrent traces', async () => {
    const a = { tokens: 0 };
    const b = { tokens: 0 };
    await Promise.all([
      traceContext.run(trace('agent-a', a), async () => {
        await new Promise((r) => setTimeout(r, 5));
        traceContext.getStore()!.usage!.tokens += 10;
      }),
      traceContext.run(trace('agent-b', b), async () => {
        traceContext.getStore()!.usage!.tokens += 99;
      }),
    ]);
    expect(a.tokens).toBe(10);
    expect(b.tokens).toBe(99);
  });
});
