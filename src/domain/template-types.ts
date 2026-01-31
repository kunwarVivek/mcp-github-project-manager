import { z } from 'zod';

// ============================================================================
// Template Types for PRD and Task Generation
// ============================================================================

/**
 * Template format detection
 */
export type TemplateFormat = 'markdown' | 'json-schema' | 'example-based';

/**
 * Template section definition
 */
export interface TemplateSection {
  id: string;
  name: string;
  description: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string;
}

/**
 * Parsed template structure
 */
export interface ParsedTemplate {
  format: TemplateFormat;
  name: string;
  description?: string;
  sections: TemplateSection[];
  placeholders: string[];
  rawContent: string;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  placeholders: string[];
  missingSections: string[];
}

/**
 * Template source location
 */
export type TemplateSource =
  | { type: 'project'; path: string }
  | { type: 'org'; repo: string; path: string }
  | { type: 'url'; url: string }
  | { type: 'inline'; content: string };

/**
 * Template storage configuration
 */
export interface TemplateConfig {
  source: TemplateSource;
  name: string;
  version?: string;
  inheritsFrom?: string;  // Template ID to inherit from
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const TemplateFormatSchema = z.enum(['markdown', 'json-schema', 'example-based']);

export const TemplateSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  required: z.boolean(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional()
});

export const ParsedTemplateSchema = z.object({
  format: TemplateFormatSchema,
  name: z.string(),
  description: z.string().optional(),
  sections: z.array(TemplateSectionSchema),
  placeholders: z.array(z.string()),
  rawContent: z.string()
});

export const TemplateValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  placeholders: z.array(z.string()),
  missingSections: z.array(z.string())
});

export const TemplateSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('project'), path: z.string() }),
  z.object({ type: z.literal('org'), repo: z.string(), path: z.string() }),
  z.object({ type: z.literal('url'), url: z.string() }),
  z.object({ type: z.literal('inline'), content: z.string() })
]);

export const TemplateConfigSchema = z.object({
  source: TemplateSourceSchema,
  name: z.string(),
  version: z.string().optional(),
  inheritsFrom: z.string().optional()
});
