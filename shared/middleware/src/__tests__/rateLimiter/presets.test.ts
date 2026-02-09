import { describe, it, expect } from 'vitest';
import {
  authRateLimit,
  globalRateLimit,
  strictRateLimit,
  twoFactorRateLimit,
} from '../../rateLimiter/presets';

describe('Rate Limiter Presets', () => {
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

  it('should export twoFactorRateLimit', () => {
    expect(twoFactorRateLimit).toBeDefined();
    expect(typeof twoFactorRateLimit).toBe('function');
  });
});
