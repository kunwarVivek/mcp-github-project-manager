import { join, resolve } from 'node:path';
import { parseCommandLineArgs } from './cli';
import * as dotenv from 'dotenv';
import { createDefaultSecretResolver } from './infrastructure/secrets/SecretProvider';
import { validateConfig, validateConfigWarnings } from './domain/config-schema';

// Parse command line arguments only if not in test environment
const cliOptions = process.env.NODE_ENV === 'test'
  ? { verbose: false, envFile: undefined, token: undefined, owner: undefined, repo: undefined }
  : parseCommandLineArgs();

// Load environment variables from .env file
const envPath = cliOptions.envFile
  ? resolve(process.cwd(), cliOptions.envFile)
  : join(process.cwd(), '.env');

// `quiet` is mandatory, not cosmetic: dotenv v17 prints an "injected env"
// banner to STDOUT, which corrupts the JSON-RPC stream this server speaks over
// stdio and drops the MCP client before the first response.
dotenv.config({ path: envPath, quiet: true });

if (cliOptions.verbose) {
  process.stderr.write(`Loading environment from: ${envPath}\n`);
}

// Secret resolution layers file-mounted secrets (SECRETS_DIR, e.g. Docker/k8s
// /run/secrets) ahead of environment variables. Created after dotenv so a
// SECRETS_DIR set in .env is honored. See infrastructure/secrets/SecretProvider.
const secretResolver = createDefaultSecretResolver();

/**
 * Configuration keys that participate in secret resolution (CLI flag →
 * SECRETS_DIR file → environment variable).
 */
const RESOLVED_CONFIG_KEYS = [
  'GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO',
  'GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_INSTALLATION_ID',
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'PERPLEXITY_API_KEY',
  'WEBHOOK_SECRET',
] as const;

/**
 * Snapshot of configuration as the server will actually see it.
 *
 * Startup validation has to run against *resolved* values. Validating raw
 * `process.env` meant a token mounted only at `$SECRETS_DIR/GITHUB_TOKEN` failed
 * the required-field check and the process exited before the file provider was
 * ever consulted — making SECRETS_DIR unusable for the very values it exists for.
 */
function buildResolvedEnv(): Record<string, string | undefined> {
  const resolved: Record<string, string | undefined> = { ...process.env };
  for (const key of RESOLVED_CONFIG_KEYS) {
    const value = secretResolver.resolve(key);
    if (value !== undefined) {
      resolved[key] = value;
    }
  }
  // CLI flags outrank both file-mounted secrets and environment variables.
  if (cliOptions.token) resolved.GITHUB_TOKEN = cliOptions.token;
  if (cliOptions.owner) resolved.GITHUB_OWNER = cliOptions.owner;
  if (cliOptions.repo) resolved.GITHUB_REPO = cliOptions.repo;
  return resolved;
}

// Validate configuration at startup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  const resolvedEnv = buildResolvedEnv();
  try {
    validateConfig(resolvedEnv);
  } catch (error) {
    process.stderr.write(`[CONFIG] ${(error as Error).message}\n`);
    process.exit(1);
  }
  for (const w of validateConfigWarnings(resolvedEnv)) {
    process.stderr.write(`[CONFIG WARNING] ${w}\n`);
  }
}

/**
 * Resolve a secret/config value fresh from the secret chain (file → env).
 * Reading at call time (rather than a frozen startup const) lets callers observe
 * rotated secrets when the mounted file changes.
 */
export function getSecret(name: string): string | undefined {
  return secretResolver.resolve(name);
}

/**
 * Get a required configuration value from command line args or environment variables
 * @param name Environment variable name
 * @param cliValue Optional CLI argument value
 * @returns The configuration value
 * @throws Error if the value is not found
 */
export function getConfigValue(name: string, cliValue?: string): string {
  // First check CLI arguments
  if (cliValue) {
    return cliValue;
  }

  // Then check the secret chain (file-mounted secrets, then environment vars)
  const value = secretResolver.resolve(name);
  if (!value) {
    throw new Error(`${name} is required. Provide it via command line argument (--${name.toLowerCase()}), environment variable, or a mounted secret (SECRETS_DIR).`);
  }
  return value;
}

/**
 * Get an optional configuration value with a default
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @param cliValue Optional CLI argument value
 * @returns The configuration value or default
 */
export function getOptionalConfigValue(name: string, defaultValue: string, cliValue?: string): string {
  // First check CLI arguments
  if (cliValue) {
    return cliValue;
  }

  // Then check the secret chain (file-mounted secrets, then environment vars)
  return secretResolver.resolve(name) || defaultValue;
}

/**
 * Get a boolean configuration value
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The boolean configuration value
 */
export function getBooleanConfigValue(name: string, defaultValue: boolean): boolean {
  // Resolve through the secret chain so SECRETS_DIR works for flags too, not
  // only for string values.
  const value = secretResolver.resolve(name);
  if (!value) {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

/**
 * Get a numeric configuration value
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The numeric configuration value
 */
export function getNumericConfigValue(name: string, defaultValue: number): number {
  // Resolve through the secret chain (see getBooleanConfigValue).
  const value = secretResolver.resolve(name);
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

// Export configuration values with CLI arguments taking precedence over environment variables
export const GITHUB_TOKEN = process.env.NODE_ENV === 'test'
  ? 'test-token'
  : getConfigValue("GITHUB_TOKEN", cliOptions.token);
export const GITHUB_OWNER = process.env.NODE_ENV === 'test'
  ? 'test-owner'
  : getConfigValue("GITHUB_OWNER", cliOptions.owner);
export const GITHUB_REPO = process.env.NODE_ENV === 'test'
  ? 'test-repo'
  : getConfigValue("GITHUB_REPO", cliOptions.repo);

// GitHub App installation auth (optional). When all three are present the
// server authenticates as the App installation instead of using a PAT.
// A PAT remains the default and documented path.
export const GITHUB_APP_ID = getOptionalConfigValue("GITHUB_APP_ID", "");
export const GITHUB_APP_PRIVATE_KEY = getOptionalConfigValue("GITHUB_APP_PRIVATE_KEY", "");
export const GITHUB_APP_INSTALLATION_ID = getOptionalConfigValue("GITHUB_APP_INSTALLATION_ID", "");

/**
 * GitHub App credentials, or undefined when the App is not fully configured.
 * All three values are required — a partial configuration falls back to the PAT
 * rather than failing, so a half-set env cannot lock the server out.
 */
export function getGitHubAppCredentials():
  | { appId: string; privateKey: string; installationId: string }
  | undefined {
  const appId = getOptionalConfigValue("GITHUB_APP_ID", "");
  const privateKey = getOptionalConfigValue("GITHUB_APP_PRIVATE_KEY", "");
  const installationId = getOptionalConfigValue("GITHUB_APP_INSTALLATION_ID", "");
  if (!appId || !privateKey || !installationId) {
    return undefined;
  }
  // Private keys are commonly supplied with literal \n escapes in env vars.
  return { appId, privateKey: privateKey.replace(/\\n/g, "\n"), installationId };
}

// Sync configuration
export const SYNC_ENABLED = getBooleanConfigValue("SYNC_ENABLED", true);
export const SYNC_TIMEOUT_MS = getNumericConfigValue("SYNC_TIMEOUT_MS", 30000);
export const SYNC_INTERVAL_MS = getNumericConfigValue("SYNC_INTERVAL_MS", 0); // 0 = disabled
export const CACHE_DIRECTORY = getOptionalConfigValue("CACHE_DIRECTORY", ".mcp-cache");
export const SYNC_RESOURCES = getOptionalConfigValue("SYNC_RESOURCES", "PROJECT,MILESTONE,ISSUE,SPRINT").split(',');

// Agent orchestration — auto-reclaim scheduler
// The scheduler is a server-side background sweep that detects agents whose
// heartbeat has gone stale (crashed/disconnected harnesses) and reclaims their
// tasks back to the unclaimed pool, then flags the agent offline. This is what
// makes the swarm self-healing: one crash no longer blocks a task forever.
//
// Note: the sweep never bootstraps the registry — it probes with
// AgentStore.registryExists() and returns early when no registry issue exists,
// so a repo that never opted into the agent layer is not mutated. Disable
// entirely with AGENT_RECLAIM_ENABLED=false or AGENT_RECLAIM_INTERVAL_MS=0.
export const AGENT_RECLAIM_ENABLED = getBooleanConfigValue("AGENT_RECLAIM_ENABLED", true);
export const AGENT_RECLAIM_INTERVAL_MS = getNumericConfigValue("AGENT_RECLAIM_INTERVAL_MS", 300000); // 5 min; 0 = disabled
export const AGENT_STALE_AFTER_MINUTES = getNumericConfigValue("AGENT_STALE_AFTER_MINUTES", 30);

// Event system configuration
export const WEBHOOK_SECRET = getOptionalConfigValue("WEBHOOK_SECRET", "");
// Security: webhook signature validation fails closed by default. When no
// WEBHOOK_SECRET is set, incoming webhooks are rejected. Set this to true ONLY
// in trusted local/dev environments to accept unsigned webhooks.
export const WEBHOOK_ALLOW_UNSIGNED = getBooleanConfigValue("WEBHOOK_ALLOW_UNSIGNED", false);
export const WEBHOOK_PORT = getNumericConfigValue("WEBHOOK_PORT", 3001);
export const SSE_ENABLED = getBooleanConfigValue("SSE_ENABLED", true);
export const EVENT_RETENTION_DAYS = getNumericConfigValue("EVENT_RETENTION_DAYS", 7);
export const MAX_EVENTS_IN_MEMORY = getNumericConfigValue("MAX_EVENTS_IN_MEMORY", 1000);
export const WEBHOOK_TIMEOUT_MS = getNumericConfigValue("WEBHOOK_TIMEOUT_MS", 5000);

// AI Provider configuration
export const ANTHROPIC_API_KEY = getOptionalConfigValue("ANTHROPIC_API_KEY", "");
export const OPENAI_API_KEY = getOptionalConfigValue("OPENAI_API_KEY", "");
export const GOOGLE_API_KEY = getOptionalConfigValue("GOOGLE_API_KEY", "");
export const PERPLEXITY_API_KEY = getOptionalConfigValue("PERPLEXITY_API_KEY", "");

// AI Model configuration
export const AI_MAIN_MODEL = getOptionalConfigValue("AI_MAIN_MODEL", "claude-opus-5");
export const AI_RESEARCH_MODEL = getOptionalConfigValue("AI_RESEARCH_MODEL", "sonar-pro");
export const AI_FALLBACK_MODEL = getOptionalConfigValue("AI_FALLBACK_MODEL", "claude-sonnet-5");
export const AI_PRD_MODEL = getOptionalConfigValue("AI_PRD_MODEL", "claude-opus-5");

// AI Task Generation configuration
export const MAX_TASKS_PER_PRD = getNumericConfigValue("MAX_TASKS_PER_PRD", 50);
export const DEFAULT_COMPLEXITY_THRESHOLD = getNumericConfigValue("DEFAULT_COMPLEXITY_THRESHOLD", 7);
export const MAX_SUBTASK_DEPTH = getNumericConfigValue("MAX_SUBTASK_DEPTH", 3);
export const AUTO_DEPENDENCY_DETECTION = getBooleanConfigValue("AUTO_DEPENDENCY_DETECTION", true);
export const AUTO_EFFORT_ESTIMATION = getBooleanConfigValue("AUTO_EFFORT_ESTIMATION", true);

// Enhanced Task Generation configuration
export const ENHANCED_TASK_GENERATION = getBooleanConfigValue("ENHANCED_TASK_GENERATION", true);
export const AUTO_CREATE_TRACEABILITY = getBooleanConfigValue("AUTO_CREATE_TRACEABILITY", true);
export const AUTO_GENERATE_USE_CASES = getBooleanConfigValue("AUTO_GENERATE_USE_CASES", true);
export const AUTO_CREATE_LIFECYCLE = getBooleanConfigValue("AUTO_CREATE_LIFECYCLE", true);
export const ENHANCED_CONTEXT_LEVEL = getOptionalConfigValue("ENHANCED_CONTEXT_LEVEL", "standard"); // minimal, standard, full
export const INCLUDE_BUSINESS_CONTEXT = getBooleanConfigValue("INCLUDE_BUSINESS_CONTEXT", false); // Default: traceability only
export const INCLUDE_TECHNICAL_CONTEXT = getBooleanConfigValue("INCLUDE_TECHNICAL_CONTEXT", false); // Default: traceability only
export const INCLUDE_IMPLEMENTATION_GUIDANCE = getBooleanConfigValue("INCLUDE_IMPLEMENTATION_GUIDANCE", false); // Default: traceability only

// GitHub AI Integration
export const AUTO_CREATE_PROJECT_FIELDS = getBooleanConfigValue("AUTO_CREATE_PROJECT_FIELDS", true);
export const AI_BATCH_SIZE = getNumericConfigValue("AI_BATCH_SIZE", 10);

// Export CLI options for use in other modules

// Logging configuration
export const LOG_FORMAT = getOptionalConfigValue('LOG_FORMAT', 'text'); // 'text' | 'json'
export const LOG_LEVEL = getOptionalConfigValue('LOG_LEVEL', 'info'); // debug, info, warn, error
export const CLI_OPTIONS = cliOptions;

// MCP tool exposure configuration
// Controls which compound tool groups are exposed to MCP clients.
// Values: 'all' (default) or comma-separated list of: core, ai, agents, events, system
export const MCP_TOOL_GROUPS = getOptionalConfigValue('MCP_TOOL_GROUPS', 'all');