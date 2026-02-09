import { CircuitBreakerState } from './types';

/**
 * Simple metrics collector
 * Tracks request counts, latencies, and circuit breaker state
 */
export class MetricsCollector {
  private requestCounts: Map<string, { total: number; success: number; failure: number }> = new Map();
  private latencies: Map<string, number[]> = new Map();
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();
  private retryCounts: Map<string, number> = new Map();

  /**
   * Record a request
   */
  recordRequest(serviceName: string, success: boolean): void {
    const metrics = this.requestCounts.get(serviceName) || { total: 0, success: 0, failure: 0 };
    metrics.total++;
    if (success) {
      metrics.success++;
    } else {
      metrics.failure++;
    }
    this.requestCounts.set(serviceName, metrics);
  }

  /**
   * Record request latency
   */
  recordLatency(serviceName: string, latencyMs: number): void {
    const latencies = this.latencies.get(serviceName) || [];
    latencies.push(latencyMs);
    // Keep only last 1000 latencies
    if (latencies.length > 1000) {
      latencies.shift();
    }
    this.latencies.set(serviceName, latencies);
  }

  /**
   * Record circuit breaker state change
   */
  recordCircuitBreakerState(serviceName: string, state: CircuitBreakerState): void {
    this.circuitBreakerStates.set(serviceName, state);
  }

  /**
   * Record retry
   */
  recordRetry(serviceName: string): void {
    const count = this.retryCounts.get(serviceName) || 0;
    this.retryCounts.set(serviceName, count + 1);
  }

  /**
   * Get metrics for a service
   */
  getMetrics(serviceName: string) {
    const requestMetrics = this.requestCounts.get(serviceName) || { total: 0, success: 0, failure: 0 };
    const latencies = this.latencies.get(serviceName) || [];
    const retryCount = this.retryCounts.get(serviceName) || 0;
    const circuitState = this.circuitBreakerStates.get(serviceName) || CircuitBreakerState.CLOSED;

    // Calculate latency percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

    const successRate = requestMetrics.total > 0
      ? (requestMetrics.success / requestMetrics.total) * 100
      : 100;

    return {
      requests: {
        total: requestMetrics.total,
        success: requestMetrics.success,
        failure: requestMetrics.failure,
        successRate: `${successRate.toFixed(2)}%`,
      },
      latency: {
        p50,
        p95,
        p99,
        avg: latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      },
      circuitBreaker: {
        state: circuitState,
      },
      retries: retryCount,
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const services = new Set([
      ...this.requestCounts.keys(),
      ...this.latencies.keys(),
      ...this.circuitBreakerStates.keys(),
    ]);

    const result: Record<string, ReturnType<typeof this.getMetrics>> = {};
    for (const service of services) {
      result[service] = this.getMetrics(service);
    }
    return result;
  }

  /**
   * Reset metrics for a service
   */
  reset(serviceName: string): void {
    this.requestCounts.delete(serviceName);
    this.latencies.delete(serviceName);
    this.circuitBreakerStates.delete(serviceName);
    this.retryCounts.delete(serviceName);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.requestCounts.clear();
    this.latencies.clear();
    this.circuitBreakerStates.clear();
    this.retryCounts.clear();
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
