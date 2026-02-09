import { Response } from 'express';
import { logger } from '@shared/utils';
import { ApiAuthRequest } from '../../middleware/apiAuth';
import { CorsApiRequest } from '../../middleware/corsApi';
import prisma from '../../lib/prisma';

const publicApiLogger = logger.child({ service: 'admin-backend', component: 'publicApi' });

/**
 * Health check endpoint
 */
export async function handleHealthCheck(req: ApiAuthRequest, res: Response): Promise<void> {
  try {
    const token = req.apiToken;
    const chatbotId = req.chatbotId;
    
    if (!token || !chatbotId) {
      res.status(400).json({ error: 'Bad Request', message: 'Missing required data' });
      return;
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
  } catch (error: unknown) {
    publicApiLogger.error('Error in health check', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * Get chatbot info (public, no auth required)
 */
export async function handleGetChatbotInfo(req: CorsApiRequest, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;

    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!chatbot) {
      res.status(404).json({ error: 'Not Found', message: 'Chatbot not found' });
      return;
    }

    res.json({
      id: chatbot.id,
      name: chatbot.name,
      status: chatbot.status,
    });
  } catch (error: unknown) {
    publicApiLogger.error('Error fetching chatbot info', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
