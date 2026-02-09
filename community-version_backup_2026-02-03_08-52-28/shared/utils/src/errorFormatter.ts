/**
 * Error Formatting Utilities
 * Standardize error formatting across services
 */

export interface FormattedError {
  message: string;
  code?: string;
  details?: unknown;
  stack?: string;
}

/**
 * Error with optional code and details properties
 */
interface ErrorWithCode extends Error {
  code?: string;
  details?: unknown;
}

/**
 * Format an error for logging or API responses
 * @param error - Error object, string, or unknown type
 * @returns Formatted error object
 */
export function formatError(error: unknown): FormattedError {
  if (error instanceof Error) {
    const errorWithCode = error as ErrorWithCode;
    return {
      message: error.message,
      code: errorWithCode.code,
      details: errorWithCode.details,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
    };
  }

  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    return {
      message: String(errorObj.message || errorObj.error || 'Unknown error'),
      code: errorObj.code as string | undefined,
      details: errorObj.details,
      stack: errorObj.stack as string | undefined,
    };
  }

  return {
    message: 'Unknown error occurred',
    details: error,
  };
}

/**
 * Format error for API response (excludes stack trace)
 * @param error - Error object, string, or unknown type
 * @returns Formatted error without stack trace
 */
export function formatErrorForApi(error: unknown): Omit<FormattedError, 'stack'> {
  const formatted = formatError(error);
  const { stack, ...apiError } = formatted;
  return apiError;
}
