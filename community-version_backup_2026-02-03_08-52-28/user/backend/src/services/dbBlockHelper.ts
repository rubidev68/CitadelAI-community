/**
 * DB Block Helper Service
 * Executes DB blocks during chatbot conversations (moved from admin-backend)
 */

import { Block, BlockType } from '@prisma/client';
import { executeDbBlock, shouldExecuteDbBlock } from './dbBlockExecutionService';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

/**
 * Execute all DB blocks for a chatbot
 */
export async function executeDbBlocksForChatbot(
  chatbotId: string,
  userMessage: string,
  sessionData: Record<string, unknown> = {},
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<Array<{ blockId: string; data: string; metadata: Record<string, unknown> }>> {
  // Get LLM provider/model from system prompt block (for query generation)
  const systemPromptBlock = await prisma.block.findFirst({
    where: {
      chatbotId: chatbotId,
      type: BlockType.LOGIC,
      subtype: 'System Prompt',
    },
  });

  const blockProperties = systemPromptBlock?.properties as { llmProvider?: string; llmModel?: string } | undefined;
  const provider = (blockProperties?.llmProvider || llmProvider || 'gemini') as 'gemini' | 'openai' | 'anthropic' | 'mistral';
  const model = blockProperties?.llmModel || llmModel;

  // Get all DB blocks for this chatbot (both ACTION 'DB' and CONTEXT 'Database')
  const dbBlocks = await prisma.block.findMany({
    where: {
      chatbotId: chatbotId,
      OR: [
        { type: BlockType.ACTION, subtype: 'DB' },
        { type: BlockType.CONTEXT, subtype: 'Database' },
      ],
    },
  });

  const results: Array<{ blockId: string; data: string; metadata: Record<string, unknown> }> = [];

  // Execute each DB block that should be executed
  for (const dbBlock of dbBlocks) {
    const shouldExecute = shouldExecuteDbBlock(dbBlock, userMessage, sessionData || {});
    
    if (shouldExecute) {
      try {
        const result = await executeDbBlock(
          dbBlock,
          userMessage,
          sessionData || {},
          undefined, // llmService - can be passed if needed
          provider,
          model
        );

        results.push({
          blockId: dbBlock.id,
          data: result.data,
          metadata: result.metadata,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error('DB Block execution failed', error instanceof Error ? error : undefined, {
          blockId: dbBlock.id,
          service: 'dbBlockHelper',
        });
        // Continue with other blocks even if one fails
      }
    }
  }

  return results;
}
