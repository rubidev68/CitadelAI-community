import prisma from '../../../lib/prisma';
import { executeDbBlocksForChatbot } from '../../dbBlockHelper';
import { Source } from '../../contextRetrievalService';
import { logger } from '@shared/utils';
import type { DbBlockResult } from '../types';

/**
 * Retrieve context from database blocks
 */
export async function retrieveDbContext(
  message: string,
  chatbotId: string,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral',
  llmModel: string
): Promise<{ context: string; sources: Source[] }> {
  let dbContext = '';
  const dbSources: Source[] = [];

  try {
    const dbBlockResults = await executeDbBlocksForChatbot(
      chatbotId,
      message,
      {},
      llmProvider,
      llmModel
    );

    if (dbBlockResults && Array.isArray(dbBlockResults)) {
      dbContext = dbBlockResults
        .map((result: DbBlockResult) => result.data || '')
        .filter((data: string) => data.length > 0)
        .join('\n\n');

      // Create sources for DB blocks
      for (const result of dbBlockResults) {
        if (result.blockId && result.data) {
          // Get block title for source name
          const dbBlock = await prisma.block.findUnique({
            where: { id: result.blockId },
            select: { title: true, properties: true },
          });

          const blockTitle = dbBlock?.title || 'Database';
          const properties = dbBlock?.properties as { fileName?: string; database?: string } | undefined;
          const dbName = properties?.fileName || properties?.database || 'Database';

          dbSources.push({
            type: 'database',
            title: `${blockTitle} (${dbName})`,
            blockId: result.blockId,
          });
        }
      }

      logger.debug('DB Block context retrieved', {
        contextLength: dbContext.length,
        sourceCount: dbSources.length,
        service: 'dbContext',
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('DB Block execution failed', {
      error: errorMessage,
      service: 'dbContext',
    });
  }

  return { context: dbContext, sources: dbSources };
}
