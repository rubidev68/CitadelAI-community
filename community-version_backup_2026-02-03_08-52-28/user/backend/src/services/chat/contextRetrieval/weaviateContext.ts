import { getContextFromWeaviate, Source } from '../../contextRetrievalService';
import { logger } from '@shared/utils';

/**
 * Retrieve context from Weaviate vector store
 */
export async function retrieveWeaviateContext(
  message: string,
  chatbotId: string
): Promise<{ context: string; sources: Source[] }> {
  try {
    const contextData = await getContextFromWeaviate(message, chatbotId);
    logger.debug('Weaviate context retrieved', {
      contextLength: contextData.context.length,
      sourceCount: contextData.sources.length,
      service: 'weaviateContext',
    });
    return contextData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Weaviate context retrieval failed', error instanceof Error ? error : undefined, {
      error: errorMessage,
      service: 'weaviateContext',
    });
    // Return empty context on error
    return { context: '', sources: [] };
  }
}
