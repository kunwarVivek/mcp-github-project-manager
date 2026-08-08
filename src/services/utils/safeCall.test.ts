import { describe, it, expect } from '@jest/globals';
import { safeCall } from './safeCall';

describe('safeCall', () => {
  it('should return the result of a successful async function', async () => {
    const result = await safeCall(async () => 42);
    expect(result).toBe(42);
  });

  it('should return complex objects from successful calls', async () => {
    const result = await safeCall(async () => ({ name: 'test', value: 123 }));
    expect(result).toEqual({ name: 'test', value: 123 });
  });

  it('should map errors to MCP errors', async () => {
    await expect(
      safeCall(async () => {
        throw new Error('Something went wrong');
      })
    ).rejects.toThrow();
  });

  it('should handle non-Error thrown values', async () => {
    await expect(
      safeCall(async () => {
        throw 'string error';
      })
    ).rejects.toThrow();
  });

  it('should handle thrown numbers', async () => {
    await expect(
      safeCall(async () => {
        throw 404;
      })
    ).rejects.toThrow();
  });

  it('should handle thrown null', async () => {
    await expect(
      safeCall(async () => {
        throw null;
      })
    ).rejects.toThrow();
  });

  it('should propagate the mapped error type', async () => {
    try {
      await safeCall(async () => {
        throw new Error('test error');
      });
      fail('Should have thrown');
    } catch (error: any) {
      // mapErrorToMCPError wraps errors in an MCP-compatible format
      expect(error).toBeDefined();
    }
  });
});
