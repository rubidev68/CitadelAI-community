export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string; // Event title
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // ISO 8601 datetime
    date?: string; // ISO 8601 date (all-day events)
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    name?: string;
    responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  organizer?: {
    email: string;
    name?: string;
  };
  recurrence?: string[]; // RRULE strings
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  created?: Date;
  updated?: Date;
  htmlLink?: string; // Link to view event in calendar
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  primary?: boolean;
  accessRole?: 'owner' | 'writer' | 'reader' | 'freeBusyReader';
}

export interface EventSearchOptions {
  calendarId?: string; // Default: primary calendar
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
  query?: string; // Search query
  orderBy?: 'startTime' | 'updated';
  singleEvents?: boolean; // Expand recurring events
}

export interface CreateEventOptions {
  calendarId?: string; // Default: primary calendar
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    name?: string;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  recurrence?: string[]; // RRULE strings
}

export interface CalendarProvider {
  // OAuth (implemented via userOAuthService)
  // Note: CalDAV may use Basic Auth instead of OAuth
  getProviderId(): 'google_calendar' | 'outlook_calendar' | 'caldav';
  getProviderName(): string;
  requiresOAuth(): boolean; // Returns false for CalDAV Basic Auth
  
  // List Calendars
  listCalendars(accessToken: string): Promise<Calendar[]>;
  
  // Read Events (CONTEXT block)
  searchEvents(
    accessToken: string,
    options: EventSearchOptions
  ): Promise<CalendarEvent[]>;
  
  getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarEvent>;
  
  // Create/Update/Delete Events (ACTION block)
  createEvent(
    accessToken: string,
    options: CreateEventOptions
  ): Promise<CalendarEvent>;
  
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CreateEventOptions>
  ): Promise<CalendarEvent>;
  
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void>;
  
  // Free/Busy Check
  checkFreeBusy(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
    calendarIds?: string[]
  ): Promise<Array<{
    calendarId: string;
    busy: Array<{
      start: Date;
      end: Date;
    }>;
  }>>;
  
  // Account Info
  getAccountInfo(accessToken: string): Promise<{
    email: string;
    name?: string;
  }>;
}
