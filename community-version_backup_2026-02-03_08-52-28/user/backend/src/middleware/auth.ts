/**
 * User Authentication Middleware
 * Uses shared JWT authentication middleware factory
 */

import { Request, RequestHandler } from 'express';
import { createJwtAuthMiddleware } from '@shared/middleware';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const JWT_SECRET = config.JWT_SECRET;

/**
 * Extended request with user (local type definition to avoid type conflicts)
 */
export interface UserAuthRequest extends Request {
  user?: { id: string; email: string };
}

/**
 * User authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authMiddleware = createJwtAuthMiddleware<UserAuthRequest>({
  prisma,
  jwtSecret: JWT_SECRET,
  model: 'user',
  requestProperty: 'user',
  logger,
}) as unknown as RequestHandler;

// Re-export for backward compatibility
export const userAuthMiddleware = authMiddleware;

// Re-export types for backward compatibility
export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}
