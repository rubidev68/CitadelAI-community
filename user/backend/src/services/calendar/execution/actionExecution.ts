import { Block, BlockType } from '@prisma/client';
import { CalendarProvider, CalendarEvent, Calendar, CreateEventOptions } from '../../calendarProviders/types';
import { CalendarBlockProperties, CalendarBlockResult, ExtractedEventDetails, CachedEventInfo } from '../types';
import { logger } from '@shared/utils';
import { parseNaturalLanguageDateTime, calculateEndTime, extractEventDetails, determineAction, extractEventId } from '../utils/eventUtils';

export async function executeCalendarActionBlock(
  block: Block,
  calendarProvider: CalendarProvider,
  accessToken: string,
  userMessage: string,
  sessionData: Record<string, unknown>,
  sessionId?: string,
  userId?: string | null,
  extractedEventDetails?: ExtractedEventDetails,
  actionType?: 'create' | 'update' | 'delete',
  cachedEventInfo?: CachedEventInfo
): Promise<CalendarBlockResult> {
  logger.debug('Executing calendar action block', {
    blockId: block.id,
    userMessage: userMessage.substring(0, 100),
    hasExtractedDetails: !!extractedEventDetails,
    actionType,
    service: 'calendarBlockExecutionService',
  });
  
  const properties = block.properties as unknown as CalendarBlockProperties;
  const config = properties.actionConfig || {};
  
  // Use AI-extracted details if available, otherwise extract from user message
  interface EventDetails {
    summary?: string;
    start?: string | { dateTime?: string; date?: string; timeZone?: string };
    end?: string | { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    description?: string;
    attendees?: string[] | Array<{ email: string; name?: string }>;
    eventId?: string;
    recurrence?: string[];
  }
  let eventDetails: EventDetails = {};
  let action: 'create' | 'update' | 'delete';
  
  if (extractedEventDetails && actionType) {
    // Use AI-extracted details
    logger.debug('Using AI-extracted event details', {
      summary: extractedEventDetails.summary,
      start: extractedEventDetails.start,
      end: extractedEventDetails.end,
      location: extractedEventDetails.location,
      hasEventId: !!extractedEventDetails.eventId,
      service: 'calendarBlockExecutionService',
    });
    
    // Normalize the extracted details format
    eventDetails = {
      summary: extractedEventDetails.summary,
      location: extractedEventDetails.location,
      attendees: extractedEventDetails.attendees,
    };
    
    // Handle start/end time - support both {old/new} and {original/updated} formats
    interface StartEndTimeObject {
      old?: string;
      new?: string;
      original?: string;
      updated?: string;
    }
    if (extractedEventDetails.start) {
      if (typeof extractedEventDetails.start === 'object') {
        // For updates, use the 'new' or 'updated' value
        const startObj = extractedEventDetails.start as StartEndTimeObject;
        eventDetails.start = startObj.new || startObj.updated;
      } else {
        eventDetails.start = extractedEventDetails.start;
      }
    }
    
    if (extractedEventDetails.end) {
      if (typeof extractedEventDetails.end === 'object') {
        // For updates, use the 'new' or 'updated' value
        const endObj = extractedEventDetails.end as StartEndTimeObject;
        eventDetails.end = endObj.new || endObj.updated;
      } else {
        eventDetails.end = extractedEventDetails.end;
      }
    }
    
    // Store eventId for update/delete operations
    if (extractedEventDetails.eventId) {
      eventDetails.eventId = extractedEventDetails.eventId;
    }
    
    action = actionType;
  } else {
    // Fallback: extract from user message (legacy behavior)
    logger.debug('No AI-extracted details, extracting from message', {
      service: 'calendarBlockExecutionService',
    });
    eventDetails = extractEventDetails(userMessage, config.template);
    action = determineAction(userMessage, config.allowedActions || ['create']);
  }
  
  logger.debug('Processing action', {
    action,
    summary: eventDetails.summary,
    hasStart: !!eventDetails.start,
    hasEnd: !!eventDetails.end,
    startType: typeof eventDetails.start,
    endType: typeof eventDetails.end,
    service: 'calendarBlockExecutionService',
  });
  
  if (action === 'create') {
    logger.debug('Creating calendar event', {
      service: 'calendarBlockExecutionService',
    });
    
    // Validate required fields
    if (!eventDetails.summary) {
      throw new Error('Event title is required');
    }
    
    // Parse and validate start/end times
    let parsedStart: { dateTime?: string; date?: string; timeZone?: string } | undefined;
    let parsedEnd: { dateTime?: string; date?: string; timeZone?: string } | undefined;
    
    // Parse start time if it's a string (natural language or ISO)
    if (eventDetails.start) {
      if (typeof eventDetails.start === 'string') {
        // Use current date as reference for relative dates
        const parsed = parseNaturalLanguageDateTime(eventDetails.start, new Date());
        if (!parsed) {
          throw new Error(`Could not parse start time: "${eventDetails.start}". Please provide a valid date and time (e.g., "next Monday at 9am" or "2025-01-20T14:30:00Z").`);
        }
        parsedStart = parsed;
      } else if (typeof eventDetails.start === 'object' && (eventDetails.start.dateTime || eventDetails.start.date)) {
        // Already parsed format
        parsedStart = eventDetails.start;
      } else {
        throw new Error(`Invalid start time format: ${JSON.stringify(eventDetails.start)}`);
      }
    }
    
    // Parse end time if it's a string (natural language or ISO)
    if (eventDetails.end) {
      if (typeof eventDetails.end === 'string') {
        // Use current date as reference for relative dates
        const parsed = parseNaturalLanguageDateTime(eventDetails.end, new Date());
        if (!parsed) {
          throw new Error(`Could not parse end time: "${eventDetails.end}". Please provide a valid date and time.`);
        }
        parsedEnd = parsed;
      } else if (typeof eventDetails.end === 'object' && (eventDetails.end.dateTime || eventDetails.end.date)) {
        // Already parsed format
        parsedEnd = eventDetails.end;
      } else {
        throw new Error(`Invalid end time format: ${JSON.stringify(eventDetails.end)}`);
      }
    }
    
    // If only start time is provided, default to 1 hour duration
    if (parsedStart && !parsedEnd) {
      parsedEnd = calculateEndTime(parsedStart, 60); // 60 minutes default duration
      logger.debug('No end time provided, defaulting to 1 hour duration', {
        service: 'calendarBlockExecutionService',
      });
    }
    
    // Validate that we have both start and end times
    if (!parsedStart || !parsedEnd) {
      throw new Error('Event start and end times are required. Please provide both start and end times, or at least a start time.');
    }
    
    // Determine calendar ID - extract from message or use default
    let calendarId = config.defaultCalendar;
    
    // Try to extract calendar name from user message (e.g., "personal calendar", "work calendar")
    if (!calendarId) {
      const calendarMatch = userMessage.match(/(?:on|in|to)\s+(?:my\s+)?([a-z]+)\s+calendar/i);
      if (calendarMatch) {
        const calendarName = calendarMatch[1].toLowerCase();
        logger.debug('Extracted calendar name from message', {
          calendarName,
          service: 'calendarBlockExecutionService',
        });
        
        // List calendars to find matching one (only VEVENT-supporting calendars are returned)
        try {
          const calendars = await calendarProvider.listCalendars(accessToken);
          
          if (calendars.length === 0) {
            throw new Error('No calendars found that support events. Please ensure you have at least one calendar configured that supports events (VEVENT), not just todo lists (VTODO).');
          }
          
          const matchingCalendar = calendars.find((cal: Calendar) => 
            cal.name.toLowerCase().includes(calendarName) || 
            calendarName.includes(cal.name.toLowerCase())
          );
          
          if (matchingCalendar) {
            calendarId = matchingCalendar.id;
            logger.debug('Found matching calendar', {
              name: matchingCalendar.name,
              id: calendarId,
              service: 'calendarBlockExecutionService',
            });
          } else {
            // Use first available calendar as fallback
            calendarId = calendars[0].id;
            logger.debug('No exact match found, using first available event-supporting calendar', {
              name: calendars[0].name,
              id: calendarId,
              searchedName: calendarName,
              service: 'calendarBlockExecutionService',
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to list calendars';
          logger.error('Failed to list calendars', error instanceof Error ? error : undefined, {
            service: 'calendarBlockExecutionService',
          });
          throw new Error(`Failed to find a calendar that supports events: ${errorMessage}`);
        }
      } else {
        // No calendar specified, try to get default calendar
        try {
          const calendars = await calendarProvider.listCalendars(accessToken);
          
          if (calendars.length === 0) {
            throw new Error('No calendars found that support events. Please ensure you have at least one calendar configured that supports events (VEVENT), not just todo lists (VTODO).');
          }
          
          // Use primary calendar or first calendar
          const primaryCalendar = calendars.find((cal: Calendar) => cal.primary) || calendars[0];
          calendarId = primaryCalendar.id;
          logger.debug('Using default calendar', {
            name: primaryCalendar.name,
            id: calendarId,
            service: 'calendarBlockExecutionService',
          });
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to list calendars';
          logger.error('Failed to list calendars for default selection', error instanceof Error ? error : undefined, {
            service: 'calendarBlockExecutionService',
          });
          throw new Error(`Failed to find a calendar that supports events: ${errorMessage}`);
        }
      }
    }
    
    // Build create options
    const createOptions: CreateEventOptions = {
      calendarId: calendarId,
      summary: eventDetails.summary,
      description: eventDetails.description || config.template?.description,
      location: eventDetails.location || config.template?.location,
      start: parsedStart,
      end: parsedEnd,
      attendees: Array.isArray(eventDetails.attendees) && eventDetails.attendees.length > 0 && typeof eventDetails.attendees[0] === 'string'
        ? (eventDetails.attendees as string[]).map(email => ({ email }))
        : (eventDetails.attendees as Array<{ email: string; name?: string }> | undefined),
      reminders: config.defaultReminders ? {
        useDefault: false,
        overrides: config.defaultReminders,
      } : undefined,
      recurrence: eventDetails.recurrence,
    };
    
    // Validate calendarId before creating
    if (!createOptions.calendarId) {
      throw new Error('No calendar specified. Please specify a calendar (e.g., "personal calendar") or configure a default calendar in the block settings.');
    }
    
    // Create event
    logger.debug('Calling calendar provider to create event', {
      calendarId: createOptions.calendarId,
      summary: createOptions.summary,
      start: createOptions.start,
      end: createOptions.end,
      service: 'calendarBlockExecutionService',
    });
    
    const event = await calendarProvider.createEvent(accessToken, createOptions);
    
    logger.info('Event created successfully', {
      eventId: event.id,
      summary: event.summary,
      service: 'calendarBlockExecutionService',
    });
    
    return {
      eventCreated: true,
      eventId: event.id,
    };
  } else if (action === 'update') {
    logger.debug('Updating calendar event', {
      service: 'calendarBlockExecutionService',
    });
    // Extract event identifier from extracted details, message, or session
    const eventIdentifier: string | undefined = (eventDetails.eventId || extractEventId(userMessage) || (typeof sessionData.lastEventId === 'string' ? sessionData.lastEventId : undefined)) as string | undefined;
    if (!eventIdentifier) {
      throw new Error('Event identifier is required for update. Please specify which event to update (e.g., "f.norbert event").');
    }
    
    logger.debug('Updating event', {
      eventIdentifier,
      summary: eventDetails.summary,
      start: eventDetails.start,
      end: eventDetails.end,
      service: 'calendarBlockExecutionService',
    });
    
    // Find the actual calendar event ID by searching for events matching the identifier
    let calendarId = config.defaultCalendar || 'primary';
    let actualEventId: string | undefined;
    
    // Use cached event info if available (from intent detection)
    if (cachedEventInfo) {
      actualEventId = cachedEventInfo.eventId;
      calendarId = cachedEventInfo.calendarId;
      logger.debug('Using cached event info', {
        eventId: actualEventId,
        calendarId: calendarId,
        summary: cachedEventInfo.summary,
        service: 'calendarBlockExecutionService',
      });
    } else if (eventIdentifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventIdentifier)) {
      // If eventIdentifier looks like a calendar event ID (UUID format), use it directly
      actualEventId = eventIdentifier;
      logger.debug('Using provided event ID directly', {
        eventId: actualEventId,
        service: 'calendarBlockExecutionService',
      });
    } else {
      // Search for event by name/summary
      logger.debug('Searching for event by identifier', {
        eventIdentifier,
        service: 'calendarBlockExecutionService',
      });
      
      // Normalize the identifier - remove "event" suffix, trim, lowercase
      const normalizedIdentifier = eventIdentifier
        .toLowerCase()
        .replace(/\s+event\s*$/i, '') // Remove trailing "event" word
        .trim();
      
      // Extract key parts (e.g., "f.norbert" from "f.norbert event")
      const identifierParts = normalizedIdentifier.split(/\s+/).filter((part: string) => part.length > 0);
      
      // First, try to use cached events from context block if available
      let events: CalendarEvent[] = [];
      if (sessionId && properties.shareCredentialsWithBlockId) {
        const { getCachedCalendarResults } = await import('../../calendarCacheService');
        const cachedEvents = getCachedCalendarResults(
          sessionId,
          properties.shareCredentialsWithBlockId,
          userId,
          {
            calendarId,
            timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            maxResults: 100,
            query: '',
          }
        );
        
        if (cachedEvents && cachedEvents.length > 0) {
          events = cachedEvents;
        }
      }
      
      // If no cached events, search via API
      // Try multiple search strategies: with query, without query, and with broader time range
      if (events.length === 0) {
        // Strategy 1: Search with specific query
        let searchOptions = {
          calendarId,
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Next year
          maxResults: 100,
          query: identifierParts.length > 0 ? identifierParts[0] : normalizedIdentifier,
          orderBy: 'startTime' as const,
          singleEvents: true,
        };
        
        events = await calendarProvider.searchEvents(accessToken, searchOptions);
        
        // Strategy 2: If no results, try without query to get all events in range
        if (events.length === 0) {
          searchOptions = {
            ...searchOptions,
            query: '', // Empty query to get all events
          };
          events = await calendarProvider.searchEvents(accessToken, searchOptions);
        }
        
        // Strategy 3: If still no results, try broader time range
        if (events.length === 0) {
          searchOptions = {
            ...searchOptions,
            timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
            timeMax: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // Next 2 years
            query: '', // Still no query
          };
          events = await calendarProvider.searchEvents(accessToken, searchOptions);
        }
      }
      
      // Try multiple matching strategies
      let matchingEvent: CalendarEvent | undefined;
      
      // Strategy 1: Exact match (case-insensitive)
      matchingEvent = events.find((e: CalendarEvent) => 
        e.summary?.toLowerCase() === normalizedIdentifier ||
        e.summary?.toLowerCase() === eventIdentifier.toLowerCase()
      );
      
      // Strategy 2: Contains match (case-insensitive) - bidirectional
      if (!matchingEvent) {
        matchingEvent = events.find((e: CalendarEvent) => {
          const eventSummary = e.summary?.toLowerCase() || '';
          return eventSummary.includes(normalizedIdentifier) || 
                 normalizedIdentifier.includes(eventSummary) ||
                 eventSummary.replace(/[^a-z0-9]/g, '') === normalizedIdentifier.replace(/[^a-z0-9]/g, ''); // Alphanumeric match
        });
      }
      
      // Strategy 3: Match by key parts (e.g., "f.norbert" matches "F.Norbert")
      if (!matchingEvent && identifierParts.length > 0) {
        const mainPart = identifierParts[0]; // e.g., "f.norbert"
        matchingEvent = events.find((e: CalendarEvent) => {
          const eventSummary = e.summary?.toLowerCase() || '';
          const eventMainPart = eventSummary.split(/\s+/)[0];
          // Check if main parts match (handles "f.norbert" vs "f.norbert" or "F.Norbert")
          return eventSummary.includes(mainPart) || 
                 mainPart.includes(eventMainPart) ||
                 eventMainPart.replace(/[^a-z0-9]/g, '') === mainPart.replace(/[^a-z0-9]/g, '');
        });
      }
      
      // Strategy 4: Fuzzy match - check if any part of the identifier matches any part of the summary
      if (!matchingEvent && identifierParts.length > 0) {
        matchingEvent = events.find((e: CalendarEvent) => {
          const eventSummary = e.summary?.toLowerCase() || '';
          const eventParts = eventSummary.split(/\s+/);
          return identifierParts.some((part: string) => 
            eventParts.some((eventPart: string) => {
              const cleanPart = part.replace(/[^a-z0-9]/g, '');
              const cleanEventPart = eventPart.replace(/[^a-z0-9]/g, '');
              return cleanPart.length > 2 && cleanEventPart.length > 2 && 
                     (cleanPart.includes(cleanEventPart) || cleanEventPart.includes(cleanPart));
            })
          );
        });
      }
      
      if (matchingEvent) {
        actualEventId = matchingEvent.id;
        // Use the calendarId from the matching event, not the configured one
        // This ensures we're updating the event in the correct calendar
        calendarId = matchingEvent.calendarId || calendarId;
        logger.debug('Found matching event for delete', {
          eventId: actualEventId,
          summary: matchingEvent.summary,
          matchedIdentifier: eventIdentifier,
          normalizedIdentifier,
          strategy: 'matched',
          calendarId: calendarId,
          service: 'calendarBlockExecutionService',
        });
      } else {
        // Log available events for debugging
        const availableSummaries = events.slice(0, 10).map((e: CalendarEvent) => e.summary).filter(Boolean);
        logger.debug('No matching event found for delete', {
          availableEvents: availableSummaries,
          service: 'calendarBlockExecutionService',
        });
        throw new Error(`Event not found: "${eventIdentifier}". Searched in ${events.length} events. Available: ${availableSummaries.slice(0, 5).join(', ')}`);
      }
    }
    
    if (!actualEventId) {
      throw new Error(`Could not find event: "${eventIdentifier}"`);
    }
    
    // Parse and prepare update fields
    const updates: Partial<CreateEventOptions> = {};
    
    if (eventDetails.summary !== undefined) {
      updates.summary = eventDetails.summary;
    }
    if (eventDetails.description !== undefined) {
      updates.description = eventDetails.description;
    }
    if (eventDetails.location !== undefined) {
      updates.location = eventDetails.location;
    }
    if (eventDetails.attendees !== undefined) {
      updates.attendees = Array.isArray(eventDetails.attendees) && eventDetails.attendees.length > 0 && typeof eventDetails.attendees[0] === 'string'
        ? (eventDetails.attendees as string[]).map(email => ({ email }))
        : (eventDetails.attendees as Array<{ email: string; name?: string }>);
    }
    
    // Parse start time if provided
    if (eventDetails.start !== undefined) {
      if (typeof eventDetails.start === 'string') {
        // Use current date as reference for relative dates
        const parsed = parseNaturalLanguageDateTime(eventDetails.start, new Date());
        if (!parsed) {
          throw new Error(`Could not parse start time: "${eventDetails.start}". Please provide a valid date and time.`);
        }
        updates.start = parsed;
      } else if (typeof eventDetails.start === 'object' && (eventDetails.start.dateTime || eventDetails.start.date)) {
        updates.start = eventDetails.start;
      } else {
        throw new Error(`Invalid start time format: ${JSON.stringify(eventDetails.start)}`);
      }
    }
    
    // Parse end time if provided
    if (eventDetails.end !== undefined) {
      if (typeof eventDetails.end === 'string') {
        // Use current date as reference for relative dates
        const parsed = parseNaturalLanguageDateTime(eventDetails.end, new Date());
        if (!parsed) {
          throw new Error(`Could not parse end time: "${eventDetails.end}". Please provide a valid date and time.`);
        }
        updates.end = parsed;
      } else if (typeof eventDetails.end === 'object' && (eventDetails.end.dateTime || eventDetails.end.date)) {
        updates.end = eventDetails.end;
      } else {
        throw new Error(`Invalid end time format: ${JSON.stringify(eventDetails.end)}`);
      }
    }
    
    // Update event using the actual calendar event ID and the correct calendarId
    const event = await calendarProvider.updateEvent(
      accessToken,
      calendarId,
      actualEventId,
      updates
    );
    
    logger.info('Event updated successfully', {
      eventId: event.id,
      service: 'calendarBlockExecutionService',
    });
    
    return {
      eventUpdated: true,
      eventId: event.id,
    };
  } else if (action === 'delete') {
    logger.debug('Deleting calendar event', {
      service: 'calendarBlockExecutionService',
    });
    // Extract event identifier from extracted details, message, or session
    const eventIdentifier: string | undefined = (eventDetails.eventId || extractEventId(userMessage) || (typeof sessionData.lastEventId === 'string' ? sessionData.lastEventId : undefined)) as string | undefined;
    if (!eventIdentifier) {
      throw new Error('Event identifier is required for delete');
    }
    
    // Find the actual calendar event ID by searching for events matching the identifier
    let calendarId = config.defaultCalendar || 'primary';
    let actualEventId: string | undefined;
    
    // Use cached event info if available (from intent detection)
    if (cachedEventInfo) {
      actualEventId = cachedEventInfo.eventId;
      calendarId = cachedEventInfo.calendarId;
      logger.debug('Using cached event info for delete', {
        eventId: actualEventId,
        calendarId: calendarId,
        summary: cachedEventInfo.summary,
        service: 'calendarBlockExecutionService',
      });
    } else if (eventIdentifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventIdentifier)) {
      // If eventIdentifier looks like a calendar event ID (UUID format), use it directly
      actualEventId = eventIdentifier;
      logger.debug('Using provided event ID directly for update', {
        eventId: actualEventId,
        service: 'calendarBlockExecutionService',
      });
    } else {
      // Search for event by name/summary (fallback if cachedEventInfo not available)
      logger.debug('Searching for event by identifier for update', {
        eventIdentifier,
        service: 'calendarBlockExecutionService',
      });
      
      // Normalize the identifier - remove "event" suffix, trim, lowercase
      const normalizedIdentifier = eventIdentifier
        .toLowerCase()
        .replace(/\s+event\s*$/i, '') // Remove trailing "event" word
        .trim();
      
      // Extract key parts (e.g., "f.norbert" from "f.norbert event")
      const identifierParts = normalizedIdentifier.split(/\s+/).filter((part: string) => part.length > 0);
      
      // First, try to use cached events from context block if available
      let events: CalendarEvent[] = [];
      if (sessionId && properties.shareCredentialsWithBlockId) {
        const { getCachedCalendarResults } = await import('../../calendarCacheService');
        const cachedEvents = getCachedCalendarResults(
          sessionId,
          properties.shareCredentialsWithBlockId,
          userId,
          {
            calendarId,
            timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            maxResults: 100,
            query: '',
          }
        );
        
        if (cachedEvents && cachedEvents.length > 0) {
          events = cachedEvents;
        }
      }
      
      // If no cached events, search via API
      // Try multiple search strategies: with query, without query, and with broader time range
      if (events.length === 0) {
        // Strategy 1: Search with specific query
        let searchOptions = {
          calendarId,
          timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Next year
          maxResults: 100,
          query: identifierParts.length > 0 ? identifierParts[0] : normalizedIdentifier,
          orderBy: 'startTime' as const,
          singleEvents: true,
        };
        
        events = await calendarProvider.searchEvents(accessToken, searchOptions);
        
        // Strategy 2: If no results, try without query to get all events in range
        if (events.length === 0) {
          searchOptions = {
            ...searchOptions,
            query: '', // Empty query to get all events
          };
          events = await calendarProvider.searchEvents(accessToken, searchOptions);
        }
        
        // Strategy 3: If still no results, try broader time range
        if (events.length === 0) {
          searchOptions = {
            ...searchOptions,
            timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
            timeMax: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // Next 2 years
            query: '', // Still no query
          };
          events = await calendarProvider.searchEvents(accessToken, searchOptions);
        }
      }
      
      // Try multiple matching strategies (same as update)
      let matchingEvent: CalendarEvent | undefined;
      
      // Strategy 1: Exact match
      matchingEvent = events.find((e: CalendarEvent) => 
        e.summary?.toLowerCase() === normalizedIdentifier ||
        e.summary?.toLowerCase() === eventIdentifier.toLowerCase()
      );
      
      // Strategy 2: Contains match
      if (!matchingEvent) {
        matchingEvent = events.find((e: CalendarEvent) => 
          e.summary?.toLowerCase().includes(normalizedIdentifier) ||
          normalizedIdentifier.includes(e.summary?.toLowerCase() || '')
        );
      }
      
      // Strategy 3: Partial word match
      if (!matchingEvent && identifierParts.length > 0) {
        matchingEvent = events.find((e: CalendarEvent) => {
          const eventSummary = e.summary?.toLowerCase() || '';
          const eventParts = eventSummary.split(/\s+/);
          return identifierParts.some((part: string) => 
            eventParts.some((eventPart: string) => {
              const cleanPart = part.replace(/[^a-z0-9]/g, '');
              const cleanEventPart = eventPart.replace(/[^a-z0-9]/g, '');
              return cleanPart.length > 2 && cleanEventPart.length > 2 && 
                     (cleanPart.includes(cleanEventPart) || cleanEventPart.includes(cleanPart));
            })
          );
        });
      }
      
      if (matchingEvent) {
        actualEventId = matchingEvent.id;
        // Use the calendarId from the matching event, not the configured one
        // This ensures we're deleting the event from the correct calendar
        calendarId = matchingEvent.calendarId || calendarId;
        logger.debug('Found matching event for update', {
          eventId: actualEventId,
          summary: matchingEvent.summary,
          matchedIdentifier: eventIdentifier,
          normalizedIdentifier,
          strategy: 'matched',
          calendarId: calendarId,
          service: 'calendarBlockExecutionService',
        });
      } else {
        // Log available events for debugging
        const availableSummaries = events.slice(0, 10).map((e: CalendarEvent) => e.summary).filter(Boolean);
        logger.debug('No matching event found for update', {
          availableEvents: availableSummaries,
          service: 'calendarBlockExecutionService',
        });
        throw new Error(`Event not found: "${eventIdentifier}". Searched in ${events.length} events. Available: ${availableSummaries.slice(0, 5).join(', ')}`);
      }
    }
    
    if (!actualEventId) {
      throw new Error(`Could not find event: "${eventIdentifier}"`);
    }
    
    logger.debug('Calling calendar provider to delete event', {
      calendarId,
      eventId: actualEventId,
      eventIdentifier,
      service: 'calendarBlockExecutionService',
    });
    
    await calendarProvider.deleteEvent(accessToken, calendarId, actualEventId!);
    
    logger.info('Event deleted successfully', {
      eventId: actualEventId,
      service: 'calendarBlockExecutionService',
    });
    
    return {
      eventDeleted: true,
      eventId: actualEventId,
    };
  }
  
    logger.error('Unknown action', undefined, {
      action,
      service: 'calendarBlockExecutionService',
    });
  throw new Error(`Unknown action: ${action}`);
}

/**
 * Parse RRULE and return human-readable recurrence description
 */

