/**
 * Validation Schemas for Internal Service Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { emailSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/internal/export-user-data
 * Export user data for migration
 */
export const exportUserDataSchema: ValidationOptions = {
  body: z.object({
    adminEmail: emailSchema,
  }),
};
