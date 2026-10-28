/**
 * Narrow a possibly-nullish value inside a test, failing with a readable
 * message instead of a later `Cannot read properties of undefined` error.
 */
export function must<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what} to be defined, got ${String(value)}`);
  }
  return value;
}
