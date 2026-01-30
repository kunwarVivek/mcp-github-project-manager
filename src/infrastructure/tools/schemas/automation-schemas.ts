import { z } from "zod";

// ===== Automation Rule Schemas =====
// Note: These complement the schemas in project-schemas.ts with additional
// output types for toggle and delete operations

export const AutomationTriggerSchema = z.object({
  type: z.string(),
  resourceType: z.string().optional(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
});

export const AutomationActionSchema = z.object({
  type: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const AutomationRuleToggleOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  message: z.string(),
});

export const AutomationRuleDeleteOutputSchema = z.object({
  deleted: z.boolean(),
  id: z.string(),
  name: z.string(),
});

// Re-export main automation schemas from project-schemas for convenience
export {
  AutomationRuleOutputSchema,
  AutomationRuleListOutputSchema,
} from "./project-schemas.js";
