/**
 * Validation Schemas for OAuth Routes
 */

import { z } from 'zod';
import type { ValidationOptions } from '@shared/utils';
import { chatbotIdSchema, blockIdSchema, oauthProviderSchema, urlSchema } from '@shared/utils';

/**
 * Schema for GET /api/user/oauth/start
 * Start user OAuth flow
 */
export const startOAuthSchema: ValidationOptions = {
  query: z.object({
    provider: oauthProviderSchema,
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
};

/**
 * Schema for GET /api/user/oauth/callback
 * OAuth callback handler
 */
export const oauthCallbackSchema: ValidationOptions = {
  query: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
};

/**
 * Schema for POST /api/user/caldav/auth
 * Store CalDAV credentials
 */
export const caldavAuthSchema: ValidationOptions = {
  body: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema.optional(), // blockId is optional (can be null for chatbot-level connections)
    serverUrl: urlSchema.optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    slackUserId: z.string().optional(),
  }),
  query: z.object({
    slackUserId: z.string().optional(),
  }),
};
