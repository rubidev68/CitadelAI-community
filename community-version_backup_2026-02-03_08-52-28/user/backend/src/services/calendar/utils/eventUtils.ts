// Event utility functions for calendar blocks

// Internal helper for extractEventDetails
function parseDateTime(dateTimeStr: string): { start: Date; end: Date } | undefined {
  // Legacy function - kept for backward compatibility
  const parsed = parseNaturalLanguageDateTime(dateTimeStr);
  if (!parsed || !parsed.dateTime) {
    return undefined;
  }
  
  const start = new Date(parsed.dateTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour
  
  return { start, end };
}

export function extractEventDetails(
  message: string,
  template?: { title?: string; description?: string; location?: string; variables?: string[] }
): {
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string; name?: string }>;
  recurrence?: string[];
} {
  // Extract title
  const titleMatch = message.match(/(?:create|schedule|add)\s+(?:event|meeting)\s+(?:called|titled|named)?\s*['"]?([^'"]+)['"]?/i);
  const summary = titleMatch ? titleMatch[1] : template?.title;
  
  // Extract date/time (simplified - would need proper date parsing)
  const dateTimeMatch = message.match(/(?:on|at)\s+([^,]+)/i);
  const dateTime = dateTimeMatch ? parseDateTime(dateTimeMatch[1]) : undefined;
  
  // Extract attendees
  const attendeeMatches = message.match(/(?:with|invite)\s+([^\s]+@[^\s]+)/gi);
  const attendees = attendeeMatches?.map(match => {
    const emailMatch = match.match(/([^\s]+@[^\s]+)/);
    return emailMatch ? { email: emailMatch[1] } : undefined;
  }).filter(Boolean) as Array<{ email: string }> | undefined;
  
  return {
    summary,
    start: dateTime ? { dateTime: dateTime.start.toISOString(), timeZone: 'UTC' } : undefined,
    end: dateTime ? { dateTime: dateTime.end.toISOString(), timeZone: 'UTC' } : undefined,
    attendees,
  };
}

/**
 * Parse natural language date/time string into calendar event format
 * Examples: "next monday at 9am", "tomorrow at 2pm", "2025-01-20 at 14:30", "2025-12-22T09:00:00Z"
 * @param dateTimeStr - Date/time string (can be ISO 8601 or natural language)
 * @param referenceDate - Optional reference date for relative dates (defaults to current date)
 */
export function parseNaturalLanguageDateTime(
  dateTimeStr: string,
  referenceDate?: Date
): { dateTime?: string; date?: string; timeZone?: string } | null {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') {
    return null;
  }
  
  // Check if it's already an ISO 8601 date string
  const isoMatch = dateTimeStr.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)$/);
  if (isoMatch) {
    // Already in ISO format, return as-is
    return {
      dateTime: dateTimeStr,
      timeZone: dateTimeStr.includes('Z') ? 'UTC' : undefined,
    };
  }
  
  const normalized = dateTimeStr.toLowerCase().trim();
  const now = referenceDate || new Date();
  let targetDate = new Date(now);
  let hasTime = false;
  let hours = 0;
  let minutes = 0;
  
  // Parse relative dates
  if (normalized.includes('today')) {
    targetDate = new Date(now);
  } else if (normalized.includes('tomorrow')) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (normalized.includes('next week')) {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (normalized.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)) {
    const dayMatch = normalized.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week
      }
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
    }
  } else if (normalized.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)) {
    const dayMatch = normalized.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
      const currentDay = now.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) {
        daysToAdd += 7; // Next week
      }
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysToAdd);
    }
  } else {
    // Try to parse as ISO date or other formats
    const isoMatch = normalized.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      targetDate = new Date(isoMatch[1]);
      if (isNaN(targetDate.getTime())) {
        return null;
      }
    } else {
      // Try to parse as relative day (e.g., "in 3 days")
      const daysMatch = normalized.match(/in\s+(\d+)\s+days?/i);
      if (daysMatch) {
        const days = parseInt(daysMatch[1], 10);
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + days);
      } else {
        // Default to today if we can't parse the date
        targetDate = new Date(now);
      }
    }
  }
  
  // Parse time
  const timePatterns = [
    /(\d{1,2})\s*(?:a\.?m\.?|am)/i, // "9am", "9 a.m.", "9am"
    /(\d{1,2})\s*(?:p\.?m\.?|pm)/i, // "9pm", "9 p.m.", "9pm"
    /(\d{1,2}):(\d{2})\s*(?:a\.?m\.?|am)/i, // "9:30am", "9:30 a.m."
    /(\d{1,2}):(\d{2})\s*(?:p\.?m\.?|pm)/i, // "9:30pm", "9:30 p.m."
    /(\d{1,2}):(\d{2})/i, // "14:30", "9:30"
    /at\s+(\d{1,2})(?::(\d{2}))?\s*(?:a\.?m\.?|am|p\.?m\.?|pm)?/i, // "at 9", "at 9am", "at 9:30pm"
  ];
  
  for (const pattern of timePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      hasTime = true;
      let parsedHours = parseInt(match[1], 10);
      minutes = match[2] ? parseInt(match[2], 10) : 0;
      
      // Handle AM/PM
      if (normalized.includes('pm') || normalized.includes('p.m')) {
        if (parsedHours !== 12) {
          parsedHours += 12;
        }
      } else if (normalized.includes('am') || normalized.includes('a.m')) {
        if (parsedHours === 12) {
          parsedHours = 0;
        }
      } else {
        // 24-hour format assumed if no AM/PM
        // If hour is 1-12 and no AM/PM specified, assume 24-hour format
      }
      
      hours = parsedHours;
      break;
    }
  }
  
  // Set time on target date
  if (hasTime) {
    targetDate.setHours(hours, minutes, 0, 0);
  } else {
    // Default to 9 AM if no time specified
    targetDate.setHours(9, 0, 0, 0);
  }
  
  // Format as ISO string with timezone
  const isoString = targetDate.toISOString();
  
  return {
    dateTime: isoString,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

/**
 * Calculate end time from start time with duration in minutes
 */
export function calculateEndTime(
  start: { dateTime?: string; date?: string; timeZone?: string },
  durationMinutes: number = 60
): { dateTime?: string; date?: string; timeZone?: string } {
  if (start.date) {
    // All-day event - end date is start date + 1 day
    const startDate = new Date(start.date + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    return {
      date: endDate.toISOString().split('T')[0],
      timeZone: start.timeZone,
    };
  }
  
  if (start.dateTime) {
    const startDate = new Date(start.dateTime);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    return {
      dateTime: endDate.toISOString(),
      timeZone: start.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    };
  }
  
  throw new Error('Invalid start time format for calculating end time');
}


export function determineAction(
  message: string,
  allowedActions: ('create' | 'update' | 'delete')[]
): 'create' | 'update' | 'delete' {
  const lowerMessage = message.toLowerCase();
  
  if (allowedActions.includes('delete') && (lowerMessage.includes('delete') || lowerMessage.includes('cancel'))) {
    return 'delete';
  }
  
  if (allowedActions.includes('update') && (lowerMessage.includes('update') || lowerMessage.includes('change') || lowerMessage.includes('modify'))) {
    return 'update';
  }
  
  return 'create'; // Default
}

export function extractEventId(message: string): string | undefined {
  // Extract event ID from message - look for patterns like "f.norbert event", "the meeting", etc.
  // Try to find event identifiers mentioned in the message
  const patterns = [
    /(?:update|change|modify|delete|remove)\s+([a-zA-Z0-9._\s-]+?)\s+event/i,
    /([a-zA-Z0-9._\s-]+?)\s+event/i,
    /event\s+(?:id\s+)?([a-zA-Z0-9_-]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return undefined;
}
