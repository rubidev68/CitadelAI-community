/**
 * Validation Schemas for Public API Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, messageSchema } from '@shared/utils';

/**
 * Schema for POST /api/chat/:chatbotId
 * Send message to chatbot (non-streaming)
 */
export const publicApiChatSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    message: messageSchema,
    sessionId: z.string().optional(),
  }),
};

/**
 * Schema for POST /api/chat/:chatbotId/stream
 * Stream message to chatbot (Server-Sent Events)
 */
export const publicApiChatStreamSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    message: messageSchema,
    sessionId: z.string().optional(),
  }),
};

/**
 * Schema for GET /api/chat/:chatbotId/health
 * Health check endpoint
 */
export const publicApiHealthCheckSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};

/**
 * Schema for GET /api/chat/:chatbotId/info
 * Get chatbot info (public, no auth required)
 */
export const publicApiChatbotInfoSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};
