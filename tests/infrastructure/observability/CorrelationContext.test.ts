/**
 * Unit tests for CorrelationContext
 *
 * Tests AsyncLocalStorage-based correlation ID tracking:
 * - Correlation ID generation
 * - Context propagation
 * - Trace lifecycle
 * - Nested traces
 */

import {
  startTrace,
  getCorrelationId,
  getTraceContext,
  traceContext,
} from '../../../src/infrastructure/observability/CorrelationContext.js';

describe('CorrelationContext', () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress stderr output during tests
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('getCorrelationId()', () => {
    it('returns undefined outside of trace', () => {
      expect(getCorrelationId()).toBeUndefined();
    });

    it('returns correlation ID within trace', async () => {
      await startTrace('test-operation', async () => {
        const correlationId = getCorrelationId();
        expect(correlationId).toBeDefined();
        expect(typeof correlationId).toBe('string');
        // UUID v4 format
        expect(correlationId).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      });
    });
  });

  describe('getTraceContext()', () => {
    it('returns undefined outside of trace', () => {
      expect(getTraceContext()).toBeUndefined();
    });

    it('returns full context within trace', async () => {
      await startTrace('my-operation', async () => {
        const context = getTraceContext();
        expect(context).toBeDefined();
        expect(context?.correlationId).toBeDefined();
        expect(context?.operation).toBe('my-operation');
        expect(typeof context?.startTime).toBe('number');
        expect(context!.startTime).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('startTrace()', () => {
    it('creates correlation ID', async () => {
      let capturedId: string | undefined;

      await startTrace('test', async () => {
        capturedId = getCorrelationId();
      });

      expect(capturedId).toBeDefined();
    });

    it('returns operation result', async () => {
      const result = await startTrace('test', async () => {
        return { data: 'test-value' };
      });

      expect(result).toEqual({ data: 'test-value' });
    });

    it('returns async operation result', async () => {
      const result = await startTrace('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 42;
      });

      expect(result).toBe(42);
    });

    it('propagates errors', async () => {
      await expect(
        startTrace('test', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });

    it('generates unique IDs for each trace', async () => {
      const ids: string[] = [];

      await startTrace('test1', async () => {
        ids.push(getCorrelationId()!);
      });

      await startTrace('test2', async () => {
        ids.push(getCorrelationId()!);
      });

      expect(ids[0]).not.toBe(ids[1]);
    });

    it('clears context after trace completes', async () => {
      await startTrace('test', async () => {
        expect(getCorrelationId()).toBeDefined();
      });

      expect(getCorrelationId()).toBeUndefined();
    });
  });

  describe('nested traces', () => {
    it('maintains outer context in nested trace', async () => {
      let outerId: string | undefined;
      let innerId: string | undefined;

      await startTrace('outer', async () => {
        outerId = getCorrelationId();

        await startTrace('inner', async () => {
          innerId = getCorrelationId();
        });
      });

      expect(outerId).toBeDefined();
      expect(innerId).toBeDefined();
      // Inner trace should have different ID
      expect(outerId).not.toBe(innerId);
    });

    it('restores outer context after inner trace', async () => {
      let outerBefore: string | undefined;
      let outerAfter: string | undefined;

      await startTrace('outer', async () => {
        outerBefore = getCorrelationId();

        await startTrace('inner', async () => {
          // Different ID
          expect(getCorrelationId()).not.toBe(outerBefore);
        });

        outerAfter = getCorrelationId();
      });

      // After inner completes, outer context is restored?
      // Note: AsyncLocalStorage.run creates new context, so after inner,
      // we're back in outer's context
      // Actually the context IS the outer context after run completes
      expect(outerAfter).toBe(outerBefore);
    });
  });

  describe('logging', () => {
    it('logs trace start event', async () => {
      await startTrace('test-op', async () => {
        return 'result';
      });

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      const startLog = calls.find((c) => c.includes('"status":"start"'));
      expect(startLog).toBeDefined();
      expect(startLog).toContain('"operation":"test-op"');
    });

    it('logs trace success event', async () => {
      await startTrace('test-op', async () => {
        return 'result';
      });

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      const successLog = calls.find((c) => c.includes('"status":"success"'));
      expect(successLog).toBeDefined();
      expect(successLog).toContain('"durationMs"');
    });

    it('logs trace error event', async () => {
      try {
        await startTrace('test-op', async () => {
          throw new Error('Test failure');
        });
      } catch {
        // Expected
      }

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      const errorLog = calls.find((c) => c.includes('"status":"error"'));
      expect(errorLog).toBeDefined();
      expect(errorLog).toContain('"error":"Test failure"');
    });
  });

  describe('traceContext export', () => {
    it('is an AsyncLocalStorage instance', () => {
      expect(traceContext).toBeDefined();
      expect(typeof traceContext.run).toBe('function');
      expect(typeof traceContext.getStore).toBe('function');
    });
  });
});
