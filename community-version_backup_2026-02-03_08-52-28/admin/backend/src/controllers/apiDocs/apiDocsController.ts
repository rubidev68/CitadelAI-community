import { Request, Response } from 'express';
import { logger } from '@shared/utils';
import prisma from '../../lib/prisma';
import { generateApiDocsHtml } from './utils/htmlGenerator';

const apiDocsLogger = logger.child({ service: 'admin-backend', component: 'apiDocs' });

/**
 * Generate HTML documentation for a chatbot's API
 */
export async function handleGetApiDocs(req: Request, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;

    // Get chatbot info
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!chatbot) {
      res.status(404).send('Chatbot not found');
      return;
    }

    // Get base URL from request
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const apiBaseUrl = `${baseUrl}/api/chat/${chatbotId}`;

    // Generate HTML documentation
    const html = generateApiDocsHtml(chatbotId, chatbot.name, apiBaseUrl, baseUrl);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: unknown) {
    apiDocsLogger.error('Error generating API docs', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).send('Error generating documentation');
  }
}
