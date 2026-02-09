import { logger } from '@shared/utils';
import { SemanticChunkingService } from '../../../services/semantic-chunking';
import { getWeaviateClient } from './weaviateUtils';
import { splitIntoChunks } from './textUtils';

const documentsLogger = logger.child({ service: 'admin-backend', component: 'documents-controller' });

type VectorizedChunk = {
  content: string;
  metadata: Record<string, unknown>;
};

/**
 * Vectorize content using semantic chunking
 */
export async function vectorizeContent(content: string, chatbotId: string, blockId: string, fileName?: string): Promise<VectorizedChunk[]> {
  try {
    // Check if content is empty
    if (!content.trim()) {
      return [];
    }
    
    const client = getWeaviateClient();
    
    // Use semantic chunking for better content organization
    const semanticChunking = new SemanticChunkingService();
    const chunkingOptions = SemanticChunkingService.getDefaultOptions('document');
    const semanticChunks = await semanticChunking.chunkContent(content, chunkingOptions);
    
    // Check if we have any chunks to process
    if (semanticChunks.length === 0) {
      return [];
    }
    
    const vectors = [];
    
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
    documentsLogger.error('Error vectorizing content with semantic chunking', { error: error instanceof Error ? error : new Error(String(error)) });
    // Fallback to simple chunking if semantic chunking fails
    return await vectorizeContentFallback(content, chatbotId, blockId, fileName);
  }
}

/**
 * Fallback function using simple chunking
 */
async function vectorizeContentFallback(content: string, chatbotId: string, blockId: string, fileName?: string): Promise<VectorizedChunk[]> {
  try {
    const client = getWeaviateClient();
    
    // Split content into chunks (max 1000 characters per chunk)
    const chunks = splitIntoChunks(content, 1000);
    const vectors = [];
    
    // Check if we have any chunks to process
    if (chunks.length === 0) {
      return [];
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Skip empty chunks
      if (!chunk.trim()) {
        continue;
      }
      
      try {
        // Store in Weaviate with auto-vectorization
        const result = await client.data
          .creator()
          .withClassName('DocumentContent')
          .withProperties({
            content: chunk,
            chatbotId,
            blockId,
            type: 'document',
            chunkIndex: i,
            totalChunks: chunks.length,
            processedAt: new Date().toISOString(),
            fileName: fileName || 'Unknown Document',
          })
          .do();
        
        vectors.push({
          content: chunk,
          metadata: {
            id: result.id,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
        });
      } catch (chunkError) {
        documentsLogger.error('Error vectorizing chunk', { chunkIndex: i, error: chunkError instanceof Error ? chunkError : new Error(String(chunkError)) });
        // Continue with other chunks even if one fails
      }
    }
    
    documentsLogger.info('Fallback: Successfully vectorized simple chunks for document', { fileName, chunksCount: vectors.length });
    return vectors;
  } catch (error) {
    documentsLogger.error('Error in fallback vectorization', { error: error instanceof Error ? error : new Error(String(error)) });
    return [];
  }
}
