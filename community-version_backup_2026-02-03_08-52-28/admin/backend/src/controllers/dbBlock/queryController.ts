import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { validateSelectQuery, executeSelectQuery, getDbConnection } from '@shared/services';
import { buildParameterizedQuery } from '../../services/queryParameterService';
import { verifyChatbotOwnership, verifyDbBlock } from './utils/validationUtils';

const dbBlockLogger = logger.child({ service: 'admin-backend', component: 'dbBlock-controller' });

/**
 * Test SELECT query execution
 */
export async function handleTestQuery(req: AdminAuthRequest, res: Response): Promise<void> {
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

    const { sqlQuery, parameters } = req.body;

    if (!sqlQuery || typeof sqlQuery !== 'string') {
      res.status(400).json({ error: 'SQL query is required' });
      return;
    }

    // Validate query is SELECT-only
    const validation = validateSelectQuery(sqlQuery);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: validation.error || 'Only SELECT queries are allowed',
      });
      return;
    }

    // Build parameterized query
    const { query, values } = buildParameterizedQuery(
      sqlQuery,
      parameters || {}
    );

    // Get database connection from block properties
    const blockProperties = block.properties as Record<string, unknown>;
    const connection = await getDbConnection({
      connectionMode: (blockProperties.connectionMode as 'server' | 'file') || 'server',
      dbType: ((blockProperties.dbType as 'postgresql' | 'mysql' | 'sqlite' | 'mssql') || 'postgresql') as 'postgresql' | 'mysql' | 'sqlite' | 'mssql',
      connectionString: blockProperties.connectionString as string | undefined,
      host: blockProperties.host as string | undefined,
      port: blockProperties.port as number | undefined,
      database: blockProperties.database as string | undefined,
      username: blockProperties.username as string | undefined,
      password: blockProperties.password as string | undefined,
      ssl: blockProperties.ssl as boolean | undefined,
      fileId: blockProperties.fileId as string | undefined,
      chatbotId: chatbotId,
      blockId: blockId,
    });

    // Execute query (with limit for testing)
    const result = await executeSelectQuery(
      connection,
      query,
      values,
      30 // 30 second timeout
    );

    // Limit results for testing (max 100 rows)
    const limitedRows = result.rows.slice(0, 100);

    res.json({
      success: true,
      results: limitedRows,
      rowCount: limitedRows.length,
      totalRowCount: result.rows.length,
      executionTime: result.executionTime,
      message: result.rows.length > 100 ? `Showing first 100 of ${result.rows.length} results` : undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbBlockLogger.error('Query test error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Query execution failed',
    });
  }
}
