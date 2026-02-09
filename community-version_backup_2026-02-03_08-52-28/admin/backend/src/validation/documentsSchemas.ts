/**
 * Validation Schemas for Documents Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, blockIdSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/process-document
 * Process document endpoint (file upload)
 */
export const processDocumentSchema: ValidationOptions = {
  body: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
  // File validation is handled by multer middleware
};
