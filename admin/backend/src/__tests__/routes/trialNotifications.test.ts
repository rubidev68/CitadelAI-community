import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import trialNotificationsRouter from '../../routes/trialNotifications';
import { checkAndSendTrialNotifications } from '../../routes/trialNotifications';

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    subscription: {
      findMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  SubscriptionStatus: {
    TRIAL: 'TRIAL',
    ACTIVE: 'ACTIVE',
    CANCELED: 'CANCELED',
  },
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock email service
const { mockEmailService } = vi.hoisted(() => {
  const mockEmailService = {
    sendTrialExpiringSoonEmail: vi.fn().mockResolvedValue(undefined),
    sendTrialExpiredEmail: vi.fn().mockResolvedValue(undefined),
  };
  return { mockEmailService };
});

vi.mock('../../services/zoho-email', () => ({
  getEmailService: () => mockEmailService,
}));

const app = express();
app.use(express.json());
app.use('/api/admin/trial-notifications', trialNotificationsRouter);

describe('Trial Notifications Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset date mocks
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('POST /api/admin/trial-notifications/check', () => {
    it('should send expiring soon emails for trials expiring in 3 days', async () => {
      // Set current date to a fixed date
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      // Calculate 3 days from now
      const threeDaysFromNow = new Date(fixedDate);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const mockSubscription = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: threeDaysFromNow,
        plan: {
          name: 'Professional',
        },
        adminUser: {
          email: 'user@example.com',
          name: 'Test User',
        },
      };

      let callCount = 0;
      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        callCount++;
        // First call is for expiring soon (3 days from now)
        if (callCount === 1) {
          return Promise.resolve([mockSubscription]);
        }
        // Second call is for expired today
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      expect(mockEmailService.sendTrialExpiringSoonEmail).toHaveBeenCalledWith(
        'user@example.com',
        'Professional',
        threeDaysFromNow,
        'Test User'
      );
      expect(mockEmailService.sendTrialExpiredEmail).not.toHaveBeenCalled();
    });

    it('should send expired emails for trials that expired today', async () => {
      // Set current date to a fixed date
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      // Set trial end date to today
      const today = new Date(fixedDate);
      today.setHours(10, 0, 0, 0); // Some time today

      const mockSubscription = {
        id: 'sub-456',
        status: 'TRIAL',
        trialEndDate: today,
        plan: {
          name: 'Enterprise',
        },
        adminUser: {
          email: 'expired@example.com',
          name: 'Expired User',
        },
      };

      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        if (query.where.trialEndDate.gte && query.where.trialEndDate.lt) {
          // Check if this is the "expired today" query (no gte/lt with 3 days offset)
          const todayStart = new Date(fixedDate);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
          
          if (query.where.trialEndDate.gte.getTime() === todayStart.getTime() &&
              query.where.trialEndDate.lt.getTime() === todayEnd.getTime()) {
            return Promise.resolve([mockSubscription]);
          }
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      expect(mockEmailService.sendTrialExpiredEmail).toHaveBeenCalledWith(
        'expired@example.com',
        'Enterprise',
        today,
        'Expired User'
      );
      expect(mockEmailService.sendTrialExpiringSoonEmail).not.toHaveBeenCalled();
    });

    it('should send both expiring soon and expired emails when applicable', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const threeDaysFromNow = new Date(fixedDate);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const today = new Date(fixedDate);
      today.setHours(10, 0, 0, 0);

      const expiringSoonSub = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: threeDaysFromNow,
        plan: { name: 'Professional' },
        adminUser: { email: 'soon@example.com', name: 'Soon User' },
      };

      const expiredSub = {
        id: 'sub-456',
        status: 'TRIAL',
        trialEndDate: today,
        plan: { name: 'Enterprise' },
        adminUser: { email: 'expired@example.com', name: 'Expired User' },
      };

      let callCount = 0;
      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        callCount++;
        if (callCount === 1) {
          // First call: expiring soon
          return Promise.resolve([expiringSoonSub]);
        } else {
          // Second call: expired today
          return Promise.resolve([expiredSub]);
        }
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      expect(mockEmailService.sendTrialExpiringSoonEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendTrialExpiredEmail).toHaveBeenCalledTimes(1);
    });

    it('should handle subscriptions without adminUser gracefully', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const threeDaysFromNow = new Date(fixedDate);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const mockSubscription = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: threeDaysFromNow,
        plan: { name: 'Professional' },
        adminUser: null, // Missing adminUser
      };

      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        if (query.where.trialEndDate.gte && query.where.trialEndDate.lt) {
          return Promise.resolve([mockSubscription]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      // Should not send email if adminUser is missing
      expect(mockEmailService.sendTrialExpiringSoonEmail).not.toHaveBeenCalled();
    });

    it('should handle subscriptions without plan gracefully', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const threeDaysFromNow = new Date(fixedDate);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const mockSubscription = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: threeDaysFromNow,
        plan: null, // Missing plan
        adminUser: { email: 'user@example.com', name: 'Test User' },
      };

      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        if (query.where.trialEndDate.gte && query.where.trialEndDate.lt) {
          return Promise.resolve([mockSubscription]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      // Should not send email if plan is missing
      expect(mockEmailService.sendTrialExpiringSoonEmail).not.toHaveBeenCalled();
    });

    it('should handle email service errors gracefully', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const threeDaysFromNow = new Date(fixedDate);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      threeDaysFromNow.setHours(0, 0, 0, 0);

      const mockSubscription = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: threeDaysFromNow,
        plan: { name: 'Professional' },
        adminUser: { email: 'user@example.com', name: 'Test User' },
      };

      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        if (query.where.trialEndDate.gte && query.where.trialEndDate.lt) {
          return Promise.resolve([mockSubscription]);
        }
        return Promise.resolve([]);
      });

      mockEmailService.sendTrialExpiringSoonEmail.mockRejectedValue(
        new Error('Email service error')
      );

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      // Should still return success even if individual emails fail
      expect(response.body.message).toBe('Trial notification check completed successfully');
      expect(mockEmailService.sendTrialExpiringSoonEmail).toHaveBeenCalled();
    });

    it('should return 500 if database query fails', async () => {
      mockPrisma.subscription.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });

    it('should handle subscriptions without trialEndDate', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      const mockSubscription = {
        id: 'sub-123',
        status: 'TRIAL',
        trialEndDate: null, // Missing trialEndDate
        plan: { name: 'Professional' },
        adminUser: { email: 'user@example.com', name: 'Test User' },
      };

      mockPrisma.subscription.findMany.mockImplementation((query: any) => {
        if (query.where.trialEndDate.gte && query.where.trialEndDate.lt) {
          return Promise.resolve([mockSubscription]);
        }
        return Promise.resolve([]);
      });

      const response = await request(app)
        .post('/api/admin/trial-notifications/check')
        .expect(200);

      expect(response.body.message).toBe('Trial notification check completed successfully');
      // Should not send email if trialEndDate is missing
      expect(mockEmailService.sendTrialExpiringSoonEmail).not.toHaveBeenCalled();
    });
  });

  describe('checkAndSendTrialNotifications function', () => {
    it('should be callable directly', async () => {
      const fixedDate = new Date('2024-01-15T12:00:00Z');
      vi.setSystemTime(fixedDate);

      mockPrisma.subscription.findMany.mockResolvedValue([]);

      await expect(checkAndSendTrialNotifications()).resolves.not.toThrow();
      expect(mockPrisma.subscription.findMany).toHaveBeenCalledTimes(2);
    });

    it('should throw error if database query fails', async () => {
      mockPrisma.subscription.findMany.mockRejectedValue(
        new Error('Database error')
      );

      await expect(checkAndSendTrialNotifications()).rejects.toThrow('Database error');
    });
  });
});
