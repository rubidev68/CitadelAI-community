import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { CircuitBreaker } from './circuitBreaker';
import { HealthChecker } from './healthChecker';
import { executeWithRetry, classifyError } from './retryStrategy';
import { metricsCollector } from './metrics';
import { ResilientClientConfig, RetryConfig, CircuitBreakerConfig } from './types';

/**
 * Error with code property
 */
interface ErrorWithCode extends Error {
  code?: string;
}

/**
 * Resilient HTTP client wrapper
 * Provides retry logic, circuit breaker, health checks, and metrics
 */
export class ResilientHttpClient {
  private client: AxiosInstance;
  private circuitBreaker?: CircuitBreaker;
  private healthChecker?: HealthChecker;
  private config: ResilientClientConfig;
  private retryConfig?: RetryConfig;

  constructor(config: ResilientClientConfig) {
    this.config = config;

    // Create base axios client
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: config.headers || {},
    });

    // Initialize circuit breaker if configured
    if (config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    }

    // Initialize health checker if configured
    if (config.healthCheck?.enabled) {
      this.healthChecker = new HealthChecker(config.baseURL, config.healthCheck);
    }

    // Store retry config
    this.retryConfig = config.retry;
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  /**
   * Make a request with resilience patterns
   */
  private async request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const startTime = Date.now();

    // Check circuit breaker
    if (this.circuitBreaker && !this.circuitBreaker.canExecute()) {
      const error: ErrorWithCode = new Error(`Circuit breaker is OPEN for service ${this.config.serviceName}`);
      error.code = 'CIRCUIT_BREAKER_OPEN';
      metricsCollector.recordRequest(this.config.serviceName, false);
      throw error;
    }

    // Check health if enabled
    if (this.healthChecker) {
      const isHealthy = this.healthChecker.getHealthStatus();
      if (!isHealthy) {
        // Try to check health immediately
        const freshHealth = await this.healthChecker.checkHealth();
        if (!freshHealth) {
          const error: ErrorWithCode = new Error(`Service ${this.config.serviceName} is unhealthy`);
          error.code = 'SERVICE_UNHEALTHY';
          metricsCollector.recordRequest(this.config.serviceName, false);
          throw error;
        }
      }
    }

    // Execute request with retry if configured
    try {
      let response: AxiosResponse<T>;

      if (this.retryConfig) {
        // Use retry strategy
        response = await executeWithRetry(
          () => this.client.request<T>(config),
          this.retryConfig,
          (attempt, error) => {
            metricsCollector.recordRetry(this.config.serviceName);
            console.warn(
              `[ResilientClient] Retry attempt ${attempt} for ${this.config.serviceName} ${config.method} ${config.url}:`,
              error instanceof Error ? error.message : error
            );
          }
        );
      } else {
        // No retry, direct call
        response = await this.client.request<T>(config);
      }

      // Record success
      const latency = Date.now() - startTime;
      metricsCollector.recordRequest(this.config.serviceName, true);
      metricsCollector.recordLatency(this.config.serviceName, latency);

      // Update circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
        const state = this.circuitBreaker.getState();
        metricsCollector.recordCircuitBreakerState(this.config.serviceName, state);
      }

      return response;
    } catch (error) {
      // Record failure
      const latency = Date.now() - startTime;
      metricsCollector.recordRequest(this.config.serviceName, false);
      metricsCollector.recordLatency(this.config.serviceName, latency);

      // Classify error
      const classification = classifyError(error);

      // Update circuit breaker
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure(classification);
        const state = this.circuitBreaker.getState();
        metricsCollector.recordCircuitBreakerState(this.config.serviceName, state);

        if (state === 'OPEN') {
          console.error(
            `[ResilientClient] Circuit breaker OPENED for ${this.config.serviceName} after failures`
          );
        }
      }

      // Re-throw the error
      throw error;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return this.circuitBreaker?.getState();
  }

  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return this.circuitBreaker?.getMetrics();
  }

  /**
   * Get health status
   */
  getHealthStatus(): boolean | undefined {
    return this.healthChecker?.getHealthStatus();
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return metricsCollector.getMetrics(this.config.serviceName);
  }
}

/**
 * Create a resilient HTTP client
 */
export function createResilientClient(config: ResilientClientConfig): ResilientHttpClient {
  return new ResilientHttpClient(config);
}
