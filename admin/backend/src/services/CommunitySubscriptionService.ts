/**
 * CommunitySubscriptionService
 * 
 * No-op implementation that allows all operations without limits.
 * Used when billing feature is disabled (Community Edition).
 */

import { ISubscriptionService, SubscriptionLimitInfo, UserSubscriptionInfo } from './interfaces/ISubscriptionService';
import { logger } from '@shared/utils';

const communitySubLogger = logger.child({ service: 'admin-backend', component: 'CommunitySubscriptionService' });

export class CommunitySubscriptionService implements ISubscriptionService {
  async getChatbotCount(userId: string): Promise<number> {
    // No tracking in community edition
    return 0;
  }

  async canCreateChatbot(userId: string): Promise<SubscriptionLimitInfo> {
    // Always allow in community edition
    return { allowed: true };
  }

  async canSendMessage(userId: string): Promise<SubscriptionLimitInfo> {
    // Always allow in community edition
    return { allowed: true };
  }

  async canIndexPages(userId: string, estimatedPages: number): Promise<SubscriptionLimitInfo> {
    // Always allow in community edition
    return { allowed: true };
  }

  async getSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo | null> {
    // No subscription info in community edition
    return null;
  }

  invalidateCache(userId: string): void {
    // No cache to invalidate in community edition
  }
}
