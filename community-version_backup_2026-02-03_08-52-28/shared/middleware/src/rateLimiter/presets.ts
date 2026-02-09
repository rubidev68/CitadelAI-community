/**
 * Pre-configured Rate Limiter Presets
 * Common rate limiting configurations for different use cases
 */

import { createRateLimiter } from './rateLimiter';
import { RequestHandler } from 'express';

/**
 * Authentication rate limiter
 * 5 attempts per 15 minutes
 */
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
}) as unknown as RequestHandler;

/**
 * Two-factor authentication rate limiter
 * 3 attempts per 15 minutes
 */
export const twoFactorRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 attempts per window
  message: 'Too many 2FA attempts, please try again later',
}) as unknown as RequestHandler;

/**
 * Global rate limiter
 * 100 requests per 15 minutes
 */
export const globalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
}) as unknown as RequestHandler;

/**
 * Strict rate limiter
 * 10 requests per 15 minutes
 */
export const strictRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many requests, please try again later',
}) as unknown as RequestHandler;
