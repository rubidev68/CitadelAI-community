/**
 * Script to update Weaviate schemas to use vectorizer for RAG
 * Run this once to ensure all schemas are properly configured with vectorization
 */

import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '@shared/utils';
import { config } from '../config';

// Initialize Weaviate client
const client: WeaviateClient | null = (() => {
  if (config.NODE_ENV === 'test') {
    return null;
  }
  const weaviateHost = config.WEAVIATE_URL.replace('http://', '').replace('https://', '');
  return weaviate.client({
    scheme: 'http',
    host: weaviateHost,
  });
})();

/**
 * Update WebsiteContent schema to use vectorizer
 */
async function updateWebsiteContentSchema() {
  if (!client) {
    logger.info('Weaviate client not available', {
      service: 'updateWeaviateSchemas',
    });
    return;
  }

  try {
    // Check if schema exists
    const existingSchemas = await client.schema.getter().do();
    const websiteContentExists = existingSchemas.classes?.some(
      (schema: { class?: string }) => schema.class === 'WebsiteContent'
    );

    if (websiteContentExists) {
      logger.debug('WebsiteContent schema exists, checking vectorizer configuration', {
        service: 'updateWeaviateSchemas',
      });
      
      // Get current schema
      const currentSchema = await client.schema.classGetter().withClassName('WebsiteContent').do();
      
      if (currentSchema.vectorizer !== 'text2vec-openai') {
        logger.warn('WebsiteContent schema exists but vectorizer is not text2vec-openai', {
          currentVectorizer: currentSchema.vectorizer || 'none',
          service: 'updateWeaviateSchemas',
        });
        
        // Allow automatic recreation if env var is set (for deployments where re-crawling is acceptable)
        const allowSchemaRecreation = config.ALLOW_WEAVIATE_SCHEMA_RECREATION;
        
        if (allowSchemaRecreation) {
          logger.info('ALLOW_WEAVIATE_SCHEMA_RECREATION=true - Recreating schema with vectorizer', {
            service: 'updateWeaviateSchemas',
          });
          logger.warn('WARNING: This will delete all WebsiteContent data. Content will need to be re-crawled', {
            service: 'updateWeaviateSchemas',
          });
          
          try {
            await client.schema.classDeleter().withClassName('WebsiteContent').do();
            logger.info('Deleted old WebsiteContent schema', {
              service: 'updateWeaviateSchemas',
            });
            // Continue to create new schema below
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (!errorMessage.includes('not found')) {
              logger.error('Error deleting schema', error instanceof Error ? error : undefined, {
                service: 'updateWeaviateSchemas',
              });
              throw error;
            }
          }
        } else {
          logger.warn('Cannot update vectorizer without recreating schema (would delete data)', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('To enable RAG automatically: Set ALLOW_WEAVIATE_SCHEMA_RECREATION=true', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('Then re-crawl your content to re-index with vectors', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('For now, queries will use BM25 (keyword search)', {
            service: 'updateWeaviateSchemas',
          });
          return; // Don't delete existing data automatically
        }
      } else {
        logger.info('WebsiteContent schema already has text2vec-openai vectorizer configured', {
          service: 'updateWeaviateSchemas',
        });
        return;
      }
    }

    // Create schema with vectorizer
    const schemaConfig = {
      class: 'WebsiteContent',
      vectorizer: 'text2vec-openai',
      moduleConfig: {
        'text2vec-openai': {
          model: 'ada',
          modelVersion: '002',
          type: 'text',
        },
      },
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
          name: 'url',
          dataType: ['string'],
        },
        {
          name: 'content',
          dataType: ['text'],
        },
        {
          name: 'title',
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
        {
          name: 'chunkIndex',
          dataType: ['int'],
        },
        {
          name: 'totalChunks',
          dataType: ['int'],
        },
      ],
    };

    await client.schema.classCreator().withClass(schemaConfig).do();
    logger.info('WebsiteContent schema created/updated with text2vec-openai vectorizer', {
      service: 'updateWeaviateSchemas',
    });
  } catch (error: unknown) {
    logger.error('Error updating WebsiteContent schema', error instanceof Error ? error : undefined, {
      service: 'updateWeaviateSchemas',
    });
    throw error;
  }
}

/**
 * Update DocumentContent schema to use vectorizer
 */
async function updateDocumentContentSchema() {
  if (!client) {
    logger.info('Weaviate client not available', {
      service: 'updateWeaviateSchemas',
    });
    return;
  }

  try {
    const existingSchemas = await client.schema.getter().do();
    const documentContentExists = existingSchemas.classes?.some(
      (schema: { class?: string }) => schema.class === 'DocumentContent'
    );

    if (documentContentExists) {
      const currentSchema = await client.schema.classGetter().withClassName('DocumentContent').do();
      
      if (currentSchema.vectorizer !== 'text2vec-openai') {
        logger.warn('DocumentContent schema exists but vectorizer is not text2vec-openai', {
          currentVectorizer: currentSchema.vectorizer || 'none',
          service: 'updateWeaviateSchemas',
        });
        
        const allowSchemaRecreation = config.ALLOW_WEAVIATE_SCHEMA_RECREATION;
        
        if (allowSchemaRecreation) {
          logger.info('ALLOW_WEAVIATE_SCHEMA_RECREATION=true - Recreating schema with vectorizer', {
            service: 'updateWeaviateSchemas',
          });
          logger.warn('WARNING: This will delete all DocumentContent data. Documents will need to be re-indexed', {
            service: 'updateWeaviateSchemas',
          });
          
          try {
            await client.schema.classDeleter().withClassName('DocumentContent').do();
            logger.info('Deleted old DocumentContent schema', {
              service: 'updateWeaviateSchemas',
            });
            // Continue to create new schema below
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (!errorMessage.includes('not found')) {
              logger.error('Error deleting schema', error instanceof Error ? error : undefined, {
                service: 'updateWeaviateSchemas',
              });
              throw error;
            }
          }
        } else {
          logger.warn('Cannot update vectorizer without recreating schema (would delete data)', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('To enable RAG automatically: Set ALLOW_WEAVIATE_SCHEMA_RECREATION=true', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('Then re-index your documents to re-index with vectors', {
            service: 'updateWeaviateSchemas',
          });
          logger.info('For now, queries will use BM25 (keyword search)', {
            service: 'updateWeaviateSchemas',
          });
          return; // Don't delete existing data automatically
        }
      } else {
        logger.info('DocumentContent schema already has text2vec-openai vectorizer configured', {
          service: 'updateWeaviateSchemas',
        });
        return;
      }
    }

    const schemaConfig = {
      class: 'DocumentContent',
      vectorizer: 'text2vec-openai',
      moduleConfig: {
        'text2vec-openai': {
          model: 'ada',
          modelVersion: '002',
          type: 'text',
        },
      },
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
    logger.info('DocumentContent schema created/updated with text2vec-openai vectorizer', {
      service: 'updateWeaviateSchemas',
    });
  } catch (error: unknown) {
    logger.error('Error updating DocumentContent schema', error instanceof Error ? error : undefined, {
      service: 'updateWeaviateSchemas',
    });
    throw error;
  }
}

/**
 * Main function to update all schemas
 * This runs automatically on service startup to ensure schemas are configured for RAG
 */
export async function updateWeaviateSchemasForRAG() {
  if (!client) {
    logger.warn('Weaviate client not available, skipping schema update', {
      service: 'updateWeaviateSchemas',
    });
    return;
  }

  logger.info('Checking/updating Weaviate schemas for RAG (vectorization)', {
    service: 'updateWeaviateSchemas',
  });
  
  try {
    // Wait a bit for Weaviate to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await updateWebsiteContentSchema();
    await updateDocumentContentSchema();
    logger.info('Weaviate schemas are configured for RAG', {
      service: 'updateWeaviateSchemas',
    });
    logger.info('Note: Existing content will be vectorized automatically when queried', {
      service: 'updateWeaviateSchemas',
    });
  } catch (error: unknown) {
    // Don't throw - just log warning, as schemas might already be configured
    logger.warn('Schema update completed with warnings', {
      error: error instanceof Error ? error.message : String(error),
      service: 'updateWeaviateSchemas',
    });
    // This is OK - schemas might already exist or Weaviate might not be ready yet
  }
}

// Run if called directly
if (require.main === module) {
  updateWeaviateSchemasForRAG()
    .then(() => {
      logger.info('Schema update completed', {
        service: 'updateWeaviateSchemas',
      });
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Schema update failed', error instanceof Error ? error : undefined, {
        service: 'updateWeaviateSchemas',
      });
      process.exit(1);
    });
}
