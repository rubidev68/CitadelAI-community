import { describe, it, expect } from 'vitest';
import {
  authRateLimit,
  twoFactorRateLimit,
  globalRateLimit,
  strictRateLimit,
} from '../../middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  it('should export authRateLimit', () => {
    expect(authRateLimit).toBeDefined();
    expect(typeof authRateLimit).toBe('function');
  });

  it('should export twoFactorRateLimit', () => {
    expect(twoFactorRateLimit).toBeDefined();
    expect(typeof twoFactorRateLimit).toBe('function');
  });

  it('should export globalRateLimit', () => {
    expect(globalRateLimit).toBeDefined();
    expect(typeof globalRateLimit).toBe('function');
  });

  it('should export strictRateLimit', () => {
    expect(strictRateLimit).toBeDefined();
    expect(typeof strictRateLimit).toBe('function');
  });

  // Note: Actual rate limiting behavior is tested by express-rate-limit library
  // These tests verify that the middleware functions are properly configured and exported
});
