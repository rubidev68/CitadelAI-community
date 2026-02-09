/**
 * Database Health Check Service
 * Provides periodic health checks for database connections with metrics
 */

import { getPoolManager } from './dbConnectionPoolManager';
import { HealthCheckResult } from '@shared/types';

/**
 * Database Health Check Service
 */
export class DatabaseHealthCheckService {
  private poolManager = getPoolManager();
  private checkInterval: NodeJS.Timeout | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();

  /**
   * Start periodic health checks
   */
  start(interval?: number): void {
    if (this.checkInterval) {
      this.stop();
    }

    const checkInterval = interval || parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10);
    this.checkInterval = setInterval(() => {
      this.checkAllConnections().catch((error) => {
        console.error('Error during health checks:', error);
      });
    }, checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check health of a specific connection
   */
  async checkConnection(connectionKey: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let healthy = false;
    let error: string | undefined;

    try {
      healthy = await this.poolManager.checkConnection(connectionKey);
      const latency = Date.now() - startTime;

      const result: HealthCheckResult = {
        healthy,
        latency,
        timestamp: new Date(),
      };

      this.healthResults.set(connectionKey, result);
      return result;
    } catch (err) {
      const latency = Date.now() - startTime;
      error = err instanceof Error ? err.message : String(err);

      const result: HealthCheckResult = {
        healthy: false,
        latency,
        error,
        timestamp: new Date(),
      };

      this.healthResults.set(connectionKey, result);
      return result;
    }
  }

  /**
   * Check health of all connections
   */
  async checkAllConnections(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const allStats = this.poolManager.getAllPoolStats();

    const promises: Array<Promise<void>> = [];
    for (const connectionKey of allStats.keys()) {
      promises.push(
        this.checkConnection(connectionKey).then((result) => {
          results.set(connectionKey, result);
        })
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get last health check result for a connection
   */
  getLastHealthCheck(connectionKey: string): HealthCheckResult | null {
    return this.healthResults.get(connectionKey) || null;
  }

  /**
   * Get all health check results
   */
  getAllHealthChecks(): Map<string, HealthCheckResult> {
    return new Map(this.healthResults);
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): { healthy: boolean; totalConnections: number; unhealthyConnections: number } {
    let unhealthyCount = 0;
    for (const result of this.healthResults.values()) {
      if (!result.healthy) {
        unhealthyCount++;
      }
    }

    return {
      healthy: unhealthyCount === 0 && this.healthResults.size > 0,
      totalConnections: this.healthResults.size,
      unhealthyConnections: unhealthyCount,
    };
  }
}

/**
 * Singleton instance
 */
let healthCheckServiceInstance: DatabaseHealthCheckService | null = null;

/**
 * Get the singleton health check service instance
 */
export function getHealthCheckService(): DatabaseHealthCheckService {
  if (!healthCheckServiceInstance) {
    healthCheckServiceInstance = new DatabaseHealthCheckService();
  }
  return healthCheckServiceInstance;
}
