import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleCalendarProvider } from '../../../services/calendarProviders/googleCalendarProvider';
import { CalendarEvent, Calendar } from '../../../services/calendarProviders/types';

// Mock googleapis - use vi.hoisted
const {
  MockOAuth2Client,
  mockSetCredentials,
  mockCalendar,
  mockCalendarListList,
  mockCalendarListGet,
  mockEventsList,
  mockEventsGet,
  mockEventsInsert,
  mockEventsUpdate,
  mockEventsDelete,
  mockFreebusyQuery,
} = vi.hoisted(() => {
  const mockSetCredentials = vi.fn();

  // Create a proper class constructor
  class MockOAuth2Client {
    setCredentials = mockSetCredentials;
  }

  const mockCalendarListList = vi.fn();
  const mockCalendarListGet = vi.fn();
  const mockEventsList = vi.fn();
  const mockEventsGet = vi.fn();
  const mockEventsInsert = vi.fn();
  const mockEventsUpdate = vi.fn();
  const mockEventsDelete = vi.fn();
  const mockFreebusyQuery = vi.fn();

  const mockCalendar = vi.fn(() => ({
    calendarList: {
      list: mockCalendarListList,
      get: mockCalendarListGet,
    },
    events: {
      list: mockEventsList,
      get: mockEventsGet,
      insert: mockEventsInsert,
      update: mockEventsUpdate,
      delete: mockEventsDelete,
    },
    freebusy: {
      query: mockFreebusyQuery,
    },
  }));

  return {
    MockOAuth2Client,
    mockSetCredentials,
    mockCalendar,
    mockCalendarListList,
    mockCalendarListGet,
    mockEventsList,
    mockEventsGet,
    mockEventsInsert,
    mockEventsUpdate,
    mockEventsDelete,
    mockFreebusyQuery,
  };
});

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: MockOAuth2Client,
    },
    calendar: mockCalendar,
  },
}));

describe('Google Calendar Provider', () => {
  let provider: GoogleCalendarProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new GoogleCalendarProvider();
    // Set environment variables
    process.env.GOOGLE_CALENDAR_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'test-client-secret';
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_DRIVE_CLIENT_ID;
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  });

  describe('getProviderId', () => {
    it('should return google_calendar', () => {
      expect(provider.getProviderId()).toBe('google_calendar');
    });
  });

  describe('getProviderName', () => {
    it('should return Google Calendar', () => {
      expect(provider.getProviderName()).toBe('Google Calendar');
    });
  });

  describe('requiresOAuth', () => {
    it('should return true', () => {
      expect(provider.requiresOAuth()).toBe(true);
    });
  });

  describe('listCalendars', () => {
    it('should list calendars successfully', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              id: 'calendar1',
              summary: 'Primary Calendar',
              description: 'My primary calendar',
              primary: true,
              accessRole: 'owner',
            },
            {
              id: 'calendar2',
              summary: 'Work Calendar',
              primary: false,
              accessRole: 'writer',
            },
          ],
        },
      };

      mockCalendarListList.mockResolvedValue(mockResponse);

      const result = await provider.listCalendars('access-token');

      expect(mockSetCredentials).toHaveBeenCalledWith({ access_token: 'access-token' });
      expect(mockCalendarListList).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'calendar1',
        name: 'Primary Calendar',
        description: 'My primary calendar',
        primary: true,
        accessRole: 'owner',
      });
      expect(result[1]).toEqual({
        id: 'calendar2',
        name: 'Work Calendar',
        description: undefined,
        primary: false,
        accessRole: 'writer',
      });
    });

    it('should handle calendars with no summary', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              id: 'calendar1',
              primary: false,
            },
          ],
        },
      };

      mockCalendarListList.mockResolvedValue(mockResponse);

      const result = await provider.listCalendars('access-token');

      expect(result[0].name).toBe('Untitled Calendar');
    });

    it('should handle empty calendar list', async () => {
      const mockResponse = {
        data: {
          items: [],
        },
      };

      mockCalendarListList.mockResolvedValue(mockResponse);

      const result = await provider.listCalendars('access-token');

      expect(result).toHaveLength(0);
    });

    it('should handle null items', async () => {
      const mockResponse = {
        data: {},
      };

      mockCalendarListList.mockResolvedValue(mockResponse);

      const result = await provider.listCalendars('access-token');

      expect(result).toHaveLength(0);
    });

    it('should use GOOGLE_DRIVE_CLIENT_ID as fallback', async () => {
      delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'drive-client-secret';

      const mockResponse = {
        data: { items: [] },
      };

      mockCalendarListList.mockResolvedValue(mockResponse);

      await provider.listCalendars('access-token');

      expect(mockCalendar).toHaveBeenCalled();
    });
  });

  describe('searchEvents', () => {
    it('should search events with default options', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              id: 'event1',
              summary: 'Meeting',
              start: { dateTime: '2025-12-22T09:00:00Z' },
              end: { dateTime: '2025-12-22T10:00:00Z' },
            },
          ],
        },
      };

      mockEventsList.mockResolvedValue(mockResponse);

      const result = await provider.searchEvents('access-token', {});

      expect(mockEventsList).toHaveBeenCalledWith({
        calendarId: 'primary',
        timeMin: undefined,
        timeMax: undefined,
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('event1');
      expect(result[0].summary).toBe('Meeting');
    });

    it('should search events with custom options', async () => {
      const timeMin = new Date('2025-12-22T00:00:00Z');
      const timeMax = new Date('2025-12-23T00:00:00Z');

      const mockResponse = {
        data: {
          items: [],
        },
      };

      mockEventsList.mockResolvedValue(mockResponse);

      await provider.searchEvents('access-token', {
        calendarId: 'calendar1',
        timeMin,
        timeMax,
        maxResults: 100,
        query: 'meeting',
        orderBy: 'updated',
        singleEvents: false,
      });

      expect(mockEventsList).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        timeMin: '2025-12-22T00:00:00.000Z',
        timeMax: '2025-12-23T00:00:00.000Z',
        maxResults: 100,
        q: 'meeting',
        orderBy: 'updated',
        singleEvents: false,
      });
    });

    it('should handle empty events list', async () => {
      const mockResponse = {
        data: {
          items: [],
        },
      };

      mockEventsList.mockResolvedValue(mockResponse);

      const result = await provider.searchEvents('access-token', {});

      expect(result).toHaveLength(0);
    });

    it('should handle null items', async () => {
      const mockResponse = {
        data: {},
      };

      mockEventsList.mockResolvedValue(mockResponse);

      const result = await provider.searchEvents('access-token', {});

      expect(result).toHaveLength(0);
    });
  });

  describe('getEvent', () => {
    it('should get event successfully', async () => {
      const mockResponse = {
        data: {
          id: 'event1',
          summary: 'Meeting',
          description: 'Team meeting',
          location: 'Room A',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      };

      mockEventsGet.mockResolvedValue(mockResponse);

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(mockEventsGet).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        eventId: 'event1',
      });
      expect(result.id).toBe('event1');
      expect(result.summary).toBe('Meeting');
      expect(result.calendarId).toBe('calendar1');
    });
  });

  describe('createEvent', () => {
    it('should create event with minimal options', async () => {
      const mockResponse = {
        data: {
          id: 'event1',
          summary: 'Meeting',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      };

      mockEventsInsert.mockResolvedValue(mockResponse);

      const result = await provider.createEvent('access-token', {
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      });

      expect(mockEventsInsert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: {
          summary: 'Meeting',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      });
      expect(result.id).toBe('event1');
    });

    it('should create event with all options', async () => {
      const mockResponse = {
        data: {
          id: 'event1',
          summary: 'Meeting',
          description: 'Team meeting',
          location: 'Room A',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      };

      mockEventsInsert.mockResolvedValue(mockResponse);

      const result = await provider.createEvent('access-token', {
        calendarId: 'calendar1',
        summary: 'Meeting',
        description: 'Team meeting',
        location: 'Room A',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        attendees: [
          { email: 'john@example.com', name: 'John' },
          { email: 'jane@example.com' },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 15 },
            { method: 'popup', minutes: 5 },
          ],
        },
        recurrence: ['RRULE:FREQ=DAILY;COUNT=5'],
      });

      expect(mockEventsInsert).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        requestBody: {
          summary: 'Meeting',
          description: 'Team meeting',
          location: 'Room A',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
          attendees: [
            { email: 'john@example.com', displayName: 'John' },
            { email: 'jane@example.com' },
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 15 },
              { method: 'popup', minutes: 5 },
            ],
          },
          recurrence: ['RRULE:FREQ=DAILY;COUNT=5'],
        },
      });
      expect(result.id).toBe('event1');
    });

    it('should create event without attendees', async () => {
      const mockResponse = {
        data: {
          id: 'event1',
          summary: 'Meeting',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      };

      mockEventsInsert.mockResolvedValue(mockResponse);

      await provider.createEvent('access-token', {
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      });

      const callArgs = mockEventsInsert.mock.calls[0][0];
      expect(callArgs.requestBody.attendees).toBeUndefined();
    });

    it('should create event with empty attendees array', async () => {
      const mockResponse = {
        data: {
          id: 'event1',
          summary: 'Meeting',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      };

      mockEventsInsert.mockResolvedValue(mockResponse);

      await provider.createEvent('access-token', {
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        attendees: [],
      });

      const callArgs = mockEventsInsert.mock.calls[0][0];
      expect(callArgs.requestBody.attendees).toBeUndefined();
    });
  });

  describe('updateEvent', () => {
    it('should update event successfully', async () => {
      const existingEvent = {
        id: 'event1',
        summary: 'Old Meeting',
        description: 'Old description',
        location: 'Old location',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      const updatedEvent = {
        id: 'event1',
        summary: 'New Meeting',
        description: 'New description',
        location: 'New location',
        start: { dateTime: '2025-12-22T10:00:00Z' },
        end: { dateTime: '2025-12-22T11:00:00Z' },
      };

      mockEventsGet.mockResolvedValue({ data: existingEvent });
      mockEventsUpdate.mockResolvedValue({ data: updatedEvent });

      const result = await provider.updateEvent(
        'access-token',
        'calendar1',
        'event1',
        {
          summary: 'New Meeting',
          description: 'New description',
          location: 'New location',
          start: { dateTime: '2025-12-22T10:00:00Z' },
          end: { dateTime: '2025-12-22T11:00:00Z' },
        }
      );

      expect(mockEventsGet).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        eventId: 'event1',
      });
      expect(mockEventsUpdate).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        eventId: 'event1',
        requestBody: updatedEvent,
      });
      expect(result.summary).toBe('New Meeting');
    });

    it('should update event with partial updates', async () => {
      const existingEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      const updatedEvent = {
        id: 'event1',
        summary: 'Updated Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      mockEventsGet.mockResolvedValue({ data: existingEvent });
      mockEventsUpdate.mockResolvedValue({ data: updatedEvent });

      const result = await provider.updateEvent(
        'access-token',
        'calendar1',
        'event1',
        {
          summary: 'Updated Meeting',
        }
      );

      expect(result.summary).toBe('Updated Meeting');
    });

    it('should update event with description set to empty string', async () => {
      const existingEvent = {
        id: 'event1',
        summary: 'Meeting',
        description: 'Old description',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      const updatedEvent = {
        id: 'event1',
        summary: 'Meeting',
        description: '',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      mockEventsGet.mockResolvedValue({ data: existingEvent });
      mockEventsUpdate.mockResolvedValue({ data: updatedEvent });

      await provider.updateEvent('access-token', 'calendar1', 'event1', {
        description: '',
      });

      const callArgs = mockEventsUpdate.mock.calls[0][0];
      expect(callArgs.requestBody.description).toBe('');
    });

    it('should update event with attendees', async () => {
      const existingEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      const updatedEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        attendees: [
          { email: 'john@example.com', displayName: 'John' },
        ],
      };

      mockEventsGet.mockResolvedValue({ data: existingEvent });
      mockEventsUpdate.mockResolvedValue({ data: updatedEvent });

      await provider.updateEvent('access-token', 'calendar1', 'event1', {
        attendees: [{ email: 'john@example.com', name: 'John' }],
      });

      const callArgs = mockEventsUpdate.mock.calls[0][0];
      expect(callArgs.requestBody.attendees).toEqual([
        { email: 'john@example.com', displayName: 'John' },
      ]);
    });

    it('should update event with reminders', async () => {
      const existingEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      const updatedEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'email', minutes: 15 }],
        },
      };

      mockEventsGet.mockResolvedValue({ data: existingEvent });
      mockEventsUpdate.mockResolvedValue({ data: updatedEvent });

      await provider.updateEvent('access-token', 'calendar1', 'event1', {
        reminders: {
          useDefault: false,
          overrides: [{ method: 'email', minutes: 15 }],
        },
      });

      const callArgs = mockEventsUpdate.mock.calls[0][0];
      expect(callArgs.requestBody.reminders).toEqual({
        useDefault: false,
        overrides: [{ method: 'email', minutes: 15 }],
      });
    });
  });

  describe('deleteEvent', () => {
    it('should delete event successfully', async () => {
      mockEventsDelete.mockResolvedValue({});

      await provider.deleteEvent('access-token', 'calendar1', 'event1');

      expect(mockEventsDelete).toHaveBeenCalledWith({
        calendarId: 'calendar1',
        eventId: 'event1',
      });
    });
  });

  describe('checkFreeBusy', () => {
    it('should check free/busy for primary calendar', async () => {
      const timeMin = new Date('2025-12-22T00:00:00Z');
      const timeMax = new Date('2025-12-23T00:00:00Z');

      const mockResponse = {
        data: {
          calendars: {
            primary: {
              busy: [
                {
                  start: '2025-12-22T09:00:00Z',
                  end: '2025-12-22T10:00:00Z',
                },
              ],
            },
          },
        },
      };

      mockFreebusyQuery.mockResolvedValue(mockResponse);

      const result = await provider.checkFreeBusy('access-token', timeMin, timeMax);

      expect(mockFreebusyQuery).toHaveBeenCalledWith({
        requestBody: {
          timeMin: '2025-12-22T00:00:00.000Z',
          timeMax: '2025-12-23T00:00:00.000Z',
          items: [{ id: 'primary' }],
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].calendarId).toBe('primary');
      expect(result[0].busy).toHaveLength(1);
      expect(result[0].busy[0].start).toEqual(new Date('2025-12-22T09:00:00Z'));
      expect(result[0].busy[0].end).toEqual(new Date('2025-12-22T10:00:00Z'));
    });

    it('should check free/busy for specific calendars', async () => {
      const timeMin = new Date('2025-12-22T00:00:00Z');
      const timeMax = new Date('2025-12-23T00:00:00Z');

      const mockResponse = {
        data: {
          calendars: {
            calendar1: {
              busy: [
                {
                  start: '2025-12-22T09:00:00Z',
                  end: '2025-12-22T10:00:00Z',
                },
              ],
            },
            calendar2: {
              busy: [],
            },
          },
        },
      };

      mockFreebusyQuery.mockResolvedValue(mockResponse);

      const result = await provider.checkFreeBusy('access-token', timeMin, timeMax, [
        'calendar1',
        'calendar2',
      ]);

      expect(mockFreebusyQuery).toHaveBeenCalledWith({
        requestBody: {
          timeMin: '2025-12-22T00:00:00.000Z',
          timeMax: '2025-12-23T00:00:00.000Z',
          items: [{ id: 'calendar1' }, { id: 'calendar2' }],
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].calendarId).toBe('calendar1');
      expect(result[1].calendarId).toBe('calendar2');
      expect(result[1].busy).toHaveLength(0);
    });

    it('should handle empty busy periods', async () => {
      const timeMin = new Date('2025-12-22T00:00:00Z');
      const timeMax = new Date('2025-12-23T00:00:00Z');

      const mockResponse = {
        data: {
          calendars: {
            primary: {
              busy: [],
            },
          },
        },
      };

      mockFreebusyQuery.mockResolvedValue(mockResponse);

      const result = await provider.checkFreeBusy('access-token', timeMin, timeMax);

      expect(result[0].busy).toHaveLength(0);
    });

    it('should handle null busy periods', async () => {
      const timeMin = new Date('2025-12-22T00:00:00Z');
      const timeMax = new Date('2025-12-23T00:00:00Z');

      const mockResponse = {
        data: {
          calendars: {
            primary: {},
          },
        },
      };

      mockFreebusyQuery.mockResolvedValue(mockResponse);

      const result = await provider.checkFreeBusy('access-token', timeMin, timeMax);

      expect(result[0].busy).toHaveLength(0);
    });
  });

  describe('getAccountInfo', () => {
    it('should get account info successfully', async () => {
      const mockResponse = {
        data: {
          id: 'user@example.com',
          summary: 'User Name',
        },
      };

      mockCalendarListGet.mockResolvedValue(mockResponse);

      const result = await provider.getAccountInfo('access-token');

      expect(mockCalendarListGet).toHaveBeenCalledWith({ calendarId: 'primary' });
      expect(result.email).toBe('user@example.com');
      expect(result.name).toBe('User Name');
    });

    it('should handle missing summary', async () => {
      const mockResponse = {
        data: {
          id: 'user@example.com',
        },
      };

      mockCalendarListGet.mockResolvedValue(mockResponse);

      const result = await provider.getAccountInfo('access-token');

      expect(result.email).toBe('user@example.com');
      expect(result.name).toBeUndefined();
    });

    it('should handle missing id', async () => {
      const mockResponse = {
        data: {
          summary: 'User Name',
        },
      };

      mockCalendarListGet.mockResolvedValue(mockResponse);

      const result = await provider.getAccountInfo('access-token');

      expect(result.email).toBe('');
      expect(result.name).toBe('User Name');
    });
  });

  describe('mapGoogleEventToCalendarEvent', () => {
    it('should map event with all fields', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'Meeting',
        description: 'Team meeting',
        location: 'Room A',
        start: { dateTime: '2025-12-22T09:00:00Z', timeZone: 'UTC' },
        end: { dateTime: '2025-12-22T10:00:00Z', timeZone: 'UTC' },
        attendees: [
          { email: 'john@example.com', displayName: 'John', responseStatus: 'accepted' },
          { email: 'jane@example.com', displayName: 'Jane', responseStatus: 'declined' },
        ],
        organizer: { email: 'organizer@example.com', displayName: 'Organizer' },
        recurrence: ['RRULE:FREQ=DAILY;COUNT=5'],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 15 },
            { method: 'popup', minutes: 5 },
          ],
        },
        status: 'confirmed',
        created: '2025-12-21T10:00:00Z',
        updated: '2025-12-21T11:00:00Z',
        htmlLink: 'https://calendar.google.com/event?eid=event1',
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.id).toBe('event1');
      expect(result.summary).toBe('Meeting');
      expect(result.description).toBe('Team meeting');
      expect(result.location).toBe('Room A');
      expect(result.start.dateTime).toBe('2025-12-22T09:00:00Z');
      expect(result.start.timeZone).toBe('UTC');
      expect(result.attendees).toHaveLength(2);
      expect(result.attendees![0].email).toBe('john@example.com');
      expect(result.attendees![0].name).toBe('John');
      expect(result.attendees![0].responseStatus).toBe('accepted');
      expect(result.organizer?.email).toBe('organizer@example.com');
      expect(result.recurrence).toEqual(['RRULE:FREQ=DAILY;COUNT=5']);
      // useDefault: false becomes undefined due to || undefined logic
      expect(result.reminders?.useDefault).toBeUndefined();
      expect(result.reminders?.overrides).toHaveLength(2);
      expect(result.status).toBe('confirmed');
      expect(result.created).toEqual(new Date('2025-12-21T10:00:00Z'));
      expect(result.htmlLink).toBe('https://calendar.google.com/event?eid=event1');
    });

    it('should map all-day event', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'All Day Event',
        start: { date: '2025-12-22' },
        end: { date: '2025-12-22' },
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.start.date).toBe('2025-12-22');
      expect(result.start.dateTime).toBeUndefined();
    });

    it('should filter out attendees without email', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        attendees: [
          { email: 'john@example.com', displayName: 'John' },
          { displayName: 'No Email' }, // Should be filtered out
          { email: 'jane@example.com' },
        ],
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.attendees).toHaveLength(2);
      expect(result.attendees![0].email).toBe('john@example.com');
      expect(result.attendees![1].email).toBe('jane@example.com');
    });

    it('should handle null event', async () => {
      mockEventsGet.mockResolvedValue({ data: null });

      await expect(
        provider.getEvent('access-token', 'calendar1', 'event1')
      ).rejects.toThrow('Invalid event: event or event.id is null');
    });

    it('should handle event without id', async () => {
      mockEventsGet.mockResolvedValue({
        data: {
          summary: 'Meeting',
        },
      });

      await expect(
        provider.getEvent('access-token', 'calendar1', 'event1')
      ).rejects.toThrow('Invalid event: event or event.id is null');
    });

    it('should handle empty summary', async () => {
      const mockEvent = {
        id: 'event1',
        summary: null,
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.summary).toBe('');
    });

    it('should handle organizer without email', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        organizer: { displayName: 'Organizer' },
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.organizer).toBeUndefined();
    });

    it('should filter reminder overrides without method or minutes', async () => {
      const mockEvent = {
        id: 'event1',
        summary: 'Meeting',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 15 },
            { method: null, minutes: 10 }, // Should be filtered
            { method: 'popup' }, // Should be filtered
            { method: 'email', minutes: null }, // Should be filtered
          ],
        },
      };

      mockEventsGet.mockResolvedValue({ data: mockEvent });

      const result = await provider.getEvent('access-token', 'calendar1', 'event1');

      expect(result.reminders?.overrides).toHaveLength(1);
      expect(result.reminders?.overrides![0].method).toBe('email');
      expect(result.reminders?.overrides![0].minutes).toBe(15);
    });
  });
});
