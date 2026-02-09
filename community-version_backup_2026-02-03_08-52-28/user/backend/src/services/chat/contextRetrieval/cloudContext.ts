import { BlockType } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { Source } from '../../contextRetrievalService';
import { logger } from '@shared/utils';

/**
 * Retrieve context from cloud storage (Google Drive, Nextcloud, etc.)
 */
export async function retrieveCloudContext(
  message: string,
  chatbotId: string
): Promise<{ context: string; sources: Source[] }> {
  let cloudContext = '';
  const cloudSources: Source[] = [];

  try {
    // Check if there are any Cloud blocks for this chatbot
    const cloudBlocks = await prisma.block.findMany({
      where: {
        chatbotId,
        type: BlockType.CONTEXT,
        subtype: 'Cloud',
      },
    });

    if (cloudBlocks.length > 0) {
      const { getCloudContextFromWeaviate } = await import('../../cloudContextRetrievalService');
      const cloudContextData = await getCloudContextFromWeaviate(message, chatbotId);
      cloudContext = cloudContextData.context;
      // Add sources - they should already be properly typed from getCloudContextFromWeaviate
      cloudSources.push(...(cloudContextData.sources as Source[]));

      logger.debug('Cloud context retrieved', {
        contextLength: cloudContext.length,
        sourceCount: cloudSources.length,
        service: 'cloudContext',
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Cloud context retrieval failed', error instanceof Error ? error : undefined, {
      error: errorMessage,
      service: 'cloudContext',
    });
    // Continue without cloud context
  }

  return { context: cloudContext, sources: cloudSources };
}
