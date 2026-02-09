import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import CronScheduler from '../cronScheduler';
import {
  handleHealthCheck,
  handleUpdateCron,
  handleGetCronStatus,
  handleListScheduledCrawls,
  handleUnscheduleCrawl,
} from '../controllers/cron/cronController';
import { validateRequest } from '@shared/utils';
import {
  updateCronSchema,
  getCronStatusSchema,
  unscheduleCrawlSchema,
} from '../validation/cronSchemas';

export default function cronRoutes(prisma: PrismaClient, cronScheduler: CronScheduler) {
  const router = Router();

  // Health check endpoint
  router.get('/health', handleHealthCheck);

  // Update cron settings for a website context
  router.post('/cron/update', validateRequest(updateCronSchema) as any, (req, res) => handleUpdateCron(prisma, cronScheduler, req, res));

  // Get cron status for a website context
  router.get('/cron/status/:blockId', validateRequest(getCronStatusSchema) as any, (req, res) => handleGetCronStatus(prisma, req, res));

  // List all scheduled crawls
  router.get('/cron/scheduled', (req, res) => handleListScheduledCrawls(prisma, req, res));

  // Unschedule a specific crawl task
  router.delete('/cron/unschedule/:blockId', validateRequest(unscheduleCrawlSchema) as any, (req, res) => handleUnscheduleCrawl(prisma, cronScheduler, req, res));

  return router;
}
