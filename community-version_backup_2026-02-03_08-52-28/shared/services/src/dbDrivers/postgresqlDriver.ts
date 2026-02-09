import {
  DatabaseDriver,
  DbConnectionConfig,
  QueryResult,
  ConnectionPoolConfig,
  ConnectionPoolStats,
  PostgresClient,
  PostgresPool,
  PostgresConfig,
} from '@shared/types';
import { decryptCredentials, logger } from '@shared/utils';

const postgresqlDriverLogger = logger.child({ service: 'shared-services', component: 'postgresqlDriver' });

// Dynamic import for pg (will be installed)
let Pool: new (config?: PostgresConfig) => PostgresPool;
let Client: new (config?: PostgresConfig) => PostgresClient;

async function loadPgDriver() {
  if (!Pool) {
    const pg = await import('pg');
    Pool = pg.Pool as unknown as new (config?: PostgresConfig) => PostgresPool;
    Client = pg.Client as unknown as new (config?: PostgresConfig) => PostgresClient;
  }
}

export class PostgreSQLDriver implements DatabaseDriver {
  async connect(config: DbConnectionConfig): Promise<PostgresClient> {
    await loadPgDriver();
    
    const connectionConfig: PostgresConfig = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || '',
      user: config.username || '',
      password: config.password ? decryptCredentials(config.password) : '',
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
    };

    if (config.connectionString) {
      // Parse connection string and override individual fields
      const url = new URL(config.connectionString.replace(/^postgresql:\/\//, 'http://'));
      connectionConfig.host = url.hostname;
      connectionConfig.port = parseInt(url.port || '5432');
      connectionConfig.database = url.pathname.slice(1);
      connectionConfig.user = url.username;
      connectionConfig.password = url.password ? decryptCredentials(url.password) : '';
    }

    const client = new Client(connectionConfig);
    await client.connect();
    return client;
  }

  async testConnection(config: DbConnectionConfig): Promise<boolean> {
    try {
      const connection = await this.connect(config);
      await connection.query('SELECT 1');
      await this.close(connection);
      return true;
    } catch (error) {
      postgresqlDriverLogger.error('PostgreSQL connection test failed', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }

  async executeQuery(connection: PostgresClient | PostgresPool, query: string, params: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();
    const result = await connection.query(query, params);
    const executionTime = Date.now() - startTime;

    return {
      rows: result.rows || [],
      rowCount: result.rowCount || 0,
      executionTime,
    };
  }

  async close(connection: PostgresClient): Promise<void> {
    await connection.end();
  }

  buildConnectionString(config: DbConnectionConfig): string {
    if (config.connectionString) {
      return config.connectionString;
    }

    const password = config.password ? decryptCredentials(config.password) : '';
    const host = config.host || 'localhost';
    const port = config.port || 5432;
    const database = config.database || '';
    const username = config.username || '';
    const ssl = config.ssl ? '?sslmode=require' : '';

    return `postgresql://${username}:${password}@${host}:${port}/${database}${ssl}`;
  }

  /**
   * Create a connection pool
   */
  async createPool(config: DbConnectionConfig, poolConfig?: ConnectionPoolConfig): Promise<PostgresPool> {
    await loadPgDriver();

    const connectionConfig: PostgresConfig = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || '',
      user: config.username || '',
      password: config.password ? decryptCredentials(config.password) : '',
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: poolConfig?.maxConnections || 10,
      min: poolConfig?.minIdleConnections || 2,
      idleTimeoutMillis: poolConfig?.idleTimeout || 300000,
      connectionTimeoutMillis: poolConfig?.connectionTimeout || 10000,
    };

    if (config.connectionString) {
      // Parse connection string and override individual fields
      const url = new URL(config.connectionString.replace(/^postgresql:\/\//, 'http://'));
      connectionConfig.host = url.hostname;
      connectionConfig.port = parseInt(url.port || '5432');
      connectionConfig.database = url.pathname.slice(1);
      connectionConfig.user = url.username;
      connectionConfig.password = url.password ? decryptCredentials(url.password) : '';
    }

    return new Pool(connectionConfig);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(pool: PostgresPool): ConnectionPoolStats | null {
    if (!pool) {
      return null;
    }

    try {
      const totalConnections = pool.totalCount || 0;
      const idleConnections = pool.idleCount || 0;
      const waitingRequests = pool.waitingCount || 0;
      const activeConnections = totalConnections - idleConnections;
      
      // Access internal options for max connections
      const poolInternal = pool as unknown as { options?: { max?: number } };
      const maxConnections = poolInternal.options?.max || 10;
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
      postgresqlDriverLogger.error('Error getting pool stats', { error: error instanceof Error ? error : new Error(String(error)) });
      return null;
    }
  }

  /**
   * Health check for a connection or pool
   */
  async healthCheck(connection: PostgresClient | PostgresPool): Promise<boolean> {
    try {
      // For pools, use query method
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
