import axios, { AxiosInstance } from 'axios';
import { CalDAVConfig } from '../types';
import { logger } from '@shared/utils';

/**
 * Get CalDAV client with authentication
 */
export function getCalDAVClient(config: CalDAVConfig): AxiosInstance {
  // Skip SSL certificate validation for self-hosted CalDAV servers
  const https = require('https');
  
  // Check if serverUrl is already a full calendar endpoint (ends with /calendars/username/)
  // If so, use it as-is; otherwise, it's a base server URL
  const baseURL = config.serverUrl.endsWith('/') 
    ? config.serverUrl 
    : `${config.serverUrl}/`;
  
  return axios.create({
    baseURL: baseURL,
    auth: {
      username: config.username,
      password: config.password,
    },
    headers: {
      'Content-Type': 'application/xml',
      'Depth': '1',
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Skip SSL certificate validation
    }),
  });
}

/**
 * Get calendar path
 * Returns empty string if serverUrl is already a full calendar endpoint
 */
export function getCalendarPath(config: CalDAVConfig, calendarId?: string): string {
  // Extract base path from serverUrl
  let baseUrlPath: string;
  try {
    const baseUrlObj = new URL(config.serverUrl);
    baseUrlPath = baseUrlObj.pathname;
  } catch {
    // If URL parsing fails, treat as path
    baseUrlPath = config.serverUrl.startsWith('http') 
      ? config.serverUrl.replace(/^https?:\/\/[^\/]+/, '')
      : config.serverUrl;
  }
  
  // Normalize base path (remove trailing slash for comparison)
  baseUrlPath = baseUrlPath.replace(/\/$/, '');
  
  // If calendarId is provided and is a full path, extract relative part
  if (calendarId && calendarId !== 'primary' && calendarId.startsWith('/')) {
    // calendarId is a full path like /remote.php/dav/calendars/anatole.cnd/personal/
    // Extract the relative part by removing the base path
    let relativePath = calendarId.replace(/\/$/, ''); // Remove trailing slash
    
    logger.debug('Extracting relative path from calendarId', {
      calendarId,
      baseUrlPath,
      relativePathBefore: relativePath,
      service: 'caldavProvider',
    });
    
    // Remove base path prefix if present
    if (relativePath.startsWith(baseUrlPath)) {
      relativePath = relativePath.substring(baseUrlPath.length);
      relativePath = relativePath.replace(/^\//, ''); // Remove leading slash
      logger.debug('Extracted relative path (prefix match)', {
        relativePath,
        service: 'caldavProvider',
      });
    } else {
      // Try to find common prefix by comparing path segments
      const baseParts = baseUrlPath.split('/').filter(p => p);
      const calParts = relativePath.split('/').filter(p => p);
      
      let matchCount = 0;
      for (let i = 0; i < Math.min(baseParts.length, calParts.length); i++) {
        if (baseParts[i] === calParts[i]) {
          matchCount++;
        } else {
          break;
        }
      }
      
      if (matchCount > 0 && matchCount < calParts.length) {
        relativePath = calParts.slice(matchCount).join('/');
        logger.debug('Extracted relative path (segment match)', {
          relativePath,
          service: 'caldavProvider',
        });
      } else {
        // If no match found, return the calendarId as-is (fallback)
        logger.warn('Could not extract relative path, using calendarId as-is', {
          calendarId,
          service: 'caldavProvider',
        });
        return calendarId;
      }
    }
    
    // Return relative path with trailing slash
    return relativePath ? `${relativePath}/` : '';
  }
  
  // Check if serverUrl is already a full calendar endpoint
  const isFullCalendarUrl = baseUrlPath.includes('/calendars/') && 
                            !baseUrlPath.includes('{username}') &&
                            (baseUrlPath.endsWith('/') || baseUrlPath.match(/\/calendars\/[^\/]+\/?$/));
  
  if (isFullCalendarUrl) {
    // If serverUrl is already a calendar endpoint, return empty or just the calendar name
    if (calendarId && calendarId !== 'primary') {
      // calendarId is just a calendar name, append it
      return `${calendarId}/`;
    }
    // Return empty string to use the baseURL as-is
    return '';
  }
  
  // serverUrl is a base server URL, construct the calendar path
  if (calendarId && calendarId !== 'primary') {
    // If calendarId doesn't start with /, it's a relative path
    if (!calendarId.startsWith('/')) {
      return `${calendarId}/`;
    }
    // It's already a full path, extract relative part
    return calendarId;
  }
  
  // Default calendar path - replace {username} template if present
  if (config.calendarPath) {
    return config.calendarPath.replace('{username}', config.username);
  }
  
  // Standard CalDAV path structure
  return `/calendars/${config.username}/`;
}
