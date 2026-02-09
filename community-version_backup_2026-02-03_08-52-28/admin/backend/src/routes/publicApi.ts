import { Router } from 'express';
import { authenticateApiToken, checkRateLimit } from '../middleware/apiAuth';
import { usageLoggerMiddleware } from '../middleware/usageLogger';
import { corsApiMiddleware } from '../middleware/corsApi';
import {
  handleChat,
  handleChatStream,
} from '../controllers/publicApi/chatController';
import {
  handleHealthCheck,
  handleGetChatbotInfo,
} from '../controllers/publicApi/infoController';
import { validateRequest } from '@shared/utils';
import {
  publicApiChatSchema,
  publicApiChatStreamSchema,
  publicApiHealthCheckSchema,
  publicApiChatbotInfoSchema,
} from '../validation/publicApiSchemas';

const router = Router();

// Apply CORS middleware to all routes (must be before route handlers)
router.use(corsApiMiddleware);

/**
 * Send message to chatbot (non-streaming)
 * POST /api/chat/:chatbotId
 */
router.post('/chat/:chatbotId', authenticateApiToken, checkRateLimit, usageLoggerMiddleware, validateRequest(publicApiChatSchema) as any, handleChat);

/**
 * Stream message to chatbot (Server-Sent Events)
 * POST /api/chat/:chatbotId/stream
 */
router.post('/chat/:chatbotId/stream', authenticateApiToken, checkRateLimit, usageLoggerMiddleware, validateRequest(publicApiChatStreamSchema) as any, handleChatStream);

/**
 * Health check endpoint
 * GET /api/chat/:chatbotId/health
 * Note: Health checks are excluded from rate limiting in tokenRateLimiter
 */
router.get('/chat/:chatbotId/health', authenticateApiToken, validateRequest(publicApiHealthCheckSchema) as any, handleHealthCheck);

/**
 * Get chatbot info (public, no auth required)
 * GET /api/chat/:chatbotId/info
 * Allows all origins for documentation/testing purposes
 */
router.get('/chat/:chatbotId/info', corsApiMiddleware, validateRequest(publicApiChatbotInfoSchema) as any, handleGetChatbotInfo);

export default router;
