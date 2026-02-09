import express, { RequestHandler } from 'express';
import authRouter from './routes/auth';
import chatRouter from './routes/chat';
import chatbotRouter from './routes/chatbot';
import mermaidRouter from './routes/mermaid';
import userOAuthRouter from './routes/userOAuth';
import calendarActionsRouter from './routes/calendarActions';
import { updateWeaviateSchemasForRAG } from './services/updateWeaviateSchemas';
import { globalRateLimit, authRateLimit } from './middleware/rateLimiter';
import { correlationIdMiddleware, requestLogger } from '@shared/utils';
import { logger } from '@shared/utils';
import { securityHeadersMiddleware, createCorsMiddleware } from '@shared/middleware';
import { config } from './config';

const app = express();
const port = process.env.PORT || 3003;

// Initialize Weaviate schemas for RAG on startup (non-blocking)
if (config.NODE_ENV !== 'test') {
  updateWeaviateSchemasForRAG().catch((error) => {
    logger.warn('Failed to update Weaviate schemas (this is OK if schemas already exist)', {
      error: error.message,
      service: 'user-backend',
    });
    // Don't fail startup if schema update fails - it might already be configured
  });
}

// Security headers middleware (must be before other middleware)
app.use(securityHeadersMiddleware({
  enableCSP: true,
  cspDirectives: {
    scriptSrc: ["'self'", ...(config.NODE_ENV === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : [])],
    styleSrc: ["'self'", "'unsafe-inline'"],
    connectSrc: ["'self'", config.API_URL, config.USER_FRONTEND_URL, config.FRONTEND_URL],
    frameSrc: ["'self'", '*'], // Allow widget embedding
  },
}) as any);

// CORS middleware - allow widget endpoints for embedding
app.use(createCorsMiddleware({
  useUserConfig: true,
  allowCredentials: true,
  allowWidgetEndpoints: true, // Allow all origins for widget embedding
}) as any);
app.use(express.json());

// Global rate limiting (applied to all routes)
app.use(globalRateLimit);

// Correlation ID middleware (must be before request logger)
app.use(correlationIdMiddleware() as any);

// Request logging middleware
app.use(requestLogger({
  skipPaths: ['/health', '/metrics'],
  logRequestBody: config.NODE_ENV === 'development',
  includeHeaders: ['user-agent', 'x-forwarded-for'],
}) as any);

app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/chatbots', chatbotRouter);
app.use('/api/mermaid', mermaidRouter);
app.use('/api/user', userOAuthRouter);
app.use('/api/calendar-actions', calendarActionsRouter);

// Handle /api/user prefix for GCE ingress routing
app.use('/api/user/api/auth', authRouter);
app.use('/api/user/api/chat', chatRouter);
app.use('/api/user/api/chatbots', chatbotRouter);
app.use('/api/user/api/mermaid', mermaidRouter);
app.use('/api/user/api/user', userOAuthRouter);
app.use('/api/user/api/calendar-actions', calendarActionsRouter);

// Handle Caddy handle_path /api/user/* which strips the /api/user prefix
// When Caddy forwards /api/user/caldav/auth, it becomes /caldav/auth
// Mount userOAuthRouter at specific paths for these stripped paths (mounted last to avoid conflicts)
// Routes: /oauth/start, /oauth/callback, /caldav/auth, /oauth/connections
// Note: Routes are already namespaced with /oauth and /caldav prefixes, so mounting at root is safe
// but we mount at /api/oauth and /api/caldav for better organization
app.use('/api/oauth', userOAuthRouter);
app.use('/api/caldav', userOAuthRouter);
// Also mount at root for Caddy-stripped paths (mounted last to avoid conflicts with other routes)
app.use('/', userOAuthRouter);

app.get('/', (req, res) => {
  res.send('Hello from the user backend!');
});

if (config.NODE_ENV !== 'test') {
  app.listen(port, () => {
    logger.info('Server started', {
      port,
      service: 'user-backend',
      environment: config.NODE_ENV || 'development',
    });
  });
}

export default app;