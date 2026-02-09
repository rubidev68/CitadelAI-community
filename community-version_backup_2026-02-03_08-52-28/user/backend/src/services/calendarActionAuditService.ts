/**
 * Calendar Action Audit Service
 * Logs all calendar actions for audit and accountability
 */

import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@shared/utils';

export interface CalendarActionLogData {
  userId: string;
  chatbotId: string;
  blockId: string;
  action: 'create' | 'update' | 'delete';
  eventId?: string;
  eventDetails: Record<string, unknown>;
  success: boolean;
  error?: string;
}

/**
 * Log a calendar action
 */
export async function logCalendarAction(data: CalendarActionLogData): Promise<void> {
  try {
    // Log for debugging
    logger.debug('Calendar Action Audit', {
      timestamp: new Date().toISOString(),
      userId: data.userId,
      chatbotId: data.chatbotId,
      blockId: data.blockId,
      action: data.action,
      eventId: data.eventId,
      success: data.success,
      error: data.error,
      service: 'calendarActionAuditService',
    });
    
    // Store in database (only if table exists - migration may not have run yet)
    try {
      await prisma.calendarActionLog.create({
        data: {
          userId: data.userId,
          chatbotId: data.chatbotId,
          blockId: data.blockId,
          action: data.action,
          eventId: data.eventId,
          eventDetails: data.eventDetails as unknown as Prisma.InputJsonValue,
          success: data.success,
          error: data.error,
          timestamp: new Date(),
        },
      });
    } catch (dbError: unknown) {
      interface PrismaError {
        code?: string;
        message?: string;
      }
      const prismaError = dbError && typeof dbError === 'object' && 'code' in dbError ? dbError as PrismaError : null;
      // If table doesn't exist (P2021), log warning but don't fail
      if (prismaError?.code === 'P2021') {
        logger.warn('CalendarActionLog table does not exist yet. Migration may need to be run', {
          service: 'calendarActionAuditService',
        });
        // Still log for debugging
        logger.debug('Action would be logged', {
          userId: data.userId,
          chatbotId: data.chatbotId,
          blockId: data.blockId,
          action: data.action,
          success: data.success,
          service: 'calendarActionAuditService',
        });
      } else {
        // Re-throw other errors
        throw dbError;
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to log action';
    logger.error('Failed to log action', error instanceof Error ? error : undefined, {
      service: 'calendarActionAuditService',
    });
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * Get action logs for a user
 */
export async function getUserActionLogs(
  userId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    return await prisma.calendarActionLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get logs';
    logger.error('Failed to get logs', error instanceof Error ? error : undefined, {
      service: 'calendarActionAuditService',
    });
    return [];
  }
}

/**
 * Get action logs for a chatbot
 */
export async function getChatbotActionLogs(
  chatbotId: string,
  limit: number = 100
): Promise<any[]> {
  try {
    return await prisma.calendarActionLog.findMany({
      where: { chatbotId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get logs';
    logger.error('Failed to get logs', error instanceof Error ? error : undefined, {
      service: 'calendarActionAuditService',
    });
    return [];
  }
}
