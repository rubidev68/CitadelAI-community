/**
 * Express middleware for request/response logging
 * Provides structured logging with correlation IDs, timing, and metadata
 */

import { Request, Response, NextFunction } from 'express';
import { logger, LogLevel, LogMetadata } from '../logger';
import { getCorrelationId } from '../correlationId';

/**
 * Options for request logger middleware
 */
export interface RequestLoggerOptions {
  /** Minimum log level for request logging */
  logLevel?: LogLevel;
  /** Paths to skip logging (e.g., health checks) */
  skipPaths?: string[];
  /** Whether to log request body */
  logRequestBody?: boolean;
  /** Whether to log response body */
  logResponseBody?: boolean;
  /** Fields to filter from logs (sensitive data) */
  sensitiveFields?: string[];
  /** Specific headers to include in logs */
  includeHeaders?: string[];
  /** Maximum body size to log (in characters) */
  maxBodySize?: number;
  /** Whether to log request start */
  logRequestStart?: boolean;
}

/**
 * Default sensitive fields to filter
 */
const DEFAULT_SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'creditCard',
  'credit_card',
  'ssn',
  'socialSecurityNumber',
];

/**
 * Sanitize object by removing sensitive fields and truncating large values
 */
function sanitizeObject(
  obj: unknown,
  sensitiveFields: string[],
  maxSize: number
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    const str = String(obj);
    return str.length > maxSize ? str.substring(0, maxSize) + '...' : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, sensitiveFields, maxSize));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Filter sensitive fields
    if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[FILTERED]';
      continue;
    }

    // Recursively sanitize nested objects
    sanitized[key] = sanitizeObject(value, sensitiveFields, maxSize);
  }

  return sanitized;
}

/**
 * Get request metadata for logging
 */
function getRequestMetadata(
  req: Request,
  options: RequestLoggerOptions
): LogMetadata {
  const correlationId = getCorrelationId() || req.correlationId;
  const metadata: LogMetadata = {
    correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  // Add specific headers if requested
  if (options.includeHeaders && options.includeHeaders.length > 0) {
    const headers: Record<string, string | undefined> = {};
    for (const header of options.includeHeaders) {
      headers[header] = req.get(header);
    }
    metadata.headers = headers;
  }

  // Add request body if requested
  if (options.logRequestBody && req.body) {
    const maxSize = options.maxBodySize || 1000;
    metadata.requestBody = sanitizeObject(
      req.body,
      options.sensitiveFields || DEFAULT_SENSITIVE_FIELDS,
      maxSize
    );
  }

  // Add query parameters
  if (Object.keys(req.query).length > 0) {
    metadata.query = sanitizeObject(
      req.query,
      options.sensitiveFields || DEFAULT_SENSITIVE_FIELDS,
      options.maxBodySize || 1000
    );
  }

  // Add user ID if available
  const reqWithUser = req as { user?: { id?: string } };
  if (reqWithUser.user?.id) {
    metadata.userId = reqWithUser.user.id;
  }

  return metadata;
}

/**
 * Get response metadata for logging
 */
function getResponseMetadata(
  req: Request,
  res: Response,
  duration: number,
  options: RequestLoggerOptions
): LogMetadata {
  const correlationId = getCorrelationId() || req.correlationId;
  const metadata: LogMetadata = {
    correlationId,
    method: req.method,
    url: req.url,
    path: req.path,
    statusCode: res.statusCode,
    duration,
  };

  // Add response size if available
  const contentLength = res.get('content-length');
  if (contentLength) {
    metadata.responseSize = parseInt(contentLength, 10);
  }

  return metadata;
}

/**
 * Express middleware for request/response logging
 * 
 * @param options Configuration options
 * @returns Express middleware function
 */
export function requestLogger(options: RequestLoggerOptions = {}) {
  const {
    logLevel = LogLevel.INFO,
    skipPaths = ['/health', '/metrics', '/api/health', '/api/metrics'],
    logRequestBody = false,
    logResponseBody = false,
    sensitiveFields = DEFAULT_SENSITIVE_FIELDS,
    includeHeaders = [],
    maxBodySize = 1000,
    logRequestStart = true,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const correlationId = getCorrelationId() || req.correlationId;

    // Skip logging for specified paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Log request start
    if (logRequestStart) {
      const requestMetadata = getRequestMetadata(req, options);
      logger.info('Incoming request', requestMetadata);
    }

    // Capture original send method
    const originalSend = res.send;
    let responseBody: unknown;

    // Override send to capture response body
    res.send = function (body: unknown) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Log response on finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseMetadata = getResponseMetadata(req, res, duration, options);

      // Add response body if requested
      if (logResponseBody && responseBody) {
        const maxSize = maxBodySize;
        responseMetadata.responseBody = sanitizeObject(
          responseBody,
          sensitiveFields,
          maxSize
        );
      }

      // Log based on status code
      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', undefined, responseMetadata);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', responseMetadata);
      } else {
        logger.info('Request completed', responseMetadata);
      }
    });

    // Log errors
    res.on('error', (error: Error) => {
      const duration = Date.now() - startTime;
      const errorMetadata = getResponseMetadata(req, res, duration, options);
      logger.error('Request error', error, errorMetadata);
    });

    next();
  };
}
