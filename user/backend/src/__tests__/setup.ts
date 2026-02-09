import { vi, beforeEach } from 'vitest';
import { loadProdEnv } from './loadEnv';

// Mock jsonwebtoken globally before any modules load
// This ensures the mock is available when shared middleware imports it
const { mockJwtVerify, mockJwtSign } = vi.hoisted(() => {
  const verify = vi.fn();
  const sign = vi.fn();
  return { mockJwtVerify: verify, mockJwtSign: sign };
});

// Mock jsonwebtoken - this should intercept all require('jsonwebtoken') calls
vi.mock('jsonwebtoken', () => {
  return {
    __esModule: true,
    default: {
      verify: mockJwtVerify,
      sign: mockJwtSign,
    },
    verify: mockJwtVerify,
    sign: mockJwtSign,
  };
});

// Patch require() to intercept jsonwebtoken imports from nested node_modules
// This is needed because the compiled shared middleware uses require() which
// resolves to its own node_modules before our mock is applied
const Module = require('module');
const originalRequireFunc = Module.prototype.require;

Module.prototype.require = function(id: string) {
  if (id === 'jsonwebtoken' || id.endsWith('/jsonwebtoken')) {
    return {
      __esModule: true,
      default: {
        verify: mockJwtVerify,
        sign: mockJwtSign,
      },
      verify: mockJwtVerify,
      sign: mockJwtSign,
    };
  }
  return originalRequireFunc.apply(this, arguments as any);
};

// Export mocks for use in tests
export { mockJwtVerify, mockJwtSign };

// Mock environment variables
// Set NODE_ENV to test to prevent server from starting
process.env.NODE_ENV = 'test';

// IMPORTANT: Set JWT_SECRET to test value BEFORE loading prod.env
// This ensures tests use predictable test values, not production secrets
// loadProdEnv will not override it since it only sets if not already set
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';

// Load environment variables from prod.env if available (for local testing)
// This allows using real API keys and secrets when running tests locally
// Note: JWT_SECRET is already set above, so it won't be overridden
loadProdEnv();

// Set required environment variables for config validation if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
}
if (!process.env.INTERNAL_SERVICE_TOKEN) {
  process.env.INTERNAL_SERVICE_TOKEN = 'test-internal-service-token';
}
if (!process.env.SLACK_ENCRYPTION_KEY) {
  // 64 hex characters required
  process.env.SLACK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}
if (!process.env.CRAWLING_SERVICE_URL) {
  process.env.CRAWLING_SERVICE_URL = 'http://localhost:3001';
}
if (!process.env.CRON_SCHEDULER_URL) {
  process.env.CRON_SCHEDULER_URL = 'http://localhost:3002';
}
if (!process.env.INSTANCE_SERVICE_URL) {
  process.env.INSTANCE_SERVICE_URL = 'http://localhost:3006';
}
if (!process.env.VERSION_TYPE) {
  process.env.VERSION_TYPE = 'opensource';
}
if (!process.env.FEATURE_BILLING) {
  process.env.FEATURE_BILLING = 'true';
}
if (!process.env.FEATURE_ENTERPRISE) {
  process.env.FEATURE_ENTERPRISE = 'true';
}
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-openai-key';
}

// Global test setup
beforeEach(() => {
  vi.clearAllMocks();
});

// Global teardown to ensure SLACK_ENCRYPTION_KEY is always set
// This prevents config validation errors when tests delete it and then modules are imported during cleanup
afterEach(() => {
  // Ensure SLACK_ENCRYPTION_KEY is always set to prevent config validation errors
  // Tests that need to delete it should restore it in their own afterEach
  if (!process.env.SLACK_ENCRYPTION_KEY) {
    process.env.SLACK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }
});
