import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { testConnection, prepareCredentialsForStorage, getDbConnection } from '@shared/services';
import { DbConnectionConfig } from '@shared/types';
import { verifyChatbotOwnership, verifyDbBlock } from './utils/validationUtils';
import prisma from '../../lib/prisma';

const dbBlockLogger = logger.child({ service: 'admin-backend', component: 'dbBlock-controller' });

/**
 * Test database connection
 */
export async function handleTestConnection(req: AdminAuthRequest, res: Response): Promise<void> {
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

    // Get connection config from request body
    const {
      dbType,
      connectionString,
      host,
      port,
      database,
      username,
      password,
      ssl,
    } = req.body;

    if (!dbType) {
      res.status(400).json({ error: 'Database type is required' });
      return;
    }

    // Prepare credentials (encrypt password if provided)
    const config: DbConnectionConfig = {
      dbType,
      connectionString,
      host,
      port,
      database,
      username,
      password: password ? prepareCredentialsForStorage({ password }).password : undefined,
      ssl,
    };

    // Test connection
    const result = await testConnection(config);

    // Update block with test status
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...(block.properties as Record<string, unknown>),
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbBlockLogger.error('Connection test error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
}
