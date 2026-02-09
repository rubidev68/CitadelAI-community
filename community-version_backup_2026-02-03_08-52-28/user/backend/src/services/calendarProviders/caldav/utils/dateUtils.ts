import { logger } from '@shared/utils';

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Parse time string (e.g., "9am", "14:30", "2:30pm") into hours and minutes
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  
  const normalized = timeStr.toLowerCase().trim();
  
  // Pattern 1: "9am", "9pm", "9 a.m.", "9 p.m."
  let match = normalized.match(/^(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const ampm = match[2].charAt(0);
    
    if (ampm === 'p') {
      if (hours !== 12) hours += 12;
    } else {
      if (hours === 12) hours = 0;
    }
    
    if (hours >= 0 && hours < 24) {
      logger.debug('Parsed time (pattern 1)', {
        hours,
        minutes: 0,
        original: timeStr,
        service: 'caldavProvider',
      });
      return { hours, minutes: 0 };
    }
  }
  
  // Pattern 2: "9:30am", "2:30pm", "9:30 a.m.", "2:30 p.m."
  match = normalized.match(/^(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].charAt(0);
    
    if (ampm === 'p') {
      if (hours !== 12) hours += 12;
    } else {
      if (hours === 12) hours = 0;
    }
    
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      logger.debug('Parsed time (pattern 2)', {
        hours,
        minutes,
        original: timeStr,
        service: 'caldavProvider',
      });
      return { hours, minutes };
    }
  }
  
  // Pattern 3: "21:30" - 24-hour format with colon
  match = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      logger.debug('Parsed time (pattern 3)', {
        hours,
        minutes,
        original: timeStr,
        service: 'caldavProvider',
      });
      return { hours, minutes };
    }
  }
  
  // Pattern 4: "21" - 24-hour format without colon
  match = normalized.match(/^(\d{1,2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = 0;
    
    if (hours >= 0 && hours < 24) {
      logger.debug('Parsed time (pattern 4)', {
        hours,
        minutes,
        original: timeStr,
        service: 'caldavProvider',
      });
      return { hours, minutes };
    }
  }
  
  logger.warn('Failed to parse time string', {
    timeStr,
    service: 'caldavProvider',
  });
  return null;
}

/**
 * Convert time string to datetime by combining with existing date
 * Preserves the timezone of the existing datetime
 */
export function timeStringToDateTime(timeStr: string, existingDateTime: string): string | null {
  const parsedTime = parseTimeString(timeStr);
  if (!parsedTime) {
    logger.debug('Failed to parse time string', {
      timeStr,
      service: 'caldavProvider',
    });
    return null;
  }
  
  // Parse existing datetime - handle both ISO format and iCalendar format
  // ISO: "2026-01-05T21:30:00Z" or "2026-01-05T21:30:00"
  // iCal: "20260105T213000Z" or "20260105T213000"
  let year: string, month: string, day: string;
  let isUTC = false;
  
  // Try ISO format first
  const isoMatch = existingDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z)?/);
  if (isoMatch) {
    year = isoMatch[1];
    month = isoMatch[2];
    day = isoMatch[3];
    isUTC = !!isoMatch[7]; // 'Z' suffix indicates UTC
  } else {
    // Try iCalendar format
    const icalMatch = existingDateTime.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
    if (icalMatch) {
      year = icalMatch[1];
      month = icalMatch[2];
      day = icalMatch[3];
      isUTC = !!icalMatch[7];
    } else {
      // Fallback to Date parsing
      const existingDate = new Date(existingDateTime);
      if (isNaN(existingDate.getTime())) {
        logger.debug('Invalid existing datetime', {
          existingDateTime,
          service: 'caldavProvider',
        });
        return null;
      }
      year = existingDate.getUTCFullYear().toString();
      month = String(existingDate.getUTCMonth() + 1).padStart(2, '0');
      day = String(existingDate.getUTCDate()).padStart(2, '0');
      isUTC = existingDateTime.endsWith('Z');
    }
  }
  
  // Format hours and minutes with leading zeros
  const hours = String(parsedTime.hours).padStart(2, '0');
  const minutes = String(parsedTime.minutes).padStart(2, '0');
  
  // Build new datetime string preserving timezone
  const newDateTime = `${year}-${month}-${day}T${hours}:${minutes}:00${isUTC ? 'Z' : ''}`;
  
  logger.debug('Parsing time update', {
    timeStr,
    parsedTime,
    existingDateTime,
    year,
    month,
    day,
    isUTC,
    newDateTime,
    service: 'caldavProvider',
  });
  
  return newDateTime;
}
