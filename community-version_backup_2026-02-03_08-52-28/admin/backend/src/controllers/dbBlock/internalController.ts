import { Request, Response } from 'express';
import { BlockType } from '@prisma/client';
import { logger } from '@shared/utils';
import { executeDbBlock, shouldExecuteDbBlock } from '../../services/dbBlockExecutionService';
import prisma from '../../lib/prisma';

const dbBlockLogger = logger.child({ service: 'admin-backend', component: 'dbBlock-controller' });

/**
 * Execute DB blocks for chatbot (internal API for user backend)
 */
export async function handleExecuteDbBlocks(req: Request, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    const { message, sessionData } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get LLM provider/model from system prompt block (for query generation)
    const systemPromptBlock = await prisma.block.findFirst({
      where: {
        chatbotId: chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
      },
    });

    const blockProperties = systemPromptBlock?.properties as { llmProvider?: string; llmModel?: string } | undefined;
    const llmProvider = (blockProperties?.llmProvider || 'gemini') as 'gemini' | 'openai' | 'anthropic' | 'mistral';
    const llmModel = blockProperties?.llmModel;

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

    interface DBBlockResult {
      blockId: string;
      data: string;
      metadata: Record<string, unknown>;
    }
    const results: DBBlockResult[] = [];

    // Execute each DB block that should be executed
    for (const dbBlock of dbBlocks) {
      if (shouldExecuteDbBlock(dbBlock, message, sessionData || {})) {
        try {
          // Note: llmService is optional - can be passed if needed for LLM-based parameter extraction
          const result = await executeDbBlock(
            dbBlock,
            message,
            sessionData || {},
            undefined, // llmService - can be passed if needed
            llmProvider,
            llmModel
          );

          results.push({
            blockId: dbBlock.id,
            data: result.data,
            metadata: result.metadata,
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          dbBlockLogger.error('DB Block execution failed', { blockId: dbBlock.id, error: error instanceof Error ? error : new Error(String(error)) });
          // Continue with other blocks even if one fails
        }
      }
    }

    res.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbBlockLogger.error('DB Block execution error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'DB Block execution failed',
    });
  }
}
