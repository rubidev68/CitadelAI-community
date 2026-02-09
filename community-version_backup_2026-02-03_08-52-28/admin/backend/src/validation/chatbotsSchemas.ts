/**
 * Validation Schemas for Chatbots Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema } from '@shared/utils';

/**
 * Schema for POST /api/admin/chatbots
 * Create a new chatbot
 */
export const createChatbotSchema: ValidationOptions = {
  body: z.object({
    name: z.string().min(1).max(255).trim(),
    description: z.string().max(1000).trim().optional(),
  }),
};

/**
 * Schema for GET /api/admin/chatbots/:id
 * Get chatbot by ID
 */
export const getChatbotSchema: ValidationOptions = {
  params: z.object({
    id: chatbotIdSchema,
  }),
};

/**
 * Schema for PUT /api/admin/chatbots/:id
 * Update chatbot (complex update with blocks, connections, etc.)
 */
export const updateChatbotSchema: ValidationOptions = {
  params: z.object({
    id: chatbotIdSchema,
  }),
  body: z.object({
    name: z.string().min(1).max(255).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
    blocks: z.array(z.any()).optional(), // Complex block structure - validate at controller level
    connections: z.array(z.any()).optional(), // Complex connection structure - validate at controller level
    websiteContexts: z.array(z.any()).optional(), // Complex website context structure - validate at controller level
  }),
};

/**
 * Schema for DELETE /api/admin/chatbots/:id
 * Delete chatbot
 */
export const deleteChatbotSchema: ValidationOptions = {
  params: z.object({
    id: chatbotIdSchema,
  }),
};
