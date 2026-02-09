import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminUser } from '@prisma/client';
import { config } from '../config';

const JWT_SECRET = config.JWT_SECRET;

// Extend the Request interface to include the user property
export interface User {
  id: string;
  role: string;
  email: string;
  userId?: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

// In-memory store for temporary tokens (use Redis in production)
export interface TempTokenData {
  userId: string;
  email: string;
  expiresAt: number;
  secret?: string;
}

export const tempTokenStore = new Map<string, TempTokenData>();

// Clean up expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tempTokenStore.entries()) {
    if (data.expiresAt < now) {
      tempTokenStore.delete(token);
    }
  }
}, 5 * 60 * 1000);

// Middleware for token validation
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: unknown, user: unknown) => {
    if (err) return res.sendStatus(403);
    req.user = user as User;
    next();
  });
};

// Type for AdminUser with optional fields (for migration compatibility)
export type AdminUserWithOptionalFields = Partial<AdminUser> & {
  id: string;
  email: string;
  password?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  twoFactorBackupCodes?: string[];
  twoFactorSetupCompleted?: boolean;
  passwordResetToken?: string | null;
  passwordResetTokenExpires?: Date | null;
  passwordResetRequestedAt?: Date | null;
};

// Type for Prisma errors
export type PrismaError = {
  code?: string;
  meta?: {
    target?: string[];
  };
  message?: string;
};

// Helper function to safely check if 2FA fields exist (fallback for missing migration)
export const has2FAFields = (user: AdminUserWithOptionalFields | Record<string, unknown>): boolean => {
  return 'twoFactorEnabled' in user;
};

export const get2FAField = <T>(user: AdminUserWithOptionalFields | Record<string, unknown>, field: string, defaultValue: T): T => {
  return has2FAFields(user) ? ((user as Record<string, unknown>)[field] as T ?? defaultValue) : defaultValue;
};

// Helper function to safely check if password reset fields exist (fallback for missing migration)
export const hasPasswordResetFields = (user: AdminUserWithOptionalFields | Record<string, unknown>): boolean => {
  return 'passwordResetToken' in user;
};

export const getPasswordResetField = <T>(user: AdminUserWithOptionalFields | Record<string, unknown>, field: string, defaultValue: T): T => {
  return hasPasswordResetFields(user) ? ((user as Record<string, unknown>)[field] as T ?? defaultValue) : defaultValue;
};
