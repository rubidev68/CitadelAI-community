/**
 * Validation Schemas for Crawling Service Routes
 */

import { z } from 'zod';
import { chatbotIdSchema, blockIdSchema, urlSchema } from '@shared/utils';

/**
 * Schema for POST /crawl
 * Start optimized crawling
 */
export const crawlSchema = {
  body: z.object({
    url: urlSchema,
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
    recursive: z.boolean().optional().default(false),
    maxDepth: z.coerce.number().int().min(1).max(10).optional().default(3),
  }),
};

/**
 * Schema for POST /crawl-legacy
 * Start legacy crawling
 */
export const crawlLegacySchema = {
  body: z.object({
    url: urlSchema,
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
    recursive: z.boolean().optional().default(false),
    maxDepth: z.coerce.number().int().min(1).max(10).optional().default(3),
  }),
};

/**
 * Schema for GET /status/:blockId
 * Get crawling status
 */
export const getCrawlStatusSchema = {
  params: z.object({
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for POST /stop
 * Stop crawling
 */
export const stopCrawlSchema = {
  body: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};
