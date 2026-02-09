/**
 * Date/Time Utilities
 * Common date and time operations
 */

/**
 * Format date to ISO string
 */
export function toISOString(date: Date | string | number): string {
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === 'string') {
    return new Date(date).toISOString();
  }
  return new Date(date).toISOString();
}

/**
 * Get current ISO timestamp
 */
export function getCurrentISOString(): string {
  return new Date().toISOString();
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = then.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  if (absDiff < 60000) {
    return isPast ? 'just now' : 'in a moment';
  }
  if (absDiff < 3600000) {
    const mins = Math.abs(diffMinutes);
    return isPast ? `${mins} minute${mins !== 1 ? 's' : ''} ago` : `in ${mins} minute${mins !== 1 ? 's' : ''}`;
  }
  if (absDiff < 86400000) {
    const hours = Math.abs(diffHours);
    return isPast ? `${hours} hour${hours !== 1 ? 's' : ''} ago` : `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  const days = Math.abs(diffDays);
  return isPast ? `${days} day${days !== 1 ? 's' : ''} ago` : `in ${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Parse date string safely
 */
export function parseDate(dateString: string): Date | null {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Check if date is valid
 */
export function isValidDate(date: Date | string | number): boolean {
  const d = date instanceof Date ? date : new Date(date);
  return !isNaN(d.getTime());
}
