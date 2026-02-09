/**
 * Stripe API Type Definitions
 * 
 * These types complement the official Stripe SDK types and provide
 * additional type safety for our specific use cases.
 * 
 * Note: Official Stripe types are accessed via Stripe.* namespace
 * (e.g., Stripe.Event, Stripe.Checkout.Session, etc.)
 */

/**
 * Stripe webhook event types we handle
 */
export type StripeWebhookEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

/**
 * Stripe checkout session metadata structure
 */
export interface StripeCheckoutSessionMetadata {
  adminUserId?: string;
  planId?: string;
  planName?: string;
  [key: string]: string | undefined;
}

/**
 * Stripe subscription metadata structure
 */
export interface StripeSubscriptionMetadata {
  adminUserId?: string;
  planId?: string;
  planName?: string;
  [key: string]: string | undefined;
}

/**
 * Stripe payment link metadata structure
 */
export interface StripePaymentLinkMetadata {
  adminUserId?: string;
  planId?: string;
  planName?: string;
  proposalId?: string;
  [key: string]: string | undefined;
}

/**
 * Parameters for creating a checkout session
 */
export interface CreateCheckoutSessionParams {
  adminUserId: string;
  adminUserEmail: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  subscriptionData?: {
    metadata?: Record<string, string>;
    [key: string]: unknown;
  };
}

/**
 * Parameters for creating a payment link
 */
export interface CreatePaymentLinkParams {
  adminUserId: string;
  planId: string;
  proposalId?: string;
  expiresAt?: Date;
}

/**
 * Stripe API response wrapper
 */
export interface StripeApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: string;
    message: string;
    code?: string;
  };
}

/**
 * Stripe webhook signature verification result
 */
export interface StripeWebhookVerificationResult {
  valid: boolean;
  event?: {
    id: string;
    type: string;
    data: {
      object: unknown;
    };
  };
  error?: string;
}
