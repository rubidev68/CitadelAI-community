import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import enterpriseRouter from '../../routes/enterprise';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    enterpriseContactRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscriptionPlan: {
      findFirst: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  EnterpriseContactStatus: {
    PENDING: 'PENDING',
    CONTACTED: 'CONTACTED',
    CONVERTED: 'CONVERTED',
    REJECTED: 'REJECTED',
  },
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock email service
const { mockEmailService } = vi.hoisted(() => {
  const mockEmailService = {
    sendEnterpriseRequestRecapEmail: vi.fn().mockResolvedValue(undefined),
    sendEnterpriseRequestNotificationEmail: vi.fn().mockResolvedValue(undefined),
  };
  return { mockEmailService };
});

vi.mock('../../services/zoho-email', () => ({
  getEmailService: () => mockEmailService,
}));

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = { id: 'admin-id', email: 'admin@example.com', name: 'Admin User' };
    next();
  },
  AdminAuthRequest: {},
}));

const app = express();
app.use(express.json());
app.use('/api/admin/enterprise', enterpriseRouter);

describe('Enterprise Routes', () => {
  const requestId = 'request-123';
  const adminUserId = 'admin-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/enterprise/contact', () => {
    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/api/admin/enterprise/contact')
        .send({
          name: 'John Doe',
          company: 'Acme Corp',
        })
        .expect(400);

      expect(response.body.error).toBe('Email is required');
    });

    it('should return 400 if email already has pending request', async () => {
      mockPrisma.enterpriseContactRequest.findFirst.mockResolvedValue({
        id: requestId,
        email: 'existing@example.com',
        status: 'PENDING',
      });

      const response = await request(app)
        .post('/api/admin/enterprise/contact')
        .send({
          email: 'existing@example.com',
          name: 'John Doe',
        })
        .expect(400);

      expect(response.body.error).toContain('already have a pending enterprise request');
    });

    it('should create enterprise contact request successfully', async () => {
      mockPrisma.enterpriseContactRequest.findFirst.mockResolvedValue(null);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: adminUserId,
        name: 'Admin User',
        email: 'admin@example.com',
      });
      mockPrisma.enterpriseContactRequest.create.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        name: 'John Doe',
        company: 'Acme Corp',
        phone: '123-456-7890',
        message: 'Interested in Enterprise plan',
        status: 'PENDING',
        adminUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const response = await request(app)
        .post('/api/admin/enterprise/contact')
        .send({
          email: 'contact@example.com',
          name: 'John Doe',
          company: 'Acme Corp',
          phone: '123-456-7890',
          message: 'Interested in Enterprise plan',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.requestId).toBe(requestId);
      expect(mockPrisma.enterpriseContactRequest.create).toHaveBeenCalled();
      expect(mockEmailService.sendEnterpriseRequestRecapEmail).toHaveBeenCalled();
      expect(mockEmailService.sendEnterpriseRequestNotificationEmail).toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully', async () => {
      mockPrisma.enterpriseContactRequest.findFirst.mockResolvedValue(null);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: adminUserId,
        name: 'Admin User',
        email: 'admin@example.com',
      });
      mockPrisma.enterpriseContactRequest.create.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        status: 'PENDING',
        adminUserId,
      } as any);
      
      // Email service fails but request should still succeed
      mockEmailService.sendEnterpriseRequestRecapEmail.mockRejectedValue(new Error('Email error'));

      const response = await request(app)
        .post('/api/admin/enterprise/contact')
        .send({
          email: 'contact@example.com',
          name: 'John Doe',
        })
        .expect(200);

      // Request should still succeed even if email fails
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/enterprise/requests', () => {
    it('should return 404 if admin user not found', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/enterprise/requests')
        .expect(404);

      expect(response.body.error).toBe('Admin user not found');
    });

    it('should return all enterprise requests', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: adminUserId,
        email: 'admin@example.com',
      });
      mockPrisma.enterpriseContactRequest.findMany.mockResolvedValue([
        {
          id: requestId,
          email: 'contact1@example.com',
          status: 'PENDING',
          createdAt: new Date(),
        },
        {
          id: 'request-456',
          email: 'contact2@example.com',
          status: 'CONTACTED',
          createdAt: new Date(),
        },
      ] as any);

      const response = await request(app)
        .get('/api/admin/enterprise/requests')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe(requestId);
      expect(mockPrisma.enterpriseContactRequest.findMany).toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/enterprise/requests/:id', () => {
    it('should return 400 if status is invalid', async () => {
      const response = await request(app)
        .put(`/api/admin/enterprise/requests/${requestId}`)
        .send({
          status: 'INVALID_STATUS',
        })
        .expect(400);

      expect(response.body.error).toBe('Invalid status');
    });

    it('should update request status successfully', async () => {
      const updatedRequest = {
        id: requestId,
        email: 'contact@example.com',
        status: 'CONTACTED',
        notes: 'Contacted via phone',
        adminUserId,
        updatedAt: new Date(),
      };

      mockPrisma.enterpriseContactRequest.update.mockResolvedValue(updatedRequest as any);

      const response = await request(app)
        .put(`/api/admin/enterprise/requests/${requestId}`)
        .send({
          status: 'CONTACTED',
          notes: 'Contacted via phone',
        })
        .expect(200);

      expect(response.body.status).toBe('CONTACTED');
      expect(response.body.notes).toBe('Contacted via phone');
      expect(mockPrisma.enterpriseContactRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          status: 'CONTACTED',
          notes: 'Contacted via phone',
          adminUserId,
        },
      });
    });

    it('should handle update errors', async () => {
      mockPrisma.enterpriseContactRequest.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put(`/api/admin/enterprise/requests/${requestId}`)
        .send({
          status: 'CONTACTED',
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to update enterprise request');
    });
  });

  describe('POST /api/admin/enterprise/requests/:id/convert', () => {
    it('should return 400 if adminUserId is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Admin user ID is required');
    });

    it('should return 404 if enterprise request not found', async () => {
      mockPrisma.enterpriseContactRequest.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({
          adminUserId: 'target-admin-id',
        })
        .expect(404);

      expect(response.body.error).toBe('Enterprise request not found');
    });

    it('should return 404 if Enterprise plan not found', async () => {
      mockPrisma.enterpriseContactRequest.findUnique.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        status: 'PENDING',
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({
          adminUserId: 'target-admin-id',
        })
        .expect(404);

      expect(response.body.error).toBe('Enterprise plan not found');
    });

    it('should return 400 if user already has subscription', async () => {
      mockPrisma.enterpriseContactRequest.findUnique.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        status: 'PENDING',
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-123',
        name: 'Enterprise',
      } as any);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-123',
        adminUserId: 'target-admin-id',
      } as any);

      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({
          adminUserId: 'target-admin-id',
        })
        .expect(400);

      expect(response.body.error).toBe('User already has a subscription');
    });

    it('should convert request to subscription successfully', async () => {
      const targetAdminId = 'target-admin-id';
      const enterprisePlanId = 'plan-123';

      mockPrisma.enterpriseContactRequest.findUnique.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        status: 'PENDING',
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: enterprisePlanId,
        name: 'Enterprise',
      } as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.create.mockResolvedValue({
        id: 'sub-123',
        adminUserId: targetAdminId,
        planId: enterprisePlanId,
        status: 'ACTIVE',
        plan: {
          id: enterprisePlanId,
          name: 'Enterprise',
        },
        adminUser: {
          id: targetAdminId,
          email: 'contact@example.com',
          name: 'John Doe',
          company: 'Acme Corp',
        },
      } as any);
      mockPrisma.enterpriseContactRequest.update.mockResolvedValue({
        id: requestId,
        status: 'CONVERTED',
      } as any);

      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({
          adminUserId: targetAdminId,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.subscription.id).toBe('sub-123');
      expect(response.body.subscription.status).toBe('ACTIVE');
      expect(mockPrisma.subscription.create).toHaveBeenCalled();
      expect(mockPrisma.enterpriseContactRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: {
          status: 'CONVERTED',
          adminUserId,
        },
      });
    });

    it('should handle conversion errors', async () => {
      mockPrisma.enterpriseContactRequest.findUnique.mockResolvedValue({
        id: requestId,
        email: 'contact@example.com',
        status: 'PENDING',
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-123',
        name: 'Enterprise',
      } as any);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/admin/enterprise/requests/${requestId}/convert`)
        .send({
          adminUserId: 'target-admin-id',
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to convert enterprise request');
    });
  });
});
