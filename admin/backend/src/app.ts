import express from 'express';
import { createRateLimiter } from './middleware/rateLimiter';
import { logger, correlationIdMiddleware, requestLogger } from '@shared/utils';
import { securityHeadersMiddleware, createCorsMiddleware } from '@shared/middleware';
import { getFeatureFlags } from './shared/config/features';
import { config } from './config';

// Initialize logger for admin-backend
const adminLogger = logger.child({ service: 'admin-backend' });

// Get feature flags
const features = getFeatureFlags();
adminLogger.info('Feature flags loaded', { features });

const app = express();

// Security headers middleware (must be before other middleware)
app.use(securityHeadersMiddleware({
  enableCSP: true,
  cspDirectives: {
    scriptSrc: ["'self'", ...(config.NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", config.API_URL, config.FRONTEND_URL],
  },
}) as any);

// CORS middleware
app.use(createCorsMiddleware({
  allowCredentials: true,
}) as any);

// Add correlation ID and request logging middleware
app.use(correlationIdMiddleware() as any);
app.use(requestLogger({
  skipPaths: ['/health', '/metrics', '/api/admin/internal'],
  logRequestBody: config.NODE_ENV === 'development',
  includeHeaders: ['user-agent', 'x-forwarded-for'],
}) as any);

// Stripe webhook endpoint - must use raw body for signature verification
// This MUST be before express.json() middleware
// Slack webhook endpoints - must use raw body for signature verification
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global rate limiting (applied to all routes except webhooks and status endpoints)
// Status endpoints are excluded because they are frequently polled (e.g., during crawling)
const globalRateLimitWithStatusExclusion = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later',
  options: {
    skip: (req: any) => {
      // Skip rate limiting for status endpoints
      // These are frequently polled and should not be rate limited
      const path = req.path || req.url || req.originalUrl || '';
      
      // Check for status endpoints (including /api/admin/status/:blockId)
      if (path.includes('/status') || 
          path.includes('/health') || 
          path.includes('/metrics') ||
          path.includes('/progress') ||
          /\/api\/admin\/status\//.test(path)) {
        return true;
      }

      // Skip polling endpoints for crawling/indexing
      if (req.method === 'GET' && (
          path.includes('/cloud/integration') || 
          path.includes('/crawled-pages')
      )) {
        return true;
      }

      // Skip global rate limit for chatbot updates (handled by specific permissive limiter)
      if (req.method === 'PUT' && path.includes('/api/admin/chatbots/')) {
        return true;
      }
      
      return false;
    },
  },
}) as any;
app.use(globalRateLimitWithStatusExclusion);

export default app;
export { adminLogger };
