import { CalendarEvent } from '../../types';
import { logger } from '@shared/utils';
import { generateUID } from '../utils/icalFormatter';

/**
 * Parse iCalendar format string and extract events
 */
export function parseICalendar(icalContent: string, calendarId: string, href?: string | null): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  try {
    // Split by BEGIN:VEVENT to find individual events
    const eventBlocks = icalContent.split(/BEGIN:VEVENT/i);
    
    for (let i = 1; i < eventBlocks.length; i++) { // Start from 1 to skip content before first event
      const eventBlock = eventBlocks[i].split(/END:VEVENT/i)[0];
      
      try {
        const event = parseICalEvent(eventBlock, calendarId, href);
        if (event) {
          events.push(event);
        }
      } catch (parseError) {
        logger.warn('Error parsing individual event', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          service: 'caldavProvider',
        });
        // Continue with next event
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error parsing iCalendar content', error instanceof Error ? error : undefined, {
      service: 'caldavProvider',
    });
  }
  
  return events;
}

/**
 * Parse a single VEVENT block from iCalendar format
 */
export function parseICalEvent(eventBlock: string, calendarId: string, href?: string | null): CalendarEvent | null {
  const lines = eventBlock.split(/\r?\n/);
  
  let uid = '';
  let summary = '';
  let description = '';
  let location = '';
  let dtstart = '';
  let dtend = '';
  let dtstartDate = false;
  let dtendDate = false;
  let status: 'confirmed' | 'tentative' | 'cancelled' = 'confirmed';
  let organizer: { email: string; name?: string } | undefined;
  const attendees: Array<{ email: string; name?: string; responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction' }> = [];
  const recurrence: string[] = [];
  
  // Handle line continuation (lines starting with space/tab continue previous line)
  let currentLine = '';
  for (const line of lines) {
    if (line.match(/^[ \t]/)) {
      // Continuation line
      currentLine += line.substring(1);
    } else {
      // New line
      if (currentLine) {
        parseICalLine(currentLine, {
          uid: (val) => uid = val,
          summary: (val) => summary = val,
          description: (val) => description = val,
          location: (val) => location = val,
          dtstart: (val, isDate) => { dtstart = val; dtstartDate = isDate; },
          dtend: (val, isDate) => { dtend = val; dtendDate = isDate; },
          status: (val) => {
            const statusVal = val as string | undefined;
            if (statusVal === 'confirmed' || statusVal === 'tentative' || statusVal === 'cancelled') {
              status = statusVal;
            }
          },
          organizer: (val) => organizer = val,
          attendee: (val) => attendees.push(val),
          rrule: (val) => recurrence.push(val),
        });
      }
      currentLine = line;
    }
  }
  // Process last line
  if (currentLine) {
    parseICalLine(currentLine, {
      uid: (val) => uid = val,
      summary: (val) => summary = val,
      description: (val) => description = val,
      location: (val) => location = val,
      dtstart: (val, isDate) => { dtstart = val; dtstartDate = isDate; },
      dtend: (val, isDate) => { dtend = val; dtendDate = isDate; },
      status: (val) => {
        const statusVal = val as string | undefined;
        if (statusVal === 'confirmed' || statusVal === 'tentative' || statusVal === 'cancelled') {
          status = statusVal;
        }
      },
      organizer: (val) => organizer = val,
      attendee: (val) => attendees.push(val),
      rrule: (val) => recurrence.push(val),
    });
  }
  
  // Generate UID if not found
  if (!uid) {
    uid = `caldav-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Parse dates
  const start = parseICalDateTime(dtstart, dtstartDate);
  const end = parseICalDateTime(dtend, dtendDate);
  
  if (!start) {
    logger.warn('Event missing start time, skipping', {
      service: 'caldavProvider',
    });
    return null;
  }
  
  return {
    id: uid,
    calendarId,
    summary: summary || 'Untitled Event',
    description: description || undefined,
    location: location || undefined,
    start,
    end: end || start, // Use start as end if end is missing
    attendees: attendees.length > 0 ? attendees : undefined,
    organizer,
    recurrence: recurrence.length > 0 ? recurrence : undefined,
    status,
    htmlLink: href || undefined, // Store CalDAV file path in htmlLink for deletion/update
  };
}

/**
 * Parse a single iCalendar line
 */
export function parseICalLine(
  line: string,
  handlers: {
    uid?: (val: string) => void;
    summary?: (val: string) => void;
    description?: (val: string) => void;
    location?: (val: string) => void;
    dtstart?: (val: string, isDate: boolean) => void;
    dtend?: (val: string, isDate: boolean) => void;
    status?: (val: string) => void;
    organizer?: (val: { email: string; name?: string }) => void;
    attendee?: (val: { email: string; name?: string; responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction' }) => void;
    rrule?: (val: string) => void;
  }
): void {
  // Handle property with parameters: PROP;PARAM1=VALUE1;PARAM2=VALUE2:VALUE
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return;
  
  const propertyPart = line.substring(0, colonIndex);
  const valuePart = line.substring(colonIndex + 1);
  
  const semicolonIndex = propertyPart.indexOf(';');
  const propertyName = semicolonIndex === -1 ? propertyPart : propertyPart.substring(0, semicolonIndex);
  const params = semicolonIndex === -1 ? '' : propertyPart.substring(semicolonIndex + 1);
  
  const unescapeValue = (val: string) => val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
  
  switch (propertyName.toUpperCase()) {
    case 'UID':
      handlers.uid?.(unescapeValue(valuePart));
      break;
    case 'SUMMARY':
      handlers.summary?.(unescapeValue(valuePart));
      break;
    case 'DESCRIPTION':
      handlers.description?.(unescapeValue(valuePart));
      break;
    case 'LOCATION':
      handlers.location?.(unescapeValue(valuePart));
      break;
    case 'DTSTART':
      const isDateStart = params.includes('VALUE=DATE') || valuePart.length === 8;
      handlers.dtstart?.(valuePart, isDateStart);
      break;
    case 'DTEND':
      const isDateEnd = params.includes('VALUE=DATE') || valuePart.length === 8;
      handlers.dtend?.(valuePart, isDateEnd);
      break;
    case 'STATUS':
      handlers.status?.(valuePart.toUpperCase());
      break;
    case 'ORGANIZER':
      const orgMatch = valuePart.match(/mailto:(.+)/i);
      const orgNameMatch = params.match(/CN=([^;]+)/i);
      handlers.organizer?.({
        email: orgMatch ? orgMatch[1] : valuePart.replace(/^mailto:/i, ''),
        name: orgNameMatch ? unescapeValue(orgNameMatch[1]) : undefined,
      });
      break;
    case 'ATTENDEE':
      const attendeeMatch = valuePart.match(/mailto:(.+)/i);
      const attendeeNameMatch = params.match(/CN=([^;]+)/i);
      const partstatMatch = params.match(/PARTSTAT=([^;]+)/i);
      handlers.attendee?.({
        email: attendeeMatch ? attendeeMatch[1] : valuePart.replace(/^mailto:/i, ''),
        name: attendeeNameMatch ? unescapeValue(attendeeNameMatch[1]) : undefined,
        responseStatus: partstatMatch ? (partstatMatch[1].toLowerCase() as 'accepted' | 'declined' | 'tentative' | 'needsAction') : undefined,
      });
      break;
    case 'RRULE':
      handlers.rrule?.(valuePart);
      break;
  }
}

/**
 * Parse iCalendar date/time string to CalendarEvent date format
 */
export function parseICalDateTime(dtValue: string, isDate: boolean): { dateTime?: string; date?: string; timeZone?: string } | null {
  if (!dtValue) return null;
  
  if (isDate) {
    // Date only (YYYYMMDD)
    if (dtValue.length === 8) {
      const year = dtValue.substring(0, 4);
      const month = dtValue.substring(4, 6);
      const day = dtValue.substring(6, 8);
      return { date: `${year}-${month}-${day}` };
    }
  } else {
    // DateTime (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
    if (dtValue.length >= 15) {
      const year = dtValue.substring(0, 4);
      const month = dtValue.substring(4, 6);
      const day = dtValue.substring(6, 8);
      const hour = dtValue.substring(9, 11);
      const minute = dtValue.substring(11, 13);
      const second = dtValue.substring(13, 15);
      const isUTC = dtValue.endsWith('Z');
      
      const dateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}${isUTC ? 'Z' : ''}`;
      return { 
        dateTime,
        timeZone: isUTC ? 'UTC' : undefined,
      };
    }
  }
  
  return null;
}
