/**
 * Type definitions for authentication middleware
 * 
 * Note: Request-extending types are NOT exported to avoid type conflicts.
 * Services should define their own Request-extending types locally.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Base type for admin user data (without Request extension)
 */
export interface AdminUserData {
  adminUser?: { id: string; email: string };
}

/**
 * Base type for regular user data (without Request extension)
 */
export interface UserData {
  user?: { id: string; email: string };
}

/**
 * JWT payload structure for admin users
 */
export interface AdminJwtPayload {
  id: string;
  email: string;
}

/**
 * JWT payload structure for regular users
 */
export interface UserJwtPayload {
  userId: string;
  email: string;
}

/**
 * Configuration for JWT authentication middleware
 */
export interface JwtAuthConfig {
  /**
   * Prisma client instance
   */
  prisma: PrismaClient;
  
  /**
   * JWT secret for token verification
   */
  jwtSecret: string;
  
  /**
   * Model name: 'adminUser' or 'user'
   */
  model: 'adminUser' | 'user';
  
  /**
   * Property name to attach to request: 'adminUser' or 'user'
   */
  requestProperty: 'adminUser' | 'user';
  
  /**
   * Optional logger instance
   */
  logger?: {
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  };
}
