import { CircuitBreakerState, CircuitBreakerConfig, ErrorClassification } from './types';

/**
 * Circuit breaker implementation
 * Prevents cascading failures by stopping requests to failing services
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: number[] = [];
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold,
      resetTimeout: config.resetTimeout,
      successThreshold: config.successThreshold || 1,
      timeWindow: config.timeWindow || 60000, // 1 minute default
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Check if request should be allowed
   */
  canExecute(): boolean {
    this.updateState();
    return this.state !== CircuitBreakerState.OPEN;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.close();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Clear old failures on success
      this.cleanOldFailures();
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(error: ErrorClassification): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push(now);

    if (error.shouldOpenCircuit) {
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        // Failed in half-open, open immediately
        this.open();
      } else if (this.state === CircuitBreakerState.CLOSED) {
        // Check if we should open
        this.cleanOldFailures();
        if (this.failures.length >= this.config.failureThreshold) {
          this.open();
        }
      }
    }
  }

  /**
   * Update circuit breaker state based on time
   */
  private updateState(): void {
    if (this.state === CircuitBreakerState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.halfOpen();
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.successes = 0;
  }

  /**
   * Close the circuit breaker
   */
  private close(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = [];
    this.successes = 0;
  }

  /**
   * Move to half-open state
   */
  private halfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successes = 0;
    // Keep failures for reference but reset count
  }

  /**
   * Remove failures outside the time window
   */
  private cleanOldFailures(): void {
    const now = Date.now();
    const cutoff = now - this.config.timeWindow;
    this.failures = this.failures.filter(time => time > cutoff);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successes,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
