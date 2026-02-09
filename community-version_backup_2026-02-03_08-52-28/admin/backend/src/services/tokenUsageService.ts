/**
 * Token Usage Tracking Service
 * Tracks API token usage with detailed logging and analytics
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const usageLogger = logger.child({ service: 'admin-backend', component: 'tokenUsage' });

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

/**
 * Get real-time usage statistics for a token (last hour)
 */
export async function getRealTimeUsage(tokenId: string): Promise<{
  requestCount: number;
  recentRequests: Array<{
    endpoint: string;
    method: string;
    statusCode: number;
    timestamp: Date;
    ipAddress: string | null;
  }>;
  requestsPerEndpoint: Record<string, number>;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [recentLogs, endpointCounts] = await Promise.all([
    prisma.tokenUsageLog.findMany({
      where: {
        tokenId,
        timestamp: {
          gte: oneHourAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 20, // Last 20 requests
      select: {
        endpoint: true,
        requestMethod: true,
        statusCode: true,
        timestamp: true,
        ipAddress: true,
      },
    }),
    prisma.tokenUsageLog.groupBy({
      by: ['endpoint'],
      where: {
        tokenId,
        timestamp: {
          gte: oneHourAgo,
        },
      },
      _count: {
        endpoint: true,
      },
    }),
  ]);

  const requestsPerEndpoint: Record<string, number> = {};
  endpointCounts.forEach((item: { endpoint: string; _count: { endpoint: number } }) => {
    requestsPerEndpoint[item.endpoint] = item._count.endpoint;
  });

  return {
    requestCount: recentLogs.length,
    recentRequests: recentLogs.map((log: { endpoint: string; requestMethod: string; statusCode: number; timestamp: Date; ipAddress: string | null }) => ({
      endpoint: log.endpoint,
      method: log.requestMethod,
      statusCode: log.statusCode,
      timestamp: log.timestamp,
      ipAddress: log.ipAddress,
    })),
    requestsPerEndpoint,
  };
}

/**
 * Get aggregated usage statistics
 */
export async function getAggregatedUsage(
  tokenId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  totalRequests: number;
  requestsPerHour: Array<{ hour: string; count: number }>;
  requestsPerDay: Array<{ day: string; count: number }>;
  topIpAddresses: Array<{ ipAddress: string; count: number }>;
  averageResponseTime: number | null;
  errorRate: number; // Percentage of 4xx/5xx responses
}> {
  const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
  const endDate = options?.endDate || new Date();

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const [allLogs, last24HoursLogs, ipCounts] = await Promise.all([
    prisma.tokenUsageLog.findMany({
      where: {
        tokenId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        statusCode: true,
        responseTime: true,
        timestamp: true,
      },
    }),
    // Get logs for last 24 hours for hourly aggregation
    prisma.tokenUsageLog.findMany({
      where: {
        tokenId,
        timestamp: {
          gte: last24Hours,
          lte: endDate,
        },
      },
      select: {
        timestamp: true,
      },
    }),
    // Top IP addresses
    prisma.tokenUsageLog.groupBy({
      by: ['ipAddress'],
      where: {
        tokenId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        ipAddress: {
          not: null,
        },
      },
      _count: {
        ipAddress: true,
      },
      orderBy: {
        _count: {
          ipAddress: 'desc',
        },
      },
      take: 10,
    }),
  ]);

  // Calculate statistics
  const totalRequests = allLogs.length;
  const errorCount = allLogs.filter((log: { statusCode: number }) => log.statusCode >= 400).length;
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

  const responseTimes = allLogs
    .map((log: { responseTime: number | null }) => log.responseTime)
    .filter((rt: number | null): rt is number => rt !== null);
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum: number, rt: number) => sum + rt, 0) / responseTimes.length
      : null;

  // Aggregate hourly counts (last 24 hours)
  const hourlyMap = new Map<string, number>();
  last24HoursLogs.forEach((log: { timestamp: Date }) => {
    const hour = new Date(log.timestamp);
    hour.setMinutes(0, 0, 0);
    const hourKey = hour.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + 1);
  });
  const requestsPerHour = Array.from(hourlyMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.hour.localeCompare(a.hour))
    .slice(0, 24);

  // Aggregate daily counts
  const dailyMap = new Map<string, number>();
  allLogs.forEach((log: { timestamp: Date }) => {
    const day = new Date(log.timestamp);
    day.setHours(0, 0, 0, 0);
    const dayKey = day.toISOString().slice(0, 10); // YYYY-MM-DD
    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
  });
  const requestsPerDay = Array.from(dailyMap.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, 30);

  return {
    totalRequests,
    requestsPerHour,
    requestsPerDay,
    topIpAddresses: ipCounts.map((item: { ipAddress: string | null; _count: { ipAddress: number } }) => ({
      ipAddress: item.ipAddress || 'unknown',
      count: item._count.ipAddress,
    })),
    averageResponseTime: averageResponseTime ? Math.round(averageResponseTime) : null,
    errorRate: Math.round(errorRate * 100) / 100, // Round to 2 decimal places
  };
}
