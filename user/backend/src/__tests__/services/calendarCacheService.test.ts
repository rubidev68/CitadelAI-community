import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedCalendarResults,
  setCachedCalendarResults,
  clearSessionCache,
  clearBlockCache,
  cleanupExpiredCache,
} from '../../services/calendarCacheService';
import { CalendarEvent } from '../../services/calendarProviders/types';

describe('Calendar Cache Service', () => {
  const mockEvents: CalendarEvent[] = [
    {
      id: 'event-1',
      calendarId: 'cal-1',
      summary: 'Test Event',
      start: { dateTime: '2024-01-01T10:00:00Z' },
      end: { dateTime: '2024-01-01T11:00:00Z' },
    },
    {
      id: 'event-2',
      calendarId: 'cal-1',
      summary: 'Another Event',
      start: { dateTime: '2024-01-01T14:00:00Z' },
      end: { dateTime: '2024-01-01T15:00:00Z' },
    },
  ];

  const mockSearchOptions = {
    timeMin: new Date('2024-01-01T00:00:00Z'),
    timeMax: new Date('2024-01-01T23:59:59Z'),
    maxResults: 10,
  };

  let originalDateNow: typeof Date.now;
  let mockDateNow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Date.now() to control time for TTL testing
    originalDateNow = Date.now;
    mockDateNow = vi.fn(() => 1000000); // Start at timestamp 1000000
    Date.now = mockDateNow;

    // Clear all caches before each test
    clearSessionCache('session-1');
    clearSessionCache('session-2');
  });

  afterEach(() => {
    // Restore original Date.now
    Date.now = originalDateNow;
  });

  describe('getCachedCalendarResults', () => {
    it('should return null when sessionId is undefined', () => {
      const result = getCachedCalendarResults(
        undefined,
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return null when sessionId is provided but cache is empty', () => {
      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return null when blockId is not in cache', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return cached events when cache is valid', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should return null when cache is expired', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time by 5 minutes + 1ms (past TTL of 5 minutes)
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return null when userId does not match', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-2',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return cached events when userId is null and matches', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        null,
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        null,
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should return null when userId is null but cache has userId', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        null,
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should return null when userId is provided but cache has null userId', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        null,
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should handle multiple sessions independently', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions,
        [{ ...mockEvents[0], id: 'event-3' }]
      );

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toEqual(mockEvents);
      expect(result2).toEqual([{ ...mockEvents[0], id: 'event-3' }]);
    });

    it('should handle multiple blocks in the same session', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions,
        [{ ...mockEvents[0], id: 'event-3' }]
      );

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toEqual(mockEvents);
      expect(result2).toEqual([{ ...mockEvents[0], id: 'event-3' }]);
    });

    it('should return cached events when cache is just within TTL', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time by exactly 5 minutes (within TTL)
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000);

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });
  });

  describe('setCachedCalendarResults', () => {
    it('should not cache when sessionId is undefined', () => {
      setCachedCalendarResults(
        undefined,
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        undefined,
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should cache events for a session and block', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should overwrite existing cache for the same session and block', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const newEvents = [{ ...mockEvents[0], id: 'event-3' }];
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        newEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(newEvents);
    });

    it('should store userId as null when undefined', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        undefined,
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        null,
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should store search options with events', () => {
      const customSearchOptions = {
        calendarId: 'cal-2',
        timeMin: new Date('2024-02-01T00:00:00Z'),
        timeMax: new Date('2024-02-01T23:59:59Z'),
        maxResults: 20,
        query: 'test query',
      };

      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        customSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        customSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should create new session cache if it does not exist', () => {
      setCachedCalendarResults(
        'session-new',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      const result = getCachedCalendarResults(
        'session-new',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });
  });

  describe('clearSessionCache', () => {
    it('should do nothing when sessionId is undefined', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearSessionCache(undefined);

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should clear all blocks for a session', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearSessionCache('session-1');

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should not affect other sessions', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearSessionCache('session-1');

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toEqual(mockEvents);
    });
  });

  describe('clearBlockCache', () => {
    it('should do nothing when sessionId is undefined', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearBlockCache(undefined, 'block-1');

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should clear cache for a specific block', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearBlockCache('session-1', 'block-1');

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toEqual(mockEvents);
    });

    it('should do nothing when block does not exist', () => {
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      clearBlockCache('session-1', 'block-nonexistent');

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should do nothing when session does not exist', () => {
      clearBlockCache('session-nonexistent', 'block-1');

      const result = getCachedCalendarResults(
        'session-nonexistent',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredCache', () => {
    it('should remove expired cache entries', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time past TTL
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      cleanupExpiredCache();

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should keep non-expired cache entries', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time but still within TTL
      mockDateNow.mockReturnValue(1000000 + 2 * 60 * 1000);

      cleanupExpiredCache();

      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toEqual(mockEvents);
    });

    it('should remove expired blocks but keep valid ones', () => {
      // Set first cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Set second cache at time 2000000
      mockDateNow.mockReturnValue(2000000);
      setCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time so block-1 is expired but block-2 is not
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      cleanupExpiredCache();

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toEqual(mockEvents);
    });

    it('should remove empty session caches after cleanup', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time past TTL
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      cleanupExpiredCache();

      // Try to get from session-1 - should return null because session was removed
      const result = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result).toBeNull();
    });

    it('should handle multiple sessions with mixed expired and valid entries', () => {
      // Set cache for session-1 at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Set cache for session-2 at time 2000000
      mockDateNow.mockReturnValue(2000000);
      setCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time so session-1 is expired but session-2 is not
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      cleanupExpiredCache();

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-2',
        'block-1',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toEqual(mockEvents);
    });

    it('should handle empty cache gracefully', () => {
      cleanupExpiredCache();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle cache with all expired entries', () => {
      // Set cache at time 1000000
      mockDateNow.mockReturnValue(1000000);
      setCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      setCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions,
        mockEvents
      );

      // Advance time past TTL
      mockDateNow.mockReturnValue(1000000 + 5 * 60 * 1000 + 1);

      cleanupExpiredCache();

      const result1 = getCachedCalendarResults(
        'session-1',
        'block-1',
        'user-1',
        mockSearchOptions
      );
      const result2 = getCachedCalendarResults(
        'session-1',
        'block-2',
        'user-1',
        mockSearchOptions
      );

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });
});
