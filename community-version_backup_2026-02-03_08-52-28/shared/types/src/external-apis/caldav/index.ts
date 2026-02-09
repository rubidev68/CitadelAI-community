/**
 * CalDAV Protocol Type Definitions
 */

/**
 * CalDAV configuration
 */
export interface CalDAVConfig {
  serverUrl: string;
  username: string;
  password: string;
  calendarPath?: string;
}

/**
 * CalDAV calendar
 */
export interface CalDAVCalendar {
  id: string;
  name: string;
  description?: string;
  url: string;
  color?: string;
  timezone?: string;
  ctag?: string;
  syncToken?: string;
}

/**
 * CalDAV calendar list response
 */
export interface CalDAVCalendarListResponse {
  calendars: CalDAVCalendar[];
}

/**
 * CalDAV event (iCalendar format)
 */
export interface CalDAVEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: string | Date;
  end: string | Date;
  timezone?: string;
  recurrence?: string[];
  attendees?: Array<{
    email: string;
    name?: string;
    role?: 'CHAIR' | 'REQ-PARTICIPANT' | 'OPT-PARTICIPANT' | 'NON-PARTICIPANT';
    status?: 'NEEDS-ACTION' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED' | 'COMPLETED' | 'IN-PROCESS';
  }>;
  organizer?: {
    email: string;
    name?: string;
  };
  status?: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';
  url?: string;
  etag?: string;
  lastModified?: string;
}

/**
 * CalDAV event list response
 */
export interface CalDAVEventListResponse {
  events: CalDAVEvent[];
  syncToken?: string;
}

/**
 * CalDAV PROPFIND response
 */
export interface CalDAVPropFindResponse {
  calendars?: Array<{
    href: string;
    displayname?: string;
    calendarDescription?: string;
    calendarColor?: string;
    calendarTimezone?: string;
    ctag?: string;
    syncToken?: string;
  }>;
  events?: Array<{
    href: string;
    etag?: string;
    getcontenttype?: string;
    getlastmodified?: string;
  }>;
}

/**
 * CalDAV error response
 */
export interface CalDAVError {
  error: string;
  statusCode?: number;
  details?: string;
}
