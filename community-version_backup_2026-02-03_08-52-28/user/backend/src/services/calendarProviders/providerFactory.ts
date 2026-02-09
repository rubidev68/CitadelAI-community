import { GoogleCalendarProvider } from './googleCalendarProvider';
import { CalDAVProvider } from './caldavProvider';
import { CalendarProvider } from './types';

export function getCalendarProvider(provider: 'google_calendar' | 'outlook_calendar' | 'caldav'): CalendarProvider {
  switch (provider) {
    case 'google_calendar':
      return new GoogleCalendarProvider();
    case 'caldav':
      return new CalDAVProvider();
    default:
      throw new Error(`Unknown calendar provider: ${provider}`);
  }
}
