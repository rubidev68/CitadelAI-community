# Testing Guide for Admin Backend

This document provides information about the testing setup for the admin-backend service.

## Overview

The admin-backend uses [Vitest](https://vitest.dev/) as the test runner with coverage reporting via `@vitest/coverage-v8`. Tests are organized in the `src/__tests__` directory.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests for a specific file
```bash
npx vitest run src/__tests__/routes/crawling.test.ts
```

## Test Structure

Tests are organized to mirror the source code structure:

```
src/__tests__/
├── setup.ts                    # Global test setup
├── mocks/                      # Mock utilities
│   ├── prisma.ts              # Prisma client mocks
│   └── weaviate.ts            # Weaviate client mocks
├── middleware/                # Middleware tests
│   ├── adminAuth.test.ts
│   └── subscriptionMiddleware.test.ts
├── routes/                     # Route tests
│   ├── crawling.test.ts
│   ├── subscription.test.ts
│   ├── documents.test.ts
│   ├── instances.test.ts
│   ├── enterprise.test.ts
│   └── resourceTemplates.test.ts
├── services/                   # Service tests
│   └── semantic-chunking.test.ts
├── shared/                     # Shared utility tests
│   └── config/
│       └── features.test.ts
├── weaviate.test.ts           # Weaviate utility tests
└── index.test.ts              # Main app endpoint tests
```

## Coverage

Coverage reports are generated automatically when running tests. The coverage configuration is set in `vitest.config.ts` with the following thresholds:

- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

### Viewing Coverage Reports

After running tests, coverage reports are available in:
- **HTML**: `coverage/index.html` (open in browser)
- **LCOV**: `coverage/lcov.info` (for CI/CD tools)
- **JSON**: `coverage/coverage-final.json`

## Writing Tests

### Test File Naming

Test files should follow the pattern: `*.test.ts` or `*.spec.ts`

### Example Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from '../path/to/module';

describe('Module Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something', () => {
    expect(functionToTest()).toBe(expectedValue);
  });
});
```

### Mocking

The test suite includes mock utilities for common dependencies:

- **Prisma**: Use `createMockPrisma()` from `__tests__/mocks/prisma.ts`
- **Weaviate**: Use `createMockWeaviateClient()` from `__tests__/mocks/weaviate.ts`
- **Axios**: Mock using `vi.mock('axios')`

### Environment Variables

Test environment variables are set in `src/__tests__/setup.ts`. You can override them in individual tests if needed.

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `dev` branches
- Pull requests targeting `main` or `dev`
- Manual workflow dispatch

The GitHub Actions workflow:
1. Installs dependencies
2. Generates Prisma client
3. Runs linter (non-blocking)
4. Runs tests with coverage
5. Uploads coverage reports to Codecov
6. Stores coverage artifacts

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Mocking**: Mock external dependencies (database, APIs, file system)
3. **Coverage**: Aim for high coverage but focus on testing critical paths
4. **Naming**: Use descriptive test names that explain what is being tested
5. **Setup/Cleanup**: Use `beforeEach` and `afterEach` for test setup and cleanup

## Troubleshooting

### Tests failing due to missing mocks

Ensure all external dependencies are properly mocked. Check the `mocks/` directory for available mock utilities.

### Coverage not generating

Make sure `@vitest/coverage-v8` is installed and the coverage configuration in `vitest.config.ts` is correct.

### Prisma errors in tests

Ensure Prisma client is properly mocked. The mock Prisma client in `__tests__/mocks/prisma.ts` should cover all Prisma operations used in your tests.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
