import { Response } from 'express';
import { BlockType, Prisma } from '@prisma/client';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { testConnection, dbFileStorageService, discoverSchema } from '@shared/services';
import { DbConnectionConfig } from '@shared/types';
import { verifyChatbotOwnership, verifyDbBlock } from './utils/validationUtils';
import prisma from '../../lib/prisma';

const dbBlockLogger = logger.child({ service: 'admin-backend', component: 'dbBlock-controller' });

/**
 * Upload database file
 */
export async function handleUploadDbFile(req: AdminAuthRequest & { file?: Express.Multer.File }, res: Response): Promise<void> {
  try {
    const { chatbotId, blockId } = req.params;
    const adminUserId = req.adminUser?.id;

    if (!adminUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Verify chatbot ownership
    if (!(await verifyChatbotOwnership(chatbotId, adminUserId))) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found' });
      }
      return;
    }

    // Verify block exists
    const block = await verifyDbBlock(blockId, chatbotId);
    if (!block) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'DB block not found' });
      }
      return;
    }

    // Delete existing file if any
    const blockProperties = block.properties as Record<string, unknown>;
    if (blockProperties.fileId) {
      try {
        await dbFileStorageService.deleteFile(chatbotId, blockId, blockProperties.fileId as string);
      } catch (error) {
        // Ignore errors when deleting old file
        dbBlockLogger.warn('Failed to delete old file', { error: error instanceof Error ? error : new Error(String(error)) });
      }
    }

    // Store file
    const storedFile = await dbFileStorageService.storeFile(req.file, chatbotId, blockId);

    // Auto-discover schema after file upload
    let discoveredSchema = null;
    let exampleQueries = null;
    try {
      const schema = await discoverSchema({
        connectionMode: 'file',
        dbType: 'sqlite',
        fileId: storedFile.fileId,
        chatbotId: chatbotId,
        blockId: blockId,
      });
      discoveredSchema = schema;

      // Generate example queries
      try {
        const { generateExampleQueries } = await import('../../services/dbExampleQueryGenerator');
        const systemPromptBlock = await prisma.block.findFirst({
          where: {
            chatbotId: chatbotId,
            type: BlockType.LOGIC,
            subtype: 'System Prompt',
          },
        });
        const systemBlockProperties = systemPromptBlock?.properties as { llmProvider?: string; llmModel?: string } | undefined;
        const llmProvider = (systemBlockProperties?.llmProvider || 'gemini') as 'gemini' | 'openai' | 'anthropic' | 'mistral';
        const llmModel = systemBlockProperties?.llmModel;
        
        exampleQueries = await generateExampleQueries(schema, 5, llmProvider, llmModel);
      } catch (error) {
        dbBlockLogger.error('Failed to generate example queries', { error: error instanceof Error ? error : new Error(String(error)) });
        // Continue without example queries
      }
    } catch (error) {
      dbBlockLogger.error('Failed to auto-discover schema', { error: error instanceof Error ? error : new Error(String(error)) });
      // Continue without schema discovery
    }

    // Update block properties
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...blockProperties,
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: storedFile.fileId,
          fileName: storedFile.originalFileName,
          fileSize: storedFile.fileSize,
          uploadedAt: storedFile.uploadedAt.toISOString(),
          lastTestStatus: 'success',
          lastTestedAt: new Date().toISOString(),
          ...(discoveredSchema && {
            schema: discoveredSchema,
            schemaDiscoveredAt: discoveredSchema.discoveredAt,
          }),
          ...(exampleQueries && {
            exampleQueries: exampleQueries,
          }),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    res.json({
      success: true,
      fileId: storedFile.fileId,
      fileName: storedFile.originalFileName,
      fileSize: storedFile.fileSize,
      uploadedAt: storedFile.uploadedAt.toISOString(),
      schema: discoveredSchema,
      exampleQueries: exampleQueries,
      tablesCount: discoveredSchema?.tables?.length || 0,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbBlockLogger.error('File upload error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'File upload failed',
    });
  }
}

/**
 * Test file-based database connection
 */
export async function handleTestFileConnection(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    if (res.headersSent) {
      return;
    }
    
    const { chatbotId, blockId } = req.params;
    const adminUserId = req.adminUser?.id;

    if (!adminUserId) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Unauthorized' });
      }
      return;
    }

    // Verify chatbot ownership
    if (!(await verifyChatbotOwnership(chatbotId, adminUserId))) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found' });
      }
      return;
    }

    // Verify block exists
    const block = await verifyDbBlock(blockId, chatbotId);
    if (!block) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'DB block not found' });
      }
      return;
    }

    const blockProperties = block.properties as Record<string, unknown>;
    const fileId = blockProperties.fileId as string | undefined;

    if (!fileId) {
      if (!res.headersSent) {
        res.status(400).json({ error: 'No database file uploaded for this block' });
      }
      return;
    }

    // Get file path
    const filePath = await dbFileStorageService.getFilePath(chatbotId, blockId, fileId);

    // Test connection
    const config: DbConnectionConfig = {
      dbType: 'sqlite',
      connectionMode: 'file',
      filePath,
    };

    const result = await testConnection(config);

    // Update block with test status
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...blockProperties,
          lastTestedAt: new Date().toISOString(),
          lastTestStatus: result.success ? 'success' : 'failed',
          lastTestError: result.error,
        },
      },
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Connection successful',
        testedAt: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Connection test failed',
        testedAt: new Date().toISOString(),
      });
    }
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    if (!res.headersSent && !res.writableEnded) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dbBlockLogger.error('File connection test error', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    }
  }
}

/**
 * Get database file info
 */
export async function handleGetDbFile(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    if (res.headersSent) {
      return;
    }
    
    const { chatbotId, blockId } = req.params;
    const adminUserId = req.adminUser?.id;

    if (!adminUserId) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Unauthorized' });
      }
      return;
    }

    // Verify chatbot ownership
    if (!(await verifyChatbotOwnership(chatbotId, adminUserId))) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found' });
      }
      return;
    }

    // Verify block exists
    const block = await verifyDbBlock(blockId, chatbotId);
    if (!block) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'DB block not found' });
      }
      return;
    }

    const blockProperties = block.properties as Record<string, unknown>;
    const fileId = blockProperties.fileId as string | undefined;

    if (!fileId) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'No database file uploaded for this block' });
      }
      return;
    }

    // Get file info
    const fileInfo = await dbFileStorageService.getFileInfo(chatbotId, blockId, fileId);

    res.json({
      fileId: fileInfo.fileId,
      fileName: blockProperties.fileName || fileInfo.originalFileName,
      fileSize: fileInfo.fileSize,
      uploadedAt: fileInfo.uploadedAt.toISOString(),
      lastAccessedAt: fileInfo.lastAccessedAt?.toISOString(),
    });
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    if (!res.headersSent && !res.writableEnded) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get file info';
      dbBlockLogger.error('Get file info error', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(500).json({
        error: errorMessage,
      });
    }
  }
}

/**
 * Delete database file
 */
export async function handleDeleteDbFile(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    if (res.headersSent) {
      return;
    }
    
    const { chatbotId, blockId } = req.params;
    const adminUserId = req.adminUser?.id;

    if (!adminUserId) {
      if (!res.headersSent) {
        res.status(401).json({ error: 'Unauthorized' });
      }
      return;
    }

    // Verify chatbot ownership
    if (!(await verifyChatbotOwnership(chatbotId, adminUserId))) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found' });
      }
      return;
    }

    // Verify block exists
    const block = await verifyDbBlock(blockId, chatbotId);
    if (!block) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'DB block not found' });
      }
      return;
    }

    const blockProperties = block.properties as Record<string, unknown>;
    const fileId = blockProperties.fileId as string | undefined;

    if (!fileId) {
      if (!res.headersSent) {
        res.status(404).json({ error: 'No database file uploaded for this block' });
      }
      return;
    }

    // Delete file
    await dbFileStorageService.deleteFile(chatbotId, blockId, fileId);

    // Update block properties - remove file-related properties
    const updatedProperties = { ...blockProperties };
    delete updatedProperties.fileId;
    delete updatedProperties.fileName;
    delete updatedProperties.fileSize;
    delete updatedProperties.uploadedAt;
    updatedProperties.connectionMode = 'server';
    
    // Also clear schema if it was discovered from the file
    if (blockProperties.connectionMode === 'file') {
      delete updatedProperties.schema;
      delete updatedProperties.schemaDiscoveredAt;
      delete updatedProperties.exampleQueries;
    }

    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: updatedProperties as Prisma.InputJsonValue,
      },
    });

    res.json({
      success: true,
      message: 'Database file deleted',
    });
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    if (!res.headersSent && !res.writableEnded) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
      dbBlockLogger.error('Delete file error', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(500).json({
        error: errorMessage,
      });
    }
  }
}
