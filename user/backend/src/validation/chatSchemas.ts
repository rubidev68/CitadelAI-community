/**
 * Validation Schemas for Chat Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { messageSchema, chatbotIdSchema, cuidSchema, paginationSchema } from '@shared/utils';

/**
 * Schema for POST /chat/respond
 * Non-streaming chat endpoint for authenticated users
 */
export const respondSchema: ValidationOptions = {
  body: z.object({
    message: messageSchema,
    chatSessionId: cuidSchema.optional(),
  }),
};

/**
 * Schema for POST /chat/respond-streaming
 * Streaming chat endpoint for authenticated users
 */
export const respondStreamingSchema: ValidationOptions = {
  body: z.object({
    message: messageSchema,
    chatSessionId: cuidSchema.optional(),
  }),
};

/**
 * Schema for GET /chat/history
 * Get chat history for a session
 */
export const getHistorySchema: ValidationOptions = {
  query: z.object({
    sessionId: cuidSchema,
  }),
};

/**
 * Schema for GET /chat/
 * Get all chat sessions for a user
 */
export const getChatSessionsSchema: ValidationOptions = {
  query: z.object({
    chatbotId: chatbotIdSchema.optional(),
    ...paginationSchema.shape,
  }),
};

/**
 * Schema for POST /chat/
 * Create a new chat session
 */
export const createChatSessionSchema: ValidationOptions = {
  body: z.object({
    chatbotId: chatbotIdSchema.optional(),
    title: z.string().max(255).optional(),
  }),
};

/**
 * Schema for POST /chat/:id/title
 * Generate or update chat session title
 */
export const generateTitleSchema: ValidationOptions = {
  params: z.object({
    id: cuidSchema,
  }),
  body: z.object({
    title: z.string().max(255).optional(),
  }),
};

/**
 * Schema for DELETE /chat/:id
 * Delete a chat session
 */
export const deleteChatSessionSchema: ValidationOptions = {
  params: z.object({
    id: cuidSchema,
  }),
};

/**
 * Schema for POST /chat/respond-streaming-widget
 * Widget-specific streaming endpoint (no auth required)
 */
export const respondStreamingWidgetSchema: ValidationOptions = {
  body: z.object({
    message: messageSchema,
    chatbotId: chatbotIdSchema,
    sessionId: z.string().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant', 'USER', 'ASSISTANT']),
      content: z.string(),
      timestamp: z.union([z.string(), z.number()]).optional(),
    })).optional(),
  }),
};

/**
 * Schema for POST /chat/internal/:chatbotId
 * Internal endpoint for service-to-service calls
 */
export const respondInternalSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    message: messageSchema,
    sessionId: z.string().optional(),
    userId: cuidSchema.optional(),
    slackUserId: z.string().optional(),
    slackChannel: z.string().optional(),
    slackMessageTs: z.string().optional(),
  }),
};

/**
 * Schema for POST /chat/slack-streaming
 * Slack-specific streaming endpoint
 */
export const respondStreamingSlackSchema: ValidationOptions = {
  body: z.object({
    message: messageSchema,
    chatbotId: chatbotIdSchema,
    sessionId: z.string().optional(),
    slackUserId: z.string(),
    slackChannel: z.string().optional(),
    slackMessageTs: z.string().optional(),
  }),
};

/**
 * Schema for POST /chat/:chatbotId (API token)
 * API token-based chat endpoint (non-streaming)
 */
export const respondApiTokenSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    message: messageSchema,
    sessionId: z.string().optional(),
  }),
};

/**
 * Schema for POST /chat/:chatbotId/stream (API token)
 * API token-based streaming endpoint
 */
export const respondStreamingApiTokenSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
  body: z.object({
    message: messageSchema,
    sessionId: z.string().optional(),
  }),
};

/**
 * Schema for GET /chat/:chatbotId/health (API token)
 * Health check endpoint
 */
export const healthCheckSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};

/**
 * Schema for GET /chat/:chatbotId/info
 * Get chatbot info (public, no auth required)
 */
export const getChatbotInfoSchema: ValidationOptions = {
  params: z.object({
    chatbotId: chatbotIdSchema,
  }),
};
