/**
 * AI Call Tracking Utility
 * Tracks AI calls for message counting (moved from admin-backend)
 * Note: AICall and Subscription models may not exist in all Prisma schemas
 */

import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

/**
 * Track an AI call for message counting
 */
export async function trackAICall(
  chatbotId: string,
  callType: 'MESSAGE' | 'TESTLLM' | 'FOLLOWUP' = 'MESSAGE'
): Promise<void> {
  try {
    // Get chatbot owner
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { ownerId: true }
    });

    if (!chatbot) {
      logger.warn('Chatbot not found for AI call tracking', {
        chatbotId,
        service: 'aiCallTracking',
      });
      return;
    }

    // Only track MESSAGE calls for limit counting
    // TESTLLM and FOLLOWUP are tracked but not counted toward limits
    // Use type assertion since AICall may not exist in all schemas
    // @ts-ignore - AICall model may not exist in user-backend schema
    interface PrismaWithAICall {
      aICall?: {
        create: (args: { data: { chatbotId: string; adminUserId: string; callType: string } }) => Promise<unknown>;
      };
    }
    const prismaWithAICall = prisma as unknown as PrismaWithAICall;
    try {
      // @ts-ignore - AICall model may not exist in user-backend schema
      await prismaWithAICall.aICall.create({
        data: {
          chatbotId,
          adminUserId: chatbot.ownerId,
          callType,
        },
      });
    } catch (error: unknown) {
      // If AICall doesn't exist, skip tracking
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unknown arg') || errorMessage.includes('does not exist')) {
        logger.debug('AICall model not available - skipping tracking', {
          service: 'aiCallTracking',
        });
        return;
      }
      throw error;
    }
  } catch (error: unknown) {
    // If AICall table doesn't exist (custom instances), silently skip tracking
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error && typeof error === 'object' && 'code' in error 
      ? (error as { code?: string }).code 
      : undefined;
    if (errorCode === 'P2021' || errorMessage.includes('does not exist') || errorMessage.includes('Unknown arg')) {
      logger.debug('AICall table does not exist - skipping tracking (custom instance)', {
        service: 'aiCallTracking',
      });
      return;
    }
    throw error;
  }
}

/**
 * Check if admin user can send a message (hasn't exceeded limit)
 */
export async function canSendMessage(chatbotId: string): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  remaining: number | null;
  code?: string;
  message?: string;
}> {
  try {
    // Get chatbot owner
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { ownerId: true }
    });

    if (!chatbot) {
      return {
        allowed: true, // Allow if chatbot not found (fail open)
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      };
    }

    // Use type assertion since subscription and AICall may not exist in all schemas
    // @ts-ignore - Subscription and AICall models may not exist in user-backend schema
    interface PrismaWithExtras {
      adminUser?: {
        findUnique: (args: { where: { id: string }; include?: { subscription?: { include?: { plan: boolean } } } }) => Promise<{
          subscription?: { plan?: { maxMessages: number | null } };
        } | null>;
      };
      aICall?: {
        count: (args: { where: { adminUserId: string; createdAt: { gte: Date }; callType: string } }) => Promise<number>;
      };
    }
    const prismaWithExtras = prisma as unknown as PrismaWithExtras;

    // Get user's subscription plan (if subscription model exists)
    let adminUser: {
      subscription?: { plan?: { maxMessages: number | null } };
    } | null | undefined;
    try {
      // @ts-ignore - subscription relation may not exist in user-backend schema
      adminUser = await prisma.adminUser.findUnique({
        where: { id: chatbot.ownerId },
        // @ts-ignore - subscription relation may not exist
        include: { subscription: { include: { plan: true } } }
      });
    } catch (error: unknown) {
      // If subscription relation doesn't exist, allow
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error && typeof error === 'object' && 'code' in error 
        ? (error as { code?: string }).code || '' 
        : '';
      const errorName = error instanceof Error ? error.name : '';
      
      // Check for various Prisma validation errors indicating missing relation
      if (
        errorMessage.includes('Unknown arg') || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('Unknown field') ||
        errorMessage.includes('subscription') ||
        errorMessage.includes('Available options') ||
        errorCode === 'P2021' ||
        errorName === 'PrismaClientValidationError' ||
        errorName === 'PrismaClientKnownRequestError'
      ) {
        logger.debug('Subscription relation not available - allowing (user-backend schema)', {
          errorMessage: errorMessage.substring(0, 100),
          errorCode,
          errorName,
          service: 'aiCallTracking',
        });
        return {
          allowed: true,
          currentCount: 0,
          maxAllowed: null,
          remaining: null,
        };
      }
      // Log unexpected errors but still allow (fail open)
      logger.warn('Unexpected error checking subscription, allowing', {
        errorMessage: errorMessage.substring(0, 200),
        errorCode,
        errorName,
        service: 'aiCallTracking',
      });
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      };
    }

    if (!adminUser || !adminUser.subscription || !adminUser.subscription?.plan) {
      // No subscription = unlimited
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      };
    }

    const plan = adminUser.subscription.plan;

    if (plan.maxMessages === null) {
      // Unlimited plan
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      };
    }

    // Get current message count (rolling 30 days) - if AICall model exists
    let currentCount = 0;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // @ts-ignore - AICall model may not exist in user-backend schema
      currentCount = await prismaWithExtras.aICall.count({
        where: {
          adminUserId: chatbot.ownerId,
          createdAt: {
            gte: thirtyDaysAgo,
          },
          callType: 'MESSAGE', // Only count message calls
        },
      });
    } catch (error: unknown) {
      // If AICall doesn't exist, allow
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = error && typeof error === 'object' && 'code' in error 
        ? (error as { code?: string }).code 
        : undefined;
      if (errorMessage.includes('Unknown arg') || errorMessage.includes('does not exist') || errorCode === 'P2021') {
        return {
          allowed: true,
          currentCount: 0,
          maxAllowed: null,
          remaining: null,
        };
      }
      throw error;
    }

    const remaining = plan.maxMessages - currentCount;

    return {
      allowed: currentCount < plan.maxMessages,
      currentCount,
      maxAllowed: plan.maxMessages,
      remaining: Math.max(0, remaining),
      code: currentCount >= plan.maxMessages ? 'MESSAGE_LIMIT_REACHED' : undefined,
      message: currentCount >= plan.maxMessages 
        ? `Message limit reached (${currentCount}/${plan.maxMessages})`
        : undefined,
    };
  } catch (error: unknown) {
    // If subscription tables don't exist (custom instances), allow
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error && typeof error === 'object' && 'code' in error 
      ? (error as { code?: string }).code || '' 
      : '';
    const errorName = error instanceof Error ? error.name : '';
    
    if (
      errorCode === 'P2021' || 
      errorMessage.includes('does not exist') || 
      errorMessage.includes('Unknown arg') ||
      errorMessage.includes('Unknown field') ||
      errorMessage.includes('subscription') ||
      errorMessage.includes('Available options') ||
      errorName === 'PrismaClientValidationError' ||
      errorName === 'PrismaClientKnownRequestError'
    ) {
      logger.debug('Subscription/AICall tables/relations do not exist - allowing (user-backend schema)', {
        errorMessage: errorMessage.substring(0, 100),
        errorCode,
        errorName,
        service: 'aiCallTracking',
      });
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      };
    }
    // Log unexpected errors but still allow (fail open)
    logger.warn('Unexpected error in canSendMessage, allowing', {
      errorMessage: errorMessage.substring(0, 200),
      errorCode,
      errorName,
      service: 'aiCallTracking',
    });
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      remaining: null,
    };
  }
}
