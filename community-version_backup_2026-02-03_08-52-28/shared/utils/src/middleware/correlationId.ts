/**
 * Express middleware for correlation ID handling
 * Extracts correlation ID from request headers or generates a new one
 */

import { Request, Response, NextFunction } from 'express';
import { generateCorrelationId, setCorrelationId, getCorrelationId } from '../correlationId';

/**
 * Extend Express Request to include correlationId
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to handle correlation IDs
 * - Checks for X-Correlation-ID header
 * - Generates new ID if not present
 * - Sets correlation ID in request and response
 * - Stores in AsyncLocalStorage for logger access
 * 
 * @returns Express middleware function
 */
export function correlationIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check for existing correlation ID in header
    const existingId = req.headers['x-correlation-id'] as string | undefined;
    
    // Generate or use existing correlation ID
    const correlationId = existingId || generateCorrelationId();
    
    // Set in AsyncLocalStorage for logger access
    setCorrelationId(correlationId);
    
    // Attach to request object
    req.correlationId = correlationId;
    
    // Set in response header
    res.setHeader('X-Correlation-ID', correlationId);
    
    next();
  };
}
