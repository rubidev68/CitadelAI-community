import { SubscriptionPlan } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const subscriptionLimitsLogger = logger.child({ service: 'admin-backend', component: 'subscriptionLimits' });

/**
 * Get the current message count for an admin user (rolling 30 days)
 * Only counts MESSAGE type calls (excludes TESTLLM and FOLLOWUP)
 */
export async function getCurrentMessageCount(adminUserId: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const count = await prisma.aICall.count({
      where: {
        adminUserId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
        callType: 'MESSAGE', // Only count message calls, not TestLLM or follow-ups
      },
    });

    return count;
  } catch (error: unknown) {
    // If AICall table doesn't exist yet (migration hasn't run), return 0
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
      subscriptionLimitsLogger.warn('AICall table does not exist (migration may not have run)', { message: prismaError.message });
      return 0;
    }
    throw error;
  }
}

/**
 * Get the total indexed pages count for an admin user
 * Sums crawledPagesCount from all WebsiteContexts for user's chatbots
 */
export async function getTotalIndexedPages(adminUserId: string): Promise<number> {
  try {
    const chatbots = await prisma.chatbot.findMany({
      where: { ownerId: adminUserId },
      include: {
        websiteContexts: {
          where: {
            crawledPagesCount: { not: null },
          },
        },
      },
    });

    const totalPages = chatbots.reduce((sum, chatbot) => {
      const chatbotPages = chatbot.websiteContexts.reduce((pageSum, context) => {
        return pageSum + (context.crawledPagesCount || 0);
      }, 0);
      return sum + chatbotPages;
    }, 0);

    return totalPages;
  } catch (error: unknown) {
    // If there's a database error (e.g., column doesn't exist), return 0
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === 'P2022' || prismaError.message?.includes('does not exist')) {
      subscriptionLimitsLogger.warn('Error counting indexed pages (migration may not have run)', { message: prismaError.message });
      return 0;
    }
    throw error;
  }
}

/**
 * Check if plan allows Pro blocks (TestLLM and coming soon blocks)
 */
export function canUseProBlocks(plan: SubscriptionPlan | null): boolean {
  if (!plan) return false;
  const planName = plan.name.toLowerCase();
  return planName === 'professional' || planName === 'pro' || planName === 'enterprise';
}

/**
 * Check if plan allows Enterprise blocks
 */
export function canUseEnterpriseBlocks(plan: SubscriptionPlan | null): boolean {
  if (!plan) return false;
  const planName = plan.name.toLowerCase();
  return planName === 'enterprise';
}

/**
 * Check if plan allows AI model customization
 */
export function canCustomizeAIModel(plan: SubscriptionPlan | null): boolean {
  if (!plan) return false;
  const planName = plan.name.toLowerCase();
  // Starter plan cannot customize, Professional and Enterprise can
  return planName !== 'starter';
}

/**
 * Check if admin user can send a message (hasn't exceeded limit)
 */
export async function canSendMessage(adminUserId: string, plan: SubscriptionPlan | null): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  remaining: number | null;
}> {
  if (!plan || plan.maxMessages === null) {
    // Unlimited plan
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      remaining: null,
    };
  }

  const currentCount = await getCurrentMessageCount(adminUserId);
  const remaining = plan.maxMessages - currentCount;

  return {
    allowed: currentCount < plan.maxMessages,
    currentCount,
    maxAllowed: plan.maxMessages,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Check if admin user can index more pages (hasn't exceeded limit)
 */
export async function canIndexPages(
  adminUserId: string,
  plan: SubscriptionPlan | null,
  additionalPages: number = 0
): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  remaining: number | null;
}> {
  if (!plan || plan.maxPages === null) {
    // Unlimited plan
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      remaining: null,
    };
  }

  const currentCount = await getTotalIndexedPages(adminUserId);
  const totalAfter = currentCount + additionalPages;
  const remaining = plan.maxPages - currentCount;

  return {
    allowed: totalAfter <= plan.maxPages,
    currentCount,
    maxAllowed: plan.maxPages,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Check if admin user can create more concurrent widget sessions
 */
export async function canCreateConcurrentSession(
  chatbotId: string,
  adminUserId: string,
  plan: SubscriptionPlan | null
): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number | null;
  remaining: number | null;
}> {
  if (!plan || plan.maxConcurrentSessions === null) {
    // Unlimited plan
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: null,
      remaining: null,
    };
  }

  // Get all active widget sessions for this chatbot
  // Note: This requires a way to query active sessions
  // For now, we'll need to pass the current count from the widget service
  // This is a placeholder - actual implementation depends on session storage
  const currentCount = 0; // TODO: Get from session store (Redis or in-memory)

  const remaining = plan.maxConcurrentSessions - currentCount;

  return {
    allowed: currentCount < plan.maxConcurrentSessions,
    currentCount,
    maxAllowed: plan.maxConcurrentSessions,
    remaining: Math.max(0, remaining),
  };
}

/**
 * Track an AI call for message counting
 */
export async function trackAICall(
  chatbotId: string,
  adminUserId: string,
  callType: 'MESSAGE' | 'TESTLLM' | 'FOLLOWUP' = 'MESSAGE'
): Promise<void> {
  try {
    // Only track MESSAGE calls for limit counting
    // TESTLLM and FOLLOWUP are tracked but not counted toward limits
    await prisma.aICall.create({
      data: {
        chatbotId,
        adminUserId,
        callType,
      },
    });
  } catch (error: unknown) {
    // If AICall table doesn't exist (custom instances), silently skip tracking
    const prismaError = error as { code?: string; message?: string };
    if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
      subscriptionLimitsLogger.debug('AICall table does not exist - skipping tracking (custom instance)');
      return;
    }
    throw error;
  }
}
