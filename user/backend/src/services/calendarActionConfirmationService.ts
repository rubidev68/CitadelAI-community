/**
 * Calendar Action Confirmation Service
 * Manages pending calendar actions that require user confirmation
 */

import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

export interface PendingCalendarAction {
  blockId: string;
  userId: string | null;
  chatbotId: string;
  slackUserId: string | null;
  sessionId?: string; // Session ID for cache lookup
  action: 'create' | 'update' | 'delete';
  eventDetails: {
    summary?: string;
    start?: string;
    end?: string;
    location?: string;
    attendees?: string[];
    eventId?: string; // Event identifier from user message
  };
  userMessage: string;
  integrationType: 'web' | 'slack' | 'api';
  expiresAt: Date;
  // Cached event information to avoid re-searching
  cachedEventInfo?: {
    eventId: string; // Actual calendar event ID (UID)
    calendarId: string; // Calendar path
    summary?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
  };
}

// In-memory store for pending actions (use Redis in production)
const pendingActions = new Map<string, PendingCalendarAction>();

// Clean up expired actions periodically
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  for (const [token, action] of pendingActions.entries()) {
    if (action.expiresAt < now) {
      pendingActions.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('Cleaned up expired pending actions', {
      count: cleaned,
      service: 'calendarActionConfirmationService',
    });
  }
}, 60000); // Every minute

/**
 * Generate a secure confirmation token
 */
export function generateConfirmationToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store a pending action
 */
export async function storePendingAction(
  token: string,
  action: PendingCalendarAction
): Promise<void> {
  pendingActions.set(token, action);
}

/**
 * Get a pending action by token
 */
export async function getPendingAction(token: string): Promise<PendingCalendarAction | null> {
  const action = pendingActions.get(token);
  if (!action) {
    return null;
  }
  
  if (action.expiresAt < new Date()) {
    pendingActions.delete(token);
    return null;
  }
  
  return action;
}

/**
 * Clear a pending action
 */
export async function clearPendingAction(token: string): Promise<void> {
  pendingActions.delete(token);
}

/**
 * Validate confirmation token
 */
export function validateConfirmationToken(token: string): boolean {
  if (!token || typeof token !== 'string' || token.length !== 64) {
    return false;
  }
  // Additional validation can be added here (e.g., signature verification)
  return true;
}
