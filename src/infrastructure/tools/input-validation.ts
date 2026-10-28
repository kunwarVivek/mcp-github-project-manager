/**
 * Argument guards for the compound tools.
 *
 * The compound schemas are FLAT: one zod object holds the parameters of every
 * action of a tool, so an action's own parameters cannot be marked required
 * there (they would be required for the other actions too). MCP therefore
 * accepts a call like `{"action": "calculate_capacity"}` and the handler is
 * the last line of defence.
 *
 * Without a guard the handlers dereferenced the missing argument and died
 * with `TypeError: Cannot read properties of undefined (reading 'map')` -
 * an error the caller cannot act on. These helpers turn that into a message
 * that names the missing parameter and the action that needs it.
 *
 * The errors are plain `Error`s on purpose: a bad argument is a TOOL
 * failure, which the server reports as `{content, isError: true}` so the
 * model can recover. A JSON-RPC/protocol error is reserved for protocol
 * faults.
 */

export function requireArray<T>(value: T[] | undefined | null, name: string, action: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} is required for ${action}`);
  }
  return value;
}

export function requireValue<T>(
  value: T | undefined | null,
  name: string,
  action: string
): NonNullable<T> {
  if (value === undefined || value === null) {
    throw new Error(`${name} is required for ${action}`);
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`${name} is required for ${action}`);
  }
  return value as NonNullable<T>;
}
