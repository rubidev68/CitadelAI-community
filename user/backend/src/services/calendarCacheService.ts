/**
 * Calendar Cache Service
 * Caches calendar results per conversation session to avoid re-fetching on every message
 */

import { CalendarEvent } from './calendarProviders/types';

interface CachedCalendarResult {
  events: CalendarEvent[];
  timestamp: number;
  blockId: string;
  userId: string | null;
  searchOptions: {
    calendarId?: string;
    timeMin: Date;
    timeMax: Date;
    maxResults: number;
    query?: string;
  };
}

// In-memory cache: sessionId -> blockId -> cached result
// In production, consider using Redis for distributed caching
const calendarCache = new Map<string, Map<string, CachedCalendarResult>>();

// Cache TTL: 5 minutes (calendar data can change, but we don't want to fetch on every message)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get cached calendar results for a session and block
 */
export function getCachedCalendarResults(
  sessionId: string | undefined,
  blockId: string,
  userId: string | null | undefined,
  searchOptions: {
    calendarId?: string;
    timeMin: Date;
    timeMax: Date;
    maxResults: number;
    query?: string;
  }
): CalendarEvent[] | null {
  if (!sessionId) {
    return null; // No session ID means no cache
  }

  const sessionCache = calendarCache.get(sessionId);
  if (!sessionCache) {
    return null;
  }

  const cached = sessionCache.get(blockId);
  if (!cached) {
    return null;
  }

  // Check if cache is still valid
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL_MS) {
    // Cache expired
    sessionCache.delete(blockId);
    return null;
  }

  // Check if search options match (if they differ significantly, don't use cache)
  // For now, we'll use cache if it's from the same block and session
  // In the future, we could add more sophisticated matching based on date ranges
  if (cached.userId !== userId) {
    // Different user, don't use cache
    return null;
  }

  // Return cached events
  return cached.events;
}

/**
 * Cache calendar results for a session and block
 */
export function setCachedCalendarResults(
  sessionId: string | undefined,
  blockId: string,
  userId: string | null | undefined,
  searchOptions: {
    calendarId?: string;
    timeMin: Date;
    timeMax: Date;
    maxResults: number;
    query?: string;
  },
  events: CalendarEvent[]
): void {
  if (!sessionId) {
    return; // No session ID means no caching
  }

  let sessionCache = calendarCache.get(sessionId);
  if (!sessionCache) {
    sessionCache = new Map();
    calendarCache.set(sessionId, sessionCache);
  }

  sessionCache.set(blockId, {
    events,
    timestamp: Date.now(),
    blockId,
    userId: userId || null,
    searchOptions,
  });
}

/**
 * Clear cache for a specific session
 * Useful when a new conversation starts or when calendar events are modified
 */
export function clearSessionCache(sessionId: string | undefined): void {
  if (!sessionId) {
    return;
  }
  calendarCache.delete(sessionId);
}

/**
 * Clear cache for a specific block in a session
 * Useful when calendar events are modified via action blocks
 */
export function clearBlockCache(sessionId: string | undefined, blockId: string): void {
  if (!sessionId) {
    return;
  }
  const sessionCache = calendarCache.get(sessionId);
  if (sessionCache) {
    sessionCache.delete(blockId);
  }
}

/**
 * Clean up expired cache entries
 * Should be called periodically to prevent memory leaks
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  const sessionsToDelete: string[] = [];

  // Use Array.from to convert iterator to array for compatibility
  for (const [sessionId, sessionCache] of Array.from(calendarCache.entries())) {
    const blocksToDelete: string[] = [];
    
    for (const [blockId, cached] of Array.from(sessionCache.entries())) {
      if (now - cached.timestamp > CACHE_TTL_MS) {
        blocksToDelete.push(blockId);
      }
    }

    // Remove expired blocks
    for (const blockId of blocksToDelete) {
      sessionCache.delete(blockId);
    }

    // If session cache is empty, mark for deletion
    if (sessionCache.size === 0) {
      sessionsToDelete.push(sessionId);
    }
  }

  // Remove empty session caches
  for (const sessionId of sessionsToDelete) {
    calendarCache.delete(sessionId);
  }
}

// Clean up expired cache every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredCache, 10 * 60 * 1000);
}
