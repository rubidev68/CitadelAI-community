import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCrawlingServiceClient, getCronSchedulerClient } from '../../services/serviceClients';
import { getServiceBaseUrl } from '@shared/utils';
import { createResilientClient } from '@shared/resilience';

// Mock dependencies
vi.mock('@shared/utils', () => ({
  getServiceBaseUrl: vi.fn(),
}));

vi.mock('@shared/resilience', () => ({
  createResilientClient: vi.fn(),
}));

describe('Service Clients', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    vi.mocked(createResilientClient).mockReturnValue(mockClient as any);
  });

  describe('getCrawlingServiceClient', () => {
    it('should create and return crawling service client', () => {
      vi.mocked(getServiceBaseUrl).mockReturnValue('http://crawling-service:3000');

      const client = getCrawlingServiceClient();

      expect(getServiceBaseUrl).toHaveBeenCalledWith('crawling-service');
      expect(createResilientClient).toHaveBeenCalledWith({
        baseURL: 'http://crawling-service:3000',
        serviceName: 'crawling-service',
        timeout: 60000,
        retry: {
          attempts: 3,
          backoff: 'exponential',
          initialDelay: 1000,
          maxDelay: 8000,
          jitter: true,
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
      expect(client).toBe(mockClient);
    });

    it('should return same client instance on subsequent calls', () => {
      vi.mocked(getServiceBaseUrl).mockReturnValue('http://crawling-service:3000');

      const client1 = getCrawlingServiceClient();
      const client2 = getCrawlingServiceClient();

      // Both should return the same client (singleton pattern)
      expect(client1).toBe(client2);
    });
  });

  describe('getCronSchedulerClient', () => {
    it('should create and return cron scheduler client', () => {
      vi.mocked(getServiceBaseUrl).mockReturnValue('http://cron-scheduler:3000');

      const client = getCronSchedulerClient();

      expect(getServiceBaseUrl).toHaveBeenCalledWith('cron-scheduler');
      expect(createResilientClient).toHaveBeenCalledWith({
        baseURL: 'http://cron-scheduler:3000',
        serviceName: 'cron-scheduler',
        timeout: 10000,
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
      expect(client).toBe(mockClient);
    });

    it('should return same client instance on subsequent calls', () => {
      vi.mocked(getServiceBaseUrl).mockReturnValue('http://cron-scheduler:3000');

      const client1 = getCronSchedulerClient();
      const client2 = getCronSchedulerClient();

      // Both should return the same client (singleton pattern)
      expect(client1).toBe(client2);
    });
  });

  describe('client configuration differences', () => {
    it('should use different configurations for different services', () => {
      vi.mocked(getServiceBaseUrl)
        .mockReturnValue('http://crawling-service:3000');

      const crawlingClient = getCrawlingServiceClient();
      expect(crawlingClient).toBeDefined();

      // Verify createResilientClient was called with crawling service config
      const calls = vi.mocked(createResilientClient).mock.calls;
      const crawlingConfig = calls.find(call => call[0]?.serviceName === 'crawling-service')?.[0];

      if (crawlingConfig) {
        expect(crawlingConfig.timeout).toBe(60000);
        expect(crawlingConfig.retry.attempts).toBe(3);
        expect(crawlingConfig.retry.backoff).toBe('exponential');
      }

      // Test cron scheduler separately
      vi.mocked(getServiceBaseUrl).mockReturnValue('http://cron-scheduler:3000');
      const cronClient = getCronSchedulerClient();
      expect(cronClient).toBeDefined();

      const cronConfig = calls.find(call => call[0]?.serviceName === 'cron-scheduler')?.[0];
      if (cronConfig) {
        expect(cronConfig.timeout).toBe(10000);
        expect(cronConfig.retry.attempts).toBe(2);
        expect(cronConfig.retry.backoff).toBe('linear');
      }
    });
  });
});
