import { CreateEventOptions } from '../../types';
import { formatICalDate, formatICalDateTime, escapeICalText } from './icalFormatter';

/**
 * Build iCalendar string from CreateEventOptions
 */
export function buildICalEvent(eventId: string, options: CreateEventOptions): string {
  const lines: string[] = [];
  
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//CitadelAI//Calendar Block//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${eventId}`);
  lines.push(`DTSTAMP:${formatICalDateTime(new Date())}`);
  
  // Summary
  lines.push(`SUMMARY:${escapeICalText(options.summary)}`);
  
  // Description
  if (options.description) {
    lines.push(`DESCRIPTION:${escapeICalText(options.description)}`);
  }
  
  // Location
  if (options.location) {
    lines.push(`LOCATION:${escapeICalText(options.location)}`);
  }
  
  // Start time
  if (options.start.dateTime) {
    lines.push(`DTSTART${options.start.timeZone ? `;TZID=${options.start.timeZone}` : ''}:${formatICalDateTime(new Date(options.start.dateTime))}`);
  } else if (options.start.date) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(new Date(options.start.date))}`);
  }
  
  // End time
  if (options.end.dateTime) {
    lines.push(`DTEND${options.end.timeZone ? `;TZID=${options.end.timeZone}` : ''}:${formatICalDateTime(new Date(options.end.dateTime))}`);
  } else if (options.end.date) {
    lines.push(`DTEND;VALUE=DATE:${formatICalDate(new Date(options.end.date))}`);
  }
  
  // Attendees
  if (options.attendees) {
    for (const attendee of options.attendees) {
      const line = `ATTENDEE;CN=${escapeICalText(attendee.name || '')}:mailto:${attendee.email}`;
      lines.push(line);
    }
  }
  
  // Reminders
  if (options.reminders) {
    for (const reminder of (options.reminders.overrides || [])) {
      lines.push('BEGIN:VALARM');
      lines.push(`ACTION:${reminder.method === 'email' ? 'EMAIL' : 'DISPLAY'}`);
      lines.push(`TRIGGER:-PT${reminder.minutes}M`);
      lines.push('END:VALARM');
    }
  }
  
  // Recurrence
  if (options.recurrence && options.recurrence.length > 0) {
    for (const rrule of options.recurrence) {
      lines.push(`RRULE:${rrule}`);
    }
  }
  
  lines.push('STATUS:CONFIRMED');
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}
