/**
 * Validation Schemas for Mermaid Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';

/**
 * Schema for POST /api/mermaid/to-image
 * Convert Mermaid diagram code to base64 PNG image
 */
export const mermaidToImageSchema: ValidationOptions = {
  body: z.object({
    mermaidCode: z.string().min(1, 'Mermaid code is required').max(50000, 'Mermaid code too long'),
  }),
};
