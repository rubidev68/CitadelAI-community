/**
 * Response Formatter Utilities
 * Consistent response formatting for API endpoints
 */

import { Response } from 'express';
import { getCorrelationId } from '@shared/utils';
import { SuccessResponse, ErrorResponse, ResponseMetadata } from './types';

/**
 * Creates a success response
 * 
 * @param data Response data
 * @param metadata Optional metadata
 * @returns Success response object
 * 
 * @example
 * ```typescript
 * res.json(successResponse({ id: '123', name: 'John' }, { timestamp: new Date().toISOString() }));
 * ```
 */
export function successResponse<T>(
  data: T,
  metadata?: ResponseMetadata
): SuccessResponse<T> {
  const correlationId = getCorrelationId();
  
  return {
    success: true,
    data,
    metadata: {
      ...metadata,
      requestId: correlationId || metadata?.requestId,
      timestamp: metadata?.timestamp || new Date().toISOString(),
    },
  };
}

/**
 * Creates an error response
 * 
 * @param error Error message or code
 * @param message Human-readable error message
 * @param code Optional error code
 * @param details Optional error details
 * @returns Error response object
 * 
 * @example
 * ```typescript
 * res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid input', 'VALIDATION_ERROR', { field: 'email' }));
 * ```
 */
export function errorResponse(
  error: string,
  message: string,
  code?: string,
  details?: unknown
): ErrorResponse {
  const correlationId = getCorrelationId();
  
  return {
    success: false,
    error,
    message,
    code,
    details,
    requestId: correlationId || undefined,
  };
}

/**
 * Sends a success response
 * 
 * @param res Express response object
 * @param data Response data
 * @param metadata Optional metadata
 * @param statusCode HTTP status code (default: 200)
 * 
 * @example
 * ```typescript
 * sendSuccessResponse(res, { id: '123' }, { timestamp: new Date().toISOString() }, 201);
 * ```
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  metadata?: ResponseMetadata,
  statusCode: number = 200
): void {
  res.status(statusCode).json(successResponse(data, metadata));
}

/**
 * Sends an error response
 * 
 * @param res Express response object
 * @param error Error message or code
 * @param message Human-readable error message
 * @param statusCode HTTP status code (default: 400)
 * @param code Optional error code
 * @param details Optional error details
 * 
 * @example
 * ```typescript
 * sendErrorResponse(res, 'NOT_FOUND', 'Resource not found', 404);
 * ```
 */
export function sendErrorResponse(
  res: Response,
  error: string,
  message: string,
  statusCode: number = 400,
  code?: string,
  details?: unknown
): void {
  res.status(statusCode).json(errorResponse(error, message, code, details));
}
