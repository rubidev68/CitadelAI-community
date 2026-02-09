import { AxiosInstance } from 'axios';
import { CalendarProvider, CalendarEvent, Calendar, EventSearchOptions, CreateEventOptions } from './types';
import { CalDAVConfig } from './caldav/types';
import { parseCalDAVCredentials } from './caldav/utils/credentialUtils';
import { getCalDAVClient } from './caldav/utils/clientUtils';
import { listCalendars } from './caldav/operations/calendarOperations';
import { searchEvents as searchEventsOp, getEvent as getEventOp, createEvent as createEventOp, updateEvent as updateEventOp, deleteEvent as deleteEventOp } from './caldav/operations/eventOperations';
import { checkFreeBusy as checkFreeBusyOp } from './caldav/operations/queryOperations';
import { logger } from '@shared/utils';

// Re-export CalDAVConfig for backward compatibility
export type { CalDAVConfig } from './caldav/types';

export class CalDAVProvider implements CalendarProvider {
  private config: CalDAVConfig | null = null;
  
  getProviderId(): 'caldav' {
    return 'caldav';
  }
  
  getProviderName(): string {
    return 'CalDAV';
  }
  
  requiresOAuth(): boolean {
    return false; // CalDAV uses Basic Auth
  }
  
  /**
   * Set CalDAV configuration (called before other methods)
   */
  setConfig(config: CalDAVConfig): void {
    this.config = config;
  }
  
  /**
   * Get CalDAV client with authentication
   */
  private getCalDAVClient(): AxiosInstance {
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    return getCalDAVClient(this.config);
  }
  
  /**
   * Ensure config is set, parsing from accessToken if needed
   */
  private ensureConfig(accessToken: string, calendarId?: string): void {
    if (!this.config) {
      const { username, password, serverUrl } = parseCalDAVCredentials(accessToken);
      this.setConfig({
        serverUrl,
        username,
        password,
        calendarPath: calendarId,
      });
    } else if (calendarId) {
      this.config.calendarPath = calendarId;
    }
  }
  
  async listCalendars(accessToken: string): Promise<Calendar[]> {
    this.ensureConfig(accessToken);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    return await listCalendars(client, this.config);
  }
  
  async searchEvents(
    accessToken: string,
    options: EventSearchOptions
  ): Promise<CalendarEvent[]> {
    this.ensureConfig(accessToken, options.calendarId);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    return await searchEventsOp(client, this.config, calendars, options);
  }
  
  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarEvent> {
    this.ensureConfig(accessToken, calendarId);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    
    // Create a bound searchEvents function
    const searchEventsFn = async (opts: EventSearchOptions) => {
      return await searchEventsOp(client, this.config!, calendars, opts);
    };
    
    return await getEventOp(client, this.config, calendars, calendarId, eventId, searchEventsFn);
  }
  
  async createEvent(
    accessToken: string,
    options: CreateEventOptions,
    preserveUID?: string
  ): Promise<CalendarEvent> {
    this.ensureConfig(accessToken, options.calendarId);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    return await createEventOp(client, this.config, calendars, options, preserveUID);
  }
  
  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CreateEventOptions>
  ): Promise<CalendarEvent> {
    this.ensureConfig(accessToken, calendarId);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    
    // Create bound functions
    const getEventFn = async (calId: string, evtId: string) => {
      const searchEventsFn = async (opts: EventSearchOptions) => {
        return await searchEventsOp(client, this.config!, calendars, opts);
      };
      return await getEventOp(client, this.config!, calendars, calId, evtId, searchEventsFn);
    };
    
    const deleteEventFn = async (calId: string, evtId: string) => {
      return await deleteEventOp(client, this.config!, calId, evtId, getEventFn);
    };
    
    const createEventFn = async (opts: CreateEventOptions, uid?: string) => {
      return await createEventOp(client, this.config!, calendars, opts, uid);
    };
    
    return await updateEventOp(client, this.config, calendars, calendarId, eventId, updates, getEventFn, deleteEventFn, createEventFn);
  }
  
  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    this.ensureConfig(accessToken, calendarId);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    
    // Create bound getEvent function
    const getEventFn = async (calId: string, evtId: string) => {
      const searchEventsFn = async (opts: EventSearchOptions) => {
        return await searchEventsOp(client, this.config!, calendars, opts);
      };
      return await getEventOp(client, this.config!, calendars, calId, evtId, searchEventsFn);
    };
    
    return await deleteEventOp(client, this.config, calendarId, eventId, getEventFn);
  }
  
  async checkFreeBusy(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
    calendarIds?: string[]
  ): Promise<Array<{ calendarId: string; busy: Array<{ start: Date; end: Date }> }>> {
    this.ensureConfig(accessToken);
    if (!this.config) {
      throw new Error('CalDAV configuration not set');
    }
    const client = this.getCalDAVClient();
    const calendars = await this.listCalendars(accessToken);
    
    // Create bound searchEvents function
    const searchEventsFn = async (opts: EventSearchOptions) => {
      return await searchEventsOp(client, this.config!, calendars, opts);
    };
    
    return await checkFreeBusyOp(searchEventsFn, timeMin, timeMax, calendarIds);
  }
  
  async getAccountInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    this.ensureConfig(accessToken);
    let username: string;
    if (this.config) {
      username = this.config.username;
    } else {
      const parsed = parseCalDAVCredentials(accessToken);
      username = parsed.username;
    }
    return {
      email: username, // CalDAV username is often an email
      name: username.split('@')[0], // Extract name from email
    };
  }
}
