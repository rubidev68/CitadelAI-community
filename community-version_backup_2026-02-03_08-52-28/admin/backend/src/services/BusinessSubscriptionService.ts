/**
 * BusinessSubscriptionService
 * 
 * Real implementation that enforces subscription limits from the database.
 * Used when billing feature is enabled.
 */

import { ISubscriptionService, SubscriptionLimitInfo, UserSubscriptionInfo } from './interfaces/ISubscriptionService';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { subscriptionUsageCache } from './subscriptionUsageCache';
import { canSendMessage, canIndexPages } from '../utils/subscriptionLimits';

const businessSubLogger = logger.child({ service: 'admin-backend', component: 'BusinessSubscriptionService' });

export class BusinessSubscriptionService implements ISubscriptionService {
  async getChatbotCount(userId: string): Promise<number> {
    try {
      // Try to get from cache first
      const cached = subscriptionUsageCache.getChatbotCount(userId);
      if (cached !== undefined) {
        return cached;
      }

      // Query from database
      const count = await prisma.chatbot.count({
        where: { ownerId: userId },
      });

      // Cache the result (note: subscriptionUsageCache doesn't have setChatbotCount, only invalidation)
      return count;
    } catch (error) {
      businessSubLogger.error('Error getting chatbot count', {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Fail open - allow operation if database is unavailable
      return 0;
    }
  }

  async canCreateChatbot(userId: string): Promise<SubscriptionLimitInfo> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: userId },
        include: { plan: true },
      });

      if (!subscription) {
        // No subscription found - allow on custom instances
        return { allowed: true };
      }

      // Check if subscription is active
      const now = new Date();
      let isActive = false;

      if (subscription.status === 'CANCELED') {
        isActive = false;
      } else if (subscription.status === 'TRIAL' && subscription.trialEndDate) {
        isActive = subscription.trialEndDate > now;
      } else if (subscription.currentPeriodEnd) {
        isActive = subscription.currentPeriodEnd > now;
      } else {
        isActive = subscription.status === 'ACTIVE';
      }

      if (!isActive) {
        return {
          allowed: false,
          reason: 'Your subscription has expired or been canceled.',
        };
      }

      // Check chatbot limit
      if (!subscription.plan || subscription.plan.maxChatbots === null) {
        return { allowed: true };
      }

      const chatbotCount = await this.getChatbotCount(userId);
      if (chatbotCount >= subscription.plan.maxChatbots) {
        return {
          allowed: false,
          reason: `Chatbot limit (${subscription.plan.maxChatbots}) has been reached.`,
          current: chatbotCount,
          limit: subscription.plan.maxChatbots,
        };
      }

      return { allowed: true };
    } catch (error) {
      businessSubLogger.error('Error checking chatbot limit', {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Fail open - allow operation if database is unavailable
      return { allowed: true };
    }
  }

  async canSendMessage(userId: string): Promise<SubscriptionLimitInfo> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: userId },
        include: { plan: true },
      });

      if (!subscription || !subscription.plan) {
        // No subscription - allow
        return { allowed: true };
      }

      const result = await canSendMessage(userId, subscription.plan);
      return {
        allowed: result.allowed,
        reason: result.allowed ? undefined : `Message limit reached`,
        current: result.currentCount,
        limit: result.maxAllowed ?? undefined,
        remaining: result.remaining ?? undefined,
      };
    } catch (error) {
      businessSubLogger.error('Error checking message limit', {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Fail open - allow operation if database is unavailable
      return { allowed: true };
    }
  }

  async canIndexPages(userId: string, estimatedPages: number): Promise<SubscriptionLimitInfo> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: userId },
        include: { plan: true },
      });

      if (!subscription || !subscription.plan) {
        // No subscription - allow
        return { allowed: true };
      }

      const result = await canIndexPages(userId, subscription.plan, estimatedPages);
      return {
        allowed: result.allowed,
        reason: result.allowed ? undefined : `Pages limit reached`,
        current: result.currentCount,
        limit: result.maxAllowed ?? undefined,
        remaining: result.remaining ?? undefined,
      };
    } catch (error) {
      businessSubLogger.error('Error checking indexed pages limit', {
        userId,
        estimatedPages,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Fail open - allow operation if database is unavailable
      return { allowed: true };
    }
  }

  async getSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo | null> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: userId },
        include: { plan: true },
      });

      if (!subscription) {
        return null;
      }

      const now = new Date();
      let isActive = false;

      if (subscription.status !== 'CANCELED') {
        if (subscription.status === 'TRIAL' && subscription.trialEndDate) {
          isActive = subscription.trialEndDate > now;
        } else if (subscription.currentPeriodEnd) {
          isActive = subscription.currentPeriodEnd > now;
        } else {
          isActive = subscription.status === 'ACTIVE';
        }
      }

      const chatbotCount = await this.getChatbotCount(userId);

      return {
        planName: subscription.plan?.name,
        status: subscription.status,
        isActive,
        chatbotLimit: subscription.plan?.maxChatbots ?? undefined,
        chatbotCount,
        messageLimit: subscription.plan?.maxMessages ?? undefined,
        indexedPagesLimit: subscription.plan?.maxPages ?? undefined,
      };
    } catch (error) {
      businessSubLogger.error('Error getting subscription info', {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return null;
    }
  }

  invalidateCache(userId: string): void {
    subscriptionUsageCache.invalidateChatbotCount(userId);
  }
}
