/**
 * Rate Limiting Middleware
 * Re-exports shared rate limiting middleware with type assertions for compatibility
 */

import { RequestHandler } from 'express';
import {
  authRateLimit as sharedAuthRateLimit,
  globalRateLimit as sharedGlobalRateLimit,
  strictRateLimit as sharedStrictRateLimit,
  createRateLimiter as sharedCreateRateLimiter,
} from '@shared/middleware';

// Cast to RequestHandler to avoid type conflicts between different @types/express versions
export const authRateLimit = sharedAuthRateLimit as unknown as RequestHandler;
export const globalRateLimit = sharedGlobalRateLimit as unknown as RequestHandler;
export const strictRateLimit = sharedStrictRateLimit as unknown as RequestHandler;
export const createRateLimiter = sharedCreateRateLimiter;
