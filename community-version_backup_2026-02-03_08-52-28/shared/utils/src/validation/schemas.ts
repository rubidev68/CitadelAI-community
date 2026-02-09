/**
 * Common Validation Schemas
 * Reusable Zod schemas for common validation patterns
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * CUID validation schema
 * Prisma uses CUIDs (Collision-resistant Unique Identifiers) by default
 * Format: starts with 'c' followed by timestamp and random characters (typically 25 chars)
 */
export const cuidSchema = z.string()
  .min(20, 'ID too short')
  .max(30, 'ID too long')
  .regex(/^c[a-z0-9]+$/, 'Invalid CUID format');

/**
 * ID schema that accepts both UUID and CUID
 * This is useful for IDs that might be either format
 */
export const idSchema = z.string()
  .min(1, 'ID is required')
  .refine(
    (val) => {
      // Try UUID first
      try {
        z.string().uuid().parse(val);
        return true;
      } catch {
        // If not UUID, try CUID format
        return /^c[a-z0-9]{20,29}$/.test(val);
      }
    },
    { message: 'Invalid ID format (must be UUID or CUID)' }
  );

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * URL validation schema
 */
export const urlSchema = z.string().url('Invalid URL format');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Chatbot ID schema (CUID - Prisma default)
 */
export const chatbotIdSchema = cuidSchema;

/**
 * Block ID schema (CUID - Prisma default)
 */
export const blockIdSchema = cuidSchema;

/**
 * User ID schema (CUID - Prisma default)
 */
export const userIdSchema = cuidSchema;

/**
 * Message content schema
 * Validates chat messages with length constraints
 */
export const messageSchema = z.string().trim().min(1, 'Message cannot be empty').max(10000, 'Message too long');

/**
 * Password schema with strength requirements
 */
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Date/time validation schemas
 */
export const dateTimeSchema = z.string().datetime('Invalid datetime format');
export const dateSchema = z.string().date('Invalid date format');

/**
 * File upload body schema
 */
export const fileUploadSchema = z.object({
  chatbotId: chatbotIdSchema,
  blockId: blockIdSchema,
});

/**
 * Common query parameter schemas
 */
export const idParamSchema = z.object({
  id: idSchema,
});

export const chatbotIdParamSchema = z.object({
  chatbotId: cuidSchema,
});

export const blockIdParamSchema = z.object({
  blockId: cuidSchema,
});

/**
 * OAuth provider schema
 */
export const oauthProviderSchema = z.enum(['google', 'microsoft', 'slack', 'nextcloud'], {
  errorMap: () => ({ message: 'Invalid OAuth provider' }),
});

/**
 * Database type schema
 */
export const databaseTypeSchema = z.enum(['postgresql', 'mysql', 'sqlite'], {
  errorMap: () => ({ message: 'Invalid database type' }),
});
