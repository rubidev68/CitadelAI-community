import { CalendarEvent } from '../../calendarProviders/types';
import { logger } from '@shared/utils';

/**
 * Parse RRULE and return human-readable recurrence description
 */
export function formatRecurrenceRule(rrule: string): string {
  try {
    // Parse RRULE (e.g., "FREQ=DAILY;INTERVAL=1" or "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    const parts: Record<string, string> = {};
    rrule.split(';').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) {
        parts[key] = value;
      }
    });

    const freq = parts.FREQ?.toLowerCase();
    const interval = parseInt(parts.INTERVAL || '1', 10);
    const count = parts.COUNT ? parseInt(parts.COUNT, 10) : null;
    const until = parts.UNTIL ? new Date(parts.UNTIL.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) : null;
    const byday = parts.BYDAY?.split(',') || [];
    const bymonthday = parts.BYMONTHDAY;
    const bymonth = parts.BYMONTH;

    let description = '';

    // Frequency description
    if (freq === 'daily') {
      description = interval === 1 ? 'Daily' : `Every ${interval} days`;
    } else if (freq === 'weekly') {
      if (byday.length > 0) {
        const dayNames: Record<string, string> = {
          'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday', 'TH': 'Thursday',
          'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
        };
        const days = byday.map(d => dayNames[d] || d).join(', ');
        description = interval === 1 ? `Weekly on ${days}` : `Every ${interval} weeks on ${days}`;
      } else {
        description = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
      }
    } else if (freq === 'monthly') {
      if (bymonthday) {
        description = interval === 1 
          ? `Monthly on day ${bymonthday}` 
          : `Every ${interval} months on day ${bymonthday}`;
      } else if (byday.length > 0) {
        const dayParts = byday[0].match(/([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)/);
        if (dayParts) {
          const weekNum = dayParts[1] || '1';
          const dayName = dayParts[2];
          const dayNames: Record<string, string> = {
            'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday', 'TH': 'Thursday',
            'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
          };
          const ordinal = weekNum === '-1' ? 'last' : 
                         weekNum === '1' ? 'first' :
                         weekNum === '2' ? 'second' :
                         weekNum === '3' ? 'third' :
                         weekNum === '4' ? 'fourth' : `${weekNum}th`;
          description = interval === 1
            ? `Monthly on the ${ordinal} ${dayNames[dayName] || dayName}`
            : `Every ${interval} months on the ${ordinal} ${dayNames[dayName] || dayName}`;
        } else {
          description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
        }
      } else {
        description = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      }
    } else if (freq === 'yearly') {
      if (bymonth && bymonthday) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const month = monthNames[parseInt(bymonth, 10) - 1] || `Month ${bymonth}`;
        description = interval === 1
          ? `Yearly on ${month} ${bymonthday}`
          : `Every ${interval} years on ${month} ${bymonthday}`;
      } else {
        description = interval === 1 ? 'Yearly' : `Every ${interval} years`;
      }
    } else {
      description = rrule; // Fallback to raw RRULE
    }

    // Add end condition
    if (count) {
      description += ` (${count} occurrences)`;
    } else if (until) {
      description += ` (until ${until.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })})`;
    }

    return description;
  } catch (error) {
    logger.error('Error parsing RRULE', error instanceof Error ? error : undefined, {
      rrule,
      service: 'calendarBlockExecutionService',
    });
    return `Recurring (${rrule})`;
  }
}

/**
 * Check if an event spans multiple days
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  if (event.start.date && event.end.date) {
    // All-day event
    const startDate = new Date(event.start.date + 'T00:00:00');
    const endDate = new Date(event.end.date + 'T00:00:00');
    // End date is exclusive in iCalendar, so subtract 1 day for comparison
    endDate.setDate(endDate.getDate() - 1);
    return startDate.getTime() !== endDate.getTime();
  } else if (event.start.dateTime && event.end.dateTime) {
    // Timed event
    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 1;
  }
  return false;
}

/**
 * Format event for LLM context
 * @param event - Calendar event to format
 * @param userTimezone - Optional IANA timezone string (e.g., 'America/New_York', 'Europe/Paris')
 */
export function formatEventForContext(event: CalendarEvent, userTimezone?: string): string {
  let formatted = `Event: ${event.summary}\n`;
  
  const isAllDay = !!(event.start.date && event.end.date);
  const isMultiDay = isMultiDayEvent(event);
  
  // Format start time
  if (event.start.dateTime) {
    const startDate = new Date(event.start.dateTime);
    let startFormatted: string;
    
    if (userTimezone) {
      // Convert to user's timezone
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        startFormatted = formatter.format(startDate);
      } catch {
        // Fallback to locale string if timezone conversion fails
        startFormatted = startDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } else {
      // Use event's timezone or default formatting
      startFormatted = startDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: event.start.timeZone || undefined,
      });
    }
    
    formatted += `Start: ${startFormatted}`;
    if (event.start.timeZone && !userTimezone) {
      formatted += ` (${event.start.timeZone})`;
    }
    formatted += '\n';
  } else if (event.start.date) {
    // All-day event
    const startDate = new Date(event.start.date + 'T00:00:00');
    let startFormatted = startDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    if (isMultiDay) {
      // Multi-day all-day event - show date range
      const endDate = new Date(event.end.date + 'T00:00:00');
      endDate.setDate(endDate.getDate() - 1); // End date is exclusive
      const endFormatted = endDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // If same month, only show day for end date
      if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
        formatted += `Date: ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric' })} (all-day, multi-day)\n`;
      } else {
        formatted += `Date: ${startFormatted} - ${endFormatted} (all-day, multi-day)\n`;
      }
    } else {
      formatted += `Date: ${startFormatted} (all-day)\n`;
    }
  }
  
  // Format end time (only for timed events, or if not already shown for multi-day all-day)
  if (event.end.dateTime && event.start.dateTime && !isAllDay) {
    const endDate = new Date(event.end.dateTime);
    const startDate = new Date(event.start.dateTime);
    let endFormatted: string;
    
    if (userTimezone) {
      // Convert to user's timezone
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        endFormatted = formatter.format(endDate);
      } catch {
        // Fallback to locale string if timezone conversion fails
        endFormatted = endDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      }
    } else {
      // Use event's timezone or default formatting
      endFormatted = endDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: event.end.timeZone || undefined,
      });
    }
    
    // For multi-day timed events, show date range
    if (isMultiDay) {
      let startDateOnly: string;
      let endDateOnly: string;
      
      if (userTimezone) {
        try {
          startDateOnly = new Intl.DateTimeFormat('en-US', { 
            timeZone: userTimezone, 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }).format(startDate);
          endDateOnly = new Intl.DateTimeFormat('en-US', { 
            timeZone: userTimezone, 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }).format(endDate);
        } catch {
          startDateOnly = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          endDateOnly = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      } else {
        startDateOnly = startDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: event.start.timeZone || undefined
        });
        endDateOnly = endDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          timeZone: event.end.timeZone || undefined
        });
      }
      
      formatted += `Date Range: ${startDateOnly} - ${endDateOnly}\n`;
      
      // Format times
      let startTime: string;
      let endTime: string;
      try {
        if (userTimezone) {
          startTime = startDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: userTimezone 
          });
          endTime = endDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: userTimezone 
          });
        } else {
          startTime = startDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: event.start.timeZone || undefined 
          });
          endTime = endDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true, 
            timeZone: event.end.timeZone || undefined 
          });
        }
        formatted += `Time: ${startTime} - ${endTime}\n`;
      } catch {
        // Fallback if time formatting fails
        formatted += `Time: ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}\n`;
      }
    } else {
      formatted += `End: ${endFormatted}`;
      if (event.end.timeZone && !userTimezone) {
        formatted += ` (${event.end.timeZone})`;
      }
      formatted += '\n';
    }
  }
  
  // Show recurrence pattern if present
  if (event.recurrence && event.recurrence.length > 0) {
    const recurrenceDescriptions = event.recurrence.map((rrule: string) => formatRecurrenceRule(rrule));
    formatted += `Recurrence: ${recurrenceDescriptions.join('; ')}\n`;
  }
  
  if (event.location) {
    formatted += `Location: ${event.location}\n`;
  }
  if (event.attendees && event.attendees.length > 0) {
    formatted += `Attendees: ${event.attendees.map((a: { email: string }) => a.email).join(', ')}\n`;
  }
  if (event.description) {
    formatted += `\n${event.description}\n`;
  }
  return formatted;
}
