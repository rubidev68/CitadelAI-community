import { Response } from 'express';
import { BlockType, Prisma } from '@prisma/client';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { discoverSchema } from '@shared/services';
import { verifyChatbotOwnership, verifyDbBlock } from './utils/validationUtils';
import prisma from '../../lib/prisma';

const dbBlockLogger = logger.child({ service: 'admin-backend', component: 'dbBlock-controller' });

interface DBBlockProperties {
  connectionMode?: string;
  dbType?: string;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  fileId?: string;
  schema?: unknown;
  schemaDiscoveredAt?: string;
  exampleQueries?: unknown;
  [key: string]: unknown;
}

/**
 * Discover database schema
 */
export async function handleDiscoverSchema(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { chatbotId, blockId } = req.params;
    const adminUserId = req.adminUser?.id;

    if (!adminUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify chatbot ownership
    if (!(await verifyChatbotOwnership(chatbotId, adminUserId))) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    // Verify block exists
    const block = await verifyDbBlock(blockId, chatbotId);
    if (!block) {
      res.status(404).json({ error: 'DB block not found' });
      return;
    }

    const blockProperties = block.properties as unknown as DBBlockProperties;
    
    // Discover schema
    const connectionMode = (blockProperties.connectionMode === 'file' || blockProperties.connectionMode === 'server') 
      ? blockProperties.connectionMode 
      : 'server';
    const dbType = (blockProperties.dbType === 'postgresql' || blockProperties.dbType === 'mysql' || blockProperties.dbType === 'sqlite' || blockProperties.dbType === 'mssql')
      ? blockProperties.dbType
      : 'postgresql';
    const schema = await discoverSchema({
      connectionMode,
      dbType,
      connectionString: blockProperties.connectionString,
      host: blockProperties.host,
      port: blockProperties.port,
      database: blockProperties.database,
      username: blockProperties.username,
      password: blockProperties.password,
      ssl: blockProperties.ssl,
      fileId: blockProperties.fileId,
      chatbotId: chatbotId,
      blockId: blockId,
    });

    // Generate example queries
    let exampleQueries = null;
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

    // Update block with discovered schema
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...blockProperties,
          schema: schema,
          schemaDiscoveredAt: schema.discoveredAt,
          ...(exampleQueries && {
            exampleQueries: exampleQueries,
          }),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    res.json({ 
      success: true, 
      schema,
      exampleQueries: exampleQueries,
      tablesCount: schema.tables?.length || 0,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Schema discovery failed';
    dbBlockLogger.error('Schema discovery error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}
