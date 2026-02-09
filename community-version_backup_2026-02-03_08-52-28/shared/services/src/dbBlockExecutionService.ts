/**
 * DB Block Execution Service
 * Executes DB blocks during chatbot conversations
 * 
 * NOTE: This service requires service-specific dependencies to be provided.
 * Services should create thin wrappers that import local implementations
 * and pass them to this shared service.
 */

import { extractParameters, buildParameterizedQuery, ParameterConfig } from './queryParameterService';

// Block interface - services will pass their Prisma Block type
export interface Block {
  id: string;
  chatbotId: string;
  properties: unknown;
  [key: string]: unknown;
}

export interface DbBlockResult {
  data: string; // Formatted result for LLM context
  metadata: {
    rowCount: number;
    executionTime: number;
  };
}

export interface BlockDatabaseSchema {
  tables?: Array<{
    name: string;
    columns?: Array<{
      name: string;
      type: string;
      nullable?: boolean;
    }>;
  }>;
  discoveredAt?: string;
}

export type DbResultFormat = 'json' | 'table' | 'text' | 'custom';

export interface DbConnection {
  // Connection object - type depends on database driver
  [key: string]: unknown;
}

export interface DbQueryResult {
  rows: Array<Record<string, unknown>>;
  executionTime: number;
}

export interface DbBlockDependencies {
  getDbConnection: (config: {
    connectionMode?: 'server' | 'file';
    dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    fileId?: string;
    chatbotId: string;
    blockId: string;
  }) => Promise<DbConnection>;
  executeSelectQuery: (connection: DbConnection, query: string, values: unknown[], timeout: number) => Promise<DbQueryResult>;
  formatDbResult: (rows: Array<Record<string, unknown>>, format: DbResultFormat, template?: string) => string;
  generateSqlQuery?: (userMessage: string, schema: BlockDatabaseSchema, llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral', llmModel?: string) => Promise<string>;
}

interface DbBlockProperties {
  connectionMode?: 'server' | 'file';
  dbType: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string; // Encrypted
  ssl?: boolean;
  // File-based connection
  fileId?: string;
  sqlQuery?: string; // Optional - will be auto-generated if not provided
  schema?: BlockDatabaseSchema; // Discovered schema
  schemaDiscoveredAt?: string;
  // Optional - defaults will be used if not provided
  parameters?: ParameterConfig[];
  resultFormat?: DbResultFormat;
  resultTemplate?: string;
  maxResultRows?: number;
  maxQueryTime?: number;
  errorHandling?: 'fail' | 'return_empty' | 'fallback_message';
  fallbackMessage?: string;
}

/**
 * Execute DB block during chatbot conversation
 */
export async function executeDbBlock(
  block: Block,
  userMessage: string,
  sessionData: Record<string, unknown>,
  dependencies: DbBlockDependencies,
  llmService?: unknown,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<DbBlockResult> {
  const properties = block.properties as unknown as DbBlockProperties;

  try {
    // 1. Generate SQL query automatically if not provided
    let sqlQuery = properties.sqlQuery;
    
    if (!sqlQuery && properties.schema && dependencies.generateSqlQuery) {
      // Auto-generate query using LLM and schema
      sqlQuery = await dependencies.generateSqlQuery(
        userMessage,
        properties.schema,
        llmProvider,
        llmModel
      );
    } else if (!sqlQuery) {
      throw new Error('No SQL query provided and schema not discovered. Please discover schema first.');
    }

    // 2. Extract parameters from user message (automatic extraction)
    const parameters = await extractParameters(
      userMessage,
      properties.parameters || [], // Empty array = automatic extraction
      sessionData,
      llmService
    );

    // 3. Build parameterized query
    const { query, values } = buildParameterizedQuery(
      sqlQuery,
      parameters
    );

    // 4. Get or create database connection
    const connection = await dependencies.getDbConnection({
      ...properties,
      chatbotId: block.chatbotId,
      blockId: block.id,
    });

    // 5. Execute SELECT query (read-only) - default timeout 30 seconds
    const result = await dependencies.executeSelectQuery(
      connection,
      query,
      values,
      properties.maxQueryTime || 30
    );

    // 6. Enforce result limit - default 1000 rows
    let rows = result.rows;
    const maxRows = properties.maxResultRows || 1000;
    if (rows.length > maxRows) {
      rows = rows.slice(0, maxRows);
    }

    // 7. Format results for LLM context - default JSON format
    const formattedResult = dependencies.formatDbResult(
      rows,
      properties.resultFormat || 'json',
      properties.resultTemplate
    );

    return {
      data: formattedResult,
      metadata: {
        rowCount: rows.length,
        executionTime: result.executionTime,
      },
    };
  } catch (error: unknown) {
    // Default error handling: return empty (fail silently to not break chat flow)
    // This is the most user-friendly approach
    console.error('DB Block execution error:', error);
    return {
      data: '',
      metadata: {
        rowCount: 0,
        executionTime: 0,
      },
    };
  }
}

/**
 * Check if DB block should be executed
 */
export function shouldExecuteDbBlock(
  block: Block,
  userMessage: string,
  sessionData?: Record<string, unknown>
): boolean {
  const properties = block.properties as unknown as DbBlockProperties & { 
    alwaysExecute?: boolean; 
    triggerKeywords?: string[] 
  };

  // Option 1: Always execute
  if (properties.alwaysExecute === true) {
    return true;
  }

  // Option 2: Check trigger keywords
  const triggerKeywords = properties.triggerKeywords || [];
  if (triggerKeywords.length > 0) {
    const lowerMessage = userMessage.toLowerCase();
    return triggerKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    );
  }

  // Default: execute if parameters can be extracted
  // This is a simple heuristic - can be improved
  return true;
}
