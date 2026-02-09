/**
 * JWT Authentication Middleware Factory
 * Creates Express middleware for JWT-based authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { JwtAuthConfig, AdminJwtPayload, UserJwtPayload } from './types';

/**
 * Creates JWT authentication middleware
 * 
 * @param config Configuration object
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // For admin users
 * const adminAuth = createJwtAuthMiddleware({
 *   prisma,
 *   jwtSecret: process.env.JWT_SECRET!,
 *   model: 'adminUser',
 *   requestProperty: 'adminUser',
 * });
 * 
 * // For regular users
 * const userAuth = createJwtAuthMiddleware({
 *   prisma,
 *   jwtSecret: process.env.JWT_SECRET!,
 *   model: 'user',
 *   requestProperty: 'user',
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createJwtAuthMiddleware<T extends Record<string, any>>(
  config: JwtAuthConfig
): (req: T, res: Response, next: NextFunction) => Promise<void> {
  const { prisma, jwtSecret, model, requestProperty, logger } = config;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required for JWT authentication');
  }

  return async (req: T, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = (req.headers as { authorization?: string })?.authorization;
      const token = authHeader?.split(' ')[1];

      if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify and decode JWT token
      let decoded: AdminJwtPayload | UserJwtPayload;
      try {
        decoded = jwt.verify(token, jwtSecret) as AdminJwtPayload | UserJwtPayload;
      } catch (error) {
        logger?.error('JWT verification failed', error instanceof Error ? error : new Error(String(error)), {
          service: 'jwt-auth-middleware',
        });
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Extract user ID based on model type
      let userId: string;
      if (model === 'adminUser') {
        const adminPayload = decoded as AdminJwtPayload;
        userId = adminPayload.id;
      } else {
        const userPayload = decoded as UserJwtPayload;
        userId = userPayload.userId;
      }

      // Lookup user in database
      const user = await (prisma[model] as { findUnique: (args: { where: { id: string } }) => Promise<{ id: string; email: string } | null> }).findUnique({
        where: { id: userId },
      });

      if (!user) {
        logger?.error('User not found in database', undefined, {
          userId,
          model,
          service: 'jwt-auth-middleware',
        });
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Attach user to request
      if (requestProperty === 'adminUser') {
        (req as T & { adminUser?: { id: string; email: string } }).adminUser = { id: user.id, email: user.email };
      } else {
        (req as T & { user?: { id: string; email: string } }).user = { id: user.id, email: user.email };
      }

      next();
    } catch (error) {
      logger?.error('JWT authentication error', error instanceof Error ? error : new Error(String(error)), {
        service: 'jwt-auth-middleware',
      });
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
}
