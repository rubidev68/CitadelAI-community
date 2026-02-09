import { describe, it, expect } from 'vitest';
import {
  authRateLimit,
  globalRateLimit,
  strictRateLimit,
} from '../../middleware/rateLimiter';

describe('Rate Limiter Middleware', () => {
  it('should export authRateLimit', () => {
    expect(authRateLimit).toBeDefined();
    expect(typeof authRateLimit).toBe('function');
  });

  it('should export globalRateLimit', () => {
    expect(globalRateLimit).toBeDefined();
    expect(typeof globalRateLimit).toBe('function');
  });

  it('should export strictRateLimit', () => {
    expect(strictRateLimit).toBeDefined();
    expect(typeof strictRateLimit).toBe('function');
  });
});
