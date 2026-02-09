import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import * as cronParser from 'cron-parser';
import { createResilientClient, ResilientHttpClient } from '@shared/resilience';
import { getServiceBaseUrl } from '@shared/utils';

interface ScheduledJob {
  blockId: string;
  cronExpression: string;
  timezone: string;
  task: cron.ScheduledTask;
}

export default class CronScheduler {
  private prisma: PrismaClient;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private CRAWLING_SERVICE_URL: string;
  private crawlingClient: ResilientHttpClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    // Centralized crawling service URL from shared registry (keeps existing defaults)
    this.CRAWLING_SERVICE_URL = getServiceBaseUrl('crawling-service');

    this.crawlingClient = createResilientClient({
      baseURL: this.CRAWLING_SERVICE_URL,
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

  async initialize() {
    console.log('Initializing cron scheduler...');
    
    // Load all enabled cron jobs from database
    const websiteContexts = await this.prisma.websiteContext.findMany({
      where: {
        cronEnabled: true,
        cronSchedule: { not: null },
      },
    });

    for (const context of websiteContexts) {
      if (context.cronSchedule) {
        await this.scheduleCrawl(
          context.blockId,
          context.cronSchedule,
          context.cronTimezone || 'UTC'
        );
      }
    }

    console.log(`Initialized ${this.scheduledJobs.size} cron jobs`);
  }

  async scheduleCrawl(blockId: string, cronExpression: string, timezone: string = 'UTC') {
    try {
      // Validate cron expression
      cronParser.parseExpression(cronExpression);

      // Remove existing job if it exists
      await this.unscheduleCrawl(blockId);

      // Create new cron task
      const task = cron.schedule(
        cronExpression,
        async () => {
          await this.executeCrawl(blockId);
        },
        {
          scheduled: true,
          timezone: timezone,
        }
      );

      // Store the job
      this.scheduledJobs.set(blockId, {
        blockId,
        cronExpression,
        timezone,
        task,
      });

      // Update next crawl time in database
      const nextCrawlAt = this.calculateNextCrawl(cronExpression, timezone);
      await this.prisma.websiteContext.update({
        where: { blockId },
        data: { nextCrawlAt },
      });

      console.log(`Scheduled crawl for blockId ${blockId} with expression ${cronExpression} in timezone ${timezone}`);
    } catch (error) {
      console.error(`Error scheduling crawl for blockId ${blockId}:`, error);
      throw error;
    }
  }

  async unscheduleCrawl(blockId: string) {
    const job = this.scheduledJobs.get(blockId);
    if (job) {
      job.task.stop();
      this.scheduledJobs.delete(blockId);
      
      // Clear next crawl time in database
      await this.prisma.websiteContext.update({
        where: { blockId },
        data: { nextCrawlAt: null },
      });

      console.log(`Unscheduled crawl for blockId ${blockId}`);
    }
  }

  private async executeCrawl(blockId: string) {
    try {
      console.log(`Executing scheduled crawl for blockId ${blockId}`);

      // Get website context details
      const websiteContext = await this.prisma.websiteContext.findUnique({
        where: { blockId },
        include: {
          chatbot: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!websiteContext) {
        console.error(`Website context not found for blockId ${blockId}`);
        return;
      }

      // Update crawling status
      await this.prisma.websiteContext.update({
        where: { blockId },
        data: {
          crawlingStatus: { status: 'queued' },
        },
      });

      // Trigger crawl via crawling service
      const response = await this.crawlingClient.post('/crawl', {
        url: websiteContext.url,
        chatbotId: websiteContext.chatbotId,
        blockId: websiteContext.blockId,
        recursive: websiteContext.recursive,
        maxDepth: websiteContext.maxDepth,
      });

      console.log(`Scheduled crawl triggered for blockId ${blockId}:`, response.data);

      // Update next crawl time
      if (websiteContext.cronSchedule) {
        const nextCrawlAt = this.calculateNextCrawl(
          websiteContext.cronSchedule,
          websiteContext.cronTimezone || 'UTC'
        );
        await this.prisma.websiteContext.update({
          where: { blockId },
          data: { nextCrawlAt },
        });
      }
    } catch (error) {
      console.error(`Error executing scheduled crawl for blockId ${blockId}:`, error);
      
      // Update status to error
      await this.prisma.websiteContext.update({
        where: { blockId },
        data: {
          crawlingStatus: { status: 'error' },
        },
      });
    }
  }

  calculateNextCrawl(cronExpression: string, timezone: string = 'UTC'): Date {
    try {
      const interval = cronParser.parseExpression(cronExpression, {
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (error) {
      console.error('Error calculating next crawl time:', error);
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24 hours from now
    }
  }

  getScheduledJobs(): Array<{ blockId: string; cronExpression: string; timezone: string }> {
    return Array.from(this.scheduledJobs.values()).map(job => ({
      blockId: job.blockId,
      cronExpression: job.cronExpression,
      timezone: job.timezone,
    }));
  }

  shutdown() {
    console.log('Shutting down cron scheduler...');
    for (const [blockId, job] of this.scheduledJobs) {
      job.task.stop();
      console.log(`Stopped cron job for blockId ${blockId}`);
    }
    this.scheduledJobs.clear();
  }
}