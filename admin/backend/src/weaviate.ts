import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import type { WeaviateWhereFilter } from '@shared/types';
import { logger } from '@shared/utils';

const weaviateLogger = logger.child({ service: 'admin-backend', component: 'weaviate' });

let client: WeaviateClient;

export function getWeaviateClient(): WeaviateClient {
  if (client) {
    return client;
  }
  
  try {
    const apiKey = process.env.WEAVIATE_API_KEY || '';
    client = weaviate.client({
      scheme: 'http',
      host: 'weaviate:8080',
      apiKey: apiKey ? new weaviate.ApiKey(apiKey) : undefined,
    });
    return client;
  } catch (error) {
    weaviateLogger.error('Failed to connect to Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    throw new Error('Could not connect to Weaviate.');
  }
}

type WeaviatePage = {
  url?: string;
  content?: string;
  title?: string;
  chatbotId?: string;
  blockId?: string;
};

export const getCrawledPages = async (chatbotId: string, blockId: string): Promise<WeaviatePage[]> => {
  try {
    const weaviateClient = getWeaviateClient();
    
    const whereFilter: WeaviateWhereFilter = {
      operator: 'And',
      operands: [
        {
          operator: 'Equal',
          path: ['chatbotId'],
          valueString: chatbotId,
        },
        {
          operator: 'Equal',
          path: ['blockId'],
          valueString: blockId,
        }
      ]
    };

    // Query WebsiteContent
    const websiteResponse = await weaviateClient.graphql
      .get()
      .withClassName('WebsiteContent')
      .withWhere(whereFilter)
      .withFields('url content title chatbotId blockId')
      .withLimit(1000)
      .do();

    const pages = websiteResponse.data.Get.WebsiteContent || [];
    return pages;
  } catch (error) {
    weaviateLogger.error('Error fetching crawled pages from Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
};

export type CloudFile = {
  chatbotId?: string;
  blockId?: string;
  provider?: string;
  fileId?: string;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  mimeType?: string;
  fileSize?: number;
  modifiedAt?: string;
  summary?: string;
  content?: string;
};

export const getCloudFiles = async (chatbotId: string, blockId: string): Promise<CloudFile[]> => {
  try {
    const weaviateClient = getWeaviateClient();
    
    const whereFilter: WeaviateWhereFilter = {
      operator: 'And',
      operands: [
        {
          operator: 'Equal',
          path: ['chatbotId'],
          valueString: chatbotId,
        },
        {
          operator: 'Equal',
          path: ['blockId'],
          valueString: blockId,
        }
      ]
    };

    // Query CloudFileContent
    // Check if schema exists first to avoid error
    try {
      const response = await weaviateClient.graphql
        .get()
        .withClassName('CloudFileContent')
        .withWhere(whereFilter)
        .withFields('fileName filePath fileType mimeType fileSize modifiedAt summary content chatbotId blockId provider fileId')
        .withLimit(1000)
        .do();
        
      return response.data.Get.CloudFileContent || [];
    } catch (queryError) {
      const errorMessage = queryError instanceof Error ? queryError.message : String(queryError);
      // If class doesn't exist, return empty array instead of throwing
      if (errorMessage.includes('cannot query class') || errorMessage.includes('not found')) {
        return [];
      }
      throw queryError;
    }
  } catch (error) {
    weaviateLogger.error('Error fetching cloud files from Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
};

export const deleteWeaviateData = async (chatbotId: string, blockId?: string): Promise<void> => {
  try {
    const weaviateClient = getWeaviateClient();
    
    const whereFilter: WeaviateWhereFilter = {
      operator: 'And',
      operands: [
        {
          operator: 'Equal',
          path: ['chatbotId'],
          valueString: chatbotId,
        }
      ]
    };

    if (blockId) {
      whereFilter.operands!.push({
        operator: 'Equal',
        path: ['blockId'],
        valueString: blockId,
      });
    }

    // Delete WebsiteContent
    const websiteResponse = await weaviateClient.graphql
      .get()
      .withClassName('WebsiteContent')
      .withWhere(whereFilter)
      .withFields('_additional { id }')
      .do();

    const websiteObjectsToDelete = websiteResponse.data.Get.WebsiteContent || [];

    // Delete DocumentContent (if class exists). If the class is missing, ignore gracefully.
    let documentObjectsToDelete: Array<{ _additional?: { id?: string } }> = [];
    try {
      const documentResponse = await weaviateClient.graphql
        .get()
        .withClassName('DocumentContent')
        .withWhere(whereFilter)
        .withFields('_additional { id }')
        .do();
      documentObjectsToDelete = documentResponse.data.Get.DocumentContent || [];
    } catch (docError: unknown) {
      const errorMessage = docError instanceof Error ? docError.message : String(docError);
      weaviateLogger.warn('Error querying DocumentContent', { error: docError instanceof Error ? docError : new Error(String(docError)) });
      documentObjectsToDelete = [];
    }

    const totalObjectsToDelete = websiteObjectsToDelete.length + documentObjectsToDelete.length;

    if (totalObjectsToDelete === 0) {
      weaviateLogger.debug('No Weaviate data to delete', { chatbotId, blockId });
      return;
    }

    // Delete website content objects
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const obj of websiteObjectsToDelete) {
      try {
        await weaviateClient.data
          .deleter()
          .withClassName('WebsiteContent')
          .withId(obj._additional?.id || '')
          .do();
        deletedCount++;
      } catch (deleteError: unknown) {
        failedCount++;
        const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
        // Check if it's a read-only error
        if (errorMessage.includes('read-only') || errorMessage.includes('read only')) {
          weaviateLogger.warn('Weaviate shard is read-only, cannot delete object', { objectId: obj._additional?.id });
        } else {
          weaviateLogger.warn('Failed to delete WebsiteContent object', { objectId: obj._additional?.id, error: deleteError instanceof Error ? deleteError : new Error(String(deleteError)) });
        }
      }
    }

    // Delete document content objects
    for (const obj of documentObjectsToDelete) {
      try {
        await weaviateClient.data
          .deleter()
          .withClassName('DocumentContent')
          .withId(obj._additional?.id || '')
          .do();
        deletedCount++;
      } catch (deleteError: unknown) {
        failedCount++;
        const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
        // Check if it's a read-only error
        if (errorMessage.includes('read-only') || errorMessage.includes('read only')) {
          weaviateLogger.warn('Weaviate shard is read-only, cannot delete object', { objectId: obj._additional?.id });
        } else {
          weaviateLogger.warn('Failed to delete DocumentContent object', { objectId: obj._additional?.id, error: deleteError instanceof Error ? deleteError : new Error(String(deleteError)) });
        }
      }
    }

    if (deletedCount > 0) {
      weaviateLogger.info('Deleted objects from Weaviate', { chatbotId, blockId, deletedCount });
    }
    
    if (failedCount > 0) {
      weaviateLogger.warn('Failed to delete objects from Weaviate', { chatbotId, blockId, failedCount });
      // Don't throw error if some deletions failed - this allows block deletion to continue
      // The objects will remain orphaned in Weaviate but won't block the deletion flow
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Check if it's a read-only error
    if (errorMessage.includes('read-only') || errorMessage.includes('read only')) {
      weaviateLogger.error('Weaviate is in read-only mode. Cannot delete data', { error: error instanceof Error ? error : new Error(String(error)) });
      // Don't throw - allow block deletion to continue even if Weaviate is read-only
      return;
    }
    weaviateLogger.error('Error executing Weaviate deletion', { error: error instanceof Error ? error : new Error(String(error)) });
    // For other errors, still don't throw to allow block deletion to proceed
    // The Weaviate data will remain but won't block the deletion flow
  }
};