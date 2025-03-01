import { config } from 'dotenv';
import { jest } from '@jest/globals';

// Load environment variables from .env file
config();

// Verify required environment variables are present
const requiredEnvVars = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    throw new Error(
      `Missing required environment variable: ${varName}\n` +
      'Please create a .env file with the required variables or set them in your environment.'
    );
  }
});

// Configure longer timeout for E2E tests
jest.setTimeout(30000);