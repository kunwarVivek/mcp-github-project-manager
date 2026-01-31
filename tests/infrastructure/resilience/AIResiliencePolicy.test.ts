/**
 * Unit tests for AIResiliencePolicy
 *
 * Tests composed resilience behavior:
 * - Successful execution
 * - Retry on transient failures
 * - Fallback when retries exhausted
 * - Circuit state queries
 * - Degraded result handling
 */

import { AIResiliencePolicy, type DegradedResult } from '../../../src/infrastructure/resilience/AIResiliencePolicy.js';

describe('AIResiliencePolicy', () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress stderr output during tests
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('execute()', () => {
    it('executes successfully and returns result', async () => {
      const policy = new AIResiliencePolicy({ maxRetries: 2 });
      const result = await policy.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('returns async operation result with correct type', async () => {
      const policy = new AIResiliencePolicy();
      const result = await policy.execute(async () => ({ data: 42, status: 'ok' }));
      expect(result).toEqual({ data: 42, status: 'ok' });
    });

    it('retries on transient failure', async () => {
      const policy = new AIResiliencePolicy({ maxRetries: 3 });
      let callCount = 0;

      const result = await policy.execute(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Transient failure');
        }
        return 'recovered';
      });

      expect(result).toBe('recovered');
      expect(callCount).toBe(3);
    });

    it('returns fallback when all retries exhausted', async () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 2,
        consecutiveFailures: 10, // High threshold to prevent circuit from opening
      });

      const result = await policy.execute(
        async () => {
          throw new Error('Permanent failure');
        },
        () => ({ degraded: true as const, message: 'Custom fallback' })
      );

      expect(result).toEqual({ degraded: true, message: 'Custom fallback' });
    });

    it('returns default fallback when no fallback function provided', async () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 1,
        consecutiveFailures: 10,
      });

      const result = await policy.execute(async () => {
        throw new Error('Failure');
      });

      const degraded = result as DegradedResult;
      expect(degraded.degraded).toBe(true);
      expect(degraded.message).toBe('AI service unavailable');
    });

    it('returns custom non-degraded fallback', async () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 1,
        consecutiveFailures: 10,
      });

      const result = await policy.execute(
        async () => {
          throw new Error('Failure');
        },
        () => ({ cached: true, data: 'cached value' })
      );

      expect(result).toEqual({ cached: true, data: 'cached value' });
    });
  });

  describe('circuit state queries', () => {
    it('getCircuitState() returns closed initially', () => {
      const policy = new AIResiliencePolicy();
      expect(policy.getCircuitState()).toBe('closed');
    });

    it('isCircuitOpen() returns false initially', () => {
      const policy = new AIResiliencePolicy();
      expect(policy.isCircuitOpen()).toBe(false);
    });

    it('getCircuitState() returns open after failures', async () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 1,
        consecutiveFailures: 2,
      });

      // Exhaust retries and cause circuit to open
      for (let i = 0; i < 3; i++) {
        await policy.execute(async () => {
          throw new Error('Fail');
        });
      }

      expect(policy.getCircuitState()).toBe('open');
      expect(policy.isCircuitOpen()).toBe(true);
    });
  });

  describe('configuration', () => {
    it('getConfig() returns resolved configuration', () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 5,
        timeoutMs: 10000,
      });

      const config = policy.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.timeoutMs).toBe(10000);
      // Defaults should be applied
      expect(config.halfOpenAfterMs).toBe(30000);
      expect(config.consecutiveFailures).toBe(5);
    });

    it('applies default values when no config provided', () => {
      const policy = new AIResiliencePolicy();
      const config = policy.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.timeoutMs).toBe(30000);
      expect(config.halfOpenAfterMs).toBe(30000);
      expect(config.consecutiveFailures).toBe(5);
    });
  });

  describe('logging', () => {
    it('logs initialization to stderr', () => {
      new AIResiliencePolicy({ maxRetries: 2 });

      expect(stderrSpy).toHaveBeenCalled();
      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('[AIResiliencePolicy]'))).toBe(true);
      expect(calls.some((c) => c.includes('maxRetries=2'))).toBe(true);
    });

    it('logs fallback trigger to stderr', async () => {
      const policy = new AIResiliencePolicy({
        maxRetries: 1,
        consecutiveFailures: 10,
      });

      await policy.execute(async () => {
        throw new Error('Failure');
      });

      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('Fallback triggered'))).toBe(true);
    });
  });
});

describe('createAIResiliencePolicy', () => {
  beforeEach(() => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates AIResiliencePolicy instance', async () => {
    const { createAIResiliencePolicy } = await import('../../../src/infrastructure/resilience/AIResiliencePolicy.js');
    const policy = createAIResiliencePolicy({ maxRetries: 2 });

    expect(policy).toBeInstanceOf(AIResiliencePolicy);
    expect(policy.getConfig().maxRetries).toBe(2);
  });
});
