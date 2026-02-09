/**
 * CommunityNotificationService
 * 
 * No-op implementation that skips all email sending.
 * Used when billing/email features are disabled (Community Edition).
 */

import { INotificationService } from './interfaces/INotificationService';
import { logger } from '@shared/utils';

const communityNotifLogger = logger.child({ service: 'admin-backend', component: 'CommunityNotificationService' });

export class CommunityNotificationService implements INotificationService {
  async sendVerificationEmail(
    email: string,
    token: string,
    baseUrl: string
  ): Promise<void> {
    // Community edition doesn't send emails
    communityNotifLogger.debug('Email sending skipped (Community Edition)', {
      email,
      type: 'verification',
    });
  }

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    // Community edition doesn't send emails
    communityNotifLogger.debug('Email sending skipped (Community Edition)', {
      email,
      type: 'password_reset',
    });
  }

  async sendSubscriptionReceiptEmail(
    email: string,
    planName: string,
    amount: number,
    currency: string,
    receiptPdfUrl?: string | null
  ): Promise<void> {
    // Community edition doesn't send emails
    communityNotifLogger.debug('Email sending skipped (Community Edition)', {
      email,
      type: 'receipt',
    });
  }

  async sendNotification(
    email: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): Promise<void> {
    // Community edition doesn't send emails
    communityNotifLogger.debug('Email sending skipped (Community Edition)', {
      email,
      subject,
      type: 'notification',
    });
  }
}
