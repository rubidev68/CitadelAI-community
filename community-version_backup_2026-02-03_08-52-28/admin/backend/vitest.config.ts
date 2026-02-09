import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: [
      'node_modules/',
      'dist/',
      '**/__mocks__/**',
      'src/routes/__mocks__/**',
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
        'prisma/**',
        '**/*.config.ts',
        '**/*.config.js',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        // Lower thresholds initially - tests validate logic structure
        // Can be increased as more comprehensive tests are added
        lines: 20,
        functions: 60,
        branches: 20,
        statements: 20,
      },
    },
    testTimeout: 10000,
  },
});
