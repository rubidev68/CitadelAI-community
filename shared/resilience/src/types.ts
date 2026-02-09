/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Retry backoff strategies
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'fixed';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit (half-open state) */
  resetTimeout: number;
  /** Number of successful requests needed to close circuit from half-open */
  successThreshold?: number;
  /** Time window in ms for tracking failures (default: 60000) */
  timeWindow?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  attempts: number;
  /** Backoff strategy */
  backoff: BackoffStrategy;
  /** Initial delay in ms */
  initialDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Whether to add jitter (randomization) to delays */
  jitter?: boolean;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Enable health checks */
  enabled: boolean;
  /** Health check endpoint path (default: /health) */
  endpoint?: string;
  /** Health check interval in ms (default: 30000) */
  interval?: number;
  /** Health check timeout in ms (default: 5000) */
  timeout?: number;
}

/**
 * Queue configuration (optional)
 */
export interface QueueConfig {
  /** Enable queuing for failed requests */
  enabled: boolean;
  /** Priority level (higher = more important) */
  priority?: number;
}

/**
 * Resilient client configuration
 */
export interface ResilientClientConfig {
  /** Base URL for the service */
  baseURL: string;
  /** Service name for logging and metrics */
  serviceName: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Health check configuration */
  healthCheck?: HealthCheckConfig;
  /** Queue configuration */
  queue?: QueueConfig;
  /** Default headers */
  headers?: Record<string, string>;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Whether the error is retryable */
  retryable: boolean;
  /** Whether the error should open circuit breaker */
  shouldOpenCircuit: boolean;
  /** Error type/category */
  type: string;
}
