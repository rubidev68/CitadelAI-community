import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    subscription: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    paymentLink: {
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock Stripe SDK - use vi.hoisted
const { mockStripe, mockStripeConstructor } = vi.hoisted(() => {
  const mockStripe = {
    customers: {
      retrieve: vi.fn(),
      create: vi.fn(),
    },
    products: {
      list: vi.fn(),
      create: vi.fn(),
    },
    prices: {
      list: vi.fn(),
      create: vi.fn(),
    },
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    paymentLinks: {
      create: vi.fn(),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
  };
  const mockStripeConstructor = vi.fn(() => mockStripe);
  return { mockStripe, mockStripeConstructor };
});

vi.mock('stripe', () => {
  // Return a class-like constructor that returns the mock
  const StripeMock = function(this: any) {
    return mockStripe;
  } as any;
  StripeMock.prototype = {};
  return {
    default: StripeMock,
  };
});

describe('Stripe Service', () => {
  const adminUserId = 'admin-123';
  const adminUserEmail = 'admin@example.com';
  const planId = 'plan-123';
  const stripeCustomerId = 'cus_test123';
  const stripePriceId = 'price_test123';
  const stripeProductId = 'prod_test123';
  let stripeService: typeof import('../../services/stripeService');

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    
    // Reset mocks - ensure Stripe constructor returns our mock
    mockStripeConstructor.mockReturnValue(mockStripe);
    
    // Re-import service to get fresh stripe instance with mocked Stripe
    vi.resetModules();
    stripeService = await import('../../services/stripeService');
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  describe('getOrCreateStripeCustomer', () => {
    it('should return existing customer ID if found in database and Stripe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: stripeCustomerId,
      });
      mockStripe.customers.retrieve.mockResolvedValue({ id: stripeCustomerId });

      const result = await stripeService.getOrCreateStripeCustomer(adminUserId, adminUserEmail);

      expect(result).toBe(stripeCustomerId);
      expect(mockStripe.customers.retrieve).toHaveBeenCalledWith(stripeCustomerId);
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not found in database', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: stripeCustomerId });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await stripeService.getOrCreateStripeCustomer(adminUserId, adminUserEmail);

      expect(result).toBe(stripeCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: adminUserEmail,
        name: undefined,
        metadata: { adminUserId },
      });
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { adminUserId },
        data: { stripeCustomerId: stripeCustomerId },
      });
    });

    it('should create new customer if existing customer not found in Stripe', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_old123',
      });
      mockStripe.customers.retrieve.mockRejectedValue(new Error('Customer not found'));
      mockStripe.customers.create.mockResolvedValue({ id: stripeCustomerId });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await stripeService.getOrCreateStripeCustomer(adminUserId, adminUserEmail);

      expect(result).toBe(stripeCustomerId);
      expect(mockStripe.customers.create).toHaveBeenCalled();
    });

    it('should include name when provided', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: stripeCustomerId });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      await stripeService.getOrCreateStripeCustomer(adminUserId, adminUserEmail, 'John Doe');

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: adminUserEmail,
        name: 'John Doe',
        metadata: { adminUserId },
      });
    });

    it('should throw error if Stripe is not configured', async () => {
      // Delete env var and reset modules to get null stripe
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();
      const { getOrCreateStripeCustomer } = await import('../../services/stripeService');
      
      await expect(
        getOrCreateStripeCustomer(adminUserId, adminUserEmail)
      ).rejects.toThrow('Stripe is not configured');
      
      // Restore for other tests
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });
  });

  describe('getStripePriceId', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should return price ID from database if found', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
        stripePriceId: stripePriceId,
      });

      const result = await stripeService.getStripePriceId('Professional');

      expect(result).toBe(stripePriceId);
      expect(mockStripe.products.list).not.toHaveBeenCalled();
    });

    it('should try "Professional" when looking for "Pro"', async () => {
      mockPrisma.subscriptionPlan.findUnique
        .mockResolvedValueOnce(null) // First call for "Pro"
        .mockResolvedValueOnce({ stripePriceId: stripePriceId }); // Second call for "Professional"

      const result = await stripeService.getStripePriceId('Pro');

      expect(result).toBe(stripePriceId);
      expect(mockPrisma.subscriptionPlan.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should try "Pro" when looking for "Professional"', async () => {
      mockPrisma.subscriptionPlan.findUnique
        .mockResolvedValueOnce(null) // First call for "Professional"
        .mockResolvedValueOnce({ stripePriceId: stripePriceId }); // Second call for "Pro"

      const result = await stripeService.getStripePriceId('Professional');

      expect(result).toBe(stripePriceId);
      expect(mockPrisma.subscriptionPlan.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should search Stripe API if not found in database', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [
          {
            id: stripeProductId,
            name: 'Professional Plan',
            object: 'product',
          },
        ],
      });
      mockStripe.prices.list.mockResolvedValue({
        data: [{ id: stripePriceId, object: 'price' }],
      });
      mockPrisma.subscriptionPlan.update.mockResolvedValue({
        id: planId,
        name: 'Professional',
        stripePriceId: stripePriceId,
      });

      const result = await stripeService.getStripePriceId('Professional');

      expect(result).toBe(stripePriceId);
      expect(mockStripe.products.list).toHaveBeenCalled();
      expect(mockStripe.prices.list).toHaveBeenCalledWith({
        product: stripeProductId,
        limit: 1,
      });
    });

    it('should handle product name variations', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [
          {
            id: stripeProductId,
            name: 'Professional',
            object: 'product',
          },
        ],
      });
      mockStripe.prices.list.mockResolvedValue({
        data: [{ id: stripePriceId, object: 'price' }],
      });
      mockPrisma.subscriptionPlan.update.mockResolvedValue({});

      const result = await stripeService.getStripePriceId('Professional');

      expect(result).toBe(stripePriceId);
    });

    it('should throw error if product not found in Stripe', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({ data: [] });

      await expect(stripeService.getStripePriceId('Unknown Plan')).rejects.toThrow('Stripe product not found');
    });

    it('should throw error if price not found for product', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [{ id: stripeProductId, name: 'Professional', object: 'product' }],
      });
      mockStripe.prices.list.mockResolvedValue({ data: [] });

      await expect(stripeService.getStripePriceId('Professional')).rejects.toThrow('No price found');
    });

    it('should update database with price ID after finding in Stripe', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [{ id: stripeProductId, name: 'Professional', object: 'product' }],
      });
      mockStripe.prices.list.mockResolvedValue({
        data: [{ id: stripePriceId, object: 'price' }],
      });
      mockPrisma.subscriptionPlan.update.mockResolvedValue({});

      await stripeService.getStripePriceId('Professional');

      expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { name: 'Professional' },
        data: {
          stripeProductId: stripeProductId,
          stripePriceId: stripePriceId,
        },
      });
    });

    it('should handle database update failure gracefully', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [{ id: stripeProductId, name: 'Professional', object: 'product' }],
      });
      mockStripe.prices.list.mockResolvedValue({
        data: [{ id: stripePriceId, object: 'price' }],
      });
      mockPrisma.subscriptionPlan.update.mockRejectedValue(new Error('Update failed'));

      // Should still return the price ID even if update fails
      const result = await stripeService.getStripePriceId('Professional');

      expect(result).toBe(stripePriceId);
    });

    it('should try alternative plan names when update fails for "Pro"', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);
      mockStripe.products.list.mockResolvedValue({
        data: [{ id: stripeProductId, name: 'Professional', object: 'product' }],
      });
      mockStripe.prices.list.mockResolvedValue({
        data: [{ id: stripePriceId, object: 'price' }],
      });
      mockPrisma.subscriptionPlan.update
        .mockRejectedValueOnce(new Error('Update failed')) // First update fails
        .mockResolvedValueOnce({}); // Second update succeeds

      const result = await stripeService.getStripePriceId('Pro');

      expect(result).toBe(stripePriceId);
      expect(mockPrisma.subscriptionPlan.update).toHaveBeenCalledTimes(2);
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();
      const { getStripePriceId } = await import('../../services/stripeService');
      await expect(getStripePriceId('Professional')).rejects.toThrow('Stripe is not configured');
      
      // Restore for other tests
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });
  });

  describe('createCheckoutSession', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should create checkout session successfully', async () => {
      const mockPlan = {
        id: planId,
        name: 'Professional',
        stripePriceId: stripePriceId,
      };
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        object: 'checkout.session',
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: stripeCustomerId,
      });
      mockStripe.customers.retrieve.mockResolvedValue({ id: stripeCustomerId });
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      const result = await stripeService.createCheckoutSession({
        adminUserId,
        adminUserEmail,
        planId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result).toEqual(mockSession);
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: stripeCustomerId,
          mode: 'subscription',
          line_items: [{ price: stripePriceId, quantity: 1 }],
          metadata: expect.objectContaining({
            adminUserId,
            planId,
            planName: 'Professional',
          }),
        })
      );
    });

    it('should throw error if plan not found', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        stripeService.createCheckoutSession({
          adminUserId,
          adminUserEmail,
          planId,
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Plan not found');
    });

    it('should create customer if not exists', async () => {
      const mockPlan = {
        id: planId,
        name: 'Professional',
        stripePriceId: stripePriceId,
      };
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        object: 'checkout.session',
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockStripe.customers.create.mockResolvedValue({ id: stripeCustomerId });
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await stripeService.createCheckoutSession({
        adminUserId,
        adminUserEmail,
        planId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(mockStripe.customers.create).toHaveBeenCalled();
    });

    it('should include subscriptionData in session creation', async () => {
      const mockPlan = {
        id: planId,
        name: 'Professional',
        stripePriceId: stripePriceId,
      };
      const mockSession = {
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        object: 'checkout.session',
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: stripeCustomerId,
      });
      mockStripe.customers.retrieve.mockResolvedValue({ id: stripeCustomerId });
      mockStripe.checkout.sessions.create.mockResolvedValue(mockSession as any);

      await stripeService.createCheckoutSession({
        adminUserId,
        adminUserEmail,
        planId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        subscriptionData: {
          trial_period_days: 14,
          metadata: { customKey: 'customValue' },
        },
      });

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            trial_period_days: 14,
            metadata: expect.objectContaining({
              adminUserId,
              planId,
              planName: 'Professional',
              customKey: 'customValue',
            }),
          }),
        })
      );
    });

    it('should throw error if price ID not found', async () => {
      const mockPlan = {
        id: planId,
        name: 'Professional',
        stripePriceId: null,
      };

      // Mock for createCheckoutSession - plan lookup
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValueOnce(mockPlan);
      
      // Mock for getOrCreateStripeCustomer
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        stripeCustomerId: stripeCustomerId,
      });
      mockStripe.customers.retrieve.mockResolvedValue({ id: stripeCustomerId });
      
      // Mock for getStripePriceId - plan not found in DB, and not found in Stripe
      // getStripePriceId will be called with plan.name ('Professional')
      // It will try to find in DB (null), then try 'Pro' (null), then search Stripe (empty)
      mockPrisma.subscriptionPlan.findUnique
        .mockResolvedValueOnce(null) // First call for "Professional" in getStripePriceId
        .mockResolvedValueOnce(null); // Second call for "Pro" in getStripePriceId
      mockStripe.products.list.mockResolvedValue({ data: [] });

      await expect(
        stripeService.createCheckoutSession({
          adminUserId,
          adminUserEmail,
          planId,
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Stripe product not found'); // getStripePriceId throws this before returning null
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();
      const { createCheckoutSession } = await import('../../services/stripeService');
      
      await expect(
        createCheckoutSession({
          adminUserId,
          adminUserEmail,
          planId,
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('Stripe is not configured');
      
      // Restore for other tests
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });
  });

  describe('createPaymentLink', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should create payment link with existing price ID', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        description: 'Custom plan description',
        price: 99.99,
        currency: 'USD',
        interval: 'month',
        stripePriceId: stripePriceId,
        stripeProductId: stripeProductId,
      };
      const mockPaymentLink = {
        id: 'pl_test123',
        url: 'https://buy.stripe.com/test',
        object: 'payment_link',
      };
      const mockDbRecord = {
        id: 'db-record-123',
        stripePaymentLinkId: 'pl_test123',
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);
      mockPrisma.paymentLink.create.mockResolvedValue(mockDbRecord as any);

      const result = await stripeService.createPaymentLink({
        adminUserId,
        planId,
      });

      expect(result.paymentLink).toEqual(mockPaymentLink);
      expect(result.dbRecord).toEqual(mockDbRecord);
      expect(mockStripe.paymentLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: stripePriceId, quantity: 1 }],
          metadata: expect.objectContaining({
            adminUserId,
            planId,
            planName: 'Custom Plan',
          }),
        })
      );
    });

    it('should create product and price if price ID not found', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        description: 'Custom plan description',
        price: 99.99,
        currency: 'USD',
        interval: 'month',
        stripePriceId: null,
      };
      const mockProduct = {
        id: stripeProductId,
        name: 'Custom Plan',
        object: 'product',
      };
      const mockPrice = {
        id: stripePriceId,
        object: 'price',
      };
      const mockPaymentLink = {
        id: 'pl_test123',
        url: 'https://buy.stripe.com/test',
        object: 'payment_link',
      };
      const mockDbRecord = {
        id: 'db-record-123',
        stripePaymentLinkId: 'pl_test123',
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.products.create.mockResolvedValue(mockProduct as any);
      mockStripe.prices.create.mockResolvedValue(mockPrice as any);
      mockPrisma.subscriptionPlan.update.mockResolvedValue({});
      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);
      mockPrisma.paymentLink.create.mockResolvedValue(mockDbRecord as any);

      const result = await stripeService.createPaymentLink({
        adminUserId,
        planId,
      });

      expect(result.paymentLink).toEqual(mockPaymentLink);
      expect(mockStripe.products.create).toHaveBeenCalledWith({
        name: 'Custom Plan',
        description: 'Custom plan description',
        metadata: {
          planId,
          adminUserId,
          isCustom: 'true',
        },
      });
      expect(mockStripe.prices.create).toHaveBeenCalledWith({
        product: stripeProductId,
        unit_amount: 9999, // 99.99 * 100
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          planId,
          adminUserId,
        },
      });
    });

    it('should handle yearly interval', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        price: 999.99,
        currency: 'USD',
        interval: 'year',
        stripePriceId: null,
      };
      const mockProduct = { id: stripeProductId, object: 'product' };
      const mockPrice = { id: stripePriceId, object: 'price' };
      const mockPaymentLink = { id: 'pl_test123', object: 'payment_link' };
      const mockDbRecord = { id: 'db-record-123' };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.products.create.mockResolvedValue(mockProduct as any);
      mockStripe.prices.create.mockResolvedValue(mockPrice as any);
      mockPrisma.subscriptionPlan.update.mockResolvedValue({});
      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);
      mockPrisma.paymentLink.create.mockResolvedValue(mockDbRecord as any);

      await stripeService.createPaymentLink({
        adminUserId,
        planId,
      });

      expect(mockStripe.prices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recurring: {
            interval: 'year',
          },
        })
      );
    });

    it('should include proposalId in metadata', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        stripePriceId: stripePriceId,
      };
      const mockPaymentLink = {
        id: 'pl_test123',
        object: 'payment_link',
      };
      const mockDbRecord = { id: 'db-record-123' };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);
      mockPrisma.paymentLink.create.mockResolvedValue(mockDbRecord as any);

      await stripeService.createPaymentLink({
        adminUserId,
        planId,
        proposalId: 'proposal-123',
      });

      expect(mockStripe.paymentLinks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            proposalId: 'proposal-123',
          }),
        })
      );
    });

    it('should include expiresAt in database record', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        stripePriceId: stripePriceId,
      };
      const mockPaymentLink = {
        id: 'pl_test123',
        object: 'payment_link',
      };
      const expiresAt = new Date('2024-12-31');
      const mockDbRecord = { id: 'db-record-123' };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.paymentLinks.create.mockResolvedValue(mockPaymentLink as any);
      mockPrisma.paymentLink.create.mockResolvedValue(mockDbRecord as any);

      await stripeService.createPaymentLink({
        adminUserId,
        planId,
        expiresAt,
      });

      expect(mockPrisma.paymentLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt,
          }),
        })
      );
    });

    it('should throw error if plan not found', async () => {
      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(
        stripeService.createPaymentLink({
          adminUserId,
          planId,
        })
      ).rejects.toThrow('Plan not found');
    });

    it('should throw error if price ID creation fails', async () => {
      const mockPlan = {
        id: planId,
        name: 'Custom Plan',
        stripePriceId: null,
      };

      mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(mockPlan);
      mockStripe.products.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        stripeService.createPaymentLink({
          adminUserId,
          planId,
        })
      ).rejects.toThrow();
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();
      const { createPaymentLink } = await import('../../services/stripeService');
      
      await expect(
        createPaymentLink({
          adminUserId,
          planId,
        })
      ).rejects.toThrow('Stripe is not configured');
      
      // Restore for other tests
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });
  });

  describe('createCustomerPortalSession', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should create customer portal session', async () => {
      const portalUrl = 'https://billing.stripe.com/test';
      mockPrisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: stripeCustomerId,
      });
      mockStripe.billingPortal.sessions.create.mockResolvedValue({
        url: portalUrl,
        object: 'billing_portal.session',
      } as any);

      const result = await stripeService.createCustomerPortalSession(adminUserId, 'https://example.com/return');

      expect(result).toBe(portalUrl);
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: stripeCustomerId,
        return_url: 'https://example.com/return',
      });
    });

    it('should throw error if customer not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const { createCustomerPortalSession } = await import('../../services/stripeService');
      await expect(
        createCustomerPortalSession(adminUserId, 'https://example.com/return')
      ).rejects.toThrow('No Stripe customer found');
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();

      const { createCustomerPortalSession } = await import('../../services/stripeService');
      await expect(
        createCustomerPortalSession(adminUserId, 'https://example.com/return')
      ).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('cancelStripeSubscription', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should cancel subscription at period end by default', async () => {
      const subscriptionId = 'sub_test123';
      mockStripe.subscriptions.update.mockResolvedValue({
        id: subscriptionId,
        cancel_at_period_end: true,
        object: 'subscription',
      } as any);

      await stripeService.cancelStripeSubscription(subscriptionId);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
        cancel_at_period_end: true,
      });
      expect(mockStripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('should cancel subscription immediately if cancelAtPeriodEnd is false', async () => {
      const subscriptionId = 'sub_test123';
      mockStripe.subscriptions.cancel.mockResolvedValue({
        id: subscriptionId,
        status: 'canceled',
        object: 'subscription',
      } as any);

      await stripeService.cancelStripeSubscription(subscriptionId, false);

      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith(subscriptionId);
      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();

      mockStripeConstructor.mockReturnValue(null);
      vi.resetModules();
      const { cancelStripeSubscription } = await import('../../services/stripeService');
      await expect(cancelStripeSubscription('sub_test123')).rejects.toThrow('Stripe is not configured');
    });
  });

  describe('updateStripeSubscription', () => {
    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    });

    it('should update subscription with new price', async () => {
      const subscriptionId = 'sub_test123';
      const newPriceId = 'price_new123';
      const mockSubscription = {
        id: subscriptionId,
        items: {
          data: [{ id: 'si_test123', object: 'subscription_item' }],
        },
        object: 'subscription',
      };
      const mockUpdatedSubscription = {
        id: subscriptionId,
        items: {
          data: [{ id: 'si_test123', price: { id: newPriceId } }],
        },
        object: 'subscription',
      };

      mockStripe.subscriptions.retrieve.mockResolvedValue(mockSubscription as any);
      mockStripe.subscriptions.update.mockResolvedValue(mockUpdatedSubscription as any);

      const result = await stripeService.updateStripeSubscription(subscriptionId, newPriceId);

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(subscriptionId, {
        items: [
          {
            id: 'si_test123',
            price: newPriceId,
          },
        ],
        proration_behavior: 'always_invoice',
      });
    });

    it('should throw error if Stripe is not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      vi.resetModules();

      mockStripeConstructor.mockReturnValue(null);
      vi.resetModules();
      const { updateStripeSubscription } = await import('../../services/stripeService');
      await expect(updateStripeSubscription('sub_test123', 'price_new123')).rejects.toThrow('Stripe is not configured');
    });

    it('should handle subscription retrieval errors', async () => {
      const subscriptionId = 'sub_test123';
      mockStripe.subscriptions.retrieve.mockRejectedValue(new Error('Subscription not found'));

      await expect(stripeService.updateStripeSubscription(subscriptionId, 'price_new123')).rejects.toThrow();
    });
  });
});
