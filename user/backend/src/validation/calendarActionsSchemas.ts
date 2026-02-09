/**
 * Validation Schemas for Calendar Actions Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { dateTimeSchema } from '@shared/utils';

/**
 * Schema for POST /api/calendar-actions/confirm
 * Confirm a calendar action
 */
export const confirmCalendarActionSchema: ValidationOptions = {
  body: z.object({
    confirmationToken: z.string().min(1, 'Confirmation token is required'),
    slackUserId: z.string().optional(),
    slackChannel: z.string().optional(),
    slackMessageTs: z.string().optional(),
    apiToken: z.string().optional(),
  }),
};

/**
 * Schema for POST /api/calendar-actions/cancel
 * Cancel a calendar action
 */
export const cancelCalendarActionSchema: ValidationOptions = {
  body: z.object({
    confirmationToken: z.string().min(1, 'Confirmation token is required'),
  }),
};

/**
 * Schema for POST /api/calendar-actions/reschedule
 * Reschedule a calendar action
 */
export const rescheduleCalendarActionSchema: ValidationOptions = {
  body: z.object({
    confirmationToken: z.string().min(1, 'Confirmation token is required'),
    newStartTime: dateTimeSchema,
    newEndTime: dateTimeSchema.optional(),
  }),
};
