/**
 * INotificationService
 * 
 * Abstraction layer for email/notification delivery.
 * Enables decoupling of core authentication logic from email services.
 * 
 * Used by:
 * - Auth routes to send verification/password reset emails
 * - Subscription routes to send receipts
 * - Enterprise routes to send notifications
 * 
 * Implementations:
 * - BusinessNotificationService: Sends emails via Zoho email service
 * - CommunityNotificationService: No-op implementation (all emails skipped)
 */

export interface INotificationService {
  /**
   * Send email verification token to user
   */
  sendVerificationEmail(
    email: string,
    token: string,
    baseUrl: string
  ): Promise<void>;

  /**
   * Send password reset link to user
   */
  sendPasswordResetEmail(email: string, resetUrl: string): Promise<void>;

  /**
   * Send subscription receipt/invoice email
   */
  sendSubscriptionReceiptEmail(
    email: string,
    planName: string,
    amount: number,
    currency: string,
    receiptPdfUrl?: string | null
  ): Promise<void>;

  /**
   * Send generic email notification
   */
  sendNotification(
    email: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<void>;
}
