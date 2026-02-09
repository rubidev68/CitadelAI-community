/**
 * Validation Schemas for API Tokens Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, cuidSchema, blockIdSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/api-tokens
 * Create a new API token
 */
export const createApiTokenSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(255).trim(),
    expiresAt: z.string().datetime().optional(),
    maxUsage: z.coerce.number().int().min(1).optional(),
    tokenType: z.enum(['DURATION', 'USAGE', 'PERMANENT']).optional().default('DURATION'),
    blockId: blockIdSchema.optional(),
  }),
};

/**
 * Schema for GET /api/admin/chatbots/:chatbotId/api-tokens
 * List all API tokens for a chatbot
 */
export const listApiTokensSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};

/**
 * Schema for GET /api/admin/api-tokens/:tokenId
 * Get a specific API token
 */
export const getApiTokenSchema: ValidationOptions = {
  params: z.object({
    tokenId: cuidSchema,
  }),
};

/**
 * Schema for PATCH /api/admin/api-tokens/:tokenId
 * Update an API token
 */
export const updateApiTokenSchema: ValidationOptions = {
  params: z.object({
    tokenId: cuidSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    maxUsage: z.coerce.number().int().min(1).optional().nullable(),
    isActive: z.boolean().optional(),
  }),
};

/**
 * Schema for DELETE /api/admin/api-tokens/:tokenId
 * Revoke an API token
 */
export const revokeApiTokenSchema: ValidationOptions = {
  params: z.object({
    tokenId: cuidSchema,
  }),
};
