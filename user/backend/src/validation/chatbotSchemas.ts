/**
 * Validation Schemas for Chatbot Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, cuidSchema } from '@shared/utils';

/**
 * Schema for GET /chatbot/
 * Get all chatbots for a user (no input validation needed)
 */
export const getChatbotsSchema: ValidationOptions = {
  // No validation needed - returns all user's chatbots
};

/**
 * Schema for GET /chatbot/:id
 * Get chatbot by ID
 */
export const getChatbotByIdSchema: ValidationOptions = {
  params: z.object({
    id: chatbotIdSchema,
  }),
};

/**
 * Schema for POST /chatbot/:chatbotId/set-default
 * Set default chatbot for user
 */
export const setDefaultChatbotSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};
