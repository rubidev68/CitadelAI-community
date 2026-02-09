import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import CronScheduler from '../../cronScheduler';

/**
 * Health check endpoint
 */
export async function handleHealthCheck(req: Request, res: Response): Promise<void> {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
}

/**
 * Update cron settings for a website context
 */
export async function handleUpdateCron(
  prisma: PrismaClient,
  cronScheduler: CronScheduler,
  req: Request,
  res: Response
): Promise<void> {
  const { blockId, cronEnabled, cronSchedule, cronTimezone } = req.body;

  if (!blockId) {
    res.status(400).json({ error: 'blockId is required' });
    return;
  }

  try {
    // Check if website context exists first
    const existingContext = await prisma.websiteContext.findUnique({
      where: { blockId },
    });

    if (!existingContext) {
      res.status(404).json({ error: 'Website context not found. Please create a website context block first.' });
      return;
    }

    // Update the database
    const websiteContext = await prisma.websiteContext.update({
      where: { blockId },
      data: {
        cronEnabled: cronEnabled || false,
        cronSchedule: cronSchedule || null,
        cronTimezone: cronTimezone || 'UTC',
        nextCrawlAt: cronEnabled && cronSchedule ? 
          cronScheduler.calculateNextCrawl(cronSchedule, cronTimezone || 'UTC') : null,
      },
    });

    // Update the cron scheduler
    if (cronEnabled && cronSchedule) {
      await cronScheduler.scheduleCrawl(blockId, cronSchedule, cronTimezone || 'UTC');
    } else {
      await cronScheduler.unscheduleCrawl(blockId);
    }

    res.json({ 
      message: 'Cron settings updated successfully',
      nextCrawlAt: websiteContext.nextCrawlAt 
    });
  } catch (error: unknown) {
    console.error('Error updating cron settings:', error);
    res.status(500).json({ error: 'Error updating cron settings' });
  }
}

/**
 * Get cron status for a website context
 */
export async function handleGetCronStatus(prisma: PrismaClient, req: Request, res: Response): Promise<void> {
  const { blockId } = req.params;

  try {
    const websiteContext = await prisma.websiteContext.findUnique({
      where: { blockId },
      select: {
        cronEnabled: true,
        cronSchedule: true,
        cronTimezone: true,
        nextCrawlAt: true,
      },
    });

    if (!websiteContext) {
      res.status(404).json({ error: 'Website context not found' });
      return;
    }

    res.json(websiteContext);
  } catch (error: unknown) {
    console.error('Error fetching cron status:', error);
    res.status(500).json({ error: 'Error fetching cron status' });
  }
}

/**
 * List all scheduled crawls
 */
export async function handleListScheduledCrawls(prisma: PrismaClient, req: Request, res: Response): Promise<void> {
  try {
    const scheduledContexts = await prisma.websiteContext.findMany({
      where: {
        cronEnabled: true,
        cronSchedule: { not: null },
      },
      select: {
        blockId: true,
        url: true,
        cronSchedule: true,
        cronTimezone: true,
        nextCrawlAt: true,
        chatbot: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json(scheduledContexts);
  } catch (error: unknown) {
    console.error('Error fetching scheduled crawls:', error);
    res.status(500).json({ error: 'Error fetching scheduled crawls' });
  }
}

/**
 * Unschedule a specific crawl task
 */
export async function handleUnscheduleCrawl(
  prisma: PrismaClient,
  cronScheduler: CronScheduler,
  req: Request,
  res: Response
): Promise<void> {
  const { blockId } = req.params;

  if (!blockId) {
    res.status(400).json({ error: 'blockId is required' });
    return;
  }

  try {
    // Check if website context exists
    const existingContext = await prisma.websiteContext.findUnique({
      where: { blockId },
    });

    if (!existingContext) {
      res.status(404).json({ error: 'Website context not found' });
      return;
    }

    // Unschedule the cron task
    await cronScheduler.unscheduleCrawl(blockId);

    // Update the database to disable cron
    await prisma.websiteContext.update({
      where: { blockId },
      data: {
        cronEnabled: false,
        cronSchedule: null,
        cronTimezone: null,
        nextCrawlAt: null,
      },
    });

    res.json({ 
      message: 'Crawl task unscheduled successfully',
      blockId 
    });
  } catch (error: unknown) {
    console.error('Error unscheduling crawl task:', error);
    res.status(500).json({ error: 'Error unscheduling crawl task' });
  }
}
