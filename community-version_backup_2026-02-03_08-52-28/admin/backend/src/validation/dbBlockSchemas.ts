/**
 * Validation Schemas for DB Block Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, blockIdSchema, databaseTypeSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-connection
 * Test database connection
 */
export const dbBlockTestConnectionSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
  body: z.object({
    dbType: databaseTypeSchema,
    connectionString: z.string().max(1000, 'Connection string too long').optional(),
    host: z.string().max(255).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    database: z.string().max(255).optional(),
    username: z.string().max(255).optional(),
    password: z.string().max(255).optional(),
    ssl: z.boolean().optional(),
  }),
};

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-query
 * Test SELECT query execution
 */
export const dbBlockQuerySchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
  body: z.object({
    sqlQuery: z.string().min(1, 'SQL query is required').max(10000, 'Query too long'),
    parameters: z.record(z.string(), z.unknown()).optional(),
  }),
};

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/blocks/:blockId/discover-schema
 * Discover database schema
 */
export const dbBlockSchemaSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/blocks/:blockId/upload-db-file
 * Upload database file
 */
export const dbBlockUploadFileSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
  // File validation is handled by multer middleware
};

/**
 * Schema for POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-file-connection
 * Test file-based database connection
 */
export const dbBlockTestFileConnectionSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for GET /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file
 * Get database file info
 */
export const dbBlockGetFileSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for DELETE /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file
 * Delete database file
 */
export const dbBlockDeleteFileSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};
