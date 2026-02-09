/**
 * API Token Authentication Middleware
 * Uses shared API token authentication middleware factory
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { createApiTokenAuthMiddleware, ApiToken, createApiTokenRateLimiter } from '@shared/middleware';
import { findTokenByValue, validateToken, incrementUsage } from '../services/apiTokenService';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const apiAuthLogger = logger.child({ service: 'admin-backend', component: 'apiAuth' });

/**
 * Extended request with API token (local type definition to avoid type conflicts)
 */
export interface ApiAuthRequest extends Request {
  apiToken?: ApiToken;
  chatbotId?: string;
}

/**
 * API token authentication middleware
 * Verifies API token and attaches apiToken and chatbotId to request
 */
export const authenticateApiToken = createApiTokenAuthMiddleware({
  findTokenByValue,
  validateToken: validateToken as (token: ApiToken | { [key: string]: unknown }) => ReturnType<typeof validateToken>,
  incrementUsage,
  prisma,
  logger: apiAuthLogger,
}) as unknown as RequestHandler;

/**
 * Token rate limiting middleware
 * Applies per-token rate limiting with Redis support (optional)
 */
let tokenRateLimiter: ReturnType<typeof createApiTokenRateLimiter> | null = null;

/**
 * Initialize token rate limiter (called once on startup)
 * Exported for testing purposes
 */
export async function initializeTokenRateLimiter(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || '';
    tokenRateLimiter = createApiTokenRateLimiter(redisUrl);
    apiAuthLogger.info('Token rate limiter initialized', {
      hasRedis: !!redisUrl,
    });
  } catch (error) {
    apiAuthLogger.warn('Failed to initialize token rate limiter, using in-memory fallback', 
      error instanceof Error ? error : new Error(String(error)));
    // Fallback to in-memory (no Redis URL)
    tokenRateLimiter = createApiTokenRateLimiter();
  }
}

/**
 * Rate limiting middleware for API tokens
 * Skips rate limiting for internal service tokens and user-authenticated requests
 */
export const checkRateLimit = async (
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Initialize rate limiter if not already done (lazy initialization)
  if (!tokenRateLimiter) {
    await initializeTokenRateLimiter();
  }

  if (tokenRateLimiter) {
    // Use the rate limiter middleware
    // Cast to avoid cross-package express type incompatibilities during Docker builds
    (tokenRateLimiter as unknown as (req: unknown, res: unknown, next: unknown) => void)(req, res, next);
  } else {
    // Fallback: just pass through if rate limiter failed to initialize
    next();
  }
};
