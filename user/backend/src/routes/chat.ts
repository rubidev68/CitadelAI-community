import { Router, Response } from 'express';
import { respond, respondStreaming, respondStreamingWidget, respondStreamingSlack, respondApiToken, respondStreamingApiToken, respondInternal, getHistory, getChatSessions, createChatSession, generateTitle, deleteChatSession } from '../controllers/chat';
import { authMiddleware } from '../middleware/auth';
import { authenticateApiToken, ApiAuthRequest, checkRateLimit } from '../middleware/apiAuth';
import { usageLoggerMiddleware } from '../middleware/usageLogger';
import { corsApiMiddleware } from '../middleware/corsApi';
import prisma from '../lib/prisma';
import { logger, validateRequest } from '@shared/utils';
import {
  respondSchema,
  respondStreamingSchema,
  getHistorySchema,
  getChatSessionsSchema,
  createChatSessionSchema,
  generateTitleSchema,
  deleteChatSessionSchema,
  respondStreamingWidgetSchema,
  respondInternalSchema,
  respondStreamingSlackSchema,
  respondApiTokenSchema,
  respondStreamingApiTokenSchema,
  healthCheckSchema,
  getChatbotInfoSchema,
} from '../validation/chatSchemas';

const router = Router();

// User-authenticated routes
router.post('/respond', authMiddleware, validateRequest(respondSchema) as any, respond);
router.post('/respond-streaming', authMiddleware, validateRequest(respondStreamingSchema) as any, respondStreaming);
router.get('/history', authMiddleware, validateRequest(getHistorySchema) as any, getHistory);
router.get('/', authMiddleware, validateRequest(getChatSessionsSchema) as any, getChatSessions);
router.post('/', authMiddleware, validateRequest(createChatSessionSchema) as any, createChatSession);
router.post('/:id/title', authMiddleware, validateRequest(generateTitleSchema) as any, generateTitle);
router.delete('/:id', authMiddleware, validateRequest(deleteChatSessionSchema) as any, deleteChatSession);

// Widget endpoint - handle OPTIONS preflight
router.options('/respond-streaming-widget', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

router.post('/respond-streaming-widget', validateRequest(respondStreamingWidgetSchema) as any, respondStreamingWidget); // No auth required, validates chatbotId

// Internal endpoint for service-to-service calls (e.g., Slack integration)
router.post('/internal/:chatbotId', validateRequest(respondInternalSchema) as any, respondInternal); // Requires X-Internal-Service header

// Slack-specific streaming endpoint (for internal service calls)
router.post('/slack-streaming', validateRequest(respondStreamingSlackSchema) as any, respondStreamingSlack); // Requires X-Internal-Service header and token

// API token-based routes (public API)
// Apply CORS middleware first, then authenticate with API token
router.use('/:chatbotId', corsApiMiddleware);
router.post('/:chatbotId', authenticateApiToken, checkRateLimit, usageLoggerMiddleware, validateRequest(respondApiTokenSchema) as any, respondApiToken as any);
router.post('/:chatbotId/stream', authenticateApiToken, checkRateLimit, usageLoggerMiddleware, validateRequest(respondStreamingApiTokenSchema) as any, respondStreamingApiToken as any);

// Health endpoint (requires API token)
router.get('/:chatbotId/health', corsApiMiddleware, authenticateApiToken, validateRequest(healthCheckSchema) as any, (async (req: ApiAuthRequest, res: Response) => {
  try {
    const token = req.apiToken;
    const chatbotId = req.chatbotId;
    
    if (!token || !chatbotId) {
      return res.status(400).json({ error: 'Bad Request', message: 'Missing required data' });
    }

    const usage = token.tokenType === 'USAGE' && token.maxUsage
      ? {
          remaining: Math.max(0, token.maxUsage - token.currentUsage),
        }
      : undefined;

    res.json({
      status: 'healthy',
      chatbotId,
      token: {
        prefix: token.tokenPrefix,
        type: token.tokenType,
        remaining: usage?.remaining,
        expiresAt: token.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Error in health check', error instanceof Error ? error : undefined, {
      service: 'chat-routes',
    });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}) as any);

router.get('/:chatbotId/info', corsApiMiddleware, validateRequest(getChatbotInfoSchema) as any, async (req, res) => {
  try {
    const { chatbotId } = req.params;
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { id: true, name: true, status: true },
    });

    if (!chatbot) {
      return res.status(404).json({ error: 'Not Found', message: 'Chatbot not found' });
    }

    res.json({
      id: chatbot.id,
      name: chatbot.name,
      status: chatbot.status,
    });
  } catch (error) {
    logger.error('Error fetching chatbot info', error instanceof Error ? error : undefined, {
      service: 'chat-routes',
    });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
