/**
 * Google Calendar API Type Definitions
 */

/**
 * Google Calendar event
 */
export interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    organizer?: boolean;
    self?: boolean;
  }>;
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  iCalUID?: string;
  created?: string;
  updated?: string;
  etag?: string;
}

/**
 * Google Calendar event list response
 */
export interface GoogleCalendarEventListResponse {
  kind: 'calendar#events';
  etag?: string;
  summary?: string;
  description?: string;
  updated?: string;
  timeZone?: string;
  accessRole?: string;
  defaultReminders?: Array<{
    method: string;
    minutes: number;
  }>;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: GoogleCalendarEvent[];
}

/**
 * Google Calendar list response
 */
export interface GoogleCalendarListResponse {
  kind: 'calendar#calendarList';
  etag?: string;
  nextPageToken?: string;
  nextSyncToken?: string;
  items: Array<{
    kind: 'calendar#calendarListEntry';
    id: string;
    summary: string;
    description?: string;
    location?: string;
    timeZone?: string;
    summaryOverride?: string;
    colorId?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    hidden?: boolean;
    selected?: boolean;
    accessRole?: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner';
    defaultReminders?: Array<{
      method: string;
      minutes: number;
    }>;
    primary?: boolean;
    deleted?: boolean;
  }>;
}

/**
 * Google Calendar OAuth token response
 */
export interface GoogleCalendarOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

/**
 * Google Calendar API error response
 */
export interface GoogleCalendarApiError {
  error: {
    code: number;
    message: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
      location?: string;
      locationType?: string;
    }>;
    status: string;
  };
}
