import { AxiosInstance } from 'axios';
import { CalendarEvent, Calendar, EventSearchOptions, CreateEventOptions } from '../../types';
import { CalDAVConfig } from '../types';
import { logger } from '@shared/utils';
import { getCalendarPath } from '../utils/clientUtils';
import { addDays } from '../utils/dateUtils';
import { timeStringToDateTime } from '../utils/dateUtils';
import { formatICalDateTime } from '../utils/icalFormatter';
import { generateUID } from '../utils/icalFormatter';
import { buildICalEvent } from '../utils/icalBuilder';
import { parseCalDAVResponse } from '../parsing/caldavResponseParser';
import { listCalendars } from './calendarOperations';

/**
 * Search for events in calendars
 */
export async function searchEvents(
  client: AxiosInstance,
  config: CalDAVConfig,
  calendars: Calendar[],
  options: EventSearchOptions
): Promise<CalendarEvent[]> {
  if (calendars.length === 0) {
    return [];
  }
  
  const allEvents: CalendarEvent[] = [];
  const timeMin = options.timeMin || new Date();
  const timeMax = options.timeMax || addDays(new Date(), 30);
  
  for (const calendar of calendars) {
    // Skip if a specific calendarId was requested and this isn't it
    if (options.calendarId && calendar.id !== options.calendarId && calendar.id !== 'primary') {
      continue;
    }
    
    try {
      // Convert absolute calendar path to relative path for the REPORT request
      let calendarPath = calendar.id;
      
      if (config && calendarPath.startsWith('/')) {
        // Extract the base path from serverUrl
        try {
          const baseUrlObj = new URL(config.serverUrl);
          let basePath = baseUrlObj.pathname;
          
          // Normalize paths (remove trailing slashes for comparison)
          basePath = basePath.replace(/\/$/, '');
          calendarPath = calendarPath.replace(/\/$/, '');
          
          // Remove base path from calendar path
          if (calendarPath.startsWith(basePath)) {
            calendarPath = calendarPath.substring(basePath.length);
            calendarPath = calendarPath.replace(/^\//, '');
          } else {
            // Try to find common prefix by comparing path segments
            const baseParts = basePath.split('/').filter(p => p);
            const calParts = calendarPath.split('/').filter(p => p);
            
            let matchCount = 0;
            for (let i = 0; i < Math.min(baseParts.length, calParts.length); i++) {
              if (baseParts[i] === calParts[i]) {
                matchCount++;
              } else {
                break;
              }
            }
            
            if (matchCount > 0) {
              calendarPath = calParts.slice(matchCount).join('/');
            }
          }
        } catch (urlError) {
          // If URL parsing fails, try simple string replacement
          const serverPath = config.serverUrl.replace(/^https?:\/\/[^\/]+/, '').replace(/\/$/, '');
          if (calendarPath.startsWith(serverPath)) {
            calendarPath = calendarPath.substring(serverPath.length).replace(/^\//, '');
          }
        }
      }
      
      // Ensure path doesn't start with / (relative to baseURL)
      calendarPath = calendarPath.replace(/^\//, '') || '.';
      
      // Remove trailing slash for REPORT request
      calendarPath = calendarPath.replace(/\/$/, '') || '.';
      
      const response = await client.request({
        method: 'REPORT',
        url: calendarPath,
        headers: {
          'Depth': '1',
          'Content-Type': 'application/xml',
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${formatICalDateTime(timeMin)}" end="${formatICalDateTime(timeMax)}" />
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`,
      });
      
      // Parse iCalendar data from CalDAV multistatus XML response
      const events = parseCalDAVResponse(response.data, calendar.id);
      
      allEvents.push(...events);
    } catch (error: unknown) {
      // Continue with other calendars
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Error listing events for calendar, continuing', {
        error: errorMessage,
        service: 'caldavProvider',
      });
    }
  }
  
  // Sort all events by start time
  allEvents.sort((a, b) => {
    const aStart = a.start.dateTime || a.start.date || '';
    const bStart = b.start.dateTime || b.start.date || '';
    return aStart.localeCompare(bStart);
  });
  
  // Apply maxResults limit if specified
  if (options.maxResults && allEvents.length > options.maxResults) {
    return allEvents.slice(0, options.maxResults);
  }
  
  return allEvents;
}

/**
 * Get a specific event by ID
 */
export async function getEvent(
  client: AxiosInstance,
  config: CalDAVConfig,
  calendars: Calendar[],
  calendarId: string,
  eventId: string,
  searchEventsFn: (options: EventSearchOptions) => Promise<CalendarEvent[]>
): Promise<CalendarEvent> {
  // First, try searching in the specified calendar
  let events = await searchEventsFn({
    calendarId,
    timeMin: new Date(0),
    timeMax: new Date('2100-01-01'),
    maxResults: 1000,
  });
  
  // Find event by UID (eventId)
  let event = events.find(e => e.id === eventId);
  
  // If not found and calendarId was specified, try searching all calendars
  if (!event && calendarId && calendarId !== 'primary') {
    logger.debug('Event not found in specified calendar, searching all calendars', {
      calendarId,
      eventId,
      service: 'caldavProvider',
    });
    events = await searchEventsFn({
      timeMin: new Date(0),
      timeMax: new Date('2100-01-01'),
      maxResults: 1000,
    });
    event = events.find(e => e.id === eventId);
  }
  
  if (!event) {
    logger.error('Event not found after searching', undefined, {
      calendarId,
      eventId,
      searchedEventsCount: events.length,
      availableEventIds: events.slice(0, 5).map(e => e.id),
      service: 'caldavProvider',
    });
    throw new Error('Event not found');
  }
  
  return event;
}

/**
 * Create a new event
 */
export async function createEvent(
  client: AxiosInstance,
  config: CalDAVConfig,
  calendars: Calendar[],
  options: CreateEventOptions,
  preserveUID?: string
): Promise<CalendarEvent> {
  // If no calendarId provided, try to get default calendar
  let finalCalendarId = options.calendarId;
  if (!finalCalendarId) {
    if (calendars.length > 0) {
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];
      finalCalendarId = primaryCalendar.id;
      logger.debug('No calendarId provided, using default calendar', {
        name: primaryCalendar.name,
        id: finalCalendarId,
        service: 'caldavProvider',
      });
    }
  }
  
  // Validate that we have a calendarId
  if (!finalCalendarId) {
    throw new Error('No calendar specified. Please provide a calendarId or configure a default calendar.');
  }
  
  // Verify the calendar supports VEVENT (events)
  const targetCalendar = calendars.find((cal: Calendar) => cal.id === finalCalendarId);
  if (!targetCalendar) {
    logger.warn('Calendar not found in filtered list (may not support VEVENT)', {
      calendarId: finalCalendarId,
      service: 'caldavProvider',
    });
    throw new Error('This calendar does not support events (VEVENT). It appears to be configured as a todo list (VTODO) calendar. Please select a different calendar that supports events.');
  }
  
  const calendarPath = getCalendarPath(config, finalCalendarId);
  
  // Ensure calendarPath is not empty
  if (!calendarPath || calendarPath === '') {
    throw new Error(`Invalid calendar path. calendarId: "${finalCalendarId}", calendarPath: "${calendarPath}". Please check your calendar configuration.`);
  }
  
  // Use preserved UID if provided, otherwise generate new one
  const eventId = preserveUID || generateUID();
  const eventUrl = `${calendarPath}${eventId}.ics`;
  
  // Build iCalendar data
  const icalString = buildICalEvent(eventId, options);
  
  try {
    // Upload event
    await client.put(eventUrl, icalString, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
      },
    });
    
    // Return created event
    return {
      id: eventId,
      calendarId: calendarPath,
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: options.start,
      end: options.end,
      attendees: options.attendees,
      reminders: options.reminders,
      recurrence: options.recurrence,
      status: 'confirmed',
      htmlLink: eventUrl,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Create event error', error instanceof Error ? error : undefined, {
      service: 'caldavProvider',
    });
    
    interface CalDAVAxiosError {
      response?: {
        data?: string | unknown;
        status?: number;
      };
      message?: string;
    }
    const caldavError = error as CalDAVAxiosError;
    if (caldavError.response?.data) {
      const errorData = typeof caldavError.response.data === 'string' ? caldavError.response.data : JSON.stringify(caldavError.response.data);
      if (errorData.includes('VTODO') || errorData.includes('InvalidComponentType')) {
        throw new Error(`This calendar does not support events (VEVENT). It appears to be configured as a todo list (VTODO) calendar. Please select a different calendar that supports events.`);
      }
      if (caldavError.response.status === 403) {
        throw new Error(`Permission denied: You don't have permission to create events in this calendar. Status: ${caldavError.response.status}`);
      }
    }
    
    throw new Error(`Failed to create event: ${caldavError.message || errorMessage}`);
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(
  client: AxiosInstance,
  config: CalDAVConfig,
  calendars: Calendar[],
  calendarId: string,
  eventId: string,
  updates: Partial<CreateEventOptions>,
  getEventFn: (calendarId: string, eventId: string) => Promise<CalendarEvent>,
  deleteEventFn: (calendarId: string, eventId: string) => Promise<void>,
  createEventFn: (options: CreateEventOptions, preserveUID?: string) => Promise<CalendarEvent>
): Promise<CalendarEvent> {
  // Get existing event
  const existing = await getEventFn(calendarId, eventId);
  
  // Parse start time if it's a string
  let start = existing.start;
  if (updates.start) {
    if (typeof updates.start === 'string') {
      const existingStartDateTime = existing.start.dateTime || existing.start.date;
      if (existingStartDateTime) {
        const newDateTime = timeStringToDateTime(updates.start, existingStartDateTime);
        if (newDateTime) {
          start = { dateTime: newDateTime, timeZone: existing.start.timeZone };
        } else {
          try {
            const parsedDate = new Date(updates.start);
            if (!isNaN(parsedDate.getTime())) {
              start = { dateTime: parsedDate.toISOString(), timeZone: existing.start.timeZone };
            }
          } catch {
            // Keep existing start if parsing fails
          }
        }
      }
    } else {
      start = updates.start;
    }
  }
  
  // Parse end time if it's a string
  let end = existing.end;
  if (updates.end) {
    if (typeof updates.end === 'string') {
      const existingEndDateTime = existing.end.dateTime || existing.end.date;
      if (existingEndDateTime) {
        const newDateTime = timeStringToDateTime(updates.end, existingEndDateTime);
        if (newDateTime) {
          end = { dateTime: newDateTime, timeZone: existing.end.timeZone };
        } else {
          try {
            const parsedDate = new Date(updates.end);
            if (!isNaN(parsedDate.getTime())) {
              end = { dateTime: parsedDate.toISOString(), timeZone: existing.end.timeZone };
            }
          } catch {
            // Keep existing end if parsing fails
          }
        }
      }
    } else {
      end = updates.end;
    }
  }
  
  // Merge updates
  const updatedOptions: CreateEventOptions = {
    calendarId,
    summary: updates.summary || existing.summary,
    description: updates.description !== undefined ? updates.description : existing.description,
    location: updates.location !== undefined ? updates.location : existing.location,
    start,
    end,
    attendees: updates.attendees || existing.attendees,
    reminders: updates.reminders || existing.reminders,
    recurrence: updates.recurrence || existing.recurrence,
  };
  
  // Delete old event
  await deleteEventFn(calendarId, eventId);
  
  // Create updated event with the same UID to preserve event identity
  return await createEventFn(updatedOptions, eventId);
}

/**
 * Delete an event
 */
export async function deleteEvent(
  client: AxiosInstance,
  config: CalDAVConfig,
  calendarId: string,
  eventId: string,
  getEventFn: (calendarId: string, eventId: string) => Promise<CalendarEvent>
): Promise<void> {
  // Get the event to retrieve its href (file path)
  const event = await getEventFn(calendarId, eventId);
  
  // Use the href from htmlLink if available, otherwise fall back to constructing it
  let eventUrl: string;
  if (event.htmlLink) {
    if (event.htmlLink.startsWith('http://') || event.htmlLink.startsWith('https://')) {
      try {
        const urlObj = new URL(event.htmlLink);
        eventUrl = urlObj.pathname;
      } catch {
        const match = event.htmlLink.match(/https?:\/\/[^\/]+(\/.*)/);
        eventUrl = match ? match[1] : event.htmlLink;
      }
    } else {
      eventUrl = event.htmlLink.startsWith('/') ? event.htmlLink : `/${event.htmlLink}`;
    }
  } else {
    const calendarPath = getCalendarPath(config, calendarId);
    eventUrl = `${calendarPath}${eventId}.ics`;
  }
  
  // Remove leading slash if baseURL already ends with slash
  const baseURL = client.defaults.baseURL || '';
  if (baseURL.endsWith('/') && eventUrl.startsWith('/')) {
    eventUrl = eventUrl.substring(1);
  }
  
  try {
    await client.delete(eventUrl);
  } catch (error: unknown) {
    interface CalDAVError {
      response?: {
        status?: number;
      };
    }
    const caldavError = error as CalDAVError;
    if (caldavError.response?.status === 404) {
      // Already deleted, ignore
      return;
    }
    throw error;
  }
}
