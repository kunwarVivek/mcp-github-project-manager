import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(dirname(__dirname), '.env');

dotenv.config({ path: envPath });

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const GITHUB_TOKEN = getRequiredEnvVar("GITHUB_TOKEN");
export const GITHUB_OWNER = getRequiredEnvVar("GITHUB_OWNER");
export const GITHUB_REPO = getRequiredEnvVar("GITHUB_REPO");