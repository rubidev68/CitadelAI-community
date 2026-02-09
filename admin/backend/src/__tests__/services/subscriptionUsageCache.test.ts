import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscriptionUsageCache } from '../../services/subscriptionUsageCache';
import prisma from '../../lib/prisma';

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    chatbot: {
      count: vi.fn(),
    },
  },
}));

describe('Subscription Usage Cache Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptionUsageCache.clearCache();
  });

  describe('getChatbotCount', () => {
    it('should return cached count if fresh', async () => {
      const adminUserId = 'user-1';
      const count = 5;

      // Set cache directly
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, count);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId, new Date());

      const result = await subscriptionUsageCache.getChatbotCount(adminUserId);

      expect(result).toBe(count);
      expect(prisma.chatbot.count).not.toHaveBeenCalled();
    });

    it('should fetch from database if cache miss', async () => {
      const adminUserId = 'user-1';
      const count = 10;
      vi.mocked(prisma.chatbot.count).mockResolvedValue(count);

      const result = await subscriptionUsageCache.getChatbotCount(adminUserId);

      expect(result).toBe(count);
      expect(prisma.chatbot.count).toHaveBeenCalledWith({
        where: { ownerId: adminUserId },
      });
    });

    it('should fetch from database if cache expired', async () => {
      const adminUserId = 'user-1';
      const oldCount = 5;
      const newCount = 10;

      // Set old cache (6 minutes ago - expired)
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, oldCount);
      (subscriptionUsageCache as any).cache.lastUpdated.set(
        adminUserId,
        new Date(Date.now() - 6 * 60 * 1000)
      );

      vi.mocked(prisma.chatbot.count).mockResolvedValue(newCount);

      const result = await subscriptionUsageCache.getChatbotCount(adminUserId);

      expect(result).toBe(newCount);
      expect(prisma.chatbot.count).toHaveBeenCalled();
    });

    it('should return 0 if table does not exist', async () => {
      const adminUserId = 'user-1';
      const prismaError = { code: 'P2021', message: 'Table does not exist' };
      vi.mocked(prisma.chatbot.count).mockRejectedValue(prismaError);

      const result = await subscriptionUsageCache.getChatbotCount(adminUserId);

      expect(result).toBe(0);
    });

    it('should return 0 if error message contains "does not exist"', async () => {
      const adminUserId = 'user-1';
      const prismaError = { message: 'Table chatbot does not exist' };
      vi.mocked(prisma.chatbot.count).mockRejectedValue(prismaError);

      const result = await subscriptionUsageCache.getChatbotCount(adminUserId);

      expect(result).toBe(0);
    });

    it('should throw error for other database errors', async () => {
      const adminUserId = 'user-1';
      const error = new Error('Database connection failed');
      vi.mocked(prisma.chatbot.count).mockRejectedValue(error);

      await expect(subscriptionUsageCache.getChatbotCount(adminUserId)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('refreshChatbotCount', () => {
    it('should fetch count from database and update cache', async () => {
      const adminUserId = 'user-1';
      const count = 15;
      vi.mocked(prisma.chatbot.count).mockResolvedValue(count);

      const result = await subscriptionUsageCache.refreshChatbotCount(adminUserId);

      expect(result).toBe(count);
      expect(prisma.chatbot.count).toHaveBeenCalledWith({
        where: { ownerId: adminUserId },
      });

      // Verify cache was updated
      const cached = (subscriptionUsageCache as any).cache.chatbotCount.get(adminUserId);
      expect(cached).toBe(count);
    });
  });

  describe('invalidateChatbotCount', () => {
    it('should remove user from cache', () => {
      const adminUserId = 'user-1';

      // Set cache
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, 5);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId, new Date());

      subscriptionUsageCache.invalidateChatbotCount(adminUserId);

      expect((subscriptionUsageCache as any).cache.chatbotCount.has(adminUserId)).toBe(false);
      expect((subscriptionUsageCache as any).cache.lastUpdated.has(adminUserId)).toBe(false);
    });

    it('should handle invalidating non-existent user', () => {
      const adminUserId = 'user-nonexistent';

      // Should not throw
      expect(() => {
        subscriptionUsageCache.invalidateChatbotCount(adminUserId);
      }).not.toThrow();
    });
  });

  describe('updateChatbotCount', () => {
    it('should increment count when delta is positive', () => {
      const adminUserId = 'user-1';
      const initialCount = 5;

      // Set cache
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, initialCount);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId, new Date());

      subscriptionUsageCache.updateChatbotCount(adminUserId, 2);

      const newCount = (subscriptionUsageCache as any).cache.chatbotCount.get(adminUserId);
      expect(newCount).toBe(7);
    });

    it('should decrement count when delta is negative', () => {
      const adminUserId = 'user-1';
      const initialCount = 5;

      // Set cache
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, initialCount);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId, new Date());

      subscriptionUsageCache.updateChatbotCount(adminUserId, -2);

      const newCount = (subscriptionUsageCache as any).cache.chatbotCount.get(adminUserId);
      expect(newCount).toBe(3);
    });

    it('should not allow negative count', () => {
      const adminUserId = 'user-1';
      const initialCount = 2;

      // Set cache
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId, initialCount);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId, new Date());

      subscriptionUsageCache.updateChatbotCount(adminUserId, -5);

      const newCount = (subscriptionUsageCache as any).cache.chatbotCount.get(adminUserId);
      expect(newCount).toBe(0); // Should not go below 0
    });

    it('should invalidate cache if user not in cache', () => {
      const adminUserId = 'user-not-cached';

      subscriptionUsageCache.updateChatbotCount(adminUserId, 1);

      // Cache should be invalidated (not set)
      expect((subscriptionUsageCache as any).cache.chatbotCount.has(adminUserId)).toBe(false);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', () => {
      const adminUserId1 = 'user-1';
      const adminUserId2 = 'user-2';

      // Set cache for multiple users
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId1, 5);
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId2, 10);
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId1, new Date());
      (subscriptionUsageCache as any).cache.lastUpdated.set(adminUserId2, new Date());

      subscriptionUsageCache.clearCache();

      expect((subscriptionUsageCache as any).cache.chatbotCount.size).toBe(0);
      expect((subscriptionUsageCache as any).cache.lastUpdated.size).toBe(0);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const adminUserId1 = 'user-1';
      const adminUserId2 = 'user-2';

      // Set cache for multiple users
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId1, 5);
      (subscriptionUsageCache as any).cache.chatbotCount.set(adminUserId2, 10);

      const stats = subscriptionUsageCache.getCacheStats();

      expect(stats.cachedUserCount).toBe(2);
    });

    it('should return 0 for empty cache', () => {
      subscriptionUsageCache.clearCache();

      const stats = subscriptionUsageCache.getCacheStats();

      expect(stats.cachedUserCount).toBe(0);
    });
  });
});
