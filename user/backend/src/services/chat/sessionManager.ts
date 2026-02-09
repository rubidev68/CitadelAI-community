import { ChatMessage } from '@prisma/client';
import prisma from '../../lib/prisma';
import type { SessionResult } from './types';
import { logger } from '@shared/utils';

/**
 * Get or create a chat session and retrieve history
 */
export async function getOrCreateSession(
  userId: string | undefined,
  sessionId: string | undefined,
  chatbotId: string,
  message: string,
  providedHistory: ChatMessage[] | undefined,
  useInMemorySession: boolean | undefined
): Promise<SessionResult> {
  let chatSession: { id: string; chatbotId: string } | null = null;
  let finalSessionId = sessionId;
  let finalHistory: ChatMessage[] = providedHistory || [];

  if (!useInMemorySession && userId) {
    // Use database session
    if (sessionId) {
      chatSession = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { id: true, chatbotId: true },
      });
    }

    if (!chatSession) {
      // Create new session
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { defaultChatbotId: true },
      });

      const defaultChatbotId = user?.defaultChatbotId || 'cmh11nv75000d2a20a5l84bnc';
      chatSession = await prisma.chatSession.create({
        data: {
          userId,
          chatbotId: chatbotId || defaultChatbotId,
        },
        select: { id: true, chatbotId: true },
      });
    }

    finalSessionId = chatSession.id;
    const actualChatbotId = chatSession.chatbotId;

    // Save user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        chatSessionId: finalSessionId,
        role: 'USER',
        content: message,
      },
    });

    // Get chat history (including the message we just created)
    finalHistory = await prisma.chatMessage.findMany({
      where: { chatSessionId: finalSessionId },
      orderBy: { createdAt: 'asc' },
    });

    logger.debug('Session retrieved/created', {
      sessionId: finalSessionId,
      chatbotId: actualChatbotId,
      historyLength: finalHistory.length,
      service: 'sessionManager',
    });
  } else if (providedHistory) {
    // Use provided history (for in-memory sessions)
    finalHistory = providedHistory;
    logger.debug('Using in-memory session', {
      historyLength: finalHistory.length,
      service: 'sessionManager',
    });
  }

  const actualChatbotId = chatSession?.chatbotId || chatbotId;

  return {
    sessionId: finalSessionId || '',
    chatbotId: actualChatbotId,
    history: finalHistory,
    chatSession,
  };
}

/**
 * Save assistant message to database session
 */
export async function saveAssistantMessage(
  sessionId: string,
  content: string
): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      chatSessionId: sessionId,
      role: 'ASSISTANT',
      content,
    },
  });
}
