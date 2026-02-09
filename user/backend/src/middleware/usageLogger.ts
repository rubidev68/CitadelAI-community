/**
 * Usage Logging Middleware
 * Logs API token usage after request completes
 */

import { Request, Response, NextFunction } from 'express';
import { ApiAuthRequest } from './apiAuth';
import { logTokenUsage } from '../services/tokenUsageService';

/**
 * Middleware to log token usage after response
 * Should be placed after authenticateApiToken middleware
 */
export function usageLoggerMiddleware(
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  let logged = false;

  // Log usage when response finishes (only once)
  const logOnce = () => {
    if (!logged) {
      logged = true;
      logUsage(req, res, startTime);
    }
  };

  // Listen for finish event (covers all response types)
  res.on('finish', logOnce);

  // Also listen for close event (for aborted connections)
  res.on('close', logOnce);

  next();
}

/**
 * Log usage for a request
 */
function logUsage(req: ApiAuthRequest, res: Response, startTime: number): void {
  const token = req.apiToken;
  if (!token) {
    return; // No token, skip logging
  }

  const responseTime = Date.now() - startTime;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || undefined;
  const ipString = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;

  // Log usage asynchronously (don't block response)
  logTokenUsage({
    tokenId: token.id,
    endpoint: req.path || req.url || 'unknown',
    requestMethod: req.method || 'UNKNOWN',
    ipAddress: ipString,
    statusCode: res.statusCode || 200,
    responseTime,
  }).catch((error) => {
    // Silently fail - don't log errors for logging failures
    // This prevents infinite loops
  });
}
