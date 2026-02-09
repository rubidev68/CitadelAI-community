import { Router } from 'express';
import { SubscriptionStatus } from '@prisma/client';
import { getEmailService } from '../services/zoho-email';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const trialNotificationsLogger = logger.child({ service: 'admin-backend', component: 'trialNotifications' });

const router = Router();

/**
 * Check and send trial expiration emails
 * This should be called daily by a cron job
 * 
 * Sends:
 * - "Trial expiring soon" email 3 days before expiration
 * - "Trial expired" email on the day of expiration
 */
export async function checkAndSendTrialNotifications(): Promise<void> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const fourDaysFromNow = new Date(today);
    fourDaysFromNow.setDate(fourDaysFromNow.getDate() + 4);

    // Find trials expiring in 3 days (for "expiring soon" email)
    // Check for trials that expire on the day that is 3 days from today
    const trialsExpiringSoon = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEndDate: {
          gte: threeDaysFromNow, // Start of day 3 days from now
          lt: fourDaysFromNow, // Start of day 4 days from now (end of day 3)
        },
      },
      include: {
        plan: {
          select: { name: true }
        },
        adminUser: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    // Find trials that expired today (for "expired" email)
    const trialsExpiredToday = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIAL,
        trialEndDate: {
          gte: new Date(today.getTime()),
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000), // End of today
        },
      },
      include: {
        plan: {
          select: { name: true }
        },
        adminUser: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    const emailService = getEmailService();
    let expiringSoonCount = 0;
    let expiredCount = 0;

    // Send "expiring soon" emails
    for (const subscription of trialsExpiringSoon) {
      if (subscription.trialEndDate && subscription.plan && subscription.adminUser) {
        try {
          await emailService.sendTrialExpiringSoonEmail(
            subscription.adminUser.email,
            subscription.plan.name,
            subscription.trialEndDate,
            subscription.adminUser.name || undefined
          );
          expiringSoonCount++;
          trialNotificationsLogger.info('Trial expiring soon email sent', { email: subscription.adminUser.email, trialEndDate: subscription.trialEndDate.toISOString() });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          trialNotificationsLogger.error('Failed to send trial expiring soon email', { email: subscription.adminUser.email, error: error instanceof Error ? error : new Error(String(error)) });
        }
      }
    }

    // Send "expired" emails
    for (const subscription of trialsExpiredToday) {
      if (subscription.trialEndDate && subscription.plan && subscription.adminUser) {
        try {
          await emailService.sendTrialExpiredEmail(
            subscription.adminUser.email,
            subscription.plan.name,
            subscription.trialEndDate,
            subscription.adminUser.name || undefined
          );
          expiredCount++;
          trialNotificationsLogger.info('Trial expired email sent', { email: subscription.adminUser.email, trialEndDate: subscription.trialEndDate.toISOString() });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          trialNotificationsLogger.error('Failed to send trial expired email', { email: subscription.adminUser.email, error: error instanceof Error ? error : new Error(String(error)) });
        }
      }
    }

    trialNotificationsLogger.info('Trial notification check completed', { expiringSoonCount, expiredCount });
  } catch (error: unknown) {
    trialNotificationsLogger.error('Error checking trial notifications', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

// Endpoint to manually trigger trial notification check (for testing or manual runs)
router.post('/check', async (req, res) => {
  try {
    await checkAndSendTrialNotifications();
    res.json({ 
      message: 'Trial notification check completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check trial notifications';
    trialNotificationsLogger.error('Error in trial notification check endpoint', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ 
      error: errorMessage,
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
