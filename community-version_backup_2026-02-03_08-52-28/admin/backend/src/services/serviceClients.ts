import { createResilientClient, ResilientHttpClient } from '@shared/resilience';
// Import from local copy in src tree (copied during Docker build)
import { getServiceBaseUrl } from '@shared/utils';

/**
 * Service clients with resilience patterns
 * Centralized configuration for all service-to-service communication
 */

let crawlingServiceClient: ResilientHttpClient | null = null;
let cronSchedulerClient: ResilientHttpClient | null = null;

/**
 * Get or create crawling service client
 */
export function getCrawlingServiceClient(): ResilientHttpClient {
  if (!crawlingServiceClient) {
    const baseURL = getServiceBaseUrl('crawling-service');

    crawlingServiceClient = createResilientClient({
      baseURL,
      serviceName: 'crawling-service',
      timeout: 60000, // Longer timeout for crawling operations
      retry: {
        attempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 8000,
        jitter: true,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000, // 30 seconds
        successThreshold: 1,
      },
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
      },
    });
  }
  return crawlingServiceClient;
}

/**
 * Get or create cron scheduler client
 */
export function getCronSchedulerClient(): ResilientHttpClient {
  if (!cronSchedulerClient) {
    const baseURL = getServiceBaseUrl('cron-scheduler');

    cronSchedulerClient = createResilientClient({
      baseURL,
      serviceName: 'cron-scheduler',
      timeout: 10000, // Shorter timeout for scheduler operations
      retry: {
        attempts: 2,
        backoff: 'linear',
        initialDelay: 1000,
        maxDelay: 5000,
        jitter: false,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
        successThreshold: 1,
      },
      healthCheck: {
        enabled: true,
        endpoint: '/health',
        interval: 30000,
        timeout: 5000,
      },
    });
  }
  return cronSchedulerClient;
}
