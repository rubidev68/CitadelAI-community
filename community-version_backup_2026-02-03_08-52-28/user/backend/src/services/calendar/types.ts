import { Block } from '@prisma/client';

export interface CalendarBlockProperties {
  // Provider Configuration
  provider: 'google_calendar' | 'outlook_calendar' | 'caldav';
  requiresUserAuth: true; // Always true for calendar blocks
  
  // CalDAV-specific Configuration
  caldavConfig?: {
    serverUrl: string; // CalDAV server URL (e.g., https://nextcloud.example.com/remote.php/dav)
    username?: string; // Optional: pre-configured username (user can override)
    useBasicAuth: boolean; // Use Basic Auth instead of OAuth
    calendarPath?: string; // Custom calendar path (default: /calendars/{username}/)
  };
  
  // Block Type Configuration
  blockMode: 'context' | 'action' | 'both'; // Which mode(s) this block supports
  
  // CONTEXT Block Properties (Reading Events)
  contextConfig?: {
    calendarId?: string; // Specific calendar ID (default: primary)
    dateRange?: {
      start?: string; // ISO date string (default: today)
      end?: string; // ISO date string (default: +30 days)
    };
    maxEvents?: number; // Max events to retrieve (default: 50)
    includeDetails?: boolean; // Include full event details
    filterBy?: {
      summary?: string; // Filter by event title
      location?: string; // Filter by location
      attendees?: string[]; // Filter by attendee emails
    };
    orderBy?: 'startTime' | 'updated'; // Sort order
  };
  
  // ACTION Block Properties (Creating/Updating Events)
  actionConfig?: {
    defaultCalendar?: string; // Default calendar ID
    defaultDuration?: number; // Default duration in minutes (default: 60)
    defaultReminders?: Array<{
      method: 'email' | 'popup';
      minutes: number; // Minutes before event
    }>;
    requireConfirmation?: boolean; // Require user confirmation before creating/updating
    allowUserOverride?: boolean; // Allow user to override time/attendees
    template?: {
      title?: string; // Event title template
      description?: string; // Event description template
      location?: string; // Location template
      variables?: string[]; // Available variables (e.g., ['title', 'date', 'time', 'attendees'])
    };
    allowedActions?: ('create' | 'update' | 'delete')[]; // Which actions are allowed
  };
  
  // Security & Limits
  rateLimit?: {
    readsPerHour?: number; // Max calendar reads per hour (default: 100)
    writesPerHour?: number; // Max calendar writes per hour (default: 20)
  };
  
  // Credential Sharing (for ACTION blocks)
  shareCredentialsWithBlockId?: string; // ID of CONTEXT block to share credentials with
  // If set, this block will use the OAuth connection from the referenced block
}

export interface CalendarBlockResult {
  // CONTEXT block result
  events?: import('../calendarProviders/types').CalendarEvent[];
  eventCount?: number;
  
  // ACTION block result
  eventCreated?: boolean;
  eventUpdated?: boolean;
  eventDeleted?: boolean;
  eventId?: string;
  
  // Common
  requiresAuth?: boolean;
  authUrl?: string;
  provider?: string;
  error?: string;
  blockId?: string; // For identifying which block needs auth
  retryCount?: number; // Track retry attempts
  serverUrl?: string; // For CalDAV server URL
}

export interface ExtractedEventDetails {
  summary?: string;
  start?: string | { old?: string; new?: string; original?: string; updated?: string };
  end?: string | { old?: string; new?: string; original?: string; updated?: string };
  location?: string;
  attendees?: string[];
  eventId?: string;
}

export interface CachedEventInfo {
  eventId: string;
  calendarId: string;
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}
