/**
 * Validation Schemas for Crawling Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, blockIdSchema, urlSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/crawling/crawl
 * Start crawling
 */
export const startCrawlSchema: ValidationOptions = {
  body: z.object({
    url: urlSchema,
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
    recursive: z.boolean().optional().default(false),
    maxDepth: z.coerce.number().int().min(1).max(10).optional().default(3),
  }),
};

/**
 * Schema for GET /api/admin/crawling/status/:blockId
 * Get crawling job status
 */
export const getCrawlStatusSchema: ValidationOptions = {
  params: z.object({
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for POST /api/admin/crawling/cancel/:jobId
 * Cancel crawling job
 */
export const cancelCrawlSchema: ValidationOptions = {
  params: z.object({
    jobId: z.string().min(1, 'Job ID is required'),
  }),
};
