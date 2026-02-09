import { CalendarEvent } from '../../types';
import { logger } from '@shared/utils';
import { parseICalendar } from './icalParser';

/**
 * Extract calendar-data content from a response block
 */
export function extractCalendarDataFromResponse(responseBlock: string): string | null {
  // Try to find calendar-data with various namespace prefixes and formats
  // Pattern 1: <cal:calendar-data>content</cal:calendar-data>
  let match = responseBlock.match(/<cal:calendar-data[^>]*>([\s\S]*?)<\/cal:calendar-data>/i);
  if (match) {
    return extractICalContent(match[1]);
  }
  
  // Pattern 2: <calendar-data>content</calendar-data> (no namespace)
  match = responseBlock.match(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/i);
  if (match) {
    return extractICalContent(match[1]);
  }
  
  // Pattern 3: CDATA format <cal:calendar-data><![CDATA[content]]></cal:calendar-data>
  match = responseBlock.match(/<cal:calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/cal:calendar-data>/i);
  if (match) {
    return match[1].trim();
  }
  
  match = responseBlock.match(/<calendar-data[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/calendar-data>/i);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Extract iCalendar content from calendar-data element content
 * Handles XML entities and whitespace
 */
export function extractICalContent(content: string): string {
  // Decode XML entities
  let icalContent = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  
  // Remove leading/trailing whitespace
  icalContent = icalContent.trim();
  
  // If content is wrapped in CDATA markers, remove them
  if (icalContent.startsWith('<![CDATA[') && icalContent.endsWith(']]>')) {
    icalContent = icalContent.substring(9, icalContent.length - 3).trim();
  }
  
  return icalContent;
}

/**
 * Parse CalDAV multistatus XML response and extract calendar events
 * CalDAV REPORT response structure:
 * <d:multistatus>
 *   <d:response>
 *     <d:href>/path/to/event.ics</d:href>
 *     <d:propstat>
 *       <d:prop>
 *         <cal:calendar-data>BEGIN:VCALENDAR...END:VCALENDAR</cal:calendar-data>
 *       </d:prop>
 *       <d:status>HTTP/1.1 200 OK</d:status>
 *     </d:propstat>
 *   </d:response>
 * </d:multistatus>
 */
export function parseCalDAVResponse(xmlData: string, calendarId: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  try {
    // First, extract all <d:response> blocks (each represents one event/resource)
    const responseMatches = xmlData.match(/<d:response[^>]*>([\s\S]*?)<\/d:response>/g);
    
    if (!responseMatches || responseMatches.length === 0) {
      // Try without namespace prefix
      const altResponseMatches = xmlData.match(/<response[^>]*>([\s\S]*?)<\/response>/g);
      if (altResponseMatches && altResponseMatches.length > 0) {
        // Process responses
        for (const responseBlock of altResponseMatches) {
          // Extract href (file path) from response
          const hrefMatch = responseBlock.match(/<d:href>(.*?)<\/d:href>/i) || responseBlock.match(/<href>(.*?)<\/href>/i);
          const href = hrefMatch ? decodeURIComponent(hrefMatch[1]) : null;
          
          const icalContent = extractCalendarDataFromResponse(responseBlock);
          if (icalContent) {
            const parsedEvents = parseICalendar(icalContent, calendarId, href);
            events.push(...parsedEvents);
          }
        }
      } else {
        logger.debug('No response elements found in CalDAV multistatus (empty calendar or no events in range)', {
          service: 'caldavProvider',
        });
      }
      return events;
    }
    
    // Process each response block
    for (const responseBlock of responseMatches) {
      // Extract href (file path) from response
      const hrefMatch = responseBlock.match(/<d:href>(.*?)<\/d:href>/i) || responseBlock.match(/<href>(.*?)<\/href>/i);
      const href = hrefMatch ? decodeURIComponent(hrefMatch[1]) : null;
      
      const icalContent = extractCalendarDataFromResponse(responseBlock);
      if (icalContent) {
        const parsedEvents = parseICalendar(icalContent, calendarId, href);
        events.push(...parsedEvents);
      }
    }
    
    // Sort events by start time
    events.sort((a, b) => {
      const aStart = a.start.dateTime || a.start.date || '';
      const bStart = b.start.dateTime || b.start.date || '';
      return aStart.localeCompare(bStart);
    });
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error parsing CalDAV response', error instanceof Error ? error : undefined, {
      service: 'caldavProvider',
    });
    // Return empty array on error
  }
  
  return events;
}
