/**
 * ISubscriptionService
 * 
 * Abstraction layer for subscription and billing limits.
 * Enables decoupling of core business logic from subscription enforcement.
 * 
 * Used by:
 * - Middleware to enforce chatbot/message/page limits
 * - Controllers to check limits before operations
 * 
 * Implementations:
 * - BusinessSubscriptionService: Enforces subscription limits from Prisma DB
 * - CommunitySubscriptionService: No-op implementation (all operations allowed)
 */

export interface SubscriptionLimitInfo {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  remaining?: number;
}

export interface UserSubscriptionInfo {
  planName?: string;
  status?: string;
  isActive: boolean;
  chatbotLimit?: number;
  chatbotCount?: number;
  messageLimit?: number;
  indexedPagesLimit?: number;
}

export interface ISubscriptionService {
  /**
   * Get the number of chatbots owned by a user
   */
  getChatbotCount(userId: string): Promise<number>;

  /**
   * Check if user can create a new chatbot
   */
  canCreateChatbot(userId: string): Promise<SubscriptionLimitInfo>;

  /**
   * Check if user can send a message (for usage tracking)
   */
  canSendMessage(userId: string): Promise<SubscriptionLimitInfo>;

  /**
   * Check if user can index pages (for search indexing)
   */
  canIndexPages(
    userId: string,
    estimatedPages: number
  ): Promise<SubscriptionLimitInfo>;

  /**
   * Get full subscription information for a user
   */
  getSubscriptionInfo(userId: string): Promise<UserSubscriptionInfo | null>;

  /**
   * Invalidate cached subscription info for a user (after subscription changes)
   */
  invalidateCache(userId: string): void;
}
