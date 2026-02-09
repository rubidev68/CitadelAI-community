/**
 * Admin Authentication Middleware
 * Uses shared JWT authentication middleware factory
 */

import { Request, RequestHandler } from 'express';
import { createJwtAuthMiddleware } from '@shared/middleware';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const JWT_SECRET = config.JWT_SECRET;

/**
 * Extended request with admin user (local type definition to avoid type conflicts)
 */
export interface AdminAuthRequest extends Request {
  adminUser?: { id: string; email: string };
}

/**
 * Admin authentication middleware
 * Verifies JWT token and attaches adminUser to request
 */
export const adminAuthMiddleware = createJwtAuthMiddleware<AdminAuthRequest>({
  prisma,
  jwtSecret: JWT_SECRET,
  model: 'adminUser',
  requestProperty: 'adminUser',
  logger,
}) as unknown as RequestHandler;
