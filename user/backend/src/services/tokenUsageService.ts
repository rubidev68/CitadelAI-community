/**
 * Token Usage Tracking Service
 * Tracks API token usage with detailed logging and analytics
 */

import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const usageLogger = logger.child({ service: 'user-backend', component: 'tokenUsage' });

/**
 * Log token usage
 */
export async function logTokenUsage(data: {
  tokenId: string;
  endpoint: string;
  requestMethod: string;
  ipAddress?: string;
  statusCode: number;
  responseTime?: number;
}): Promise<void> {
  try {
    await prisma.tokenUsageLog.create({
      data: {
        tokenId: data.tokenId,
        endpoint: data.endpoint,
        requestMethod: data.requestMethod,
        ipAddress: data.ipAddress,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
      },
    });
  } catch (error) {
    // Don't fail the request if logging fails
    usageLogger.error('Failed to log token usage', error instanceof Error ? error : new Error(String(error)), {
      tokenId: data.tokenId,
    });
  }
}
