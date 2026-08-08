import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true, // Enable describe, it, expect, etc. globally (Jest parity)
    environment: 'node',
    include: [
      'src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.spec.ts',
      'src/__tests__/**/*.e2e.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: [
      'node_modules',
      '**/build/**',
    ],
    setupFiles: [
      'reflect-metadata',
      'src/__tests__/e2e/setup.ts', // E2E setup for environment variables
    ],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/__tests__/**',
      ],
      reporter: ['text', 'lcov', 'clover'],
    },
    // Mock configuration
    clearMocks: true,
    restoreMocks: false,
    // Reporter
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
