/**
 * Shared Types Package
 * Common TypeScript types and interfaces
 * 
 * NOTE: Prisma-generated types (Block, BlockType, etc.) are schema-specific
 * and should be imported directly from @prisma/client in each service.
 */

// Common API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

// Common error response
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}

// Database connection management types
export * from './database';

// Database driver type definitions
export * from './database-drivers';

// External API type definitions
export * from './external-apis';
