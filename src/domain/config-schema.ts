import { z } from "zod";

/** Validates a non-empty string (trims whitespace). */
const nonEmptyString = z.string().min(1, "must not be empty");

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
      if (typeof value === "boolean") return value;
      const normalized = value.trim().toLowerCase();
      if (normalized === "") return defaultValue;
      return normalized === "true" || normalized === "1";
    });

/**
 * GitHub configuration. The token is optional here because a complete GitHub
 * App configuration is an alternative credential; `ServerConfigSchema` enforces
 * "token OR complete App credentials".
 */
export const GitHubConfigSchema = z.object({
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: nonEmptyString,
  GITHUB_REPO: nonEmptyString,
});

/** AI provider keys — all optional; absence produces a warning, not a failure. */
export const AIConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().default(""),
  OPENAI_API_KEY: z.string().default(""),
  GOOGLE_API_KEY: z.string().default(""),
  PERPLEXITY_API_KEY: z.string().default(""),
});

/** GitHub App installation auth — optional; a partial config falls back to the PAT. */
export const GitHubAppConfigSchema = z.object({
  GITHUB_APP_ID: z.string().default(""),
  GITHUB_APP_PRIVATE_KEY: z.string().default(""),
  GITHUB_APP_INSTALLATION_ID: z.string().default(""),
});

/** Sync/cache configuration. */
export const SyncConfigSchema = z.object({
  SYNC_ENABLED: booleanFlag(true),
  SYNC_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SYNC_INTERVAL_MS: z.coerce.number().int().nonnegative().default(0),
  SYNC_RESOURCES: z.string().default("PROJECT,MILESTONE,ISSUE,SPRINT"),
  CACHE_DIRECTORY: z.string().default(".mcp-cache"),
  // Consumed by infrastructure/cache/ResourceCache (read from process.env there).
  MAX_CACHE_ENTRIES: z.coerce.number().int().positive().default(10000),
  EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  MAX_EVENTS_IN_MEMORY: z.coerce.number().int().positive().default(1000),
});

/** Webhook / events HTTP server configuration. */
export const WebhookConfigSchema = z.object({
  WEBHOOK_SECRET: z.string().default(""),
  WEBHOOK_ALLOW_UNSIGNED: booleanFlag(false),
  WEBHOOK_HOST: z.string().min(1).default("127.0.0.1"),
  WEBHOOK_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  WEBHOOK_ALLOWED_ORIGINS: z.string().default(""),
  WEBHOOK_RATE_LIMIT: z.coerce.number().int().positive().default(100),
  WEBHOOK_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  WEBHOOK_TRUSTED_PROXIES: z.string().default(""),
  SSE_ENABLED: booleanFlag(true),
  EVENTS_ALLOW_UNAUTHENTICATED: booleanFlag(false),
  EVENTS_AUTH_TOKEN: z.string().default(""),
});

/** Agent orchestration (auto-reclaim scheduler). */
export const AgentConfigSchema = z.object({
  AGENT_RECLAIM_ENABLED: booleanFlag(true),
  AGENT_RECLAIM_INTERVAL_MS: z.coerce.number().int().nonnegative().default(300000),
  AGENT_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
});

/** Logging configuration. Unknown values fall back at runtime (see logger parseLevel/parseFormat). */
export const LoggingConfigSchema = z.object({
  LOG_FORMAT: z.string().default("text"),
  LOG_LEVEL: z.string().default("info"),
});

/** Mutation audit log, OpenTelemetry export and GraphQL rate-limit floor. */
export const ObservabilityConfigSchema = z.object({
  AUDIT_LOG_ENABLED: booleanFlag(false),
  AUDIT_LOG_PATH: z.string().min(1).default(".mcp-audit/mutations.jsonl"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(""),
  OTEL_SERVICE_NAME: z.string().min(1).default("mcp-github-project-manager"),
  RATE_LIMIT_FLOOR: z.coerce.number().int().nonnegative().default(100),
});

/** AI model configuration. */
export const AIModelConfigSchema = z.object({
  AI_MAIN_MODEL: z.string().default(""),
  AI_RESEARCH_MODEL: z.string().default(""),
  AI_FALLBACK_MODEL: z.string().default(""),
  AI_PRD_MODEL: z.string().default(""),
  // Per-role provider overrides
  AI_MAIN_PROVIDER: z.string().default(""),
  AI_MAIN_API_KEY: z.string().default(""),
  AI_MAIN_BASE_URL: z.string().default(""),
  AI_RESEARCH_PROVIDER: z.string().default(""),
  AI_RESEARCH_API_KEY: z.string().default(""),
  AI_RESEARCH_BASE_URL: z.string().default(""),
  AI_FALLBACK_PROVIDER: z.string().default(""),
  AI_FALLBACK_API_KEY: z.string().default(""),
  AI_FALLBACK_BASE_URL: z.string().default(""),
  AI_PRD_PROVIDER: z.string().default(""),
  AI_PRD_API_KEY: z.string().default(""),
  AI_PRD_BASE_URL: z.string().default(""),
});

/** Numeric bounds for AI task generation. */
export const AITaskConfigSchema = z.object({
  MAX_TASKS_PER_PRD: z.coerce.number().int().min(1).max(200).default(50),
  DEFAULT_COMPLEXITY_THRESHOLD: z.coerce.number().int().min(1).max(10).default(7),
  MAX_SUBTASK_DEPTH: z.coerce.number().int().min(1).max(10).default(3),
  AI_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  AI_SESSION_TOKEN_LIMIT: z.coerce.number().int().min(0).default(0),
});

/** Full server configuration schema. */
export const ServerConfigSchema = z
  .object({
    github: GitHubConfigSchema,
    githubApp: GitHubAppConfigSchema.optional(),
    ai: AIConfigSchema.optional(),
    sync: SyncConfigSchema.optional(),
    webhook: WebhookConfigSchema.optional(),
    agent: AgentConfigSchema.optional(),
    logging: LoggingConfigSchema.optional(),
    observability: ObservabilityConfigSchema.optional(),
    aiModels: AIModelConfigSchema.optional(),
    aiTasks: AITaskConfigSchema.optional(),
  })
  .superRefine((config, ctx) => {
    const app = config.githubApp;
    const appComplete = Boolean(
      app?.GITHUB_APP_ID && app.GITHUB_APP_PRIVATE_KEY && app.GITHUB_APP_INSTALLATION_ID
    );
    if (!config.github.GITHUB_TOKEN && !appComplete) {
      ctx.addIssue({
        code: "custom",
        path: ["github", "GITHUB_TOKEN"],
        message:
          "GITHUB_TOKEN is required unless GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY and GITHUB_APP_INSTALLATION_ID are all set",
      });
    }
  });

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

/**
 * Validate configuration at startup. Returns validated config or throws
 * with a human-readable error listing all validation failures.
 */
export function validateConfig(rawEnv: Record<string, string | undefined>): ServerConfig {
  // `FOO=` in a .env file yields "" — treated as unset, matching env.ts getters
  // (which fall back to the default on empty values) so numeric fields don't fail on "".
  const env: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(rawEnv)) {
    if (value !== undefined && value.trim() !== "") env[key] = value;
  }
  const result = ServerConfigSchema.safeParse({
    github: {
      GITHUB_TOKEN: env.GITHUB_TOKEN,
      GITHUB_OWNER: env.GITHUB_OWNER,
      GITHUB_REPO: env.GITHUB_REPO,
    },
    ai: {
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ?? "",
      OPENAI_API_KEY: env.OPENAI_API_KEY ?? "",
      GOOGLE_API_KEY: env.GOOGLE_API_KEY ?? "",
      PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY ?? "",
    },
    githubApp: {
      GITHUB_APP_ID: env.GITHUB_APP_ID,
      GITHUB_APP_PRIVATE_KEY: env.GITHUB_APP_PRIVATE_KEY,
      GITHUB_APP_INSTALLATION_ID: env.GITHUB_APP_INSTALLATION_ID,
    },
    sync: {
      SYNC_ENABLED: env.SYNC_ENABLED,
      SYNC_TIMEOUT_MS: env.SYNC_TIMEOUT_MS,
      SYNC_INTERVAL_MS: env.SYNC_INTERVAL_MS,
      SYNC_RESOURCES: env.SYNC_RESOURCES,
      CACHE_DIRECTORY: env.CACHE_DIRECTORY,
      MAX_CACHE_ENTRIES: env.MAX_CACHE_ENTRIES,
      EVENT_RETENTION_DAYS: env.EVENT_RETENTION_DAYS,
      MAX_EVENTS_IN_MEMORY: env.MAX_EVENTS_IN_MEMORY,
    },
    webhook: {
      WEBHOOK_SECRET: env.WEBHOOK_SECRET,
      WEBHOOK_ALLOW_UNSIGNED: env.WEBHOOK_ALLOW_UNSIGNED,
      WEBHOOK_HOST: env.WEBHOOK_HOST,
      WEBHOOK_PORT: env.WEBHOOK_PORT,
      WEBHOOK_TIMEOUT_MS: env.WEBHOOK_TIMEOUT_MS,
      WEBHOOK_ALLOWED_ORIGINS: env.WEBHOOK_ALLOWED_ORIGINS,
      WEBHOOK_RATE_LIMIT: env.WEBHOOK_RATE_LIMIT,
      WEBHOOK_RATE_WINDOW_MS: env.WEBHOOK_RATE_WINDOW_MS,
      WEBHOOK_TRUSTED_PROXIES: env.WEBHOOK_TRUSTED_PROXIES,
      SSE_ENABLED: env.SSE_ENABLED,
      EVENTS_ALLOW_UNAUTHENTICATED: env.EVENTS_ALLOW_UNAUTHENTICATED,
      EVENTS_AUTH_TOKEN: env.EVENTS_AUTH_TOKEN,
    },
    agent: {
      AGENT_RECLAIM_ENABLED: env.AGENT_RECLAIM_ENABLED,
      AGENT_RECLAIM_INTERVAL_MS: env.AGENT_RECLAIM_INTERVAL_MS,
      AGENT_STALE_AFTER_MINUTES: env.AGENT_STALE_AFTER_MINUTES,
    },
    logging: {
      LOG_FORMAT: env.LOG_FORMAT,
      LOG_LEVEL: env.LOG_LEVEL,
    },
    observability: {
      AUDIT_LOG_ENABLED: env.AUDIT_LOG_ENABLED,
      AUDIT_LOG_PATH: env.AUDIT_LOG_PATH,
      OTEL_EXPORTER_OTLP_ENDPOINT: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      OTEL_SERVICE_NAME: env.OTEL_SERVICE_NAME,
      RATE_LIMIT_FLOOR: env.RATE_LIMIT_FLOOR,
    },
    aiModels: {
      AI_MAIN_MODEL: env.AI_MAIN_MODEL,
      AI_RESEARCH_MODEL: env.AI_RESEARCH_MODEL,
      AI_FALLBACK_MODEL: env.AI_FALLBACK_MODEL,
      AI_PRD_MODEL: env.AI_PRD_MODEL,
      AI_MAIN_PROVIDER: env.AI_MAIN_PROVIDER,
      AI_MAIN_API_KEY: env.AI_MAIN_API_KEY,
      AI_MAIN_BASE_URL: env.AI_MAIN_BASE_URL,
      AI_RESEARCH_PROVIDER: env.AI_RESEARCH_PROVIDER,
      AI_RESEARCH_API_KEY: env.AI_RESEARCH_API_KEY,
      AI_RESEARCH_BASE_URL: env.AI_RESEARCH_BASE_URL,
      AI_FALLBACK_PROVIDER: env.AI_FALLBACK_PROVIDER,
      AI_FALLBACK_API_KEY: env.AI_FALLBACK_API_KEY,
      AI_FALLBACK_BASE_URL: env.AI_FALLBACK_BASE_URL,
      AI_PRD_PROVIDER: env.AI_PRD_PROVIDER,
      AI_PRD_API_KEY: env.AI_PRD_API_KEY,
      AI_PRD_BASE_URL: env.AI_PRD_BASE_URL,
    },
    aiTasks: {
      MAX_TASKS_PER_PRD: env.MAX_TASKS_PER_PRD,
      DEFAULT_COMPLEXITY_THRESHOLD: env.DEFAULT_COMPLEXITY_THRESHOLD,
      MAX_SUBTASK_DEPTH: env.MAX_SUBTASK_DEPTH,
      AI_BATCH_SIZE: env.AI_BATCH_SIZE,
      AI_SESSION_TOKEN_LIMIT: env.AI_SESSION_TOKEN_LIMIT,
    },
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
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
  const globalKeys = [
    env.ANTHROPIC_API_KEY,
    env.OPENAI_API_KEY,
    env.GOOGLE_API_KEY,
    env.PERPLEXITY_API_KEY,
  ];
  const perRoleKeys = [
    env.AI_MAIN_API_KEY,
    env.AI_RESEARCH_API_KEY,
    env.AI_FALLBACK_API_KEY,
    env.AI_PRD_API_KEY,
  ];
  const allKeys = [...globalKeys, ...perRoleKeys];
  if (!allKeys.some((k) => k && k.length > 0)) {
    warnings.push(
      "No AI provider API key configured — AI features will be unavailable. Set a global key (e.g. ANTHROPIC_API_KEY) or per-role keys (e.g. AI_MAIN_API_KEY)."
    );
  }
  return warnings;
}
