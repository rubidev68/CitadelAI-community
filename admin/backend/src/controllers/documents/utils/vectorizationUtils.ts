import { logger } from '@shared/utils';
import { Chunk } from '@shared/services';
import { getWeaviateClient } from './weaviateUtils';

const documentsLogger = logger.child({ service: 'admin-backend', component: 'documents-controller' });

type VectorizedChunk = {
  content: string;
  metadata: Record<string, unknown>;
};

/**
 * Vectorize content using provided semantic chunks
 */
export async function vectorizeContent(
  semanticChunks: Chunk[], 
  chatbotId: string, 
  blockId: string, 
  fileName: string,
  summary?: string
): Promise<VectorizedChunk[]> {
  try {
    // Check if we have anything to process
    if (semanticChunks.length === 0 && !summary) {
      return [];
    }
    
    const client = getWeaviateClient();
    const vectors = [];

    // Add summary chunk if provided
    if (summary) {
      try {
        const result = await client.data
          .creator()
          .withClassName('DocumentContent')
          .withProperties({
            content: `Summary: ${summary}`,
            chatbotId,
            blockId,
            type: 'document',
            chunkIndex: -1, // Special index for summary
            totalChunks: semanticChunks.length,
            processedAt: new Date().toISOString(),
            fileName: fileName || 'Unknown Document',
            chunkType: 'summary',
            wordCount: summary.split(/\s+/).length,
            charCount: summary.length,
          })
          .do();

        vectors.push({
          content: summary,
          metadata: {
            id: result.id,
            chunkIndex: -1,
            totalChunks: semanticChunks.length,
            chunkType: 'summary',
          },
        });
      } catch (summaryError) {
         documentsLogger.error('Error vectorizing summary chunk', { error: summaryError instanceof Error ? summaryError : new Error(String(summaryError)) });
      }
    }
    
    for (const semanticChunk of semanticChunks) {
      // Skip empty chunks
      if (!semanticChunk.content.trim()) {
        continue;
      }
      
      try {
        // Store in Weaviate with auto-vectorization
        const result = await client.data
          .creator()
          .withClassName('DocumentContent')
          .withProperties({
            content: semanticChunk.content,
            chatbotId,
            blockId,
            type: 'document',
            chunkIndex: semanticChunk.metadata.chunkIndex,
            totalChunks: semanticChunk.metadata.totalChunks,
            processedAt: new Date().toISOString(),
            fileName: fileName || 'Unknown Document',
            // Additional semantic metadata
            chunkType: semanticChunk.metadata.chunkType,
            parentHeading: semanticChunk.metadata.parentHeading,
            wordCount: semanticChunk.metadata.wordCount,
            charCount: semanticChunk.metadata.charCount,
            semanticScore: semanticChunk.metadata.semanticScore,
          })
          .do();
        
        vectors.push({
          content: semanticChunk.content,
          metadata: {
            id: result.id,
            chunkIndex: semanticChunk.metadata.chunkIndex,
            totalChunks: semanticChunk.metadata.totalChunks,
            chunkType: semanticChunk.metadata.chunkType,
            parentHeading: semanticChunk.metadata.parentHeading,
            wordCount: semanticChunk.metadata.wordCount,
            charCount: semanticChunk.metadata.charCount,
          },
        });
      } catch (chunkError) {
        documentsLogger.error('Error vectorizing semantic chunk', { chunkIndex: semanticChunk.metadata.chunkIndex, error: chunkError instanceof Error ? chunkError : new Error(String(chunkError)) });
        // Continue with other chunks even if one fails
      }
    }
    
    documentsLogger.info('Successfully vectorized semantic chunks for document', { fileName, chunksCount: vectors.length });
    return vectors;
  } catch (error) {
    documentsLogger.error('Error vectorizing content', { error: error instanceof Error ? error : new Error(String(error)) });
    return [];
  }
}

