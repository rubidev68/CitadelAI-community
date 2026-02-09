/**
 * Security Headers Middleware
 * Implements helmet middleware with environment-based configuration
 */

import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Options for security headers middleware
 */
export interface SecurityHeadersOptions {
  /**
   * Enable Content-Security-Policy (default: true)
   */
  enableCSP?: boolean;
  /**
   * Enable Strict-Transport-Security (default: auto-detect based on HTTPS_ENABLED)
   */
  enableHSTS?: boolean;
  /**
   * Custom CSP directives to merge with defaults
   */
  cspDirectives?: Record<string, string[]>;
  /**
   * Environment override (default: from config)
   */
  environment?: string;
  /**
   * Enable frame options (default: 'sameorigin')
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
}

/**
 * Create security headers middleware with environment-based configuration
 * 
 * @param options - Configuration options
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import { securityHeadersMiddleware } from '@shared/middleware';
 * 
 * app.use(securityHeadersMiddleware({
 *   enableCSP: true,
 *   cspDirectives: {
 *     scriptSrc: ["'self'", "'unsafe-inline'"],
 *   },
 * }));
 * ```
 */
export function securityHeadersMiddleware(
  options: SecurityHeadersOptions = {}
): RequestHandler {
  // Read directly from process.env to avoid requiring full config validation
  // This middleware only needs NODE_ENV and HTTPS_ENABLED
  const env = options.environment || 
    (process.env.NODE_ENV as 'development' | 'test' | 'production') || 
    'development';
  const isProduction = env === 'production';
  const isHTTPS = process.env.HTTPS_ENABLED === 'true' || isProduction;
  
  // Default CSP directives
  const defaultCSPDirectives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...(env === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  };
  
  // Add upgradeInsecureRequests only in production (empty array enables it in helmet v8)
  if (env === 'production') {
    defaultCSPDirectives.upgradeInsecureRequests = [];
  }

  // Merge custom directives (ensure all values are arrays)
  const cspDirectives: Record<string, string[]> = { ...defaultCSPDirectives };
  if (options.cspDirectives) {
    Object.keys(options.cspDirectives).forEach((key) => {
      const value = options.cspDirectives![key];
      // Only include array values (helmet v8 requires all directives to be arrays)
      if (Array.isArray(value)) {
        cspDirectives[key] = value;
      }
    });
  }

  // Remove undefined values and ensure all values are arrays
  Object.keys(cspDirectives).forEach((key) => {
    const value = cspDirectives[key];
    if (!Array.isArray(value) || value === undefined) {
      delete cspDirectives[key];
    }
  });

  return helmet({
    contentSecurityPolicy: options.enableCSP !== false ? {
      directives: cspDirectives,
    } : false,
    strictTransportSecurity: (isHTTPS && options.enableHSTS !== false) ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false,
    } : false,
    xFrameOptions: options.frameOptions !== undefined 
      ? (options.frameOptions === false ? false : { action: options.frameOptions.toLowerCase() as 'deny' | 'sameorigin' })
      : { action: 'sameorigin' },
    xContentTypeOptions: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // Disable COEP as it can break many sites
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}
