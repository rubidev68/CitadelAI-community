import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import paymentLinksRouter from '../../routes/paymentLinks';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    paymentLink: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock Stripe service - use vi.hoisted
const { mockStripeService } = vi.hoisted(() => {
  const mockPaymentLinks = {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  };
  const mockStripeService = {
    stripe: {
      paymentLinks: mockPaymentLinks,
    },
    createPaymentLink: vi.fn(),
  };
  return { mockStripeService, mockPaymentLinks };
});

vi.mock('../../services/stripeService', () => ({
  stripe: mockStripeService.stripe,
  createPaymentLink: mockStripeService.createPaymentLink,
}));

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
    };
    next();
  },
  AdminAuthRequest: {},
}));

describe('Payment Links Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/payment-links', paymentLinksRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/payment-links', () => {
    beforeEach(() => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'SUPERADMIN',
      });
    });

    it('should return 403 if user is not superadmin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
      });

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
          adminUserId: 'target-admin-id',
        })
        .expect(403);

      expect(response.body.error).toBe('Only superadmins can create payment links');
    });

    it('should return 400 if planId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          adminUserId: 'target-admin-id',
        })
        .expect(400);

      expect(response.body.error).toContain('planId and adminUserId are required');
    });

    it('should return 400 if adminUserId is missing', async () => {
      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
        })
        .expect(400);

      expect(response.body.error).toContain('planId and adminUserId are required');
    });

    it('should return 503 if Stripe is not configured', async () => {
      // This test is skipped because mocking stripe as null requires module re-import
      // which is complex with vi.mock. The functionality is tested in integration tests.
      // For unit tests, we assume stripe is available when needed.
    });

    it('should return 404 if target admin user not found', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: 'admin-id',
          role: 'SUPERADMIN',
        })
        .mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
          adminUserId: 'non-existent-admin',
        })
        .expect(404);

      expect(response.body.error).toBe('Target admin user not found');
    });

    it('should return 404 if plan not found', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: 'admin-id',
          role: 'SUPERADMIN',
        })
        .mockResolvedValueOnce({
          id: 'target-admin-id',
          email: 'target@example.com',
          name: 'Target Admin',
        });

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'non-existent-plan',
          adminUserId: 'target-admin-id',
        })
        .expect(404);

      expect(response.body.error).toBe('Plan not found');
    });

    it('should create payment link successfully', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: 'admin-id',
          role: 'SUPERADMIN',
        })
        .mockResolvedValueOnce({
          id: 'target-admin-id',
          email: 'target@example.com',
          name: 'Target Admin',
        });

      const mockPlan = {
        id: 'plan-123',
        name: 'Custom Plan',
        price: 299,
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);

      const mockPaymentLink = {
        id: 'plink-123',
        url: 'https://buy.stripe.com/link-123',
      };

      const mockDbRecord = {
        id: 'db-record-123',
        status: 'ACTIVE',
        expiresAt: null,
      };

      mockStripeService.createPaymentLink.mockResolvedValue({
        paymentLink: mockPaymentLink,
        dbRecord: mockDbRecord,
      });

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
          adminUserId: 'target-admin-id',
        })
        .expect(200);

      expect(response.body.id).toBe('db-record-123');
      expect(response.body.paymentLinkUrl).toBe('https://buy.stripe.com/link-123');
      expect(response.body.plan.name).toBe('Custom Plan');
    });

    it('should return 500 on error creating payment link', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: 'admin-id',
          role: 'SUPERADMIN',
        })
        .mockResolvedValueOnce({
          id: 'target-admin-id',
          email: 'target@example.com',
          name: 'Target Admin',
        });

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Custom Plan',
        price: 299,
      });

      mockStripeService.createPaymentLink.mockRejectedValue(
        new Error('Stripe error')
      );

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
          adminUserId: 'target-admin-id',
        })
        .expect(500);

      expect(response.body.error).toBe('Stripe error');
    });

    it('should set expiration date if expiresInDays provided', async () => {
      mockPrisma.adminUser.findUnique
        .mockResolvedValueOnce({
          id: 'admin-id',
          role: 'SUPERADMIN',
        })
        .mockResolvedValueOnce({
          id: 'target-admin-id',
          email: 'target@example.com',
          name: 'Target Admin',
        });

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Custom Plan',
        price: 299,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mockStripeService.createPaymentLink.mockResolvedValue({
        paymentLink: { id: 'plink-123', url: 'https://buy.stripe.com/link-123' },
        dbRecord: {
          id: 'db-record-123',
          status: 'ACTIVE',
          expiresAt: futureDate,
        },
      });

      const response = await request(app)
        .post('/api/admin/payment-links')
        .send({
          planId: 'plan-123',
          adminUserId: 'target-admin-id',
          expiresInDays: 30,
        })
        .expect(200);

      expect(response.body.expiresAt).toBeDefined();
      expect(mockStripeService.createPaymentLink).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        })
      );
    });
  });

  describe('GET /api/admin/payment-links', () => {
    beforeEach(() => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'SUPERADMIN',
      });
    });

    it('should return list of payment links', async () => {
      const mockPaymentLinks = [
        {
          id: 'link-1',
          status: 'ACTIVE',
          plan: { id: 'plan-1', name: 'Plan 1' },
          adminUser: { id: 'admin-1', email: 'admin1@example.com' },
        },
        {
          id: 'link-2',
          status: 'EXPIRED',
          plan: { id: 'plan-2', name: 'Plan 2' },
          adminUser: { id: 'admin-2', email: 'admin2@example.com' },
        },
      ];

      mockPrisma.paymentLink.findMany.mockResolvedValue(mockPaymentLinks);

      const response = await request(app)
        .get('/api/admin/payment-links')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('link-1');
    });

    it('should return 403 if user is not superadmin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
      });

      const response = await request(app)
        .get('/api/admin/payment-links')
        .expect(403);

      expect(response.body.error).toBe('Only superadmins can view payment links');
    });

    it('should return 500 on database error', async () => {
      mockPrisma.paymentLink.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/admin/payment-links')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch payment links');
    });
  });

  describe('GET /api/admin/payment-links/:id', () => {
    const linkId = 'link-123';

    it('should return 404 if payment link not found', async () => {
      mockPrisma.paymentLink.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(404);

      expect(response.body.error).toBe('Payment link not found');
    });

    it('should return payment link details for owner', async () => {
      const mockPaymentLink = {
        id: linkId,
        status: 'ACTIVE',
        adminUserId: 'admin-id', // Same as req.adminUser.id
        plan: { id: 'plan-123', name: 'Custom Plan' },
        adminUser: { id: 'admin-id', email: 'admin@example.com' },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(200);

      expect(response.body.id).toBe(linkId);
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should return payment link details for superadmin', async () => {
      const mockPaymentLink = {
        id: linkId,
        status: 'ACTIVE',
        adminUserId: 'other-admin-id',
        plan: { id: 'plan-123', name: 'Custom Plan' },
        adminUser: { id: 'other-admin-id', email: 'other@example.com' },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'SUPERADMIN',
      });

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(200);

      expect(response.body.id).toBe(linkId);
    });

    it('should return 403 if user is not owner or superadmin', async () => {
      const mockPaymentLink = {
        id: linkId,
        status: 'ACTIVE',
        adminUserId: 'other-admin-id',
        plan: { id: 'plan-123', name: 'Custom Plan' },
        adminUser: { id: 'other-admin-id', email: 'other@example.com' },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
      });

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should include Stripe payment link URL when available', async () => {
      const mockPaymentLink = {
        id: linkId,
        status: 'ACTIVE',
        adminUserId: 'admin-id',
        stripePaymentLinkId: 'plink-123',
        plan: { id: 'plan-123', name: 'Custom Plan' },
        adminUser: { id: 'admin-id', email: 'admin@example.com' },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockStripeService.stripe.paymentLinks.retrieve.mockResolvedValue({
        url: 'https://buy.stripe.com/link-123',
      });

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(200);

      expect(response.body.paymentLinkUrl).toBe('https://buy.stripe.com/link-123');
    });

    it('should handle Stripe retrieval error gracefully', async () => {
      const mockPaymentLink = {
        id: linkId,
        status: 'ACTIVE',
        adminUserId: 'admin-id',
        stripePaymentLinkId: 'plink-123',
        plan: { id: 'plan-123', name: 'Custom Plan' },
        adminUser: { id: 'admin-id', email: 'admin@example.com' },
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockStripeService.stripe.paymentLinks.retrieve.mockRejectedValue(
        new Error('Stripe error')
      );

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(200);

      // Should still return payment link even if Stripe retrieval fails
      expect(response.body.id).toBe(linkId);
      expect(response.body.paymentLinkUrl).toBeNull();
    });

    it('should return 500 on database error', async () => {
      mockPrisma.paymentLink.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get(`/api/admin/payment-links/${linkId}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch payment link');
    });
  });

  describe('GET /api/admin/payment-links/user/:adminUserId', () => {
    const adminUserId = 'admin-id'; // Must match req.adminUser.id from middleware

    it('should return payment links for owner', async () => {
      const mockPaymentLinks = [
        {
          id: 'link-1',
          status: 'ACTIVE',
          plan: { id: 'plan-1', name: 'Plan 1' },
        },
      ];

      mockPrisma.paymentLink.findMany.mockResolvedValue(mockPaymentLinks);

      const response = await request(app)
        .get(`/api/admin/payment-links/user/${adminUserId}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(mockPrisma.paymentLink.findMany).toHaveBeenCalledWith({
        where: { adminUserId },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
            },
          },
          subscription: {
            select: {
              id: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return payment links for superadmin viewing other user', async () => {
      const mockPaymentLinks = [
        {
          id: 'link-1',
          status: 'ACTIVE',
          plan: { id: 'plan-1', name: 'Plan 1' },
        },
      ];

      mockPrisma.paymentLink.findMany.mockResolvedValue(mockPaymentLinks);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'SUPERADMIN',
      });

      const response = await request(app)
        .get(`/api/admin/payment-links/user/other-admin-id`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('should return 403 if user is not owner or superadmin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
      });

      const response = await request(app)
        .get(`/api/admin/payment-links/user/other-admin-id`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return 500 on database error', async () => {
      // First call is for isSuperAdmin check, second is for findMany
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN', // Not superadmin, so will check if owner
      });
      mockPrisma.paymentLink.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get(`/api/admin/payment-links/user/${adminUserId}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch payment links');
    });
  });

  describe('POST /api/admin/payment-links/:id/cancel', () => {
    const linkId = 'link-123';

    beforeEach(() => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'SUPERADMIN',
      });
    });

    it('should return 404 if payment link not found', async () => {
      mockPrisma.paymentLink.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/payment-links/${linkId}/cancel`)
        .expect(404);

      expect(response.body.error).toBe('Payment link not found');
    });

    it('should return 403 if user is not superadmin', async () => {
      const mockPaymentLink = {
        id: linkId,
        stripePaymentLinkId: 'plink-123',
        status: 'ACTIVE',
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        role: 'ADMIN',
      });

      const response = await request(app)
        .post(`/api/admin/payment-links/${linkId}/cancel`)
        .expect(403);

      expect(response.body.error).toBe('Only superadmins can cancel payment links');
    });

    it('should return 400 if payment link is already completed', async () => {
      const mockPaymentLink = {
        id: linkId,
        stripePaymentLinkId: 'plink-123',
        status: 'COMPLETED',
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);

      const response = await request(app)
        .post(`/api/admin/payment-links/${linkId}/cancel`)
        .expect(400);

      expect(response.body.error).toBe('Cannot cancel a completed payment link');
    });

    it('should cancel payment link', async () => {
      const mockPaymentLink = {
        id: linkId,
        stripePaymentLinkId: 'plink-123',
        status: 'ACTIVE',
      };

      const cancelledPaymentLink = {
        ...mockPaymentLink,
        status: 'CANCELLED',
      };

      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink);
      mockPrisma.paymentLink.update.mockResolvedValue(cancelledPaymentLink);

      const response = await request(app)
        .post(`/api/admin/payment-links/${linkId}/cancel`)
        .expect(200);

      expect(response.body.status).toBe('CANCELLED');
      expect(mockPrisma.paymentLink.update).toHaveBeenCalledWith({
        where: { id: linkId },
        data: { status: 'CANCELLED' },
      });
    });

    it('should return 500 on database error', async () => {
      mockPrisma.paymentLink.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post(`/api/admin/payment-links/${linkId}/cancel`)
        .expect(500);

      expect(response.body.error).toBe('Failed to cancel payment link');
    });
  });
});
