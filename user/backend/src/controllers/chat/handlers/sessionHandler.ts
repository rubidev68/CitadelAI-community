import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import prisma from '../../../lib/prisma';
import { logger } from '@shared/utils';
import { createLLMService } from '../../../services/llmService';

/**
 * Get chat history for a session
 */
export async function getHistory(req: AuthRequest, res: Response): Promise<void> {
  const { sessionId } = req.query;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const messages = await prisma.chatMessage.findMany({
      where: {
        chatSessionId: sessionId as string,
        chatSession: {
          userId,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    res.json(messages);
  } catch (error) {
    logger.error('Error in getMessages', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * Get all chat sessions for a user
 */
export async function getChatSessions(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const chatbotId = req.query.chatbotId as string;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const whereClause: {
      userId: string;
      chatbotId?: string;
    } = {
      userId,
    };

    // If chatbotId is provided, filter by it
    if (chatbotId) {
      whereClause.chatbotId = chatbotId;
    }

    const chatSessions = await prisma.chatSession.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(chatSessions);
  } catch (error) {
    logger.error('Error in getMessages', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * Create a new chat session
 */
export async function createChatSession(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const { chatbotId } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    // Use provided chatbotId or fallback to user's default chatbot
    let finalChatbotId = chatbotId;
    
    if (!finalChatbotId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      finalChatbotId = user?.defaultChatbotId || 'cmh11nv75000d2a20a5l84bnc'; // Fallback to a public chatbot
    }

    const newChatSession = await prisma.chatSession.create({
      data: {
        userId,
        chatbotId: finalChatbotId,
        title: 'New Chat',
      },
    });
    res.json(newChatSession);
  } catch (error) {
    logger.error('Error in getMessages', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * Generate a title for a chat session based on the first message
 */
export async function generateTitle(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        chatMessages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1,
        },
      },
    });

    if (!chatSession || chatSession.chatMessages.length === 0) {
      res.status(404).json({ error: 'Chat session not found or no messages yet' });
      return;
    }

    const firstMessage = chatSession.chatMessages[0].content;
    const systemPrompt = `Generate a short, descriptive title (5 words or less) for a conversation that starts with this message: "${firstMessage}". Return only the title text without any formatting, quotes, or special characters.`;
    
    // Use default Gemini for title generation
    const llmService = createLLMService('gemini', 'gemini-2.5-flash');
    const title = await llmService.generateResponse(chatSession.chatbotId, systemPrompt, [], firstMessage);

    // Clean the title to ensure it's non-formatted
    const cleanTitle = title
      .replace(/"/g, '') // Remove quotes
      .replace(/\*\*/g, '') // Remove bold formatting
      .replace(/\*/g, '') // Remove italic formatting
      .replace(/#/g, '') // Remove markdown headers
      .replace(/`/g, '') // Remove code formatting
      .replace(/\[|\]/g, '') // Remove brackets
      .replace(/\(|\)/g, '') // Remove parentheses
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
      .trim(); // Remove leading/trailing whitespace

    const updatedChatSession = await prisma.chatSession.update({
      where: {
        id,
      },
      data: {
        title: cleanTitle,
      },
    });

    res.json(updatedChatSession);
  } catch (error) {
    logger.error('Error in getMessages', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}

/**
 * Delete a chat session and all its messages
 */
export async function deleteChatSession(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    await prisma.chatMessage.deleteMany({
      where: {
        chatSessionId: id,
        chatSession: {
          userId,
        },
      },
    });

    await prisma.chatSession.delete({
      where: {
        id,
        userId,
      },
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error in getMessages', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    res.status(500).json({ error: 'Something went wrong' });
  }
}
