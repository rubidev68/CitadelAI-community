/**
 * Database Connection Pool Manager
 * Manages connection pools for all database types with health checks and automatic reconnection
 */

import {
  DatabaseDriver,
  DbConnectionConfig,
  ConnectionPoolConfig,
  ConnectionPoolStats,
  PoolInfo,
} from '@shared/types';
import { logger } from '@shared/utils';

const poolLogger = logger.child({ service: 'shared-services', component: 'dbConnectionPoolManager' });

/**
 * Default pool configuration
 */
const DEFAULT_POOL_CONFIG: Required<ConnectionPoolConfig> = {
  maxConnections: parseInt(process.env.DB_POOL_MAX_CONNECTIONS || '10', 10),
  minIdleConnections: parseInt(process.env.DB_POOL_MIN_IDLE || '2', 10),
  connectionTimeout: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '10000', 10),
  idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '300000', 10), // 5 minutes
  maxLifetime: parseInt(process.env.DB_POOL_MAX_LIFETIME || '3600000', 10), // 1 hour
  healthCheckEnabled: process.env.DB_HEALTH_CHECK_ENABLED !== 'false',
  healthCheckInterval: parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
};

/**
 * Generate a unique connection key for pooling
 */
function generateConnectionKey(config: DbConnectionConfig): string {
  if (config.connectionMode === 'file' && config.filePath) {
    return `sqlite:file:${config.filePath}`;
  }
  if (config.connectionMode === 'file' && config.fileId) {
    return `sqlite:file:${config.fileId}`;
  }
  // Server-based connection
  const host = config.host || 'localhost';
  const port = config.port || (config.dbType === 'mysql' ? 3306 : 5432);
  const database = config.database || '';
  return `${config.dbType}:${host}:${port}:${database}`;
}

/**
 * Database Connection Pool Manager
 */
export class DatabaseConnectionPoolManager {
  private pools: Map<string, PoolInfo> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private healthCheckCallbacks: Array<(connectionKey: string, error: Error) => void> = [];

  constructor() {
    // Start health checks if enabled
    if (DEFAULT_POOL_CONFIG.healthCheckEnabled) {
      this.startHealthChecks();
    }
  }

  /**
   * Get or create a connection from the pool
   */
  async getConnection(
    config: DbConnectionConfig,
    driver: DatabaseDriver,
    poolConfig?: Partial<ConnectionPoolConfig>
  ): Promise<unknown> {
    const connectionKey = generateConnectionKey(config);
    const finalPoolConfig: Required<ConnectionPoolConfig> = {
      ...DEFAULT_POOL_CONFIG,
      ...poolConfig,
    };

    // Check if pool exists
    let poolInfo = this.pools.get(connectionKey);

    if (!poolInfo) {
      // Create new pool
      if (driver.createPool) {
        const pool = await driver.createPool(config, finalPoolConfig);
        poolInfo = {
          pool,
          config,
          poolConfig: finalPoolConfig,
          stats: {
            totalConnections: 0,
            activeConnections: 0,
            idleConnections: 0,
            waitingRequests: 0,
            maxConnections: finalPoolConfig.maxConnections,
            poolUtilization: 0,
          },
          driver,
        };
        this.pools.set(connectionKey, poolInfo);
      } else {
        // Driver doesn't support pooling, create a single connection
        const connection = await driver.connect(config);
        poolInfo = {
          pool: connection,
          config,
          poolConfig: finalPoolConfig,
          stats: {
            totalConnections: 1,
            activeConnections: 1,
            idleConnections: 0,
            waitingRequests: 0,
            maxConnections: 1,
            poolUtilization: 100,
          },
          driver,
        };
        this.pools.set(connectionKey, poolInfo);
      }
    }

    // Update stats
    this.updatePoolStats(connectionKey);

    // For drivers with pooling, get connection from pool
    // For drivers without pooling, return the single connection
    const result = this.pools.get(connectionKey);
    if (!result) {
      throw new Error('Failed to create or retrieve connection pool');
    }
    return result.pool;
  }

  /**
   * Release a connection back to the pool
   */
  async releaseConnection(connectionKey: string, connection: unknown): Promise<void> {
    const poolInfo = this.pools.get(connectionKey);
    if (!poolInfo) {
      return;
    }

    // For pooled connections, the pool handles release automatically
    // For single connections, we keep them in the pool
    this.updatePoolStats(connectionKey);
  }

  /**
   * Get pool statistics
   */
  getPoolStats(connectionKey: string): ConnectionPoolStats | null {
    const poolInfo = this.pools.get(connectionKey);
    if (!poolInfo) {
      return null;
    }

    this.updatePoolStats(connectionKey);
    return { ...poolInfo.stats };
  }

  /**
   * Get all pool statistics
   */
  getAllPoolStats(): Map<string, ConnectionPoolStats> {
    const stats = new Map<string, ConnectionPoolStats>();
    for (const key of this.pools.keys()) {
      const poolStats = this.getPoolStats(key);
      if (poolStats) {
        stats.set(key, poolStats);
      }
    }
    return stats;
  }

  /**
   * Update pool statistics
   */
  private updatePoolStats(connectionKey: string): void {
    const poolInfo = this.pools.get(connectionKey);
    if (!poolInfo) {
      return;
    }

    // Try to get stats from driver if available
    if (poolInfo.driver.getPoolStats) {
      const driverStats = poolInfo.driver.getPoolStats(poolInfo.pool);
      if (driverStats) {
        poolInfo.stats = driverStats;
        return;
      }
    }

    // Fallback: estimate stats (for drivers without pool stats)
    // This is a simple approximation
    poolInfo.stats.poolUtilization = poolInfo.stats.totalConnections > 0
      ? (poolInfo.stats.activeConnections / poolInfo.stats.maxConnections) * 100
      : 0;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(interval?: number): void {
    if (this.healthCheckInterval) {
      this.stopHealthChecks();
    }

    const checkInterval = interval || DEFAULT_POOL_CONFIG.healthCheckInterval;
    this.healthCheckInterval = setInterval(() => {
      this.checkAllConnections().catch((error) => {
        poolLogger.error('Error during health checks:', { error });
      });
    }, checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of a specific connection
   */
  async checkConnection(connectionKey: string): Promise<boolean> {
    const poolInfo = this.pools.get(connectionKey);
    if (!poolInfo) {
      return false;
    }

    try {
      // Use driver's health check if available
      if (poolInfo.driver.healthCheck) {
        const healthy = await poolInfo.driver.healthCheck(poolInfo.pool);
        poolInfo.healthStatus = healthy;
        poolInfo.lastHealthCheck = new Date();
        return healthy;
      }

      // Fallback: use testConnection
      const healthy = await poolInfo.driver.testConnection(poolInfo.config);
      poolInfo.healthStatus = healthy;
      poolInfo.lastHealthCheck = new Date();
      return healthy;
    } catch (error) {
      poolInfo.healthStatus = false;
      poolInfo.lastHealthCheck = new Date();

      // Notify callbacks
      for (const callback of this.healthCheckCallbacks) {
        try {
          callback(connectionKey, error as Error);
        } catch (cbError) {
          poolLogger.error('Error in health check callback:', { error: cbError instanceof Error ? cbError : new Error(String(cbError)) });
        }
      }

      return false;
    }
  }

  /**
   * Check health of all connections
   */
  async checkAllConnections(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    const promises: Array<Promise<void>> = [];

    for (const connectionKey of this.pools.keys()) {
      promises.push(
        this.checkConnection(connectionKey).then((healthy) => {
          results.set(connectionKey, healthy);
        })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Register a callback for health check failures
   */
  onHealthCheckFailure(callback: (connectionKey: string, error: Error) => void): void {
    this.healthCheckCallbacks.push(callback);
  }

  /**
   * Close a specific pool
   */
  async closePool(connectionKey: string): Promise<void> {
    const poolInfo = this.pools.get(connectionKey);
    if (!poolInfo) {
      return;
    }

    try {
      // For pooled connections, close the pool
      // For single connections, close the connection
      if (poolInfo.driver.close) {
        await poolInfo.driver.close(poolInfo.pool);
      }
    } catch (error) {
      poolLogger.error(`Error closing pool ${connectionKey}:`, { error: error instanceof Error ? error : new Error(String(error)) });
    } finally {
      this.pools.delete(connectionKey);
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    this.stopHealthChecks();

    const closePromises: Array<Promise<void>> = [];
    for (const connectionKey of this.pools.keys()) {
      closePromises.push(this.closePool(connectionKey));
    }

    await Promise.allSettled(closePromises);
    this.pools.clear();
  }
}

/**
 * Singleton instance
 */
let poolManagerInstance: DatabaseConnectionPoolManager | null = null;

/**
 * Get the singleton pool manager instance
 */
export function getPoolManager(): DatabaseConnectionPoolManager {
  if (!poolManagerInstance) {
    poolManagerInstance = new DatabaseConnectionPoolManager();
  }
  return poolManagerInstance;
}
