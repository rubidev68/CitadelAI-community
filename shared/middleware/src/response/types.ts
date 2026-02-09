/**
 * Response type definitions
 */

/**
 * Metadata for API responses
 */
export interface ResponseMetadata {
  timestamp?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: ResponseMetadata;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}

/**
 * API response union type
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
