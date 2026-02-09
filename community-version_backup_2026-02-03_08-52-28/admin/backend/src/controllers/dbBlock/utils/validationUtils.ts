import { BlockType } from '@prisma/client';
import prisma from '../../../lib/prisma';

/**
 * Verify chatbot ownership
 */
export async function verifyChatbotOwnership(
  chatbotId: string,
  adminUserId: string
): Promise<boolean> {
  const chatbot = await prisma.chatbot.findFirst({
    where: {
      id: chatbotId,
      ownerId: adminUserId,
    },
  });
  return !!chatbot;
}

/**
 * Verify DB block exists
 */
export async function verifyDbBlock(
  blockId: string,
  chatbotId: string
) {
  const block = await prisma.block.findFirst({
    where: {
      id: blockId,
      chatbotId: chatbotId,
      OR: [
        { type: BlockType.ACTION, subtype: 'DB' },
        { type: BlockType.CONTEXT, subtype: 'Database' },
      ],
    },
  });
  return block;
}
