import { CalendarEvent, EventSearchOptions } from '../../types';
import { logger } from '@shared/utils';

/**
 * Check free/busy status for calendars
 */
export async function checkFreeBusy(
  searchEventsFn: (options: EventSearchOptions) => Promise<CalendarEvent[]>,
  timeMin: Date,
  timeMax: Date,
  calendarIds?: string[]
): Promise<Array<{ calendarId: string; busy: Array<{ start: Date; end: Date }> }>> {
  const calendars = calendarIds || ['primary'];
  
  const results: Array<{ calendarId: string; busy: Array<{ start: Date; end: Date }> }> = [];
  
  for (const calendarId of calendars) {
    // Query events in time range
    const events = await searchEventsFn({
      calendarId,
      timeMin,
      timeMax,
    });
    
    // Extract busy periods
    const busy = events
      .filter(e => e.status !== 'cancelled')
      .map(e => ({
        start: e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date || ''),
        end: e.end.dateTime ? new Date(e.end.dateTime) : new Date(e.end.date || ''),
      }));
    
    results.push({
      calendarId,
      busy,
    });
  }
  
  return results;
}
