import { Router } from 'express';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import { getCrawledPages } from '../weaviate';
import { getCrawlingServiceClient, getCronSchedulerClient } from '../services/serviceClients';
import { checkIndexedPagesLimit } from '../middleware/subscriptionMiddleware';
import { canUseProBlocks } from '../utils/subscriptionLimits';
import prisma from '../lib/prisma';
import { logger, validateRequest } from '@shared/utils';
import {
  startCrawlSchema,
  getCrawlStatusSchema,
} from '../validation/crawlingSchemas';
import { chatbotIdSchema, blockIdSchema } from '@shared/utils';
import { z } from 'zod';

const crawlingRoutesLogger = logger.child({ service: 'admin-backend', component: 'crawling-routes' });

const router = Router();

router.post('/crawl', adminAuthMiddleware, checkIndexedPagesLimit, validateRequest(startCrawlSchema) as any, async (req: AdminAuthRequest, res) => {
  const { url, chatbotId, blockId, recursive, maxDepth } = req.body;

  if (!url || !chatbotId || !blockId) {
    return res.status(400).json({ error: 'URL, chatbotId, and blockId are required' });
  }

  try {
    crawlingRoutesLogger.info('Starting crawl', { chatbotId, blockId, url });
    const client = getCrawlingServiceClient();
    const response = await client.post('/crawl', {
      url,
      chatbotId,
      blockId,
      recursive,
      maxDepth,
    });
    crawlingRoutesLogger.info('Crawl started successfully', { blockId });
    res.json(response.data);
  } catch (error: unknown) {
    crawlingRoutesLogger.error('Crawl request error', { error: error instanceof Error ? error : new Error(String(error)) });
    const axiosError = error as { response?: { status?: number; data?: { error?: string } }; message?: string; code?: string };
    const statusCode = axiosError.response?.status || 500;
    const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Failed to start crawling';
    
    // Log more details for debugging
    if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ETIMEDOUT') {
      crawlingRoutesLogger.error('Connection error to crawling service', { code: axiosError.code });
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      code: axiosError.code || 'CRAWL_ERROR'
    });
  }
});

router.get('/status/:blockId', adminAuthMiddleware, validateRequest(getCrawlStatusSchema) as any, async (req, res) => {
  const { blockId } = req.params;
  try {
    const client = getCrawlingServiceClient();
    const response = await client.get(`/crawl/status/${blockId}`);
    res.json(response.data);
  } catch (error: unknown) {
    crawlingRoutesLogger.error('Error fetching crawling status', { error: error instanceof Error ? error : new Error(String(error)) });
    const axiosError = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
    const statusCode = axiosError.response?.status || 500;
    const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Error fetching crawling status';
    res.status(statusCode).json({ error: errorMessage });
  }
});

router.post('/stop', adminAuthMiddleware, validateRequest({
  body: z.object({
    chatbotId: chatbotIdSchema,
    blockId: blockIdSchema,
  }),
}) as any, async (req, res) => {
  const { chatbotId, blockId } = req.body;
  try {
    const client = getCrawlingServiceClient();
    const response = await client.post('/stop', { chatbotId, blockId });
    res.json(response.data);
  } catch (error: unknown) {
    crawlingRoutesLogger.error('Error stopping crawl', { error: error instanceof Error ? error : new Error(String(error)) });
    const axiosError = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
    const statusCode = axiosError.response?.status || 500;
    const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Error stopping crawl';
    res.status(statusCode).json({ error: errorMessage });
  }
});

router.post('/cron/update', adminAuthMiddleware, validateRequest({
  body: z.object({
    blockId: blockIdSchema,
    cronEnabled: z.boolean().optional(),
    cronSchedule: z.string().optional(),
    cronTimezone: z.string().optional(),
  }),
}) as any, async (req: AdminAuthRequest, res) => {
  const { blockId, cronEnabled, cronSchedule, cronTimezone } = req.body;

  try {
    // Check if user has Pro/Enterprise plan (required for cron scheduling)
    const subscription = await prisma.subscription.findUnique({
      where: { adminUserId: req.adminUser!.id },
      include: { plan: true }
    });

    if (!subscription) {
      return res.status(403).json({ 
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION',
        message: 'Please subscribe to a plan to access this feature'
      });
    }

    // Cron scheduling is Pro/Enterprise only
    if (!canUseProBlocks(subscription.plan)) {
      return res.status(403).json({
        error: 'Scheduled crawling is not available',
        code: 'CRON_NOT_AVAILABLE',
        message: 'Scheduled crawling is available in Professional and Enterprise plans. Please upgrade to access this feature.'
      });
    }

    const client = getCronSchedulerClient();
    const response = await client.post('/cron/update', {
      blockId,
      cronEnabled,
      cronSchedule,
      cronTimezone,
    });
    res.json(response.data);
  } catch (error: unknown) {
    crawlingRoutesLogger.error('Error updating cron settings', { error: error instanceof Error ? error : new Error(String(error)) });
    const axiosError = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
    const statusCode = axiosError.response?.status || 500;
    const errorMessage = axiosError.response?.data?.error || axiosError.message || 'Error updating cron settings';
    res.status(statusCode).json({ error: errorMessage });
  }
});

router.get('/crawled-pages/:blockId', adminAuthMiddleware, validateRequest({
  params: z.object({
    blockId: blockIdSchema,
  }),
  query: z.object({
    chatbotId: chatbotIdSchema,
  }),
}) as any, async (req: AdminAuthRequest, res) => {
  const { blockId } = req.params;
  const chatbotId = req.query.chatbotId as string;

  try {
    // Verify the user owns the chatbot
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId,
        ownerId: req.adminUser!.id,
      },
    });

    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found or access denied' });
    }

    const pages = await getCrawledPages(chatbotId, blockId);
    // Return unique links by URL (first occurrence), keep title when available
    const seen = new Set<string>();
    const unique = [] as Array<{ url: string; title?: string; content?: string }>;
    interface WeaviatePage {
      url?: string;
      title?: string;
      content?: string;
      properties?: { url?: string; title?: string };
    }
    for (const p of (pages as WeaviatePage[])) {
      const url = (p.url || (p.properties && p.properties.url) || '').toString();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      unique.push({ url, title: (p.title || p.properties?.title) as string | undefined });
    }
    res.json(unique);
  } catch (error) {
    crawlingRoutesLogger.error('Error fetching crawled pages', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error fetching crawled pages' });
  }
});

export default router;