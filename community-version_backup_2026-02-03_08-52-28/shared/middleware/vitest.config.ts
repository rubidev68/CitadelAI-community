import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__mocks__/**',
      'node_modules/**',
      'dist/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
        '**/coverage/**',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        // Temporarily lowered - index.ts files are just re-exports
        lines: 60,
        functions: 55,
        branches: 60,
        statements: 60,
      },
    },
    testTimeout: 10000,
  },
});
