import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { CliOptions, parseCommandLineArgs } from './cli.js';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const cliOptions = parseCommandLineArgs();

// Load environment variables from .env file
const envPath = cliOptions.envFile
  ? resolve(process.cwd(), cliOptions.envFile)
  : join(dirname(__dirname), '.env');

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

// Export configuration values with CLI arguments taking precedence over environment variables
export const GITHUB_TOKEN = getConfigValue("GITHUB_TOKEN", cliOptions.token);
export const GITHUB_OWNER = getConfigValue("GITHUB_OWNER", cliOptions.owner);
export const GITHUB_REPO = getConfigValue("GITHUB_REPO", cliOptions.repo);

// Export CLI options for use in other modules
export const CLI_OPTIONS = cliOptions;