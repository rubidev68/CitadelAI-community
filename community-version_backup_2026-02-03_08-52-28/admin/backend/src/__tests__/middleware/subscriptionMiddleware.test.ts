import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { SubscriptionStatus } from '@prisma/client';
import {
  requireActiveSubscription,
  checkChatbotLimit,
  checkUserAccessLimit,
  checkMessageLimit,
  checkIndexedPagesLimit,
  addSubscriptionInfo,
  SubscriptionRequest,
} from '../../middleware/subscriptionMiddleware';
import { AdminAuthRequest } from '../../middleware/adminAuth';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    subscription: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    chatbotAccess: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    chatSession: { findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    chatMessage: { deleteMany: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  SubscriptionStatus: {
    ACTIVE: 'ACTIVE',
    TRIAL: 'TRIAL',
    CANCELED: 'CANCELED',
  },
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock subscription limits utils - use vi.hoisted
const { mockSubscriptionLimits } = vi.hoisted(() => {
  const mockSubscriptionLimits = {
    canSendMessage: vi.fn(),
    canIndexPages: vi.fn(),
  };
  return { mockSubscriptionLimits };
});

vi.mock('../../utils/subscriptionLimits', () => ({
  canSendMessage: mockSubscriptionLimits.canSendMessage,
  canIndexPages: mockSubscriptionLimits.canIndexPages,
}));

// Mock subscription usage cache - use vi.hoisted
const { mockSubscriptionUsageCache } = vi.hoisted(() => {
  const mockSubscriptionUsageCache = {
    getChatbotCount: vi.fn(),
  };
  return { mockSubscriptionUsageCache };
});

vi.mock('../../services/subscriptionUsageCache', () => ({
  subscriptionUsageCache: mockSubscriptionUsageCache,
}));

describe('Subscription Middleware', () => {
  let req: Partial<SubscriptionRequest & AdminAuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: {
        id: 'user-id',
        role: 'ADMIN',
        email: 'test@example.com',
      },
      adminUser: {
        id: 'admin-id',
        email: 'admin@example.com',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  describe('requireActiveSubscription', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if no subscription is found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No subscription found',
          code: 'NO_SUBSCRIPTION',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if subscription is canceled', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-id',
        status: SubscriptionStatus.CANCELED,
        trialEndDate: null,
        currentPeriodEnd: null,
        plan: { id: 'plan-id', name: 'Pro' },
      });

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Subscription inactive or expired',
          code: 'SUBSCRIPTION_INACTIVE',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if trial has expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-id',
        status: SubscriptionStatus.TRIAL,
        trialEndDate: expiredDate,
        currentPeriodEnd: null,
        plan: { id: 'plan-id', name: 'Pro' },
      });

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Subscription inactive or expired',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if current period has expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-id',
        status: SubscriptionStatus.ACTIVE,
        trialEndDate: null,
        currentPeriodEnd: expiredDate,
        plan: { id: 'plan-id', name: 'Pro' },
      });

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if subscription is active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const mockSubscription = {
        id: 'sub-id',
        status: SubscriptionStatus.ACTIVE,
        trialEndDate: null,
        currentPeriodEnd: futureDate,
        plan: { id: 'plan-id', name: 'Pro' },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(req.subscription).toEqual(mockSubscription);
    });

    it('should call next() if trial is still active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockSubscription = {
        id: 'sub-id',
        status: SubscriptionStatus.TRIAL,
        trialEndDate: futureDate,
        currentPeriodEnd: null,
        plan: { id: 'plan-id', name: 'Pro' },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrisma.subscription.findUnique.mockRejectedValue(new Error('Database error'));

      await requireActiveSubscription(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error checking subscription status' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('checkChatbotLimit', () => {
    it('should return 401 if no user ID found', async () => {
      req.user = undefined;
      req.adminUser = undefined;

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should use adminUser.id if available', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Pro', maxChatbots: null },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionUsageCache.getChatbotCount.mockResolvedValue(5);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { adminUserId: 'admin-id' },
        include: { plan: true },
      });
      expect(next).toHaveBeenCalled();
    });

    it('should call next() if plan has unlimited chatbots (null)', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Enterprise', maxChatbots: null },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if chatbot limit is reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxChatbots: 3 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionUsageCache.getChatbotCount.mockResolvedValue(3);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Chatbot limit reached',
          code: 'CHATBOT_LIMIT_REACHED',
          currentCount: 3,
          maxAllowed: 3,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if chatbot limit is not reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxChatbots: 3 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionUsageCache.getChatbotCount.mockResolvedValue(2);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() if no subscription found (custom instance)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() if subscription table does not exist (custom instance)', async () => {
      const prismaError = { code: 'P2021', message: 'Table "Subscription" does not exist' };
      mockPrisma.subscription.findUnique.mockRejectedValue(prismaError);

      await checkChatbotLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkUserAccessLimit', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;

      await checkUserAccessLimit(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if plan has unlimited users (null)', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Enterprise', maxUsers: null },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await checkUserAccessLimit(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 if user access limit is reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxUsers: 10 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.chatbotAccess.count.mockResolvedValue(10);

      await checkUserAccessLimit(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User access limit reached',
          code: 'USER_ACCESS_LIMIT_REACHED',
          currentCount: 10,
          maxAllowed: 10,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user access limit is not reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxUsers: 10 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.chatbotAccess.count.mockResolvedValue(5);

      await checkUserAccessLimit(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('checkMessageLimit', () => {
    it('should return 401 if user is not authenticated', async () => {
      req.user = undefined;

      await checkMessageLimit(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if no subscription found (custom instance)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await checkMessageLimit(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if message limit is reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxMessages: 1000 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionLimits.canSendMessage.mockResolvedValue({
        allowed: false,
        currentCount: 1000,
        maxAllowed: 1000,
        remaining: 0,
      });

      await checkMessageLimit(req as SubscriptionRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Message limit reached',
          code: 'MESSAGE_LIMIT_REACHED',
          currentCount: 1000,
          maxAllowed: 1000,
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if message limit is not reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxMessages: 1000 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionLimits.canSendMessage.mockResolvedValue({
        allowed: true,
        currentCount: 500,
        maxAllowed: 1000,
        remaining: 500,
      });

      await checkMessageLimit(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow request if subscription table does not exist (custom instance)', async () => {
      const error = new Error('Table does not exist');
      (error as any).code = 'P2021';
      mockPrisma.subscription.findUnique.mockRejectedValue(error);

      await checkMessageLimit(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkIndexedPagesLimit', () => {
    it('should return 401 if no user ID found', async () => {
      req.user = undefined;
      req.adminUser = undefined;

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if no subscription found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'No subscription found',
          code: 'NO_SUBSCRIPTION',
        })
      );
    });

    it('should call next() if maxPages column does not exist (migration not run)', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Pro', maxPages: undefined },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 if indexed pages limit is reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxPages: 100 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionLimits.canIndexPages.mockResolvedValue({
        allowed: false,
        currentCount: 100,
        maxAllowed: 100,
        remaining: 0,
      });

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Indexed pages limit reached',
          code: 'PAGES_LIMIT_REACHED',
        })
      );
    });

    it('should call next() if indexed pages limit is not reached', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxPages: 100 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionLimits.canIndexPages.mockResolvedValue({
        allowed: true,
        currentCount: 50,
        maxAllowed: 100,
        remaining: 50,
      });

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should consider additional pages from request body', async () => {
      req.body = { estimatedPages: 20 };
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Starter', maxPages: 100 },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockSubscriptionLimits.canIndexPages.mockResolvedValue({
        allowed: true,
        currentCount: 50,
        maxAllowed: 100,
        remaining: 50,
      });

      await checkIndexedPagesLimit(req as SubscriptionRequest & AdminAuthRequest, res as Response, next);

      expect(mockSubscriptionLimits.canIndexPages).toHaveBeenCalledWith('admin-id', mockSubscription.plan, 20);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('addSubscriptionInfo', () => {
    it('should call next() even if user is not authenticated', async () => {
      req.user = undefined;

      await addSubscriptionInfo(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should attach subscription to request if found', async () => {
      const mockSubscription = {
        id: 'sub-id',
        plan: { id: 'plan-id', name: 'Pro' },
      };

      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

      await addSubscriptionInfo(req as SubscriptionRequest, res as Response, next);

      expect(req.subscription).toEqual(mockSubscription);
      expect(next).toHaveBeenCalled();
    });

    it('should call next() even if subscription is not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await addSubscriptionInfo(req as SubscriptionRequest, res as Response, next);

      expect(req.subscription).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should call next() even if database error occurs', async () => {
      mockPrisma.subscription.findUnique.mockRejectedValue(new Error('Database error'));

      await addSubscriptionInfo(req as SubscriptionRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
