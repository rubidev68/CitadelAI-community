import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

export interface CorsApiRequest extends Request {
  allowedOrigins?: string[];
  isDocumentationRequest?: boolean;
}

/**
 * Get allowed origins for a chatbot from API block configuration
 * Also includes admin frontend origin for testing/documentation purposes
 */
async function getAllowedOrigins(chatbotId: string): Promise<string[]> {
  try {
    const apiBlock = await prisma.block.findFirst({
      where: {
        chatbotId,
        type: 'FRONTEND',
        subtype: 'API',
      },
      select: {
        properties: true,
      },
    });

    const properties = (apiBlock?.properties as { allowedOrigins?: string[] }) || {};
    const configuredOrigins = properties.allowedOrigins || [];
    
    // Add admin frontend origin for testing/documentation (if not already included)
    const adminFrontendOrigin = config.FRONTEND_URL;
    if (!configuredOrigins.includes(adminFrontendOrigin) && !configuredOrigins.includes('*')) {
      configuredOrigins.push(adminFrontendOrigin);
    }
    
    return configuredOrigins;
  } catch (error) {
    logger.error('Error fetching allowed origins', error instanceof Error ? error : undefined, {
      service: 'corsApi-middleware',
    });
    // Fallback: allow admin frontend for testing
    const adminFrontendOrigin = config.FRONTEND_URL;
    return [adminFrontendOrigin];
  }
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  if (allowedOrigins.includes('*')) {
    return true;
  }
  return allowedOrigins.includes(origin);
}

/**
 * Set CORS headers
 */
function setCorsHeaders(res: Response, origin: string | undefined, maxAge: number = 86400) {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Timezone');
  res.setHeader('Access-Control-Max-Age', maxAge.toString());
}

/**
 * CORS middleware for public API endpoints
 * Checks allowed origins from API block configuration
 * For documentation requests (info endpoint), allows all origins temporarily (1 hour)
 */
export const corsApiMiddleware = async (
  req: CorsApiRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { chatbotId } = req.params;
  const origin = req.headers.origin;
  const isInfoEndpoint = req.path.includes('/info');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    // For info endpoint (documentation), allow all origins temporarily
    if (isInfoEndpoint) {
      setCorsHeaders(res, origin, 3600); // 1 hour for documentation
      res.status(204).end();
      return;
    }

    // For other endpoints, check allowed origins
    if (chatbotId && origin) {
      const allowedOrigins = await getAllowedOrigins(chatbotId);
      const adminFrontendOrigin = config.FRONTEND_URL;

      // Always allow admin frontend origin for testing/documentation
      if (origin === adminFrontendOrigin) {
        setCorsHeaders(res, origin);
        res.status(204).end();
        return;
      }

      // If no origins configured, deny (security by default)
      if (allowedOrigins.length === 0) {
        res.status(403).json({ error: 'CORS not configured for this chatbot. Please configure allowed origins in the API block settings.' });
        return;
      }

      // Check if origin is allowed
      if (isOriginAllowed(origin, allowedOrigins)) {
        setCorsHeaders(res, origin);
        res.status(204).end();
        return;
      }

      res.status(403).json({ 
        error: 'CORS origin not allowed',
        message: `Origin "${origin}" is not in the allowed origins list. Please add it in the API block settings.`
      });
      return;
    }

    // No chatbotId or origin - deny
    res.status(400).json({ error: 'Bad Request' });
    return;
  }

  // For actual requests, set CORS headers
  if (origin) {
    // Info endpoint: allow all origins temporarily (for documentation)
    if (isInfoEndpoint) {
      setCorsHeaders(res, origin, 3600); // 1 hour for documentation
      next();
      return;
    }

    // Other endpoints: check allowed origins
    if (chatbotId) {
      const allowedOrigins = await getAllowedOrigins(chatbotId);
      const adminFrontendOrigin = config.FRONTEND_URL;

      // Always allow admin frontend origin for testing/documentation
      if (origin === adminFrontendOrigin) {
        setCorsHeaders(res, origin);
        next();
        return;
      }

      // If no origins configured, deny (security by default)
      if (allowedOrigins.length === 0) {
        res.status(403).json({ error: 'CORS not configured for this chatbot. Please configure allowed origins in the API block settings.' });
        return;
      }

      // Check if origin is allowed
      if (isOriginAllowed(origin, allowedOrigins)) {
        setCorsHeaders(res, origin);
        next();
        return;
      }

      res.status(403).json({ 
        error: 'CORS origin not allowed',
        message: `Origin "${origin}" is not in the allowed origins list. Please add it in the API block settings.`
      });
      return;
    }
  }

  // No origin header (same-origin request) - allow
  next();
};
