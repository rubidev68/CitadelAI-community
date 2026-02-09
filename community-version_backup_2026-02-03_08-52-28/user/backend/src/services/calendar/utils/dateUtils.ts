// Date utility functions for calendar blocks
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Extract date range from user message
 * Returns null if no specific range is mentioned
 */
export function extractDateRange(message: string): { start: Date; end: Date } | null {
  // Simple regex-based extraction (can be enhanced with LLM)
  const today = new Date();
  const thisWeek = {
    start: startOfWeek(today),
    end: endOfWeek(today),
  };
  
  if (message.match(/this\s+week/i)) {
    return thisWeek;
  }
  
  if (message.match(/next\s+week/i)) {
    return {
      start: addDays(thisWeek.start, 7),
      end: addDays(thisWeek.end, 7),
    };
  }
  
  // Detect past date ranges
  const pastMonthMatch = message.match(/(?:last|past|previous)\s+(\d+)?\s*month/i);
  if (pastMonthMatch) {
    const months = parseInt(pastMonthMatch[1] || '1', 10);
    return {
      start: addMonths(today, -months),
      end: today,
    };
  }
  
  // Detect "X months ago" pattern
  const monthsAgoMatch = message.match(/(\d+)\s+months?\s+ago/i);
  if (monthsAgoMatch) {
    const months = parseInt(monthsAgoMatch[1], 10);
    const startDate = addMonths(today, -months);
    return {
      start: startDate,
      end: addMonths(startDate, 1), // One month range
    };
  }
  
  // Detect "last year" or "past year"
  if (message.match(/(?:last|past)\s+year/i)) {
    return {
      start: addMonths(today, -12),
      end: today,
    };
  }
  
  // Detect requests for past events in general
  if (message.match(/(?:past|previous|old|historical|before|earlier)\s+events?/i)) {
    // Default to 3 months back when asking for past events
    return {
      start: addMonths(today, -3),
      end: today,
    };
  }
  
  return null;
}

/**
 * Check if the requested date range goes further back than the default range
 * Default range is 1 month before current date
 */
export function requiresExtendedPastRange(requestedStart: Date, defaultStart: Date): boolean {
  // If requested start is more than 1 day before default start, consider it extended
  const oneDayMs = 24 * 60 * 60 * 1000;
  return requestedStart.getTime() < (defaultStart.getTime() - oneDayMs);
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

export function extractSearchQuery(message: string): string | undefined {
  // Simple extraction - can be enhanced with LLM
  const match = message.match(/(?:about|regarding|for)\s+(.+?)(?:\s|$)/i);
  return match ? match[1] : undefined;
}
