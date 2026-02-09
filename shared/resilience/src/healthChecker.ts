import axios, { AxiosInstance } from 'axios';
import { HealthCheckConfig } from './types';

/**
 * Health checker for services
 * Periodically checks service health and caches status
 */
export class HealthChecker {
  private client: AxiosInstance;
  private config: Required<HealthCheckConfig>;
  private isHealthy: boolean = true;
  private lastCheck: number = 0;
  private checkInterval?: NodeJS.Timeout;

  constructor(baseURL: string, config: HealthCheckConfig) {
    this.config = {
      enabled: config.enabled,
      endpoint: config.endpoint || '/health',
      interval: config.interval || 30000, // 30 seconds default
      timeout: config.timeout || 5000, // 5 seconds default
    };

    this.client = axios.create({
      baseURL,
      timeout: this.config.timeout,
    });

    if (this.config.enabled) {
      this.startPeriodicChecks();
    }
  }

  /**
   * Check health immediately
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get(this.config.endpoint);
      this.isHealthy = response.status === 200;
      this.lastCheck = Date.now();
      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastCheck = Date.now();
      return false;
    }
  }

  /**
   * Get cached health status
   */
  getHealthStatus(): boolean {
    // If check is stale (older than interval), return false to force fresh check
    const now = Date.now();
    if (now - this.lastCheck > this.config.interval) {
      return false; // Stale, need fresh check
    }
    return this.isHealthy;
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicChecks(): void {
    // Initial check
    this.checkHealth().catch(() => {
      // Ignore initial check errors
    });

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkHealth().catch(() => {
        // Ignore periodic check errors
      });
    }, this.config.interval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Get last check time
   */
  getLastCheckTime(): number {
    return this.lastCheck;
  }
}
