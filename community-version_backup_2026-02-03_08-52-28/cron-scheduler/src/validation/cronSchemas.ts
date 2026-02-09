/**
 * Validation Schemas for Cron Scheduler Routes
 */

import { z } from 'zod';
import { blockIdSchema } from '@shared/utils';

/**
 * Schema for POST /cron/update
 * Update cron settings for a website context
 */
export const updateCronSchema = {
  body: z.object({
    blockId: blockIdSchema,
    cronEnabled: z.boolean().optional(),
    cronSchedule: z.string().max(255).optional().nullable(),
    cronTimezone: z.string().max(100).optional().default('UTC'),
  }),
};

/**
 * Schema for GET /cron/status/:blockId
 * Get cron status for a website context
 */
export const getCronStatusSchema = {
  params: z.object({
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for DELETE /cron/unschedule/:blockId
 * Unschedule a specific crawl task
 */
export const unscheduleCrawlSchema = {
  params: z.object({
    blockId: blockIdSchema,
  }),
};
