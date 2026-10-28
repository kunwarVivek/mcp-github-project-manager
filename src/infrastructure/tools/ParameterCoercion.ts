import { z } from "zod";

/**
 * Parameter coercion utilities to handle MCP string-based parameters
 * Converts string values to appropriate types before Zod validation
 */

/**
 * Coerce MCP parameters to appropriate types based on Zod schema
 */
export function coerceParameters(
  args: Record<string, unknown>,
  schema: z.ZodType
): Record<string, unknown> {
  if (!args || typeof args !== "object") {
    return args;
  }

  const coerced = { ...args };

  // Get the shape of the schema if it's an object schema
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;

    for (const [key, value] of Object.entries(coerced)) {
      if (shape[key]) {
        coerced[key] = coerceValue(value, shape[key]);
      }
    }
  }

  return coerced;
}

/**
 * Coerce a single value based on its Zod type
 */
function coerceValue(value: unknown, zodType: z.ZodType): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle ZodDefault
  if (zodType instanceof z.ZodDefault) {
    return coerceValue(value, zodType._def.innerType as z.ZodType);
  }

  // Handle ZodOptional
  if (zodType instanceof z.ZodOptional) {
    return coerceValue(value, zodType._def.innerType as z.ZodType);
  }

  // Handle ZodNullable
  if (zodType instanceof z.ZodNullable) {
    return coerceValue(value, zodType._def.innerType as z.ZodType);
  }

  // Handle ZodBoolean - convert string "true"/"false" to boolean
  if (zodType instanceof z.ZodBoolean) {
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
    return value;
  }

  // Handle ZodNumber - convert string numbers to numbers
  if (zodType instanceof z.ZodNumber) {
    if (typeof value === "string" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return value;
  }

  // Handle ZodArray - parse JSON arrays from strings
  if (zodType instanceof z.ZodArray) {
    if (typeof value === "string") {
      try {
        // Try to parse as JSON array
        if (value.startsWith("[") && value.endsWith("]")) {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
        // Handle comma-separated values
        if (value.includes(",")) {
          return value.split(",").map((v) => v.trim());
        }
      } catch {
        // If parsing fails, return original value for Zod to handle
      }
    }
    return value;
  }

  // Handle ZodObject - recursively coerce nested objects
  if (zodType instanceof z.ZodObject && typeof value === "object") {
    return coerceParameters(value as Record<string, unknown>, zodType);
  }

  // Handle ZodEnum - no coercion needed, strings should work
  if (zodType instanceof z.ZodEnum) {
    return value;
  }

  // Handle ZodString - ensure string type
  if (zodType instanceof z.ZodString) {
    if (typeof value !== "string") {
      return String(value);
    }
    return value;
  }

  // Handle ZodUnion - try each type
  if (zodType instanceof z.ZodUnion) {
    for (const option of zodType._def.options as z.ZodType[]) {
      try {
        const coerced = coerceValue(value, option);
        // Quick validation to see if this coercion works
        option.parse(coerced);
        return coerced;
      } catch {
        // Continue to next union option
      }
    }
  }

  // Return original value if no coercion is needed/possible
  return value;
}
