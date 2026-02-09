/**
 * BusinessNotificationService
 * 
 * Real implementation that sends emails via Zoho email service.
 * Used when billing/email features are enabled.
 */

import { INotificationService } from './interfaces/INotificationService';
import { getEmailService } from './zoho-email';
import { logger } from '@shared/utils';

const businessNotifLogger = logger.child({ service: 'admin-backend', component: 'BusinessNotificationService' });

export class BusinessNotificationService implements INotificationService {
  async sendVerificationEmail(
    email: string,
    token: string,
    baseUrl: string
  ): Promise<void> {
    try {
      const emailService = getEmailService();
      await emailService.sendVerificationEmail(email, token, baseUrl);
    } catch (error) {
      businessNotifLogger.error('Failed to send verification email', {
        email,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Don't throw - allow registration to continue even if email fails
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    try {
      const emailService = getEmailService();
      await emailService.sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      businessNotifLogger.error('Failed to send password reset email', {
        email,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Don't throw - allow password reset flow to continue
    }
  }

  async sendSubscriptionReceiptEmail(
    email: string,
    planName: string,
    amount: number,
    currency: string,
    receiptPdfUrl?: string | null
  ): Promise<void> {
    try {
      const emailService = getEmailService();
      await emailService.sendSubscriptionReceiptEmail(
        email,
        planName,
        amount,
        currency,
        receiptPdfUrl ?? null
      );
    } catch (error) {
      businessNotifLogger.error('Failed to send subscription receipt email', {
        email,
        planName,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Don't throw - allow subscription to continue even if receipt email fails
    }
  }

  async sendNotification(
    email: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<void> {
    try {
      const emailService = getEmailService();
      await emailService.sendEmail({
        to: email,
        subject,
        htmlBody,
        textBody,
      });
    } catch (error) {
      businessNotifLogger.error('Failed to send notification email', {
        email,
        subject,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      // Don't throw - allow operations to continue even if notification fails
    }
  }
}
