// @ts-check

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: [
    '**/src/__tests__/e2e/tools/**/*.e2e.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/e2e/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|@modelcontextprotocol)/)',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.json'
    }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  extensionsToTreatAsEsm: ['.ts'],
  testTimeout: 60000, // 60 seconds for comprehensive E2E tests
  verbose: true,
  maxConcurrency: 1, // Run tests sequentially to avoid conflicts
  bail: false, // Continue running tests even if some fail
  collectCoverage: false, // Disable coverage for E2E tests
  
  // Environment variables for testing
  setupFiles: ['<rootDir>/jest.e2e.tools.setup.mjs'],
  
  // Test reporting
  reporters: ['default'],

  // Global test configuration
  globals: {
    'ts-jest': {
      useESM: true
    }
  },

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Test name pattern for filtering
  testNamePattern: process.env.TEST_NAME_PATTERN
};

export default config;
