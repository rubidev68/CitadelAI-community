import { Request } from 'express';

/**
 * Extract user timezone from request headers
 */
export function extractUserTimezone(req: Request): string | undefined {
  return req.headers['x-user-timezone'] as string || 
         req.headers['X-User-Timezone'] as string ||
         undefined;
}
