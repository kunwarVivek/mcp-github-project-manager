/**
 * Unit tests for CircuitBreakerService
 *
 * Tests circuit breaker behavior:
 * - Initial state
 * - Successful execution
 * - State transitions on failures
 * - State queries
 */

import { CircuitBreakerService } from '../../../src/infrastructure/resilience/CircuitBreakerService.js';

describe('CircuitBreakerService', () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    // Suppress stderr output during tests
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  describe('initial state', () => {
    it('starts in closed state', () => {
      const cb = new CircuitBreakerService('test');
      expect(cb.getState()).toBe('closed');
    });

    it('returns isOpen() as false initially', () => {
      const cb = new CircuitBreakerService('test');
      expect(cb.isOpen()).toBe(false);
    });
  });

  describe('execute()', () => {
    it('executes successfully when closed', async () => {
      const cb = new CircuitBreakerService('test');
      const result = await cb.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('returns async operation result', async () => {
      const cb = new CircuitBreakerService('test');
      const result = await cb.execute(async () => {
        return { data: 42 };
      });
      expect(result).toEqual({ data: 42 });
    });

    it('throws error on operation failure', async () => {
      const cb = new CircuitBreakerService('test');
      await expect(
        cb.execute(async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');
    });

    it('tracks consecutive failures', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 3 });

      // First two failures - circuit should stay closed
      for (let i = 0; i < 2; i++) {
        await expect(
          cb.execute(async () => {
            throw new Error('Failure');
          })
        ).rejects.toThrow('Failure');
      }
      expect(cb.getState()).toBe('closed');
    });

    it('opens after consecutive failures threshold', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 3 });

      // Cause 3 consecutive failures to open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          cb.execute(async () => {
            throw new Error('Failure');
          })
        ).rejects.toThrow('Failure');
      }

      // Circuit should now be open
      expect(cb.getState()).toBe('open');
      expect(cb.isOpen()).toBe(true);
    });
  });

  describe('state queries', () => {
    it('getState() returns correct state', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 2 });
      expect(cb.getState()).toBe('closed');

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('Fail');
          });
        } catch {
          // Expected
        }
      }

      expect(cb.getState()).toBe('open');
    });

    it('isOpen() returns correct boolean', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 2 });
      expect(cb.isOpen()).toBe(false);

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await cb.execute(async () => {
            throw new Error('Fail');
          });
        } catch {
          // Expected
        }
      }

      expect(cb.isOpen()).toBe(true);
    });
  });

  describe('configuration', () => {
    it('accepts custom consecutiveFailures', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 1 });

      // Single failure should open the circuit
      await expect(
        cb.execute(async () => {
          throw new Error('Fail');
        })
      ).rejects.toThrow('Fail');

      expect(cb.isOpen()).toBe(true);
    });

    it('accepts custom halfOpenAfter', () => {
      // Just verify it accepts the config without error
      const cb = new CircuitBreakerService('test', {
        halfOpenAfter: 1000,
        consecutiveFailures: 5,
      });
      expect(cb.getState()).toBe('closed');
    });
  });

  describe('logging', () => {
    it('logs state changes to stderr', async () => {
      const cb = new CircuitBreakerService('test', { consecutiveFailures: 1 });

      await expect(
        cb.execute(async () => {
          throw new Error('Fail');
        })
      ).rejects.toThrow();

      // Should have logged the state change
      expect(stderrSpy).toHaveBeenCalled();
      const calls = stderrSpy.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('[CircuitBreaker:test]'))).toBe(true);
    });
  });
});
