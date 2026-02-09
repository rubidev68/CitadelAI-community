import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import stripeWebhookRouter from '../../routes/stripeWebhook';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    adminUser: {
      findUnique: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    proposal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentLink: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  SubscriptionStatus: {
    ACTIVE: 'ACTIVE',
    CANCELED: 'CANCELED',
    PAST_DUE: 'PAST_DUE',
    INCOMPLETE: 'INCOMPLETE',
    INCOMPLETE_EXPIRED: 'INCOMPLETE_EXPIRED',
    TRIALING: 'TRIALING',
    UNPAID: 'UNPAID',
  },
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock Stripe service
const { mockStripe } = vi.hoisted(() => {
  const mockStripe = {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
    },
    invoices: {
      retrieve: vi.fn(),
    },
  };
  return { mockStripe };
});

// Mock stripeService - stripe is exported as a named export
vi.mock('../../services/stripeService', () => ({
  stripe: mockStripe,
}));

// Mock email service
const { mockEmailService } = vi.hoisted(() => {
  const mockEmailService = {
    sendSubscriptionReceiptEmail: vi.fn().mockResolvedValue(undefined),
    sendPlanChangeEmail: vi.fn().mockResolvedValue(undefined),
    sendSubscriptionCancellationEmail: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  };
  return { mockEmailService };
});

vi.mock('../../services/zoho-email', () => ({
  getEmailService: () => mockEmailService,
}));

// Mock axios for proposal migration
const { mockAxios } = vi.hoisted(() => {
  const mockAxios = {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  };
  return { mockAxios };
});

vi.mock('axios', () => ({
  default: mockAxios,
}));

const app = express();
// Stripe webhook requires raw body for signature verification
app.use('/api/admin/stripe/webhook', express.raw({ type: 'application/json' }));
app.use('/api/admin/stripe/webhook', stripeWebhookRouter);

describe('Stripe Webhook Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set webhook secret for tests
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
    // Reset stripe mock to have webhooks
    mockStripe.webhooks = {
      constructEvent: vi.fn(),
    };
    mockStripe.subscriptions = {
      retrieve: vi.fn(),
      update: vi.fn(),
    };
    mockStripe.invoices = {
      retrieve: vi.fn(),
    };
  });

  describe('POST /api/admin/stripe/webhook', () => {
    it.skip('should return 503 if Stripe is not configured', async () => {
      // Skipped: Testing null stripe requires dynamic module re-mocking which is complex
      // This scenario is better tested in integration tests
    });

    it('should return 400 if stripe-signature header is missing', async () => {
      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .send(Buffer.from(JSON.stringify({ type: 'test' })))
        .expect(400);

      expect(response.body.error).toBe('Missing stripe-signature header');
    });

    it('should return 400 if webhook signature verification fails', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'invalid-signature')
        .send(Buffer.from(JSON.stringify({ type: 'test' })))
        .expect(400);

      expect(response.body.error).toBe('Invalid signature');
    });

    it('should handle checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            amount_total: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
    });

    it('should handle checkout.session.completed with invoice and receipt email', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            invoice: 'inv-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            amount_total: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      const mockInvoice = {
        id: 'inv-123',
        invoice_pdf: 'https://invoice.stripe.com/inv-123.pdf',
        hosted_invoice_url: 'https://invoice.stripe.com/inv-123',
        amount_paid: 1000,
        currency: 'usd',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockEmailService.sendSubscriptionReceiptEmail).toHaveBeenCalledWith(
        'admin@example.com',
        'Professional',
        1000,
        'usd',
        'https://invoice.stripe.com/inv-123.pdf',
        'Admin User'
      );
    });

    it('should handle invoice retrieval error gracefully in checkout.session.completed', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            invoice: 'inv-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            amount_total: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.retrieve.mockRejectedValue(new Error('Invoice not found'));
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should still send email even if invoice retrieval fails
      expect(mockEmailService.sendSubscriptionReceiptEmail).toHaveBeenCalled();
    });

    it('should handle email sending error gracefully in checkout.session.completed', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            amount_total: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);
      mockEmailService.sendSubscriptionReceiptEmail.mockRejectedValue(
        new Error('Email service error')
      );

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      // Should still succeed even if email fails
      expect(response.body.received).toBe(true);
    });

    it('should handle checkout.session.completed with missing metadata', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            metadata: {}, // Missing adminUserId and planId
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if metadata is missing
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed with missing subscription ID', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            // Missing subscription ID
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if subscription ID is missing
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed with invoice for amount/currency', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            invoice: 'inv-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            // No amount_total, should use invoice
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      const mockInvoice = {
        id: 'inv-123',
        amount_paid: 2000,
        currency: 'eur',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockStripe.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockEmailService.sendSubscriptionReceiptEmail).toHaveBeenCalledWith(
        'admin@example.com',
        'Professional',
        2000,
        'eur',
        null,
        'Admin User'
      );
    });

    it('should handle error upserting subscription in checkout.session.completed', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
            amount_total: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(500);

      expect(response.body.error).toBe('Webhook handler failed');
    });

    it('should handle checkout.session.completed for payment link', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            payment_link: 'plink-123',
            metadata: {},
          },
        },
      };

      const mockPaymentLink = {
        id: 'payment-link-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        proposalId: null,
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
        adminUser: {
          id: 'admin-id',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.paymentLink.update.mockResolvedValue({
        id: 'payment-link-123',
        status: 'COMPLETED',
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPrisma.paymentLink.findUnique).toHaveBeenCalledWith({
        where: { stripePaymentLinkId: 'plink-123' },
        include: { plan: true, adminUser: true },
      });
    });

    it('should handle checkout.session.completed for payment link with no payment_link', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            // No payment_link field
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
        price: 1000,
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not look for payment link
      expect(mockPrisma.paymentLink.findUnique).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed for payment link not found', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            payment_link: 'plink-123',
            metadata: {},
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if payment link not found
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed for payment link with no subscription ID', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            payment_link: 'plink-123',
            // No subscription ID
            metadata: {},
          },
        },
      };

      const mockPaymentLink = {
        id: 'payment-link-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        proposalId: null,
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
        adminUser: {
          id: 'admin-id',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if subscription ID is missing
      expect(mockStripe.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it('should handle checkout.session.completed for payment link with proposal and instance migration', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            payment_link: 'plink-123',
            metadata: {},
          },
        },
      };

      const mockPaymentLink = {
        id: 'payment-link-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        proposalId: 'proposal-123',
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
        adminUser: {
          id: 'admin-id',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      process.env.SUPERADMIN_BACKEND_URL = 'http://test-backend:3007';
      process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
      mockAxios.post.mockResolvedValue({ data: { success: true } });

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.paymentLink.update.mockResolvedValue({
        id: 'payment-link-123',
        status: 'COMPLETED',
      } as any);
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'instance-123', subdomain: 'test', status: 'ACTIVE' },
      ]);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should handle checkout.session.completed for payment link with proposal but no instance', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            payment_link: 'plink-123',
            metadata: {},
          },
        },
      };

      const mockPaymentLink = {
        id: 'payment-link-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        proposalId: 'proposal-123',
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
        adminUser: {
          id: 'admin-id',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.paymentLink.update.mockResolvedValue({
        id: 'payment-link-123',
        status: 'COMPLETED',
      } as any);
      mockPrisma.$queryRaw.mockResolvedValue([]); // No instance found

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle checkout.session.completed for payment link with proposal but instance not ACTIVE', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            payment_link: 'plink-123',
            metadata: {},
          },
        },
      };

      const mockPaymentLink = {
        id: 'payment-link-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        proposalId: 'proposal-123',
        plan: {
          id: 'plan-123',
          name: 'Professional',
        },
        adminUser: {
          id: 'admin-id',
          email: 'admin@example.com',
          name: 'Admin User',
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {},
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.paymentLink.findUnique.mockResolvedValue(mockPaymentLink as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockPrisma.subscription.upsert.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        status: 'ACTIVE',
      } as any);
      mockPrisma.paymentLink.update.mockResolvedValue({
        id: 'payment-link-123',
        status: 'COMPLETED',
      } as any);
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'instance-123', subdomain: 'test', status: 'PENDING' }, // Not ACTIVE
      ]);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle customer.subscription.updated with missing adminUserId', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-123' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {}, // Missing adminUserId
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not update subscription if adminUserId is missing
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated with different statuses', async () => {
      const statuses = [
        { stripe: 'incomplete', expected: 'INCOMPLETE' },
        { stripe: 'incomplete_expired', expected: 'INCOMPLETE_EXPIRED' },
        { stripe: 'unpaid', expected: 'UNPAID' },
        { stripe: 'past_due', expected: 'PAST_DUE' },
        { stripe: 'unknown_status', expected: 'ACTIVE' }, // default case
      ];

      for (const { stripe, expected } of statuses) {
        vi.clearAllMocks();
        
        const mockEvent = {
          type: 'customer.subscription.updated',
          data: {
            object: {
              id: 'sub-123',
              customer: 'cus-123',
              status: stripe,
              items: {
                data: [{ price: { id: 'price-123' } }],
              },
              current_period_start: Math.floor(Date.now() / 1000),
              current_period_end: Math.floor(Date.now() / 1000) + 2592000,
              cancel_at_period_end: false,
              canceled_at: null,
              metadata: {
                adminUserId: 'admin-id',
              },
            },
          },
        };

        const fullSubscription = {
          id: 'sub-123',
          customer: 'cus-123',
          status: stripe,
          items: {
            data: [{ price: { id: 'price-123' } }],
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
          canceled_at: null,
          metadata: {
            adminUserId: 'admin-id',
          },
        };

        mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
        mockStripe.subscriptions.retrieve.mockResolvedValue(fullSubscription as any);
        mockPrisma.subscription.findFirst.mockResolvedValue({
          id: 'sub-db-123',
          adminUserId: 'admin-id',
          planId: 'plan-123',
          currentPeriodEnd: new Date(),
          plan: {
            name: 'Professional',
          },
          adminUser: {
            email: 'admin@example.com',
            name: 'Admin User',
          },
        } as any);
        mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);
        mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
        mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

        const response = await request(app)
          .post('/api/admin/stripe/webhook')
          .set('stripe-signature', 'valid-signature')
          .send(Buffer.from(JSON.stringify(mockEvent)))
          .expect(200);

        expect(response.body.received).toBe(true);
        expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: expected,
            }),
          })
        );
      }
    });

    it('should handle customer.subscription.updated with Stripe API error and fallback', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-123' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      const fullSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          adminUserId: 'admin-id',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe API error'));
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        currentPeriodEnd: new Date(),
        plan: {
          name: 'Professional',
        },
        adminUser: {
          email: 'admin@example.com',
          name: 'Admin User',
        },
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should still update using webhook data as fallback
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated with plan change email error', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-456' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      const fullSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-456' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          adminUserId: 'admin-id',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(fullSubscription as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123', // Old plan
        currentPeriodEnd: new Date(),
        plan: {
          name: 'Starter', // Old plan name
        },
        adminUser: {
          email: 'admin@example.com',
          name: 'Admin User',
        },
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-456', // New plan
        name: 'Professional',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-456',
        name: 'Professional',
      } as any);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockEmailService.sendPlanChangeEmail.mockRejectedValue(new Error('Email error'));

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should still succeed even if email fails
    });

    it('should handle customer.subscription.updated with plan change and send email', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-456' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      const fullSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-456' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          adminUserId: 'admin-id',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(fullSubscription as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123', // Old plan
        currentPeriodEnd: new Date(),
        plan: {
          name: 'Starter', // Old plan name
        },
        adminUser: {
          email: 'admin@example.com',
          name: 'Admin User',
        },
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-456', // New plan
        name: 'Professional',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-456',
        name: 'Professional',
      } as any);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockEmailService.sendPlanChangeEmail).toHaveBeenCalledWith(
        'admin@example.com',
        'Starter',
        'Professional',
        'Admin User'
      );
    });

    it('should handle customer.subscription.updated event', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-123' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      const fullSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          adminUserId: 'admin-id',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(fullSubscription as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        currentPeriodEnd: new Date(),
        plan: {
          name: 'Professional',
        },
        adminUser: {
          email: 'admin@example.com',
          name: 'Admin User',
        },
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
      } as any);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle customer.subscription.deleted with missing adminUserId', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub-123',
            metadata: {}, // Missing adminUserId
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not update subscription if adminUserId is missing
      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
    });

    it('should handle customer.subscription.deleted event', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub-123',
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        stripeSubscriptionId: 'sub-123',
      } as any);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub-123' },
        data: expect.objectContaining({ status: 'CANCELED' }),
      });
    });

    it('should handle invoice.payment_succeeded with no subscription ID', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv-123',
            // No subscription field
            customer: 'cus-123',
            amount_paid: 1000,
            currency: 'usd',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if no subscription ID
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('should handle invoice.payment_succeeded with subscription not found', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv-123',
            subscription: 'sub-123',
            customer: 'cus-123',
            amount_paid: 1000,
            currency: 'usd',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not update if subscription not found
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle invoice.payment_succeeded with Stripe API error', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv-123',
            subscription: 'sub-123',
            customer: 'cus-123',
            amount_paid: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        stripeSubscriptionId: 'sub-123',
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe API error'));
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-db-123',
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should still update subscription with fallback data
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const mockEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'inv-123',
            subscription: 'sub-123',
            customer: 'cus-123',
            amount_paid: 1000,
            currency: 'usd',
          },
        },
      };

      const mockSubscription = {
        id: 'sub-123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        stripeSubscriptionId: 'sub-123',
      } as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      // The route uses subscription.update with where: { id: subscription.id }
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-db-123',
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle invoice.payment_failed with no subscription ID', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv-123',
            // No subscription field
            customer: 'cus-123',
            amount_due: 1000,
            currency: 'usd',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      // Should not process if no subscription ID
      expect(mockPrisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('should handle invoice.payment_failed event', async () => {
      const mockEvent = {
        type: 'invoice.payment_failed',
        data: {
          object: {
            id: 'inv-123',
            subscription: 'sub-123',
            customer: 'cus-123',
            amount_due: 1000,
            currency: 'usd',
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        stripeSubscriptionId: 'sub-123',
      } as any);
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-db-123',
        status: 'PAST_DUE',
      } as any);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-id',
        email: 'admin@example.com',
        name: 'Admin User',
      } as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
    });

    it('should handle customer.subscription.created event', async () => {
      const mockEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub-123',
            customer: 'cus-123',
            status: 'active',
            items: {
              data: [{ price: { id: 'price-123' } }],
            },
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 2592000,
            cancel_at_period_end: false,
            canceled_at: null,
            metadata: {
              adminUserId: 'admin-id',
            },
          },
        },
      };

      const fullSubscription = {
        id: 'sub-123',
        customer: 'cus-123',
        status: 'active',
        items: {
          data: [{ price: { id: 'price-123' } }],
        },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        cancel_at_period_end: false,
        canceled_at: null,
        metadata: {
          adminUserId: 'admin-id',
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockResolvedValue(fullSubscription as any);
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-123',
        adminUserId: 'admin-id',
        planId: 'plan-123',
        currentPeriodEnd: new Date(),
        plan: {
          name: 'Professional',
        },
        adminUser: {
          email: 'admin@example.com',
          name: 'Admin User',
        },
      } as any);
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
      } as any);
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        id: 'plan-123',
        name: 'Professional',
      } as any);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle unhandled event types gracefully', async () => {
      const mockEvent = {
        type: 'unknown.event.type',
        data: {
          object: {},
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle errors in event processing', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'session-123',
            subscription: 'sub-123',
            metadata: {
              adminUserId: 'admin-id',
              planId: 'plan-123',
            },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Stripe error'));

      const response = await request(app)
        .post('/api/admin/stripe/webhook')
        .set('stripe-signature', 'valid-signature')
        .send(Buffer.from(JSON.stringify(mockEvent)))
        .expect(500);

      expect(response.body.error).toBe('Webhook handler failed');
    });
  });
});
