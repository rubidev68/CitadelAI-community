import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCurrentMessageCount,
  getTotalIndexedPages,
  canUseProBlocks,
  canUseEnterpriseBlocks,
  canCustomizeAIModel,
  canSendMessage,
  canIndexPages,
  canCreateConcurrentSession,
  trackAICall,
} from '../../utils/subscriptionLimits';
import { SubscriptionPlan } from '@prisma/client';
import prisma from '../../lib/prisma';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    aICall: {
      count: vi.fn(),
      create: vi.fn(),
    },
    chatbot: {
      findMany: vi.fn(),
    },
  },
}));

describe('Subscription Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentMessageCount', () => {
    it('should return message count for last 30 days', async () => {
      const adminUserId = 'user-1';
      const count = 150;
      vi.mocked(prisma.aICall.count).mockResolvedValue(count);

      const result = await getCurrentMessageCount(adminUserId);

      expect(prisma.aICall.count).toHaveBeenCalledWith({
        where: {
          adminUserId,
          createdAt: {
            gte: expect.any(Date),
          },
          callType: 'MESSAGE',
        },
      });
      expect(result).toBe(count);
    });

    it('should return 0 if table does not exist', async () => {
      const adminUserId = 'user-1';
      const prismaError = { code: 'P2021', message: 'Table does not exist' };
      vi.mocked(prisma.aICall.count).mockRejectedValue(prismaError);

      const result = await getCurrentMessageCount(adminUserId);

      expect(result).toBe(0);
    });

    it('should return 0 if error message contains "does not exist"', async () => {
      const adminUserId = 'user-1';
      const prismaError = { message: 'Table aICall does not exist' };
      vi.mocked(prisma.aICall.count).mockRejectedValue(prismaError);

      const result = await getCurrentMessageCount(adminUserId);

      expect(result).toBe(0);
    });

    it('should throw error for other database errors', async () => {
      const adminUserId = 'user-1';
      const error = new Error('Database connection failed');
      vi.mocked(prisma.aICall.count).mockRejectedValue(error);

      await expect(getCurrentMessageCount(adminUserId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getTotalIndexedPages', () => {
    it('should return total indexed pages for user chatbots', async () => {
      const adminUserId = 'user-1';
      const mockChatbots = [
        {
          id: 'chatbot-1',
          websiteContexts: [
            { crawledPagesCount: 100 },
            { crawledPagesCount: 50 },
          ],
        },
        {
          id: 'chatbot-2',
          websiteContexts: [
            { crawledPagesCount: 200 },
          ],
        },
      ];
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockChatbots as any);

      const result = await getTotalIndexedPages(adminUserId);

      expect(prisma.chatbot.findMany).toHaveBeenCalledWith({
        where: { ownerId: adminUserId },
        include: {
          websiteContexts: {
            where: {
              crawledPagesCount: { not: null },
            },
          },
        },
      });
      expect(result).toBe(350); // 100 + 50 + 200
    });

    it('should return 0 for user with no chatbots', async () => {
      const adminUserId = 'user-1';
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue([]);

      const result = await getTotalIndexedPages(adminUserId);

      expect(result).toBe(0);
    });

    it('should return 0 if column does not exist', async () => {
      const adminUserId = 'user-1';
      const prismaError = { code: 'P2022', message: 'Column does not exist' };
      vi.mocked(prisma.chatbot.findMany).mockRejectedValue(prismaError);

      const result = await getTotalIndexedPages(adminUserId);

      expect(result).toBe(0);
    });

    it('should handle null crawledPagesCount', async () => {
      const adminUserId = 'user-1';
      const mockChatbots = [
        {
          id: 'chatbot-1',
          websiteContexts: [
            { crawledPagesCount: 100 },
            { crawledPagesCount: null },
          ],
        },
      ];
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockChatbots as any);

      const result = await getTotalIndexedPages(adminUserId);

      expect(result).toBe(100);
    });
  });

  describe('canUseProBlocks', () => {
    it('should return true for Professional plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Professional',
      } as SubscriptionPlan;

      expect(canUseProBlocks(plan)).toBe(true);
    });

    it('should return true for Pro plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Pro',
      } as SubscriptionPlan;

      expect(canUseProBlocks(plan)).toBe(true);
    });

    it('should return true for Enterprise plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Enterprise',
      } as SubscriptionPlan;

      expect(canUseProBlocks(plan)).toBe(true);
    });

    it('should return false for Free plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
      } as SubscriptionPlan;

      expect(canUseProBlocks(plan)).toBe(false);
    });

    it('should return false for null plan', () => {
      expect(canUseProBlocks(null)).toBe(false);
    });

    it('should handle case-insensitive plan names', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'PROFESSIONAL',
      } as SubscriptionPlan;

      expect(canUseProBlocks(plan)).toBe(true);
    });
  });

  describe('canUseEnterpriseBlocks', () => {
    it('should return true for Enterprise plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Enterprise',
      } as SubscriptionPlan;

      expect(canUseEnterpriseBlocks(plan)).toBe(true);
    });

    it('should return false for Professional plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Professional',
      } as SubscriptionPlan;

      expect(canUseEnterpriseBlocks(plan)).toBe(false);
    });

    it('should return false for null plan', () => {
      expect(canUseEnterpriseBlocks(null)).toBe(false);
    });
  });

  describe('canCustomizeAIModel', () => {
    it('should return true for Professional plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Professional',
      } as SubscriptionPlan;

      expect(canCustomizeAIModel(plan)).toBe(true);
    });

    it('should return false for Starter plan', () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Starter',
      } as SubscriptionPlan;

      expect(canCustomizeAIModel(plan)).toBe(false);
    });

    it('should return false for null plan', () => {
      expect(canCustomizeAIModel(null)).toBe(false);
    });
  });

  describe('canSendMessage', () => {
    it('should return allowed for unlimited plan', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Enterprise',
        maxMessages: null,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      const result = await canSendMessage(adminUserId, plan);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should return allowed if under limit', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
        maxMessages: 100,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      vi.mocked(prisma.aICall.count).mockResolvedValue(50);

      const result = await canSendMessage(adminUserId, plan);

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(50);
      expect(result.maxAllowed).toBe(100);
      expect(result.remaining).toBe(50);
    });

    it('should return not allowed if over limit', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
        maxMessages: 100,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      vi.mocked(prisma.aICall.count).mockResolvedValue(150);

      const result = await canSendMessage(adminUserId, plan);

      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(150);
      expect(result.maxAllowed).toBe(100);
      expect(result.remaining).toBe(0);
    });
  });

  describe('canIndexPages', () => {
    it('should return allowed for unlimited plan', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Enterprise',
        maxPages: null,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      const result = await canIndexPages(adminUserId, plan);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
    });

    it('should return allowed if under limit', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
        maxPages: 100,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      const mockChatbots = [
        {
          id: 'chatbot-1',
          websiteContexts: [{ crawledPagesCount: 50 }],
        },
      ];
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockChatbots as any);

      const result = await canIndexPages(adminUserId, plan);

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(50);
      expect(result.maxAllowed).toBe(100);
      expect(result.remaining).toBe(50);
    });

    it('should return not allowed if over limit with additional pages', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
        maxPages: 100,
      } as SubscriptionPlan;
      const adminUserId = 'user-1';

      const mockChatbots = [
        {
          id: 'chatbot-1',
          websiteContexts: [{ crawledPagesCount: 80 }],
        },
      ];
      vi.mocked(prisma.chatbot.findMany).mockResolvedValue(mockChatbots as any);

      const result = await canIndexPages(adminUserId, plan, 30); // 80 + 30 = 110 > 100

      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(80);
    });
  });

  describe('canCreateConcurrentSession', () => {
    it('should return allowed for unlimited plan', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Enterprise',
        maxConcurrentSessions: null,
      } as SubscriptionPlan;

      const result = await canCreateConcurrentSession('chatbot-1', 'user-1', plan);

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
    });

    it('should return allowed if under limit', async () => {
      const plan: SubscriptionPlan = {
        id: 'plan-1',
        name: 'Free',
        maxConcurrentSessions: 10,
      } as SubscriptionPlan;

      const result = await canCreateConcurrentSession('chatbot-1', 'user-1', plan);

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(0);
      expect(result.maxAllowed).toBe(10);
    });
  });

  describe('trackAICall', () => {
    it('should track MESSAGE call', async () => {
      const chatbotId = 'chatbot-1';
      const adminUserId = 'user-1';
      vi.mocked(prisma.aICall.create).mockResolvedValue({} as any);

      await trackAICall(chatbotId, adminUserId, 'MESSAGE');

      expect(prisma.aICall.create).toHaveBeenCalledWith({
        data: {
          chatbotId,
          adminUserId,
          callType: 'MESSAGE',
        },
      });
    });

    it('should track TESTLLM call', async () => {
      const chatbotId = 'chatbot-1';
      const adminUserId = 'user-1';
      vi.mocked(prisma.aICall.create).mockResolvedValue({} as any);

      await trackAICall(chatbotId, adminUserId, 'TESTLLM');

      expect(prisma.aICall.create).toHaveBeenCalledWith({
        data: {
          chatbotId,
          adminUserId,
          callType: 'TESTLLM',
        },
      });
    });

    it('should handle table not existing gracefully', async () => {
      const chatbotId = 'chatbot-1';
      const adminUserId = 'user-1';
      const prismaError = { code: 'P2021', message: 'Table does not exist' };
      vi.mocked(prisma.aICall.create).mockRejectedValue(prismaError);

      // Should not throw
      await expect(trackAICall(chatbotId, adminUserId)).resolves.toBeUndefined();
    });
  });
});
