// @ts-check

/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/e2e/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit)/)',
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
  testTimeout: 30000,
  verbose: true,
  maxConcurrency: 1,
};

export default config;