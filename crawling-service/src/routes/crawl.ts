import express from 'express';
import CrawlingService from '../crawling';
import OptimizedCrawlingService from '../optimized-crawling';
import {
  handleCrawl,
  handleCrawlLegacy,
  handleGetStatus,
  handleStopCrawl,
  handleHealthCheck,
  handleGetConcurrencyStatus,
} from '../controllers/crawl/crawlController';
import { validateRequest } from '@shared/utils';
import {
  crawlSchema,
  crawlLegacySchema,
  getCrawlStatusSchema,
  stopCrawlSchema,
} from '../validation/crawlSchemas';

const crawlRoutes = (
  crawlingService: CrawlingService,
  optimizedCrawlingService: OptimizedCrawlingService
): any => {
  const router: any = (express as any).Router();

  // Crawl endpoint (optimized)
  router.post('/crawl', validateRequest(crawlSchema) as any, (req: any, res: any) => handleCrawl(optimizedCrawlingService, req, res));

  // Legacy crawling endpoint
  router.post('/crawl-legacy', validateRequest(crawlLegacySchema) as any, (req: any, res: any) => handleCrawlLegacy(crawlingService, req, res));

  // Get crawling status
  router.get('/status/:blockId', validateRequest(getCrawlStatusSchema) as any, handleGetStatus);

  // Kong route for /crawl/status/:blockId
  router.get('/crawl/status/:blockId', validateRequest(getCrawlStatusSchema) as any, handleGetStatus);

  // Stop crawling
  router.post('/stop', validateRequest(stopCrawlSchema) as any, (req: any, res: any) => handleStopCrawl(optimizedCrawlingService, req, res));

  // Health check endpoint
  router.get('/health', handleHealthCheck);

  // Status endpoint to show concurrency information
  router.get('/concurrency-status', (req: any, res: any) => handleGetConcurrencyStatus(optimizedCrawlingService, req, res));

  return router;
};

export default crawlRoutes;
