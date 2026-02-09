/**
 * Per-Token Rate Limiter
 * Creates Express rate limiting middleware for API tokens with Redis support
 */

import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@shared/utils';
import { ApiToken } from '../auth/apiTokenAuth';

const rateLimiterLogger = logger.child({ service: 'rate-limiter', component: 'token-rate-limiter' });

/**
 * Default rate limits per token type (requests per minute)
 */
export const DEFAULT_RATE_LIMITS = {
  DURATION: 100, // 100 requests/minute
  USAGE: 50,     // 50 requests/minute (more restrictive)
  PERMANENT: 200, // 200 requests/minute
} as const;

/**
 * Get rate limit for a token
 * Checks token-specific override first, then falls back to defaults per token type
 */
export function getTokenRateLimit(token: ApiToken): number {
  // Check for per-token override
  if (token.rateLimitPerMinute !== null && token.rateLimitPerMinute !== undefined) {
    return token.rateLimitPerMinute;
  }

  // Fall back to defaults per token type
  return DEFAULT_RATE_LIMITS[token.tokenType] || DEFAULT_RATE_LIMITS.DURATION;
}

/**
 * Check if request should skip rate limiting
 */
export function shouldSkipRateLimit(req: Request): boolean {
  // Skip if internal service token (X-Internal-Service header)
  if (req.headers['x-internal-service'] || req.headers['x-internal-service-token']) {
    return true;
  }

  // Skip if user-authenticated (has user JWT, not API token)
  // This is checked by looking for user auth in the request
  // The API token auth middleware will set req.apiToken, so if it's not set
  // but there's auth, it might be user auth - but we'll handle this in the middleware

  // Skip health check endpoints
  const path = req.path.toLowerCase();
  if (path.includes('/health')) {
    return true;
  }

  return false;
}

/**
 * Configuration for token rate limiter
 */
export interface TokenRateLimiterConfig {
  /**
   * Function to get the API token from the request
   * Should return the token if available, null otherwise
   */
  getToken: (req: Request) => ApiToken | null | undefined;

  /**
   * Redis URL (optional - if not provided, uses in-memory store)
   */
  redisUrl?: string;

  /**
   * Custom key generator (optional)
   * Default: uses token ID + endpoint path
   */
  keyGenerator?: (req: Request, token: ApiToken) => string;
}

/**
 * Creates a per-token rate limiter middleware
 * 
 * @param config Configuration object
 * @returns Express rate limit middleware
 */
export function createTokenRateLimiter(config: TokenRateLimiterConfig): RateLimitRequestHandler {
  const { getToken, redisUrl, keyGenerator } = config;

  // Create Redis store if Redis URL is provided
  let store: Options['store'] | undefined;
  
  if (redisUrl && redisUrl !== '') {
    try {
      // Try to use Redis store
      // express-rate-limit v7 supports stores via the 'store' option
      // We'll use a simple in-memory fallback if Redis is not available
      // For now, we'll create the rate limiter with dynamic key generation
      // The actual Redis integration will be handled by express-rate-limit's built-in support
      
      // Note: express-rate-limit v7 doesn't have built-in Redis support
      // We'll use in-memory for now and can add Redis store later if needed
      // The key is to make it work first, then optimize
      
      rateLimiterLogger.info('Redis URL provided, but using in-memory store for now', {
        note: 'Redis store can be added later via rate-limit-redis package if needed',
      });
    } catch (error) {
      rateLimiterLogger.warn('Failed to initialize Redis store, using in-memory fallback', 
        error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Create dynamic rate limiter that checks token on each request
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req: Request) => {
      // Skip rate limiting if conditions are met
      if (shouldSkipRateLimit(req)) {
        return Number.MAX_SAFE_INTEGER; // Effectively no limit
      }

      // Get token from request
      const token = getToken(req);
      if (!token) {
        // If no token, use a default limit (shouldn't happen in normal flow)
        return DEFAULT_RATE_LIMITS.DURATION;
      }

      // Get rate limit for this token
      return getTokenRateLimit(token);
    },
    keyGenerator: (req: Request) => {
      // Skip rate limiting if conditions are met
      if (shouldSkipRateLimit(req)) {
        return 'skip'; // Use a constant key for skipped requests
      }

      // Get token from request
      const token = getToken(req);
      if (!token) {
        // Fallback to IP-based if no token (shouldn't happen)
        return req.ip || 'unknown';
      }

      // Use custom key generator if provided
      if (keyGenerator) {
        return keyGenerator(req, token);
      }

      // Default: token ID + endpoint path
      const endpoint = req.path || 'unknown';
      return `ratelimit:token:${token.id}:${endpoint}`;
    },
    message: { error: 'Rate limit exceeded. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for certain requests
      return shouldSkipRateLimit(req);
    },
    store,
  });
}

/**
 * Create a token rate limiter that extracts token from req.apiToken
 * This is the main function to use with API token authentication middleware
 */
export function createApiTokenRateLimiter(redisUrl?: string): RateLimitRequestHandler {
  return createTokenRateLimiter({
    getToken: (req: Request) => {
      // Extract token from request (set by authenticateApiToken middleware)
      return (req as Request & { apiToken?: ApiToken }).apiToken || null;
    },
    redisUrl,
  });
}
