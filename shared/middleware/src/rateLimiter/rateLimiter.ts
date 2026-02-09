/**
 * Rate Limiting Middleware Factory
 * Creates Express rate limiting middleware with consistent configuration
 */

import rateLimit, { Options } from 'express-rate-limit';
import { RequestHandler } from 'express';

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  
  /**
   * Maximum number of requests per window
   */
  max: number;
  
  /**
   * Error message to return when limit is exceeded
   */
  message?: string;
  
  /**
   * Additional rate limit options
   */
  options?: Partial<Options>;
}

/**
 * Creates a rate limiter middleware
 * 
 * @param config Configuration object
 * @returns Express rate limit middleware
 * 
 * @example
 * ```typescript
 * const limiter = createRateLimiter({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   max: 100, // 100 requests per window
 *   message: 'Too many requests, please try again later',
 * });
 * ```
 */
export function createRateLimiter(config: RateLimiterConfig): RequestHandler {
  const { windowMs, max, message = 'Too many requests, please try again later', options = {} } = config;

  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    ...options,
  }) as unknown as RequestHandler;
}
