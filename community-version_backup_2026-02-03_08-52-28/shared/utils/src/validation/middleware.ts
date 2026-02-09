/**
 * Validation Middleware
 * Express middleware for request validation using Zod schemas
 */

import { z } from 'zod';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../logger';

/**
 * Schema-like type compatible with Zod v3 and v4 (and any object with safeParseAsync).
 * Return type is intentionally loose so different Zod versions (v3 uses error.errors,
 * v4 types ZodError differently) are accepted; runtime handles both.
 */
export type SchemaLike = {
  safeParseAsync(data: unknown): Promise<{ success: boolean; data?: unknown; error?: unknown }>;
};

/**
 * Validation options for validateRequest middleware
 */
export interface ValidationOptions {
  body?: SchemaLike;
  params?: SchemaLike;
  query?: SchemaLike;
}

/**
 * Validation error response format
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  path: (string | number)[];
}

export interface ValidationErrorResponse {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: ValidationErrorDetail[];
  };
}

/**
 * Validated request type (extends Express Request with validated fields)
 * Note: This is a type helper - actual validation happens at runtime via middleware
 */
export type ValidatedRequest<
  TBody = unknown,
  TParams extends Record<string, string> = Record<string, string>,
  TQuery extends Record<string, unknown> = Record<string, unknown>
> = Request<TParams, any, TBody, TQuery>;

/**
 * Validation middleware factory
 * Creates Express middleware that validates request body, params, and query using Zod schemas
 * 
 * @param options - Validation options with Zod schemas for body, params, and/or query
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * const schema = {
 *   body: z.object({
 *     email: z.string().email(),
 *     password: z.string().min(8),
 *   }),
 * };
 * 
 * router.post('/login', validateRequest(schema), (req, res) => {
 *   // req.body is now typed and validated
 *   const { email, password } = req.body;
 * });
 * ```
 */
/**
 * Wrapper to handle async middleware errors properly in Express
 * Only passes errors to Express error handler if response hasn't been sent
 */
function asyncHandler(fn: (req: any, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req: any, res: Response, next: NextFunction): void => {
    // Execute async function and handle any unhandled promise rejections
    Promise.resolve(fn(req, res, next)).catch((error: unknown) => {
      // CRITICAL: Only pass error to Express error handler if response hasn't been sent
      // Check multiple conditions to be absolutely sure the response wasn't sent
      // This prevents double error handling when validation middleware has already sent a response
      // In test environments, res.headersSent might not be set immediately after res.json(),
      // so we check all possible indicators that a response was sent
      if (!res.headersSent && !res.writableEnded && !res.finished) {
        // Response hasn't been sent, so pass error to Express error handler
        next(error);
      } else {
        // Response was already sent (by validation middleware or another handler)
        // Silently ignore the error to prevent double responses
        // This can happen if validation middleware sent a 400 response and then an error occurred
        // or if res.json() set headers but the promise still rejected for some reason
        // In test environments, there might be timing issues where headers are sent
        // but the promise rejection happens before headersSent is updated
      }
    });
  };
}

// Minimal error shape: Zod v3 uses .errors, Zod v4 uses .issues
type ValidationErrorLike = { errors?: unknown[]; issues?: unknown[] };

// Helper function to send validation error response
function sendValidationError(res: Response, error: ValidationErrorLike, req: any): void {
  if (res.headersSent || res.writableEnded) {
    return;
  }

  const errorList = (error.errors ?? error.issues ?? []) as Array<{ path?: unknown[]; message?: string; code?: string }>;

  // Format validation error response
  const firstError = errorList.length > 0
    ? errorList[0]
    : { path: [] as unknown[], message: 'Validation failed', code: 'invalid_type' as const };
  let errorMessage = 'Validation failed';
  
  // Map common validation errors to user-friendly messages
  const errorPath = Array.isArray(firstError.path) 
    ? firstError.path.map(String).join('.')
    : String(firstError.path || '');
    
  // Check for missing required fields
  if (firstError.code === 'invalid_type' && (firstError.message ?? '').includes('Required')) {
    const fieldName = Array.isArray(firstError.path) && firstError.path.length > 0
      ? String(firstError.path[firstError.path.length - 1])
      : 'field';
    errorMessage = `${fieldName} is required`;
  } else if (errorPath === 'message' || errorPath.includes('message')) {
    if (firstError.code === 'too_small' || firstError.code === 'invalid_type') {
      errorMessage = 'message is required';
    } else {
      errorMessage = firstError.message || 'message is required';
    }
  } else if (errorPath === 'chatbotId' || errorPath.includes('chatbotId')) {
    if (firstError.code === 'invalid_type' || firstError.code === 'custom') {
      errorMessage = 'chatbotId is required';
    } else {
      errorMessage = firstError.message || 'Invalid chatbotId';
    }
  } else if (errorPath === 'blockId' || errorPath.includes('blockId')) {
    if (firstError.code === 'invalid_type' || firstError.code === 'custom') {
      errorMessage = 'blockId is required';
    } else {
      errorMessage = firstError.message || 'Invalid blockId';
    }
  } else if (Array.isArray(firstError.path) && firstError.path.length > 0) {
    const fieldName = firstError.path[firstError.path.length - 1];
    // Check if multiple required fields are missing
    if (errorList.length > 1) {
      const missingFields = errorList
        .filter(e => (e.code === 'invalid_type' && (e.message ?? '').includes('Required')) || e.code === 'too_small' || (e.code === 'custom' && (e.message ?? '').includes('Required')))
        .map(e => Array.isArray(e.path) && e.path.length > 0 ? String(e.path[e.path.length - 1]) : 'field')
        .filter(Boolean);
      if (missingFields.length > 0) {
        // If we have chatbotId and blockId, use the specific message format
        if (missingFields.length === 2 && missingFields.includes('chatbotId') && missingFields.includes('blockId')) {
          errorMessage = 'chatbotId and blockId are required';
        } else if (missingFields.length >= 2) {
          errorMessage = `${missingFields.join(' and ')} are required`;
        } else {
          errorMessage = `${missingFields[0]} is required`;
        }
      } else {
        errorMessage = `${String(fieldName)}: ${firstError.message || 'Invalid value'}`;
      }
    } else {
      errorMessage = `${String(fieldName)}: ${firstError.message || 'Invalid value'}`;
    }
  } else {
    errorMessage = firstError.message || 'Validation failed';
  }

  // Log validation error using existing logger (safely)
  try {
    if (logger && typeof logger.warn === 'function') {
      logger.warn('Validation failed', {
        service: 'validation-middleware',
        errors: errorList,
        path: req.path,
        method: req.method,
        userId: (req as any)?.user?.id || (req as any)?.adminUser?.id,
        correlationId: (req as any)?.correlationId,
      });
    }
  } catch (logError) {
    // If logger fails, continue anyway - don't break validation
  }

  // Send error response
  try {
    res.status(400).json({
      error: 'Bad Request',
      message: errorMessage,
    });
    // Explicitly end the response to ensure it's fully sent
    if (!res.writableEnded) {
      res.end();
    }
  } catch (sendError) {
    // If sending fails, response might have already been sent
    // Just return silently
  }
}

export function validateRequest<TBody = unknown, TParams = unknown, TQuery = unknown>(
  options: ValidationOptions
): RequestHandler {
  return asyncHandler(async (req: any, res: Response, next: NextFunction): Promise<void> => {
    // Validate body if schema provided
    if (options.body) {
      // Ensure body exists (Express might not parse it in some cases)
      const bodyToValidate = req.body !== undefined ? req.body : {};
      
      // Use safeParseAsync to avoid throwing errors
      const result = await options.body.safeParseAsync(bodyToValidate);
      if (!result.success) {
        // Validation failed - send error response and return (don't throw)
        sendValidationError(res, result.error as ValidationErrorLike, req);
        return; // Return successfully to resolve the promise
      }
      // Validation succeeded - update req.body
      req.body = result.data;
    }

    // Validate params if schema provided
    if (options.params) {
      const result = await options.params.safeParseAsync(req.params);
      if (!result.success) {
        // Validation failed - send error response and return (don't throw)
        sendValidationError(res, result.error as ValidationErrorLike, req);
        return; // Return successfully to resolve the promise
      }
      // Validation succeeded - update req.params
      req.params = result.data;
    }

    // Validate query if schema provided
    if (options.query) {
      const result = await options.query.safeParseAsync(req.query);
      if (!result.success) {
        // Validation failed - send error response and return (don't throw)
        sendValidationError(res, result.error as ValidationErrorLike, req);
        return; // Return successfully to resolve the promise
      }
      // Validation succeeded - update req.query
      req.query = result.data;
    }

    // All validation passed - continue to next middleware
    // Only call next() if headers haven't been sent
    if (!res.headersSent && !res.writableEnded) {
      next();
    }
    // If headers were sent (validation failed), just return without calling next()
  });
}
