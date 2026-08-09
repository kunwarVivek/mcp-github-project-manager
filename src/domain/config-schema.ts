import { z } from 'zod';

/** Validates a non-empty string (trims whitespace). */
const nonEmptyString = z.string().min(1, 'must not be empty');

/**
 * Parse a boolean-valued environment variable.
 *
 * Zod's coercing boolean applies JS truthiness, so the *string* "false" becomes
 * `true` — a fail-open default for flags like WEBHOOK_ALLOW_UNSIGNED. This
 * matches the runtime getter in `env.ts`: only "true"/"1" are true.
 */
const booleanFlag = (defaultValue: boolean) =>
  z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) return defaultValue;
      if (typeof value === 'boolean') return value;
      const normalized = value.trim().toLowerCase();
      if (normalized === '') return defaultValue;
      return normalized === 'true' || normalized === '1';
    });

/** GitHub configuration — required for all operations. */
export const GitHubConfigSchema = z.object({
  GITHUB_TOKEN: nonEmptyString,
  GITHUB_OWNER: nonEmptyString,
  GITHUB_REPO: nonEmptyString,
});

/** AI provider keys — all optional; absence produces a warning, not a failure. */
export const AIConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  GOOGLE_API_KEY: z.string().default(''),
  PERPLEXITY_API_KEY: z.string().default(''),
});

/** Sync/cache configuration. */
export const SyncConfigSchema = z.object({
  SYNC_ENABLED: booleanFlag(true),
  SYNC_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SYNC_INTERVAL_MS: z.coerce.number().int().nonnegative().default(0),
  CACHE_DIRECTORY: z.string().default('.mcp-cache'),
  MAX_CACHE_ENTRIES: z.coerce.number().int().positive().default(10000),
});

/** Webhook configuration. */
export const WebhookConfigSchema = z.object({
  WEBHOOK_SECRET: z.string().default(''),
  WEBHOOK_ALLOW_UNSIGNED: booleanFlag(false),
  WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
});

/** AI model configuration. */
export const AIModelConfigSchema = z.object({
  AI_MAIN_MODEL: z.string().default('claude-opus-5'),
  AI_RESEARCH_MODEL: z.string().default('sonar-pro'),
  AI_FALLBACK_MODEL: z.string().default('claude-sonnet-5'),
  AI_PRD_MODEL: z.string().default('claude-opus-5'),
});

/** Numeric bounds for AI task generation. */
export const AITaskConfigSchema = z.object({
  MAX_TASKS_PER_PRD: z.coerce.number().int().min(1).max(200).default(50),
  DEFAULT_COMPLEXITY_THRESHOLD: z.coerce.number().int().min(1).max(10).default(7),
  MAX_SUBTASK_DEPTH: z.coerce.number().int().min(1).max(10).default(3),
  AI_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
});

/** Full server configuration schema. */
export const ServerConfigSchema = z.object({
  github: GitHubConfigSchema,
  ai: AIConfigSchema.optional(),
  sync: SyncConfigSchema.optional(),
  webhook: WebhookConfigSchema.optional(),
  aiModels: AIModelConfigSchema.optional(),
  aiTasks: AITaskConfigSchema.optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Validate configuration at startup. Returns validated config or throws
 * with a human-readable error listing all validation failures.
 */
export function validateConfig(env: Record<string, string | undefined>): ServerConfig {
  const result = ServerConfigSchema.safeParse({
    github: {
      GITHUB_TOKEN: env.GITHUB_TOKEN,
      GITHUB_OWNER: env.GITHUB_OWNER,
      GITHUB_REPO: env.GITHUB_REPO,
    },
    ai: {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ?? '',
      OPENAI_API_KEY: env.OPENAI_API_KEY ?? '',
      GOOGLE_API_KEY: env.GOOGLE_API_KEY ?? '',
      PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY ?? '',
    },
    sync: {
      SYNC_ENABLED: env.SYNC_ENABLED,
      SYNC_TIMEOUT_MS: env.SYNC_TIMEOUT_MS,
      SYNC_INTERVAL_MS: env.SYNC_INTERVAL_MS,
      CACHE_DIRECTORY: env.CACHE_DIRECTORY,
      MAX_CACHE_ENTRIES: env.MAX_CACHE_ENTRIES,
    },
    webhook: {
      WEBHOOK_SECRET: env.WEBHOOK_SECRET,
      WEBHOOK_ALLOW_UNSIGNED: env.WEBHOOK_ALLOW_UNSIGNED,
      WEBHOOK_PORT: env.WEBHOOK_PORT,
      WEBHOOK_TIMEOUT_MS: env.WEBHOOK_TIMEOUT_MS,
    },
    aiModels: {
      AI_MAIN_MODEL: env.AI_MAIN_MODEL,
      AI_RESEARCH_MODEL: env.AI_RESEARCH_MODEL,
      AI_FALLBACK_MODEL: env.AI_FALLBACK_MODEL,
      AI_PRD_MODEL: env.AI_PRD_MODEL,
    },
    aiTasks: {
      MAX_TASKS_PER_PRD: env.MAX_TASKS_PER_PRD,
      DEFAULT_COMPLEXITY_THRESHOLD: env.DEFAULT_COMPLEXITY_THRESHOLD,
      MAX_SUBTASK_DEPTH: env.MAX_SUBTASK_DEPTH,
      AI_BATCH_SIZE: env.AI_BATCH_SIZE,
    },
  });

  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuration validation failed:\n${issues}`);
  }

  return result.data;
}

/**
 * Warn-only validation (for AI config which is optional).
 * Returns list of warnings without throwing.
 */
export function validateConfigWarnings(env: Record<string, string | undefined>): string[] {
  const warnings: string[] = [];
  const aiKeys = [env.ANTHROPIC_API_KEY, env.OPENAI_API_KEY, env.GOOGLE_API_KEY, env.PERPLEXITY_API_KEY];
  if (!aiKeys.some(k => k && k.length > 0)) {
    warnings.push('No AI provider API key configured — AI features will be unavailable');
  }
  return warnings;
}
