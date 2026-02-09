import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '@shared/utils';
import { config } from '../../../config';

const publicApiLogger = logger.child({ service: 'admin-backend', component: 'publicApi' });

// Initialize Weaviate client
const WEAVIATE_URL = config.WEAVIATE_URL;
let client: WeaviateClient | null = null;
if (config.NODE_ENV !== 'test') {
  client = weaviate.client({
    scheme: 'http',
    host: WEAVIATE_URL.replace('http://', '').replace('https://', ''),
  });
}

// Types
type Source = {
  type: 'website' | 'document';
  url?: string;
  title?: string;
  fileName?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
};

type WeaviateWebsiteContent = {
  url?: string;
  content?: string;
  title?: string;
  chatbotId?: string;
};

type WeaviateDocumentContent = {
  content?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
  fileName?: string;
  chatbotId?: string;
};

/**
 * Get context from Weaviate (simplified version)
 */
export async function getContextFromWeaviate(message: string, chatbotId: string): Promise<{ context: string; sources: Source[] }> {
  if (!client) {
    return { context: '', sources: [] };
  }

  try {
    // Get website content
    const websiteResponse = await client.graphql
      .get()
      .withClassName('WebsiteContent')
      .withFields('content url title chatbotId')
      .withBm25({ query: message })
      .withLimit(10)
      .do();

    // Get document content
    let documentResponse = { data: { Get: { DocumentContent: [] } } };
    try {
      documentResponse = await client.graphql
        .get()
        .withClassName('DocumentContent')
        .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId')
        .withBm25({ query: message })
        .withLimit(5)
        .do();
    } catch {
      // DocumentContent schema might not exist
    }

    const websiteContext = (websiteResponse.data.Get.WebsiteContent || [])
      .filter((item: WeaviateWebsiteContent) => item.chatbotId === chatbotId && item.content && item.content.length > 100)
      .slice(0, 10)
      .map((item: WeaviateWebsiteContent) => ({
        content: item.content || '',
        source: {
          type: 'website' as const,
          url: item.url,
          title: item.title || item.url || 'Website',
        },
      }));

    const documentContext = (documentResponse.data.Get.DocumentContent || [])
      .filter((item: WeaviateDocumentContent) => item.chatbotId === chatbotId && item.content && item.content.length > 100)
      .slice(0, 5)
      .map((item: WeaviateDocumentContent) => ({
        content: item.content || '',
        source: {
          type: 'document' as const,
          chunkIndex: item.chunkIndex,
          totalChunks: item.totalChunks,
          processedAt: item.processedAt,
          fileName: item.fileName || 'Document',
          title: item.fileName || 'Document',
        },
      }));

    const allContext = [...websiteContext, ...documentContext];

    if (allContext.length === 0) {
      return {
        context: 'No relevant context found. Answer based on your general knowledge.',
        sources: [],
      };
    }

    return {
      context: allContext.map((item) => item.content).join('\n\n'),
      sources: allContext.map((item) => item.source),
    };
  } catch (error) {
    publicApiLogger.error('Error retrieving context from Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    return { context: '', sources: [] };
  }
}
