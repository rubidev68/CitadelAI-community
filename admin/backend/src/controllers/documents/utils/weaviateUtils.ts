import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '@shared/utils';

const documentsLogger = logger.child({ service: 'admin-backend', component: 'documents-controller' });

// Weaviate client
let weaviateClient: WeaviateClient;

export function getWeaviateClient(): WeaviateClient {
  if (weaviateClient) {
    return weaviateClient;
  }
  
  try {
    const apiKey = process.env.WEAVIATE_API_KEY || '';
    weaviateClient = weaviate.client({
      scheme: 'http',
      host: 'weaviate:8080',
      apiKey: apiKey ? new weaviate.ApiKey(apiKey) : undefined,
    });
    return weaviateClient;
  } catch (error) {
    documentsLogger.error('Failed to connect to Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    throw new Error('Could not connect to Weaviate.');
  }
}

/**
 * Create DocumentContent schema if it doesn't exist
 */
export async function ensureDocumentContentSchema(): Promise<void> {
  try {
    const client = getWeaviateClient();
    
    // Check if schema already exists
    const existingSchemas = await client.schema.getter().do();
    const documentContentExists = existingSchemas.classes?.some(
      (schema: { class?: string }) => schema.class === 'DocumentContent'
    );
    
    if (documentContentExists) {
      return;
    }
    
    // Create the schema
    const schemaConfig = {
      class: 'DocumentContent',
      vectorizer: 'text2vec-transformers',
      properties: [
        {
          name: 'chatbotId',
          dataType: ['string'],
        },
        {
          name: 'blockId',
          dataType: ['string'],
        },
        {
          name: 'content',
          dataType: ['text'],
        },
        {
          name: 'type',
          dataType: ['string'],
        },
        {
          name: 'chunkIndex',
          dataType: ['int'],
        },
        {
          name: 'totalChunks',
          dataType: ['int'],
        },
        {
          name: 'processedAt',
          dataType: ['date'],
        },
        {
          name: 'fileName',
          dataType: ['string'],
        },
        {
          name: 'chunkType',
          dataType: ['string'],
        },
        {
          name: 'parentHeading',
          dataType: ['string'],
        },
        {
          name: 'wordCount',
          dataType: ['int'],
        },
        {
          name: 'charCount',
          dataType: ['int'],
        },
        {
          name: 'semanticScore',
          dataType: ['number'],
        },
      ],
    };
    
    await client.schema.classCreator().withClass(schemaConfig).do();
    documentsLogger.info('DocumentContent schema created successfully');
  } catch (error) {
    documentsLogger.error('Error creating DocumentContent schema', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}
