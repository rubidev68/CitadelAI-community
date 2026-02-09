import { describe, it, expect } from 'vitest';
import { getCalendarProvider } from '../../../services/calendarProviders/providerFactory';
import { GoogleCalendarProvider } from '../../../services/calendarProviders/googleCalendarProvider';
import { CalDAVProvider } from '../../../services/calendarProviders/caldavProvider';

describe('calendarProviders/providerFactory', () => {
  describe('getCalendarProvider', () => {
    it('should return GoogleCalendarProvider for google_calendar', () => {
      const provider = getCalendarProvider('google_calendar');
      expect(provider).toBeInstanceOf(GoogleCalendarProvider);
      expect(provider.getProviderId()).toBe('google_calendar');
      expect(provider.getProviderName()).toBe('Google Calendar');
      expect(provider.requiresOAuth()).toBe(true);
    });

    it('should return CalDAVProvider for caldav', () => {
      const provider = getCalendarProvider('caldav');
      expect(provider).toBeInstanceOf(CalDAVProvider);
      expect(provider.getProviderId()).toBe('caldav');
      expect(provider.getProviderName()).toBe('CalDAV');
      expect(provider.requiresOAuth()).toBe(false);
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        getCalendarProvider('unknown_provider' as any);
      }).toThrow('Unknown calendar provider: unknown_provider');
    });

    it('should throw error for outlook_calendar (not implemented)', () => {
      expect(() => {
        getCalendarProvider('outlook_calendar');
      }).toThrow('Unknown calendar provider: outlook_calendar');
    });
  });
});
