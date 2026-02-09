import { RetryConfig, ErrorClassification } from './types';
import axios, { AxiosError } from 'axios';

/**
 * Classify error to determine if it's retryable
 */
export function classifyError(error: unknown): ErrorClassification {
  // Network errors - always retryable
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    
    // Network errors (no response)
    if (!axiosError.response) {
      interface AxiosErrorWithCode extends AxiosError {
        code?: string;
      }
      const errorWithCode = axiosError as AxiosErrorWithCode;
      const code = errorWithCode.code;
      if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'ECONNRESET') {
        return {
          retryable: true,
          shouldOpenCircuit: true,
          type: 'network_error',
        };
      }
      return {
        retryable: true,
        shouldOpenCircuit: true,
        type: 'network_error',
      };
    }

    const status = axiosError.response.status;

    // 5xx errors - retryable, should open circuit
    if (status >= 500) {
      return {
        retryable: true,
        shouldOpenCircuit: true,
        type: 'server_error',
      };
    }

    // 429 Too Many Requests - retryable
    if (status === 429) {
      return {
        retryable: true,
        shouldOpenCircuit: false,
        type: 'rate_limit',
      };
    }

    // 4xx errors (except 429) - not retryable
    return {
      retryable: false,
      shouldOpenCircuit: false,
      type: 'client_error',
    };
  }

  // Unknown errors - assume retryable but don't open circuit
  return {
    retryable: true,
    shouldOpenCircuit: false,
    type: 'unknown_error',
  };
}

/**
 * Calculate delay for retry attempt
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const initialDelay = config.initialDelay || 1000;
  const maxDelay = config.maxDelay || 30000;

  let delay: number;

  switch (config.backoff) {
    case 'exponential':
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'fixed':
    default:
      delay = initialDelay;
      break;
  }

  // Apply max delay
  delay = Math.min(delay, maxDelay);

  // Add jitter if enabled (randomize ±20%)
  if (config.jitter) {
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    delay = Math.max(0, delay + jitter);
  }

  return Math.round(delay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  onRetry?: (attempt: number, error: unknown) => void
): Promise<T> {
  let lastError: unknown;
  const maxAttempts = config.attempts + 1; // +1 for initial attempt

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const classification = classifyError(error);

      // Don't retry if error is not retryable
      if (!classification.retryable) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= maxAttempts) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      if (onRetry) {
        onRetry(attempt, error);
      }
      await sleep(delay);
    }
  }

  throw lastError;
}
