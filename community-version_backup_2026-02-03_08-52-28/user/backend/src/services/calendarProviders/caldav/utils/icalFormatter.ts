/**
 * Helper functions for iCalendar formatting
 */

/**
 * Format date as iCalendar date (YYYYMMDD)
 */
export function formatICalDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/**
 * Format date as iCalendar datetime (YYYYMMDDTHHMMSSZ)
 */
export function formatICalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Escape text for iCalendar format
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate a unique UID for iCalendar events
 */
export function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@citadelai.app`;
}
