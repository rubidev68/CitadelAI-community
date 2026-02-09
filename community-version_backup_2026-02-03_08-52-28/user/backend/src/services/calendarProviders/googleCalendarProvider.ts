import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { CalendarProvider, CalendarEvent, Calendar, EventSearchOptions, CreateEventOptions } from './types';
import type { GoogleCalendarEvent } from '@shared/types';
import { config } from '../../config';

export class GoogleCalendarProvider implements CalendarProvider {
  getProviderId(): 'google_calendar' {
    return 'google_calendar';
  }
  
  getProviderName(): string {
    return 'Google Calendar';
  }
  
  requiresOAuth(): boolean {
    return true;
  }
  
  private getCalendarClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CALENDAR_CLIENT_ID || config.GOOGLE_DRIVE_CLIENT_ID,
      config.GOOGLE_CALENDAR_CLIENT_SECRET || config.GOOGLE_DRIVE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }
  
  async listCalendars(accessToken: string): Promise<Calendar[]> {
    const calendar = this.getCalendarClient(accessToken);
    const response = await calendar.calendarList.list();
    
    return (response.data.items || []).map(item => ({
      id: item.id!,
      name: item.summary || 'Untitled Calendar',
      description: item.description || undefined,
      primary: item.primary || false,
      accessRole: (item.accessRole as 'owner' | 'writer' | 'reader' | 'freeBusyReader') || 'reader',
    }));
  }
  
  async searchEvents(
    accessToken: string,
    options: EventSearchOptions
  ): Promise<CalendarEvent[]> {
    const calendar = this.getCalendarClient(accessToken);
    const calendarId = options.calendarId || 'primary';
    
    interface CalendarListParams {
      calendarId: string;
      q?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      singleEvents?: boolean;
      orderBy?: 'startTime' | 'updated';
    }
    const params: CalendarListParams = {
      calendarId,
      timeMin: options.timeMin?.toISOString(),
      timeMax: options.timeMax?.toISOString(),
      maxResults: options.maxResults || 50,
      singleEvents: options.singleEvents !== false,
      orderBy: options.orderBy || 'startTime',
    };
    
    if (options.query) {
      params.q = options.query;
    }
    
    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    
    return events.map(event => this.mapGoogleEventToCalendarEvent(event, calendarId));
  }
  
  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<CalendarEvent> {
    const calendar = this.getCalendarClient(accessToken);
    const response = await calendar.events.get({
      calendarId,
      eventId,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data, calendarId);
  }
  
  async createEvent(
    accessToken: string,
    options: CreateEventOptions
  ): Promise<CalendarEvent> {
    const calendar = this.getCalendarClient(accessToken);
    const calendarId = options.calendarId || 'primary';
    
    const event: GoogleCalendarEvent = {
      summary: options.summary,
      description: options.description,
      location: options.location,
      start: options.start,
      end: options.end,
    };
    
    if (options.attendees && options.attendees.length > 0) {
      event.attendees = options.attendees.map(att => ({
        email: att.email,
        displayName: att.name,
      }));
    }
    
    if (options.reminders) {
      event.reminders = {
        useDefault: options.reminders.useDefault,
        overrides: options.reminders.overrides?.map(rem => ({
          method: rem.method,
          minutes: rem.minutes,
        })),
      };
    }
    
    if (options.recurrence && options.recurrence.length > 0) {
      event.recurrence = options.recurrence;
    }
    
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data, calendarId);
  }
  
  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CreateEventOptions>
  ): Promise<CalendarEvent> {
    const calendar = this.getCalendarClient(accessToken);
    
    // Get existing event
    const existing = await calendar.events.get({ calendarId, eventId });
    const event = existing.data;
    
    // Apply updates
    if (updates.summary) event.summary = updates.summary;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.start) event.start = updates.start;
    if (updates.end) event.end = updates.end;
    if (updates.attendees) {
      event.attendees = updates.attendees.map(att => ({
        email: att.email,
        displayName: att.name,
      }));
    }
    if (updates.reminders) {
      event.reminders = {
        useDefault: updates.reminders.useDefault,
        overrides: updates.reminders.overrides?.map(rem => ({
          method: rem.method,
          minutes: rem.minutes,
        })),
      };
    }
    
    const response = await calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });
    
    return this.mapGoogleEventToCalendarEvent(response.data, calendarId);
  }
  
  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void> {
    const calendar = this.getCalendarClient(accessToken);
    await calendar.events.delete({
      calendarId,
      eventId,
    });
  }
  
  async checkFreeBusy(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
    calendarIds?: string[]
  ): Promise<Array<{ calendarId: string; busy: Array<{ start: Date; end: Date }> }>> {
    const calendar = this.getCalendarClient(accessToken);
    
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: (calendarIds || ['primary']).map(id => ({ id })),
      },
    });
    
    return Object.entries(response.data.calendars || {}).map(([calendarId, calendar]) => ({
      calendarId,
      busy: (calendar.busy || []).map(busy => ({
        start: new Date(busy.start!),
        end: new Date(busy.end!),
      })),
    }));
  }
  
  async getAccountInfo(accessToken: string): Promise<{ email: string; name?: string }> {
    const calendar = this.getCalendarClient(accessToken);
    const response = await calendar.calendarList.get({ calendarId: 'primary' });
    return {
      email: response.data.id || '',
      name: response.data.summary || undefined,
    };
  }
  
  private mapGoogleEventToCalendarEvent(event: { id?: string | null; summary?: string | null; description?: string | null; location?: string | null; start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null; end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null; attendees?: Array<{ email?: string | null; displayName?: string | null; responseStatus?: string | null }> | null; organizer?: { email?: string | null; displayName?: string | null } | null; recurrence?: string[] | null; reminders?: { useDefault?: boolean | null; overrides?: Array<{ method?: string | null; minutes?: number | null }> | null } | null; status?: string | null; created?: string | null; updated?: string | null; htmlLink?: string | null } | null, calendarId: string): CalendarEvent {
    if (!event || !event.id) {
      throw new Error('Invalid event: event or event.id is null');
    }
    return {
      id: event.id,
      calendarId,
      summary: event.summary || '',
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
        timeZone: event.start?.timeZone || undefined,
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
        timeZone: event.end?.timeZone || undefined,
      },
      attendees: event.attendees?.filter(att => att.email).map((att: { email?: string | null; displayName?: string | null; responseStatus?: string | null }) => ({
        email: att.email!,
        name: att.displayName || undefined,
        responseStatus: (att.responseStatus as 'accepted' | 'declined' | 'tentative' | 'needsAction') || undefined,
      })),
      organizer: event.organizer && event.organizer.email ? {
        email: event.organizer.email,
        name: event.organizer.displayName || undefined,
      } : undefined,
      recurrence: event.recurrence || undefined,
      reminders: event.reminders ? {
        useDefault: event.reminders.useDefault || undefined,
        overrides: event.reminders.overrides?.filter(ovr => ovr.method && ovr.minutes).map(ovr => ({
          method: (ovr.method as 'email' | 'popup') || 'email',
          minutes: ovr.minutes || 0,
        })) || undefined,
      } : undefined,
      status: (event.status as 'confirmed' | 'tentative' | 'cancelled') || undefined,
      created: event.created ? new Date(event.created) : undefined,
      updated: event.updated ? new Date(event.updated) : undefined,
      htmlLink: event.htmlLink || undefined,
    };
  }
}
