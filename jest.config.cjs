/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  resolver: '<rootDir>/jest.resolver.cjs',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // nanoid v5 is ESM-only and pulled in transitively by @ai-sdk providers;
    // map it to a CJS stub so Jest's CommonJS runtime can load AI-touching suites.
    '^nanoid$': '<rootDir>/src/__tests__/__mocks__/nanoid.cjs',
    '^nanoid/non-secure$': '<rootDir>/src/__tests__/__mocks__/nanoid.cjs',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'esnext',
          target: 'es2022',
          moduleResolution: 'node'
        },
        useESM: true,
      },
    ],
  },
  // reflect-metadata must load before tsyringe's module init in any suite that
  // imports the DI graph; a setupFile guarantees it regardless of dep load order.
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Never resolve modules from the compiled output; tests run against src/.ts.
  // Without this, build/*.js collides with src/*.ts in module resolution once a
  // build exists (e.g. ResourceCache resolves to the compiled module).
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
    '**/__tests__/**/*.e2e.ts',
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  verbose: true,
  testTimeout: 10000,
  maxWorkers: '50%',
  moduleDirectories: ['node_modules', 'src'],
  injectGlobals: true,
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};
