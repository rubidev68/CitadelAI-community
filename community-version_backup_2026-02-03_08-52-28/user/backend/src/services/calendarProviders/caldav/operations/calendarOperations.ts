import { AxiosInstance } from 'axios';
import { Calendar } from '../../types';
import { CalDAVConfig } from '../types';
import { logger } from '@shared/utils';
import { getCalendarPath } from '../utils/clientUtils';

/**
 * List all available calendars
 */
export async function listCalendars(
  client: AxiosInstance,
  config: CalDAVConfig
): Promise<Calendar[]> {
  const calendars: Calendar[] = [];
  
  // Discover calendars using PROPFIND
  try {
    const response = await client.request({
      method: 'PROPFIND',
      url: '/',
      headers: {
        'Depth': '1',
      },
      data: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <c:calendar-description />
    <d:resourcetype />
    <c:supported-calendar-component-set />
  </d:prop>
</d:propfind>`,
    });
    
    // Parse XML multistatus response to find calendar collections
    const xmlData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    // Extract all response blocks
    let responseMatches = xmlData.match(/<d:response[^>]*>([\s\S]*?)<\/d:response>/g);
    
    if (!responseMatches || responseMatches.length === 0) {
      // Try without namespace
      const altMatches = xmlData.match(/<response[^>]*>([\s\S]*?)<\/response>/g);
      if (altMatches) {
        responseMatches = altMatches;
      }
    }
    
    if (responseMatches && responseMatches.length > 0) {
      for (const responseBlock of responseMatches) {
        try {
          // Extract href (calendar path)
          const hrefMatch = responseBlock.match(/<d:href>(.*?)<\/d:href>/i) || responseBlock.match(/<href>(.*?)<\/href>/i);
          if (!hrefMatch) continue;
          
          const href = decodeURIComponent(hrefMatch[1]);
          
          // Check if it's a calendar collection (has <c:calendar> in resourcetype)
          const resourceTypeMatch = responseBlock.match(/<d:resourcetype>([\s\S]*?)<\/d:resourcetype>/i) || 
                                     responseBlock.match(/<resourcetype>([\s\S]*?)<\/resourcetype>/i);
          const isCalendar = resourceTypeMatch && (
            resourceTypeMatch[1].includes('<c:calendar') || 
            resourceTypeMatch[1].includes('<calendar') ||
            resourceTypeMatch[1].includes('calendar')
          );
          
          if (!isCalendar) {
            continue;
          }
          
          // Extract display name
          const displayNameMatch = responseBlock.match(/<d:displayname>(.*?)<\/d:displayname>/i) || 
                                  responseBlock.match(/<displayname>(.*?)<\/displayname>/i);
          const name = displayNameMatch ? decodeURIComponent(displayNameMatch[1]) : href.split('/').pop() || 'Calendar';
          
          // Extract calendar description
          const descMatch = responseBlock.match(/<c:calendar-description>(.*?)<\/c:calendar-description>/i) ||
                           responseBlock.match(/<calendar-description>(.*?)<\/calendar-description>/i);
          const description = descMatch ? decodeURIComponent(descMatch[1]) : undefined;
          
          // Extract supported calendar components
          // Look for both self-closing and content-based component set tags
          const componentSetMatch = responseBlock.match(/<c:supported-calendar-component-set[^>]*>([\s\S]*?)<\/c:supported-calendar-component-set>/i) ||
                                    responseBlock.match(/<supported-calendar-component-set[^>]*>([\s\S]*?)<\/supported-calendar-component-set>/i) ||
                                    responseBlock.match(/<c:supported-calendar-component-set[^>]*\/>/i) ||
                                    responseBlock.match(/<supported-calendar-component-set[^>]*\/>/i);
          
          let supportsVEVENT = false;
          let supportsVTODO = false;
          let hasComponentSet = false;
          
          if (componentSetMatch) {
            hasComponentSet = true;
            const componentSetContent = componentSetMatch[1] || '';
            
            // Check if it's an empty/self-closing tag (VTODO-only calendars often have empty component sets)
            if (componentSetMatch[0].includes('/>') || componentSetContent.trim() === '') {
              // Empty component set - this typically means VTODO-only
              supportsVEVENT = false;
              supportsVTODO = true;
              logger.debug('Empty component set detected (likely VTODO-only)', {
                name,
                href,
                service: 'caldavProvider',
              });
            } else {
              // Extract individual component types using various XML patterns
              const compMatches = componentSetContent.match(/<cal:comp[^>]*name="([^"]+)"[^>]*>/gi) ||
                                  componentSetContent.match(/<comp[^>]*name="([^"]+)"[^>]*>/gi) ||
                                  componentSetContent.match(/name="([^"]+)"/gi);
              
              if (compMatches && compMatches.length > 0) {
                for (const compMatch of compMatches) {
                  const nameMatch = compMatch.match(/name="([^"]+)"/i);
                  if (nameMatch) {
                    const compName = nameMatch[1].toUpperCase();
                    if (compName === 'VEVENT') {
                      supportsVEVENT = true;
                    } else if (compName === 'VTODO') {
                      supportsVTODO = true;
                    }
                  }
                }
              } else {
                // Fallback: check if VEVENT or VTODO appears in the text
                supportsVEVENT = componentSetContent.includes('VEVENT') || componentSetContent.includes('vevent');
                supportsVTODO = componentSetContent.includes('VTODO') || componentSetContent.includes('vtodo');
              }
            }
          } else {
            // Component set not present - some servers don't return it
            // In this case, we'll include it but verify later when creating events
            // This is safer than excluding calendars that might actually support VEVENT
            supportsVEVENT = true;
          }
          
          // Only include calendars that support VEVENT (events)
          // Exclude calendars that explicitly only support VTODO
          if (hasComponentSet && !supportsVEVENT) {
            logger.debug('Skipping calendar that does not support VEVENT', {
              name,
              href,
              supportsVEVENT,
              supportsVTODO,
              hasComponentSet,
              componentSet: componentSetMatch ? (componentSetMatch[1] || 'empty/self-closing') : 'not found',
              service: 'caldavProvider',
            });
            continue;
          }
          
          calendars.push({
            id: href,
            name: name,
            description: description,
            primary: calendars.length === 0, // First calendar is primary
            accessRole: 'writer',
          });
        } catch (parseError: unknown) {
          // Continue with next calendar on parse error
          logger.warn('Error parsing calendar', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            service: 'caldavProvider',
          });
        }
      }
    }
    
    // If no calendars found, use default calendar path
    if (calendars.length === 0) {
      const defaultPath = getCalendarPath(config);
      calendars.push({
        id: defaultPath,
        name: 'Default Calendar',
        primary: true,
        accessRole: 'writer',
      });
    }
    
    return calendars;
  } catch (error: unknown) {
    // Return default calendar on error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Error listing calendars, using default', {
      error: errorMessage,
      service: 'caldavProvider',
    });
    const defaultPath = getCalendarPath(config);
    return [{
      id: defaultPath,
      name: 'Default Calendar',
      primary: true,
      accessRole: 'writer',
    }];
  }
}
