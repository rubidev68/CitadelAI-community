import { Block } from '@prisma/client';
import { CalendarProvider, EventSearchOptions, CalendarEvent } from '../../calendarProviders/types';
import { CalendarBlockProperties, CalendarBlockResult } from '../types';
import { getCachedCalendarResults, setCachedCalendarResults } from '../../calendarCacheService';
import { logger } from '@shared/utils';
import { extractDateRange, extractSearchQuery, addDays, addMonths, requiresExtendedPastRange } from '../utils/dateUtils';

export async function executeCalendarContextBlock(
  block: Block,
  calendarProvider: CalendarProvider,
  accessToken: string,
  userMessage: string,
  sessionData: Record<string, unknown>,
  sessionId?: string,
  userId?: string | null | undefined
): Promise<CalendarBlockResult> {
  const properties = block.properties as unknown as CalendarBlockProperties;
  const config = properties.contextConfig || {};
  
  // Default date range: 1 month before to 30 days in the future
  const defaultStart = config.dateRange?.start ? new Date(config.dateRange.start) : addMonths(new Date(), -1);
  const defaultEnd = config.dateRange?.end ? new Date(config.dateRange.end) : addDays(new Date(), 30);
  
  // Extract date range from user message or use configured/default range
  const extractedRange = extractDateRange(userMessage);
  const dateRange = extractedRange || {
    start: defaultStart,
    end: defaultEnd,
  };
  
  // Check if user is requesting events further back than default
  const needsExtendedRange = requiresExtendedPastRange(dateRange.start, defaultStart);
  const shouldUseCache = !needsExtendedRange; // Don't cache when fetching extended past ranges
  
  // Build search options
  const orderByValue: 'startTime' | 'updated' = (config.orderBy === 'startTime' || config.orderBy === 'updated') ? config.orderBy : 'startTime';
  const searchOptions: EventSearchOptions = {
    calendarId: config.calendarId,
    timeMin: dateRange.start,
    timeMax: dateRange.end,
    maxResults: config.maxEvents || 50,
    query: extractSearchQuery(userMessage) || config.filterBy?.summary,
    orderBy: orderByValue,
    singleEvents: true,
  };
  
  let events: CalendarEvent[];
  
  // Check cache first (only if not fetching extended range)
  if (shouldUseCache) {
    const cachedEvents = getCachedCalendarResults(
      sessionId,
      block.id,
      userId,
      {
        calendarId: searchOptions.calendarId,
        timeMin: searchOptions.timeMin!,
        timeMax: searchOptions.timeMax!,
        maxResults: searchOptions.maxResults!,
        query: searchOptions.query,
      }
    );
    
    if (cachedEvents) {
      logger.debug('Using cached calendar results', {
        blockId: block.id,
        sessionId,
        eventCount: cachedEvents.length,
        service: 'calendarBlockExecutionService',
      });
      events = cachedEvents;
    } else {
      logger.debug('Fetching calendar events from API', {
        blockId: block.id,
        sessionId,
        service: 'calendarBlockExecutionService',
      });
      // Search events from API
      events = await calendarProvider.searchEvents(accessToken, searchOptions);
      
      // Cache the results for this session
      if (sessionId) {
        setCachedCalendarResults(
          sessionId,
          block.id,
          userId,
          {
            calendarId: searchOptions.calendarId,
            timeMin: searchOptions.timeMin!,
            timeMax: searchOptions.timeMax!,
            maxResults: searchOptions.maxResults!,
            query: searchOptions.query,
          },
          events
        );
      }
    }
  } else {
    // Extended range requested - fetch directly without cache
    logger.debug('Fetching extended past calendar events (bypassing cache)', {
      blockId: block.id,
      sessionId,
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
      service: 'calendarBlockExecutionService',
    });
    events = await calendarProvider.searchEvents(accessToken, searchOptions);
    // Don't cache extended range queries
  }
  
  // Apply additional filters
  let filteredEvents = events;
  if (config.filterBy) {
    if (config.filterBy.location) {
      filteredEvents = filteredEvents.filter((e: CalendarEvent) => 
        e.location?.toLowerCase().includes(config.filterBy!.location!.toLowerCase())
      );
    }
    if (config.filterBy.attendees && config.filterBy.attendees.length > 0) {
      filteredEvents = filteredEvents.filter((e: CalendarEvent) =>
        e.attendees?.some((att: { email: string }) => config.filterBy!.attendees!.includes(att.email))
      );
    }
  }
  
  return {
    events: filteredEvents,
    eventCount: filteredEvents.length,
  };
}

/**
 * Execute ACTION block - Create/Update/Delete events
 */
