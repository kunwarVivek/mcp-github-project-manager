// Setup file for E2E tools tests
// This file runs before all tests and sets up the environment

// Load environment variables from .env files
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.test' });

// Set default environment variables for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// GitHub API configuration
if (!process.env.GITHUB_TOKEN) {
  console.warn('⚠️  GITHUB_TOKEN not set - using test token (some tests may be skipped)');
  process.env.GITHUB_TOKEN = 'ghp_test_token_for_mocking';
}

if (!process.env.GITHUB_OWNER) {
  console.warn('⚠️  GITHUB_OWNER not set - using test owner');
  process.env.GITHUB_OWNER = 'test-owner';
}

if (!process.env.GITHUB_REPO) {
  console.warn('⚠️  GITHUB_REPO not set - using test repo');
  process.env.GITHUB_REPO = 'test-repo';
}

// AI API configuration
const aiKeys = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY', 
  'GOOGLE_API_KEY',
  'PERPLEXITY_API_KEY'
];

let hasAnyAIKey = false;
aiKeys.forEach(key => {
  if (process.env[key]) {
    hasAnyAIKey = true;
  } else {
    // Set test values for missing AI keys
    process.env[key] = `test-${key.toLowerCase().replace('_', '-')}`;
  }
});

if (!hasAnyAIKey && process.env.E2E_REAL_API === 'true') {
  console.warn('⚠️  No AI API keys found - AI tool tests may be limited');
}

// AI model configuration
process.env.AI_MAIN_MODEL = process.env.AI_MAIN_MODEL || 'claude-3-5-sonnet-20241022';
process.env.AI_RESEARCH_MODEL = process.env.AI_RESEARCH_MODEL || 'perplexity-llama-3.1-sonar-large-128k-online';
process.env.AI_FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || 'gpt-4o';
process.env.AI_PRD_MODEL = process.env.AI_PRD_MODEL || 'claude-3-5-sonnet-20241022';

// Test configuration
process.env.CACHE_DIRECTORY = process.env.CACHE_DIRECTORY || './test-cache';
process.env.SYNC_ENABLED = process.env.SYNC_ENABLED || 'false';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
process.env.WEBHOOK_PORT = process.env.WEBHOOK_PORT || '3001';
process.env.SSE_ENABLED = process.env.SSE_ENABLED || 'false';

// Logging configuration
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'warn';

// Test mode configuration
if (process.env.E2E_REAL_API === 'true') {
  console.log('🔗 Running E2E tests with REAL API calls');
  console.log('📋 GitHub:', process.env.GITHUB_OWNER + '/' + process.env.GITHUB_REPO);
  console.log('🤖 AI Keys:', aiKeys.filter(key => process.env[key] && !process.env[key].startsWith('test-')).join(', ') || 'None (using test keys)');
} else {
  console.log('🧪 Running E2E tests with MOCKED API calls');
}

// Global test timeout is set in jest config

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Cleanup function for test resources
global.testCleanup = {
  resources: new Set(),
  
  addResource(type, id) {
    this.resources.add({ type, id });
  },
  
  async cleanup() {
    // This would be used to clean up test resources in real API tests
    if (process.env.E2E_REAL_API === 'true') {
      console.log('🧹 Cleaning up test resources...');
      // Implementation would depend on specific cleanup needs
    }
    this.resources.clear();
  }
};

// Global test utilities
global.testUtils = {
  // Generate unique test identifiers
  generateTestId: () => `e2e-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Wait for condition
  waitFor: async (condition, timeout = 10000, interval = 1000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  // Retry function with exponential backoff
  retry: async (fn, maxAttempts = 3, baseDelay = 1000) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
};

console.log('🚀 E2E Tools Test Environment Setup Complete');
console.log('📊 Test Configuration:');
console.log('  - Real API:', process.env.E2E_REAL_API === 'true' ? 'Yes' : 'No');
console.log('  - GitHub Token:', process.env.GITHUB_TOKEN ? 'Set' : 'Not Set');
console.log('  - AI Keys:', hasAnyAIKey ? 'Available' : 'Test Only');
console.log('  - Test Timeout:', '60 seconds');
console.log('  - Max Concurrency:', '1 (sequential)');
console.log('');
