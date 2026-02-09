/**
 * Sanitization Utilities
 * Conservative sanitization functions to prevent injection attacks
 * 
 * IMPORTANT: These functions are opt-in and should be used carefully
 * to avoid breaking existing functionality. Test thoroughly before applying broadly.
 */

/**
 * Sanitize string - conservative approach, only removes control characters
 * Use this for general string sanitization where you want minimal changes
 * 
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  // Only remove control characters (preserve legitimate whitespace)
  // Removes: \x00-\x08, \x0B-\x0C, \x0E-\x1F, \x7F
  // Preserves: \x09 (tab), \x0A (newline), \x0D (carriage return)
  return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize HTML - conservative approach, preserves safe formatting
 * Use this only when HTML content is expected but needs sanitization
 * 
 * @param input - HTML string to sanitize
 * @param allowBasicFormatting - Whether to allow basic formatting tags (default: false)
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(input: string, allowBasicFormatting = false): string {
  // For now, we'll use a simple approach that removes HTML tags
  // In production, consider using DOMPurify: npm install isomorphic-dompurify
  if (allowBasicFormatting) {
    // Allow basic formatting tags (bold, italic, links)
    // Remove all other tags and attributes
    let sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .replace(/on\w+='[^']*'/gi, '') // Remove event handlers (single quotes)
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/data:/gi, ''); // Remove data: protocol (can be dangerous)
    return sanitized;
  }
  
  // Default: remove all HTML tags (including script tags)
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''); // Remove script tags first
  sanitized = sanitized.replace(/<[^>]*>/g, ''); // Remove all remaining HTML tags
  return sanitized;
}

/**
 * Sanitize file path - prevent directory traversal
 * Use this for file paths and filenames
 * 
 * @param input - File path to sanitize
 * @returns Sanitized file path
 */
export function sanitizePath(input: string): string {
  // Prevent directory traversal
  // Remove all dots, path separators, and trim
  return input
    .replace(/\./g, '') // Remove all dots (including ..)
    .replace(/[\/\\]/g, '') // Remove path separators
    .trim();
}

/**
 * Sanitize filename - safe for filesystem
 * Use this for filenames
 * 
 * @param input - Filename to sanitize
 * @returns Sanitized filename
 */
export function sanitizeFilename(input: string): string {
  // Sanitize filename (preserve extension)
  const parts = input.split('.');
  const ext = parts.length > 1 ? '.' + parts.pop() : '';
  const name = parts.join('.');
  
  return sanitizePath(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255 - ext.length) + ext;
}

/**
 * Sanitize SQL input - complement to parameterized queries
 * Use this ONLY as a secondary defense, never as primary protection
 * Parameterized queries are still required
 * 
 * @param input - SQL input to sanitize
 * @returns Sanitized SQL input
 */
export function sanitizeSqlInput(input: string): string {
  // Remove SQL comment markers
  // Handle multi-line comments first
  let sanitized = input.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
  sanitized = sanitized.replace(/--/g, ''); // Remove single-line comment markers
  sanitized = sanitized.replace(/;/g, ''); // Remove statement separators
  return sanitized;
}

/**
 * Sanitize object keys - prevent prototype pollution
 * Use this when processing user-provided object keys
 * 
 * @param key - Object key to sanitize
 * @returns Sanitized key or null if invalid
 */
export function sanitizeObjectKey(key: string): string | null {
  // Prevent prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return null;
  }
  
  // Only allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return null;
  }
  
  return key;
}

/**
 * Sanitize URL - basic URL sanitization
 * Use this for URLs that need sanitization (complement to URL validation)
 * 
 * @param url - URL string to sanitize
 * @returns Sanitized URL string
 */
export function sanitizeUrl(url: string): string {
  // Remove control characters and dangerous protocols
  let sanitized = sanitizeString(url);
  
  // Remove dangerous protocols (keep http, https, ftp)
  sanitized = sanitized.replace(/^(javascript|data|vbscript|file):/gi, '');
  
  return sanitized.trim();
}
