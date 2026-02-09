/**
 * Database Connection Service
 * Manages database connections, connection pooling, and query execution
 */

import { DbConnectionConfig, QueryResult, ConnectionPoolConfig } from '@shared/types';
import type { PostgresPool, PostgresClient, MySQLPool, MySQLConnection, SQLiteDatabase } from '@shared/types';
import { getDatabaseDriver } from './dbDrivers';
import { validateSelectQuery } from './dbQueryValidator';
import { encryptCredentials } from '@shared/utils';
import { dbFileStorageService } from './dbFileStorageService';
import { getPoolManager } from './dbConnectionPoolManager';
import { logger } from '@shared/utils';

const dbConnectionLogger = logger.child({ service: 'shared-services', component: 'dbConnectionService' });

// Database connection type - can be a pool or a single connection
type DatabaseConnection = PostgresPool | PostgresClient | MySQLPool | MySQLConnection | SQLiteDatabase;

// Connection with dbType property for identification
// Compatible with DbConnection from @shared/services (has index signature)
export type TypedDatabaseConnection = DatabaseConnection & {
  dbType?: 'postgresql' | 'mysql' | 'sqlite' | 'mssql';
  [key: string]: unknown; // Index signature for compatibility with DbConnection
};

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
  maxQueryTime?: number; // seconds
  // File-based connection
  fileId?: string;
  chatbotId?: string; // Required for file-based connections
  blockId?: string; // Required for file-based connections
}

/**
 * Get or create database connection using pool manager
 */
export async function getDbConnection(
  properties: DbBlockProperties,
  poolConfig?: Partial<ConnectionPoolConfig>
): Promise<TypedDatabaseConnection> {
  const connectionMode = properties.connectionMode || 'server';
  
  let config: DbConnectionConfig;

  // Handle file-based connection
  if (connectionMode === 'file') {
    if (!properties.fileId || !properties.chatbotId || !properties.blockId) {
      throw new Error('fileId, chatbotId, and blockId are required for file-based connections');
    }

    // Get file path from storage service
    const filePath = await dbFileStorageService.getFilePath(
      properties.chatbotId,
      properties.blockId,
      properties.fileId
    );

    // Update last accessed time
    await dbFileStorageService.updateLastAccessed(filePath);

    config = {
      dbType: 'sqlite', // File-based connections are always SQLite
      connectionMode: 'file',
      filePath,
    };
  } else {
    // Server-based connection
    config = {
      dbType: properties.dbType,
      connectionMode: 'server',
      connectionString: properties.connectionString,
      host: properties.host,
      port: properties.port,
      database: properties.database,
      username: properties.username,
      password: properties.password, // Already encrypted
      ssl: properties.ssl,
    };
  }

  // Get driver and pool manager
  const driver = getDatabaseDriver(config.dbType);
  const poolManager = getPoolManager();

  // Get connection from pool manager
  const connection = await poolManager.getConnection(config, driver, poolConfig) as DatabaseConnection;
  
  // Store dbType on connection for later use
  const typedConnection = connection as TypedDatabaseConnection;
  typedConnection.dbType = config.dbType;

  return typedConnection;
}

/**
 * Test database connection
 */
export async function testConnection(config: DbConnectionConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const driver = getDatabaseDriver(config.dbType);
    const success = await driver.testConnection(config);
    
    if (success) {
      return { success: true };
    } else {
      return { success: false, error: 'Connection test failed' };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

/**
 * Execute SELECT query (read-only)
 */
export async function executeSelectQuery(
  connection: TypedDatabaseConnection,
  query: string,
  params: unknown[],
  maxQueryTime: number = 30
): Promise<QueryResult> {
  // Validate query is SELECT-only
  const validation = validateSelectQuery(query);
  if (!validation.valid) {
    throw new Error(validation.error || 'Only SELECT queries are allowed');
  }

  // Set query timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query timeout after ${maxQueryTime} seconds`));
    }, maxQueryTime * 1000);
  });

  // Execute query with timeout
  const queryPromise = (async () => {
    const dbType = connection.dbType || 'postgresql';
    const driver = getDatabaseDriver(dbType);
    
    // For pooled connections (PostgreSQL Pool), use pool.query directly
    if (connection && typeof (connection as PostgresPool).query === 'function' && dbType === 'postgresql') {
      const postgresPool = connection as PostgresPool;
      const startTime = Date.now();
      const result = await postgresPool.query(query, params);
      const executionTime = Date.now() - startTime;
      
      return {
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        executionTime,
      };
    }
    
    // For MySQL pools or single connections, use driver
    return await driver.executeQuery(connection, query, params);
  })();

  return Promise.race([queryPromise, timeoutPromise]);
}

/**
 * Close database connection
 */
export async function closeConnection(connection: TypedDatabaseConnection): Promise<void> {
  try {
    const dbType = connection.dbType || 'postgresql';
    const driver = getDatabaseDriver(dbType);
    await driver.close(connection);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    dbConnectionLogger.error('Error closing connection', { error: error instanceof Error ? error : new Error(String(error)) });
  }
}

/**
 * Prepare database credentials for storage (encrypt password)
 */
export function prepareCredentialsForStorage(
  config: Partial<DbConnectionConfig>
): Partial<DbConnectionConfig> {
  const prepared = { ...config };
  
  if (prepared.password && !prepared.password.includes(':')) {
    // Password is not encrypted, encrypt it
    prepared.password = encryptCredentials(prepared.password);
  }
  
  return prepared;
}
