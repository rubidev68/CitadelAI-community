/**
 * DB Block Execution Service Wrapper
 * Wraps the shared dbBlockExecutionService with service-specific dependencies
 */

import { Block } from '@prisma/client';
import { 
  executeDbBlock as sharedExecuteDbBlock, 
  shouldExecuteDbBlock as sharedShouldExecuteDbBlock,
  DbBlockDependencies 
} from '@shared/services';
import { getDbConnection, executeSelectQuery, type TypedDatabaseConnection, DatabaseSchema } from '@shared/services';
import { formatDbResult, DbResultFormat } from '@shared/utils';
import { generateSqlQuery } from './dbQueryGenerator';

// Re-export types and functions from shared service
export { shouldExecuteDbBlock } from '@shared/services';

/**
 * Execute DB block during chatbot conversation
 * This is a wrapper that provides service-specific dependencies to the shared service
 */
export async function executeDbBlock(
  block: Block,
  userMessage: string,
  sessionData: Record<string, unknown>,
  llmService?: unknown,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
) {
  // Prepare dependencies for shared service
  const dependencies: DbBlockDependencies = {
    getDbConnection: async (config) => {
      return await getDbConnection({
        connectionMode: config.connectionMode,
        dbType: config.dbType,
        connectionString: config.connectionString,
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password: config.password,
        ssl: config.ssl,
        fileId: config.fileId,
        chatbotId: config.chatbotId,
        blockId: config.blockId,
      });
    },
    executeSelectQuery: async (connection, query, values, timeout) => {
      // Cast DbConnection to TypedDatabaseConnection for internal use
      const typedConnection = connection as TypedDatabaseConnection;
      const result = await executeSelectQuery(typedConnection, query, values, timeout);
      return {
        rows: result.rows,
        executionTime: result.executionTime,
      };
    },
    formatDbResult: (rows, format, template) => {
      return formatDbResult(rows, format as DbResultFormat, template);
    },
    generateSqlQuery: async (userMessage, schema, provider, model) => {
      return await generateSqlQuery(userMessage, schema as DatabaseSchema, provider, model);
    },
  };

  // Call shared service with dependencies
  return await sharedExecuteDbBlock(
    block,
    userMessage,
    sessionData,
    dependencies,
    llmService,
    llmProvider,
    llmModel
  );
}
