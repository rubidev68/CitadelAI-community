/**
 * Validation Schemas for Auth Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { emailSchema, passwordSchema } from '@shared/utils';

/**
 * Schema for POST /auth/register
 * User registration
 */
export const registerSchema: ValidationOptions = {
  body: z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().min(1).max(255).trim().optional(),
  }),
};

/**
 * Schema for POST /auth/login
 * User login
 */
export const loginSchema: ValidationOptions = {
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
};

/**
 * Schema for POST /auth/logout
 * User logout (no body validation needed)
 */
export const logoutSchema: ValidationOptions = {
  // No validation needed - logout is stateless
};

/**
 * Schema for GET /auth/me
 * Get current user info (no input validation needed)
 */
export const getMeSchema: ValidationOptions = {
  // No validation needed - uses auth middleware
};
