/**
 * Service Factory Pattern
 * 
 * Creates appropriate service implementations based on feature flags.
 * This allows seamless switching between business and community editions.
 */

import { isFeatureEnabled } from '../shared/config/features';
import { ISubscriptionService } from './interfaces/ISubscriptionService';
import { INotificationService } from './interfaces/INotificationService';

import { CommunitySubscriptionService } from './CommunitySubscriptionService';

import { CommunityNotificationService } from './CommunityNotificationService';

let subscriptionServiceInstance: ISubscriptionService | null = null;
let notificationServiceInstance: INotificationService | null = null;

/**
 * Get or create the subscription service instance
 */
export function getSubscriptionService(): ISubscriptionService {
  if (subscriptionServiceInstance === null) {
    subscriptionServiceInstance = new CommunitySubscriptionService();
  }
  return subscriptionServiceInstance;
}

/**
 * Get or create the notification service instance
 */
export function getNotificationService(): INotificationService {
  if (notificationServiceInstance === null) {
    notificationServiceInstance = new CommunityNotificationService();
  }
  return notificationServiceInstance;
}

/**
 * Reset service instances (useful for testing)
 */
export function resetServiceInstances(): void {
  subscriptionServiceInstance = null;
  notificationServiceInstance = null;
}
