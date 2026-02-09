import {
  DatabaseDriver,
  DbConnectionConfig,
  QueryResult,
  ConnectionPoolConfig,
  ConnectionPoolStats,
  MySQLConnection,
  MySQLPool,
  MySQLConfig,
} from '@shared/types';
import { decryptCredentials } from '@shared/utils';
import { logger } from '@shared/utils';

const mysqlDriverLogger = logger.child({ service: 'shared-services', component: 'mysqlDriver' });

// Dynamic import for mysql2 (will be installed)
let createConnection: (config: MySQLConfig) => Promise<MySQLConnection>;
let createPool: (config: MySQLConfig) => MySQLPool;

async function loadMysqlDriver() {
  if (!createConnection) {
    const mysql = await import('mysql2/promise');
    createConnection = mysql.createConnection as unknown as (config: MySQLConfig) => Promise<MySQLConnection>;
  }
  if (!createPool) {
    // createPool is exported from mysql2, not mysql2/promise
    const mysql2 = await import('mysql2');
    createPool = mysql2.createPool as unknown as (config: MySQLConfig) => MySQLPool;
  }
}

export class MySQLDriver implements DatabaseDriver {
  async connect(config: DbConnectionConfig): Promise<MySQLConnection> {
    await loadMysqlDriver();
    
    const connectionConfig: MySQLConfig = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database || '',
      user: config.username || '',
      password: config.password ? decryptCredentials(config.password) : '',
      ssl: config.ssl ? {} : undefined,
    };

    if (config.connectionString) {
      // Parse connection string
      const url = new URL(config.connectionString.replace(/^mysql:\/\//, 'http://'));
      connectionConfig.host = url.hostname;
      connectionConfig.port = parseInt(url.port || '3306');
      connectionConfig.database = url.pathname.slice(1);
      connectionConfig.user = url.username;
      connectionConfig.password = url.password ? decryptCredentials(url.password) : '';
    }

    return await createConnection(connectionConfig);
  }

  async testConnection(config: DbConnectionConfig): Promise<boolean> {
    try {
      const connection = await this.connect(config);
      await connection.query('SELECT 1');
      await this.close(connection);
      return true;
    } catch (error) {
      mysqlDriverLogger.error('MySQL connection test failed', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }

  async executeQuery(connection: MySQLConnection, query: string, params: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();
    const [rows, fields] = await connection.execute(query, params);
    const executionTime = Date.now() - startTime;

    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      executionTime,
    };
  }

  async close(connection: MySQLConnection): Promise<void> {
    await connection.end();
  }

  buildConnectionString(config: DbConnectionConfig): string {
    if (config.connectionString) {
      return config.connectionString;
    }

    const password = config.password ? decryptCredentials(config.password) : '';
    const host = config.host || 'localhost';
    const port = config.port || 3306;
    const database = config.database || '';
    const username = config.username || '';

    return `mysql://${username}:${password}@${host}:${port}/${database}`;
  }

  /**
   * Create a connection pool
   */
  async createPool(config: DbConnectionConfig, poolConfig?: ConnectionPoolConfig): Promise<MySQLPool> {
    await loadMysqlDriver();

    const connectionConfig: MySQLConfig = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database || '',
      user: config.username || '',
      password: config.password ? decryptCredentials(config.password) : '',
      ssl: config.ssl ? {} : undefined,
      connectionLimit: poolConfig?.maxConnections || 10,
      queueLimit: 0, // Unlimited queue
      idleTimeout: poolConfig?.idleTimeout || 300000,
      connectTimeout: poolConfig?.connectionTimeout || 10000,
    };

    if (config.connectionString) {
      // Parse connection string
      const url = new URL(config.connectionString.replace(/^mysql:\/\//, 'http://'));
      connectionConfig.host = url.hostname;
      connectionConfig.port = parseInt(url.port || '3306');
      connectionConfig.database = url.pathname.slice(1);
      connectionConfig.user = url.username;
      connectionConfig.password = url.password ? decryptCredentials(url.password) : '';
    }

    return createPool(connectionConfig);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(pool: MySQLPool): ConnectionPoolStats | null {
    if (!pool) {
      return null;
    }

    try {
      // Access internal pool properties (mysql2 doesn't expose stats API)
      // Using type assertion to access internal properties safely
      const poolInternal = pool as unknown as {
        pool?: {
          _allConnections?: unknown[];
          _acquiredConnections?: unknown[];
          _connectionQueue?: unknown[];
          config?: { connectionLimit?: number };
        };
      };
      
      const poolInfo = poolInternal.pool;
      if (!poolInfo) {
        return null;
      }
      
      const totalConnections = poolInfo._allConnections?.length || 0;
      const activeConnections = poolInfo._acquiredConnections?.length || 0;
      const idleConnections = totalConnections - activeConnections;
      const waitingRequests = poolInfo._connectionQueue?.length || 0;
      const maxConnections = poolInfo.config?.connectionLimit || 10;
      const poolUtilization = maxConnections > 0 ? (activeConnections / maxConnections) * 100 : 0;

      return {
        totalConnections,
        activeConnections,
        idleConnections,
        waitingRequests,
        maxConnections,
        poolUtilization,
      };
    } catch (error) {
      mysqlDriverLogger.error('Error getting pool stats', { error: error instanceof Error ? error : new Error(String(error)) });
      return null;
    }
  }

  /**
   * Health check for a connection or pool
   */
  async healthCheck(connection: MySQLConnection | MySQLPool): Promise<boolean> {
    try {
      // For pools, use execute method
      if (connection && typeof connection.execute === 'function') {
        await connection.execute('SELECT 1');
        return true;
      }
      // For single connections
      if (connection && typeof connection.query === 'function') {
        await connection.query('SELECT 1');
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
