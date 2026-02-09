/**
 * Error Handling Middleware
 * Standardized error handling for Express applications
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { formatErrorForApi } from '@shared/utils';
import { getCorrelationId } from '@shared/utils';

/**
 * Error with optional code and details
 */
interface ErrorWithCode extends Error {
  code?: string;
  details?: unknown;
  statusCode?: number;
}

/**
 * Configuration for error handler
 */
export interface ErrorHandlerConfig {
  /**
   * Logger instance (optional)
   */
  logger?: {
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  };
  
  /**
   * Include stack trace in development mode
   * Default: true if NODE_ENV === 'development'
   */
  includeStack?: boolean;
  
  /**
   * Include error details in response
   * Default: true if NODE_ENV === 'development'
   */
  includeDetails?: boolean;
}

/**
 * Creates error handling middleware
 * 
 * @param config Configuration object (optional)
 * @returns Express error handler middleware
 * 
 * @example
 * ```typescript
 * const errorHandler = createErrorHandler({
 *   logger,
 *   includeStack: process.env.NODE_ENV === 'development',
 * });
 * 
 * app.use(errorHandler);
 * ```
 */
export function createErrorHandler(config: ErrorHandlerConfig = {}): ErrorRequestHandler {
  const {
    logger,
    includeStack = process.env.NODE_ENV === 'development',
    includeDetails = process.env.NODE_ENV === 'development',
  } = config;

  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    // Log error
    if (logger) {
      const error = err instanceof Error ? err : new Error(String(err));
      const correlationId = getCorrelationId();
      logger.error('Request error', error, {
        service: 'error-handler',
        method: req.method,
        path: req.path,
        correlationId,
        requestId: correlationId,
      });
    } else {
      // Fallback to console.error if no logger provided
      console.error('Error:', err);
    }

    // Determine status code
    const errorWithCode = err as ErrorWithCode;
    const statusCode = errorWithCode.statusCode || 500;

    // Format error for response
    const formattedError = formatErrorForApi(err);
    const correlationId = getCorrelationId();

    // Build response
    const response: {
      error: string;
      message: string;
      code?: string;
      details?: unknown;
      stack?: string;
      requestId?: string;
    } = {
      error: statusCode >= 500 ? 'Internal Server Error' : 'Error',
      message: includeDetails
        ? formattedError.message
        : statusCode >= 500
        ? 'Something went wrong'
        : formattedError.message,
      requestId: correlationId,
    };

    // Add optional fields
    if (formattedError.code) {
      response.code = formattedError.code;
    }

    if (includeDetails && formattedError.details) {
      response.details = formattedError.details;
    }

    if (includeStack && err instanceof Error && err.stack) {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
  };
}
