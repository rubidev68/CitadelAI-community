import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crawlingRouter from '../../routes/crawling';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    chatbot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock service clients
// The service clients return ResilientHttpClient instances which have post/get methods
const { mockCrawlingServiceClient, mockCronSchedulerClient } = vi.hoisted(() => {
  const mockCrawlingServiceClient = {
    post: vi.fn(),
    get: vi.fn(),
  };
  const mockCronSchedulerClient = {
    post: vi.fn(),
    get: vi.fn(),
  };
  return { mockCrawlingServiceClient, mockCronSchedulerClient };
});

vi.mock('../../services/serviceClients', () => ({
  getCrawlingServiceClient: vi.fn(() => mockCrawlingServiceClient),
  getCronSchedulerClient: vi.fn(() => mockCronSchedulerClient),
}));

// Mock weaviate
const { mockGetCrawledPages } = vi.hoisted(() => {
  const mockGetCrawledPages = vi.fn();
  return { mockGetCrawledPages };
});

vi.mock('../../weaviate', () => ({
  getCrawledPages: mockGetCrawledPages,
}));

// Mock subscription limits
vi.mock('../../utils/subscriptionLimits', () => ({
  canUseProBlocks: vi.fn(() => true),
}));

// Mock subscription middleware (checkIndexedPagesLimit)
vi.mock('../../middleware/subscriptionMiddleware', () => ({
  checkIndexedPagesLimit: (req: any, res: any, next: any) => next(),
}));

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = { id: 'admin-id', email: 'admin@example.com' };
    next();
  },
  AdminAuthRequest: {},
}));

const app = express();
app.use(express.json());
app.use('/api/admin/crawling', crawlingRouter);

describe('Crawling Routes', () => {
  const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format
  const blockId = 'cmjbb8hwd0001qn1tp1of602h'; // Valid CUID format
  const url = 'https://example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/crawling/crawl', () => {
    it('should return 400 if URL is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          chatbotId,
          blockId,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/URL|url|required/);
    });

    it('should return 400 if chatbotId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          url,
          blockId,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/URL|url|required/);
    });

    it('should return 400 if blockId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          url,
          chatbotId,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/URL|url|required/);
    });

    it('should start crawl successfully', async () => {
      mockCrawlingServiceClient.post.mockResolvedValue({
        data: { status: 'started', jobId: 'job-123' },
      });

      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          url,
          chatbotId,
          blockId,
          recursive: true,
          maxDepth: 3,
        })
        .expect(200);

      expect(response.body.status).toBe('started');
      expect(mockCrawlingServiceClient.post).toHaveBeenCalledWith('/crawl', {
        url,
        chatbotId,
        blockId,
        recursive: true,
        maxDepth: 3,
      });
    });

    it('should handle crawling service errors', async () => {
      mockCrawlingServiceClient.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Service unavailable' },
        },
        message: 'Service unavailable',
      });

      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          url,
          chatbotId,
          blockId,
        })
        .expect(500);

      expect(response.body.error).toBe('Service unavailable');
    });

    it('should handle connection errors', async () => {
      mockCrawlingServiceClient.post.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      });

      const response = await request(app)
        .post('/api/admin/crawling/crawl')
        .send({
          url,
          chatbotId,
          blockId,
        })
        .expect(500);

      expect(response.body.error).toBe('Connection refused');
      expect(response.body.code).toBe('ECONNREFUSED');
    });
  });

  describe('GET /api/admin/crawling/status/:blockId', () => {
    it('should return crawling status', async () => {
      mockCrawlingServiceClient.get.mockResolvedValue({
        data: { status: 'crawling', pagesCrawled: 10, totalPages: 50 },
      });

      const response = await request(app)
        .get(`/api/admin/crawling/status/${blockId}`)
        .expect(200);

      expect(response.body.status).toBe('crawling');
      expect(response.body.pagesCrawled).toBe(10);
      expect(mockCrawlingServiceClient.get).toHaveBeenCalledWith(`/crawl/status/${blockId}`);
    });

    it('should handle status fetch errors', async () => {
      mockCrawlingServiceClient.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: 'Crawl not found' },
        },
        message: 'Not found',
      });

      const response = await request(app)
        .get(`/api/admin/crawling/status/${blockId}`)
        .expect(404);

      expect(response.body.error).toBe('Crawl not found');
    });
  });

  describe('POST /api/admin/crawling/stop', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/stop')
        .send({
          blockId,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/chatbotId|blockId|required/);
    });

    it('should return 400 if blockId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/stop')
        .send({
          chatbotId,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/chatbotId|blockId|required/);
    });

    it('should stop crawl successfully', async () => {
      mockCrawlingServiceClient.post.mockResolvedValue({
        data: { status: 'stopped' },
      });

      const response = await request(app)
        .post('/api/admin/crawling/stop')
        .send({
          chatbotId,
          blockId,
        })
        .expect(200);

      expect(response.body.status).toBe('stopped');
      expect(mockCrawlingServiceClient.post).toHaveBeenCalledWith('/stop', {
        chatbotId,
        blockId,
      });
    });

    it('should handle stop errors', async () => {
      mockCrawlingServiceClient.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Failed to stop' },
        },
        message: 'Failed to stop',
      });

      const response = await request(app)
        .post('/api/admin/crawling/stop')
        .send({
          chatbotId,
          blockId,
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to stop');
    });
  });

  describe('POST /api/admin/crawling/cron/update', () => {
    it('should return 400 if blockId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/crawling/cron/update')
        .send({
          cronEnabled: true,
        })
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/blockId|required/);
    });

    it('should return 403 if no subscription found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/crawling/cron/update')
        .send({
          blockId,
          cronEnabled: true,
        })
        .expect(403);

      expect(response.body.error).toBe('No subscription found');
      expect(response.body.code).toBe('NO_SUBSCRIPTION');
    });

    it('should return 403 if plan does not support cron', async () => {
      const { canUseProBlocks } = await import('../../utils/subscriptionLimits');
      vi.mocked(canUseProBlocks).mockReturnValueOnce(false);

      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        adminUserId: 'admin-id',
        plan: {
          id: 'plan-123',
          name: 'Basic',
        },
      } as any);

      const response = await request(app)
        .post('/api/admin/crawling/cron/update')
        .send({
          blockId,
          cronEnabled: true,
        })
        .expect(403);

      expect(response.body.error).toContain('Scheduled crawling is not available');
      expect(response.body.code).toBe('CRON_NOT_AVAILABLE');
    });

    it('should update cron settings successfully', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        adminUserId: 'admin-id',
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
      } as any);

      mockCronSchedulerClient.post.mockResolvedValue({
        data: { success: true },
      });

      const response = await request(app)
        .post('/api/admin/crawling/cron/update')
        .send({
          blockId,
          cronEnabled: true,
          cronSchedule: '0 0 * * *',
          cronTimezone: 'UTC',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCronSchedulerClient.post).toHaveBeenCalledWith('/cron/update', {
        blockId,
        cronEnabled: true,
        cronSchedule: '0 0 * * *',
        cronTimezone: 'UTC',
      });
    });

    it('should handle cron update errors', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        adminUserId: 'admin-id',
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
      } as any);

      mockCronSchedulerClient.post.mockRejectedValue({
        response: {
          status: 500,
          data: { error: 'Failed to update' },
        },
        message: 'Failed to update',
      });

      const response = await request(app)
        .post('/api/admin/crawling/cron/update')
        .send({
          blockId,
          cronEnabled: true,
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to update');
    });
  });

  describe('GET /api/admin/crawling/crawled-pages/:blockId', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const response = await request(app)
        .get(`/api/admin/crawling/crawled-pages/${blockId}`)
        .expect(400);

      expect(response.body.message || response.body.error).toMatch(/blockId|chatbotId|required/);
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/crawling/crawled-pages/${blockId}?chatbotId=${chatbotId}`)
        .expect(404);

      expect(response.body.error || response.body.message).toMatch(/Chatbot not found|Chatbot not found or access denied/);
    });

    it('should return crawled pages successfully', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      } as any);

      const mockPages = [
        { url: 'https://example.com/page1', title: 'Page 1' },
        { url: 'https://example.com/page2', title: 'Page 2' },
      ];

      mockGetCrawledPages.mockResolvedValue(mockPages);

      const response = await request(app)
        .get(`/api/admin/crawling/crawled-pages/${blockId}?chatbotId=${chatbotId}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].url).toBe('https://example.com/page1');
      expect(mockGetCrawledPages).toHaveBeenCalledWith(chatbotId, blockId);
    });

    it('should deduplicate pages by URL', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      } as any);

      const mockPages = [
        { url: 'https://example.com/page1', title: 'Page 1' },
        { url: 'https://example.com/page1', title: 'Page 1 Duplicate' },
        { url: 'https://example.com/page2', title: 'Page 2' },
      ];

      mockGetCrawledPages.mockResolvedValue(mockPages);

      const response = await request(app)
        .get(`/api/admin/crawling/crawled-pages/${blockId}?chatbotId=${chatbotId}`)
        .expect(200);

      // Should deduplicate by URL
      expect(response.body).toHaveLength(2);
      expect(response.body[0].url).toBe('https://example.com/page1');
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      } as any);

      mockGetCrawledPages.mockRejectedValue(new Error('Weaviate error'));

      const response = await request(app)
        .get(`/api/admin/crawling/crawled-pages/${blockId}?chatbotId=${chatbotId}`)
        .expect(500);

      expect(response.body.error).toBe('Error fetching crawled pages');
    });
  });
});
