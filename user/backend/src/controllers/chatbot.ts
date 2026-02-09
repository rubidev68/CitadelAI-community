
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

export const getChatbots = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const chatbotAccesses = await prisma.chatbotAccess.findMany({
      where: {
        userId: userId,
      },
      include: {
        chatbot: {
          include: {
            blocks: true,
            connections: true,
          },
        },
      },
    });

    const chatbots = chatbotAccesses.map((access) => access.chatbot);

    res.status(200).json({ chatbots, defaultChatbotId: user.defaultChatbotId });
  } catch (error) {
    logger.error('Error in chatbot controller', error instanceof Error ? error : undefined, {
      service: 'chatbot-controller',
    });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const setDefaultChatbot = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { chatbotId } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Verify the user has access to this chatbot
    const access = await prisma.chatbotAccess.findFirst({
      where: {
        userId: userId,
        chatbotId: chatbotId,
      },
    });

    if (!access) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        defaultChatbotId: chatbotId,
      },
    });

    res.status(200).json({ message: 'Default chatbot updated successfully' });
  } catch (error) {
    logger.error('Error in chatbot controller', error instanceof Error ? error : undefined, {
      service: 'chatbot-controller',
    });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getChatbotById = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const access = await prisma.chatbotAccess.findFirst({
      where: {
        userId: userId,
        chatbotId: id,
      },
    });

    if (!access) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const chatbot = await prisma.chatbot.findUnique({
      where: {
        id: id,
      },
      include: {
        blocks: true,
        connections: true,
      },
    });

    if (!chatbot) {
      return res.status(404).json({ message: 'Chatbot not found' });
    }

    res.status(200).json(chatbot);
  } catch (error) {
    logger.error('Error in chatbot controller', error instanceof Error ? error : undefined, {
      service: 'chatbot-controller',
    });
    res.status(500).json({ message: 'Internal server error' });
  }
};
