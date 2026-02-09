/**
 * Subscription Usage Cache Service
 * 
 * Maintains cached counts for subscription usage metrics (chatbots, messages, pages)
 * Automatically invalidates and updates when relevant data changes.
 * 
 * This provides:
 * - Real-time accurate counts without querying database every time
 * - Automatic cache invalidation on data changes
 * - Single source of truth for usage metrics
 */

import prisma from '../lib/prisma';

interface UsageCache {
  chatbotCount: Map<string, number>; // adminUserId -> count
  lastUpdated: Map<string, Date>; // adminUserId -> timestamp
}

class SubscriptionUsageCacheService {
  private cache: UsageCache = {
    chatbotCount: new Map(),
    lastUpdated: new Map(),
  };

  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get chatbot count for a user (from cache or database)
   */
  async getChatbotCount(adminUserId: string): Promise<number> {
    const cached = this.cache.chatbotCount.get(adminUserId);
    const lastUpdated = this.cache.lastUpdated.get(adminUserId);
    
    // Return cached value if it exists and is fresh
    if (cached !== undefined && lastUpdated) {
      const age = Date.now() - lastUpdated.getTime();
      if (age < this.CACHE_TTL_MS) {
        return cached;
      }
    }

    // Cache miss or expired - fetch from database
    return this.refreshChatbotCount(adminUserId);
  }

  /**
   * Refresh chatbot count from database and update cache
   */
  async refreshChatbotCount(adminUserId: string): Promise<number> {
    try {
      const count = await prisma.chatbot.count({
        where: { ownerId: adminUserId }
      });

      this.cache.chatbotCount.set(adminUserId, count);
      this.cache.lastUpdated.set(adminUserId, new Date());

      return count;
    } catch (error: unknown) {
      // If table doesn't exist, return 0
      interface PrismaError {
        code?: string;
        message?: string;
      }
      const prismaError = error as PrismaError;
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Invalidate chatbot count cache for a user
   * Call this when chatbots are created/deleted
   */
  invalidateChatbotCount(adminUserId: string): void {
    this.cache.chatbotCount.delete(adminUserId);
    this.cache.lastUpdated.delete(adminUserId);
  }

  /**
   * Update chatbot count (increment/decrement)
   * More efficient than invalidating and refetching
   */
  updateChatbotCount(adminUserId: string, delta: number): void {
    const current = this.cache.chatbotCount.get(adminUserId);
    if (current !== undefined) {
      const newCount = Math.max(0, current + delta);
      this.cache.chatbotCount.set(adminUserId, newCount);
      this.cache.lastUpdated.set(adminUserId, new Date());
    } else {
      // Cache miss - invalidate to force refresh on next access
      this.invalidateChatbotCount(adminUserId);
    }
  }

  /**
   * Clear all caches (useful for testing or reset)
   */
  clearCache(): void {
    this.cache.chatbotCount.clear();
    this.cache.lastUpdated.clear();
  }

  /**
   * Get cache statistics (for monitoring/debugging)
   */
  getCacheStats(): {
    cachedUserCount: number;
    cacheHitRate?: number;
  } {
    return {
      cachedUserCount: this.cache.chatbotCount.size,
    };
  }
}

// Export singleton instance
export const subscriptionUsageCache = new SubscriptionUsageCacheService();
