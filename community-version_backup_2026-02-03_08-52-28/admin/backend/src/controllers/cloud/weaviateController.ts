import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';

const cloudLogger = logger.child({ service: 'admin-backend', component: 'cloud-controller' });

interface WeaviateStatus {
  connected: boolean;
  ready: boolean;
  schemas: string[];
  cloudFileContentExists: boolean;
  cloudFileContentReadOnly: boolean;
  error?: string;
}

/**
 * Check Weaviate status and diagnose read-only issues
 */
export async function handleWeaviateStatus(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const weaviateClient = require('../../weaviate').getWeaviateClient();
    if (!weaviateClient) {
      res.status(503).json({ error: 'Weaviate client not available' });
      return;
    }

    const status: WeaviateStatus = {
      connected: false,
      ready: false,
      schemas: [],
      cloudFileContentExists: false,
      cloudFileContentReadOnly: false,
    };

    try {
      // Check if Weaviate is ready
      const readyResponse = await weaviateClient.misc.readyChecker().do();
      status.ready = readyResponse === true || readyResponse?.ready === true;
      status.connected = true;

      // Get all schemas
      const schemas = await weaviateClient.schema.getter().do();
      status.schemas = schemas.classes?.map((c: { class?: string }) => c.class) || [];

      // Check CloudFileContent specifically
      const cloudSchema = schemas.classes?.find((c: { class?: string }) => c.class === 'CloudFileContent');
      status.cloudFileContentExists = !!cloudSchema;

      if (cloudSchema) {
        // Try to get a test object to check if it's read-only
        try {
          await weaviateClient.graphql
            .get()
            .withClassName('CloudFileContent')
            .withLimit(1)
            .do();
          status.cloudFileContentReadOnly = false;
        } catch (queryError: unknown) {
          const queryErrorMessage = queryError instanceof Error ? queryError.message : String(queryError);
          if (queryErrorMessage.includes('read-only') || queryErrorMessage.includes('store is read-only')) {
            status.cloudFileContentReadOnly = true;
          }
        }
      }
    } catch (error: unknown) {
      status.error = error instanceof Error ? error.message : 'Unknown error';
    }

    res.json(status);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check Weaviate status';
    cloudLogger.error('Error checking Weaviate status', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * Delete CloudFileContent schema (requires re-indexing)
 */
export async function handleDeleteCloudFileContentSchema(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const weaviateClient = require('../../weaviate').getWeaviateClient();
    if (!weaviateClient) {
      res.status(503).json({ error: 'Weaviate client not available' });
      return;
    }

    // Check if schema exists
    const schemas = await weaviateClient.schema.getter().do();
    const cloudSchema = schemas.classes?.find((c: { class?: string }) => c.class === 'CloudFileContent');

    if (!cloudSchema) {
      res.status(404).json({ error: 'CloudFileContent schema does not exist' });
      return;
    }

    // Delete the schema
    try {
      await weaviateClient.schema.classDeleter().withClassName('CloudFileContent').do();
      res.json({ 
        success: true, 
        message: 'CloudFileContent schema deleted. You will need to re-index cloud files.' 
      });
    } catch (deleteError: unknown) {
      const deleteErrorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
      if (deleteErrorMessage.includes('read-only') || deleteErrorMessage.includes('store is read-only')) {
        res.status(503).json({ 
          error: 'Weaviate is read-only. Cannot delete schema. Please fix Weaviate configuration first.',
          details: 'See WEAVIATE_READONLY_FIX.md for solutions'
        });
        return;
      }
      throw deleteError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete CloudFileContent schema';
    cloudLogger.error('Error deleting CloudFileContent schema', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}
