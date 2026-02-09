/**
 * Enhanced CORS Middleware
 * Centralized CORS configuration with environment-based origins
 */

import cors, { CorsOptions } from 'cors';
import { Request, RequestHandler } from 'express';

/**
 * Options for CORS middleware
 */
export interface CorsMiddlewareOptions {
  /**
   * Allowed origins (overrides config defaults)
   */
  allowedOrigins?: string[];
  /**
   * Allow credentials (default: true)
   */
  allowCredentials?: boolean;
  /**
   * Allow widget endpoints (default: false)
   * When true, allows all origins for widget embedding
   */
  allowWidgetEndpoints?: boolean;
  /**
   * Widget origin pattern (default: matches all HTTP/HTTPS)
   */
  widgetPattern?: RegExp;
  /**
   * Additional allowed headers
   */
  allowedHeaders?: string[];
  /**
   * Additional exposed headers
   */
  exposedHeaders?: string[];
  /**
   * Use user config instead of admin config (for user-backend)
   */
  useUserConfig?: boolean;
}

/**
 * Get default allowed origins from environment variables
 * Reads directly from process.env to avoid requiring full config validation
 */
function getDefaultOrigins(useUserConfig = false): string[] {
  // Read directly from process.env to avoid config validation issues
  const corsOrigins = process.env.CORS_ALLOWED_ORIGINS;
  
  if (corsOrigins && corsOrigins.trim() !== '') {
    return corsOrigins.split(',').map(origin => origin.trim());
  }

  // Default origins based on frontend URLs from environment
  const defaultOrigins: string[] = [];
  
  const frontendUrl = process.env.FRONTEND_URL;
  const userFrontendUrl = process.env.USER_FRONTEND_URL;
  
  if (frontendUrl) {
    defaultOrigins.push(frontendUrl);
  }
  
  if (userFrontendUrl && userFrontendUrl !== frontendUrl) {
    defaultOrigins.push(userFrontendUrl);
  }

  // Add localhost for development
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'development') {
    defaultOrigins.push('http://localhost:3000', 'http://localhost:8080');
  }

  // Fallback if no URLs are set
  if (defaultOrigins.length === 0) {
    defaultOrigins.push(
      'https://admin.citadelai.app',
      'https://chat.citadelai.app',
      'http://localhost:3000',
      'http://localhost:8080'
    );
  }

  return defaultOrigins;
}

/**
 * Check if origin matches dedicated instance pattern
 */
function isDedicatedInstance(origin: string): boolean {
  return /^https:\/\/[^.]+\.citadelai\.app$/.test(origin);
}

/**
 * Create enhanced CORS middleware with environment-based configuration
 * 
 * @param options - Configuration options
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import { createCorsMiddleware } from '@shared/middleware';
 * 
 * app.use(createCorsMiddleware({
 *   allowWidgetEndpoints: true,
 *   allowedHeaders: ['X-Custom-Header'],
 * }));
 * ```
 */
export function createCorsMiddleware(
  options: CorsMiddlewareOptions = {}
): RequestHandler {
  const allowedOrigins = options.allowedOrigins || getDefaultOrigins(options.useUserConfig);
  const widgetPattern = options.widgetPattern || /^https?:\/\//;
  
  const corsOptions: CorsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
      // Allow requests with no origin (same-origin, mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Widget endpoint handling - allow all origins for widget embedding
      if (options.allowWidgetEndpoints && widgetPattern.test(origin)) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Check dedicated instance pattern
      if (isDedicatedInstance(origin)) {
        return callback(null, true);
      }

      // Origin not allowed
      callback(new Error(`CORS: Origin "${origin}" is not allowed`));
    },
    credentials: options.allowCredentials !== false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-User-Timezone',
      ...(options.allowedHeaders || []),
    ],
    exposedHeaders: [
      'Content-Type',
      ...(options.exposedHeaders || []),
    ],
    maxAge: 86400, // 24 hours
  };

  return cors(corsOptions);
}
