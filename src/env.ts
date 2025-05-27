import { dirname, join, resolve } from 'path';
import { CliOptions, parseCommandLineArgs } from './cli';
import * as dotenv from 'dotenv';

// Parse command line arguments only if not in test environment
const cliOptions = process.env.NODE_ENV === 'test'
  ? { verbose: false, envFile: undefined, token: undefined, owner: undefined, repo: undefined }
  : parseCommandLineArgs();

// Load environment variables from .env file
const envPath = cliOptions.envFile
  ? resolve(process.cwd(), cliOptions.envFile)
  : join(process.cwd(), '.env');

dotenv.config({ path: envPath });

if (cliOptions.verbose) {
  console.error(`Loading environment from: ${envPath}`);
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

  // Then check environment variables
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Provide it via command line argument (--${name.toLowerCase()}) or environment variable.`);
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

  // Then check environment variables
  return process.env[name] || defaultValue;
}

/**
 * Get a boolean configuration value
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The boolean configuration value
 */
export function getBooleanConfigValue(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get a numeric configuration value
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The numeric configuration value
 */
export function getNumericConfigValue(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
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

// Sync configuration
export const SYNC_ENABLED = getBooleanConfigValue("SYNC_ENABLED", true);
export const SYNC_TIMEOUT_MS = getNumericConfigValue("SYNC_TIMEOUT_MS", 30000);
export const SYNC_INTERVAL_MS = getNumericConfigValue("SYNC_INTERVAL_MS", 0); // 0 = disabled
export const CACHE_DIRECTORY = getOptionalConfigValue("CACHE_DIRECTORY", ".mcp-cache");
export const SYNC_RESOURCES = getOptionalConfigValue("SYNC_RESOURCES", "PROJECT,MILESTONE,ISSUE,SPRINT").split(',');

// Event system configuration
export const WEBHOOK_SECRET = getOptionalConfigValue("WEBHOOK_SECRET", "");
export const WEBHOOK_PORT = getNumericConfigValue("WEBHOOK_PORT", 3001);
export const SSE_ENABLED = getBooleanConfigValue("SSE_ENABLED", true);
export const EVENT_RETENTION_DAYS = getNumericConfigValue("EVENT_RETENTION_DAYS", 7);
export const MAX_EVENTS_IN_MEMORY = getNumericConfigValue("MAX_EVENTS_IN_MEMORY", 1000);
export const WEBHOOK_TIMEOUT_MS = getNumericConfigValue("WEBHOOK_TIMEOUT_MS", 5000);

// Export CLI options for use in other modules
export const CLI_OPTIONS = cliOptions;