import CrawlingService from '../../crawling';
import OptimizedCrawlingService from '../../optimized-crawling';
import prisma from '../../lib/prisma';

/**
 * Crawl endpoint (optimized)
 */
export async function handleCrawl(
  optimizedCrawlingService: OptimizedCrawlingService,
  req: any,
  res: any
): Promise<void> {
  const { url, chatbotId, blockId, recursive, maxDepth } = req.body;

  if (!url || !chatbotId || !blockId) {
    res.status(400).json({ error: 'URL, chatbotId, and blockId are required' });
    return;
  }

  try {
    // IMPORTANT: Always update chatbotId in case it changed (e.g., chatbot was recreated with new ID)
    await prisma.websiteContext.upsert({
      where: { blockId },
      update: {
        chatbotId, // Update chatbotId to ensure it matches the current chatbot
        url,
        crawlingStatus: { status: 'queued' },
        lastCrawledAt: null,
        crawledPagesCount: null,
      },
      create: {
        chatbotId,
        blockId,
        url,
        crawlingStatus: { status: 'queued' },
      },
    });
    
    console.log(`[CRAWL QUEUE] - WebsiteContext upserted for blockId: ${blockId}, chatbotId: ${chatbotId}`);

    // Use the optimized service by default
    optimizedCrawlingService.addJobToQueue({
      startUrl: url,
      chatbotId,
      blockId,
      recursive: recursive || false,
      maxDepth: maxDepth || 3,
    });

    res.json({ message: 'Optimized crawling job added to the queue' });
  } catch (error: unknown) {
    console.error(`[CRAWL QUEUE ERROR] - Failed to add job for blockId: ${blockId}`, error);
    res.status(500).json({ error: 'Failed to add job to the queue' });
  }
}

/**
 * Legacy crawl endpoint
 */
export async function handleCrawlLegacy(
  crawlingService: CrawlingService,
  req: any,
  res: any
): Promise<void> {
  const { url, chatbotId, blockId, recursive, maxDepth } = req.body;

  if (!url || !chatbotId || !blockId) {
    res.status(400).json({ error: 'URL, chatbotId, and blockId are required' });
    return;
  }

  try {
    await prisma.websiteContext.upsert({
      where: { blockId },
      update: {
        url,
        crawlingStatus: { status: 'queued' },
        lastCrawledAt: null,
        crawledPagesCount: null,
      },
      create: {
        chatbotId,
        blockId,
        url,
        crawlingStatus: { status: 'queued' },
      },
    });

    crawlingService.addJobToQueue({
      startUrl: url,
      chatbotId,
      blockId,
      recursive: recursive || false,
      maxDepth: maxDepth || 3,
    });

    res.json({ message: 'Legacy crawling job added to the queue' });
  } catch (error: unknown) {
    console.error(`[CRAWL LEGACY ERROR] - Failed to add job for blockId: ${blockId}`, error);
    res.status(500).json({ error: 'Failed to add legacy job to the queue' });
  }
}

/**
 * Get crawling status
 */
export async function handleGetStatus(req: any, res: any): Promise<void> {
  const { blockId } = req.params;
  console.log(`Fetching status for blockId: ${blockId}`);
  try {
    const websiteContext = await prisma.websiteContext.findUnique({ where: { blockId } });
    if (websiteContext) {
      res.json(websiteContext.crawlingStatus);
    } else {
      res.status(404).json({ error: 'No crawling job found for this block' });
    }
  } catch (error: unknown) {
    console.error('Error fetching crawling status:', error);
    res.status(500).json({ error: 'Error fetching crawling status' });
  }
}

/**
 * Stop crawling
 */
export async function handleStopCrawl(
  optimizedCrawlingService: OptimizedCrawlingService,
  req: any,
  res: any
): Promise<void> {
  const { chatbotId, blockId } = req.body;
  if (!chatbotId || !blockId) {
    res.status(400).json({ error: 'chatbotId and blockId are required' });
    return;
  }
  optimizedCrawlingService.stopCrawling(chatbotId, blockId);
  res.json({ message: 'Crawling stopped for block' });
}

/**
 * Health check endpoint
 */
export async function handleHealthCheck(req: any, res: any): Promise<void> {
  try {
    const { checkPrismaHealth } = await import('../../lib/prisma');
    const prismaHealth = await checkPrismaHealth();
    
    res.json({
      status: prismaHealth.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        prisma: {
          status: prismaHealth.healthy ? 'connected' : 'disconnected',
          latency: prismaHealth.latency,
          error: prismaHealth.error,
        },
      },
    });
  } catch (error: unknown) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get concurrency status
 */
export async function handleGetConcurrencyStatus(
  optimizedCrawlingService: OptimizedCrawlingService,
  req: any,
  res: any
): Promise<void> {
  const status = optimizedCrawlingService.getConcurrencyStatus();
  res.json(status);
}
