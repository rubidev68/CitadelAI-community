import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import bcrypt from 'bcrypt';
import { isFeatureEnabled } from './shared/config/features';
import { getEmailService } from './services/zoho-email';
import { checkChatbotLimit } from './middleware/subscriptionMiddleware';
import prisma from './lib/prisma';
import app, { adminLogger } from './app';
import { authenticateToken, AuthRequest, PrismaError } from './middleware/auth';
import healthRoutes from './routes/health';
import internalRoutes from './routes/internal';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;

// Mount health routes
app.use('/', healthRoutes);

// Mount internal routes (before logging middleware to avoid logging sensitive data)
app.use('/', internalRoutes);

// Logging middleware (after internal endpoints to avoid logging sensitive data)
app.use((req, res, next) => {
  // Skip logging for internal endpoints
  if (req.path.startsWith('/api/admin/internal/')) {
    return next();
  }
  adminLogger.debug('Request received', { method: req.method, url: req.url });
  if (req.body && Object.keys(req.body).length > 0) {
    adminLogger.debug('Request body', { body: req.body });
  }
  next();
});

app.get('/', (req, res) => {
  res.send('Admin Backend is running!');
});

// Mount auth routes
app.use('/api/admin', authRoutes);
adminLogger.info('Auth routes loaded');

// Mount dashboard routes
app.use('/api/admin', dashboardRoutes);
adminLogger.info('Dashboard routes loaded');

// Import API tokens routes early to register before chatbot routes
// This ensures /api/admin/chatbots/:chatbotId/api-tokens matches before /api/admin/chatbots/:id
import apiTokensRoutes from './routes/apiTokens';
app.use('/api/admin', apiTokensRoutes);
adminLogger.info('API tokens routes loaded');

// Import Slack routes early to register before chatbot routes
// This ensures /api/admin/chatbots/:chatbotId/slack/integration matches before /api/admin/chatbots/:id
// Mount OAuth and webhook routes at /api/admin/slack
// Cloud storage integration routes
const cloudRoutes = require('./routes/cloud').default;
app.use('/api/admin/cloud', cloudRoutes);
adminLogger.info('Cloud storage routes loaded');

// Cloud storage auto-refresh cron job (runs every hour)
cron.schedule('0 * * * *', async () => {
  try {
    // Get all Cloud blocks
    const cloudBlocks = await prisma.block.findMany({
      where: {
        type: 'CONTEXT',
        subtype: 'Cloud',
      },
    });

    for (const block of cloudBlocks) {
      const properties = block.properties as Record<string, unknown>;
      const autoRefresh = properties.autoRefresh as boolean | undefined;
      const refreshInterval = (properties.refreshInterval as number | undefined) || 24;
      const lastIndexedAt = properties.lastIndexedAt as string | undefined;
      const indexingStatus = properties.indexingStatus as string | undefined;
      const isConnected = properties.isConnected as boolean | undefined;

      // Skip if not connected or currently indexing
      if (!isConnected || indexingStatus === 'indexing') {
        continue;
      }

      // Check if refresh is needed
      const shouldRefresh = !lastIndexedAt || 
        (Date.now() - new Date(lastIndexedAt).getTime()) > (refreshInterval * 60 * 60 * 1000);

      if (autoRefresh && shouldRefresh) {
        adminLogger.info('Starting cloud auto-refresh indexing', { blockId: block.id });
        const { indexCloudFiles } = require('./services/cloudIndexingService');
        indexCloudFiles(block.id).catch((error: unknown) => {
          adminLogger.error('Cloud auto-refresh indexing error', { blockId: block.id, error: error instanceof Error ? error : new Error(String(error)) });
        });
      }
    }
  } catch (error) {
    adminLogger.error('Cloud auto-refresh cron job error', { error: error instanceof Error ? error : new Error(String(error)) });
  }
});
adminLogger.info('Cloud storage auto-refresh cron job scheduled (runs every hour)');
// Mount chatbot-specific routes at /api/admin to match frontend expectations
adminLogger.info('Slack routes loaded');

// Mount chatbot routes
import chatbotRoutes from './routes/chatbots';
app.use('/api/admin', chatbotRoutes);
adminLogger.info('Chatbot routes loaded');

// Mount custom provider routes
import customProvidersRoutes from './routes/customProviders';
app.use('/api/admin', customProvidersRoutes);
adminLogger.info('Custom provider routes loaded');

// Mount credentials routes
import credentialsRoutes from './routes/credentials';
app.use('/api/admin/credentials', credentialsRoutes);
adminLogger.info('Credentials routes loaded');

// Mount profile routes
import profileRoutes from './routes/profile';
app.use('/api/admin', profileRoutes);
adminLogger.info('Profile routes loaded');

import crawlingRoutes from './routes/crawling';
import documentsRoutes from './routes/documents';
import testDatasetsRoutes from './routes/testDatasets';
import testRunsRoutes from './routes/testRuns';
import trialNotificationsRoutes, { checkAndSendTrialNotifications } from './routes/trialNotifications';

// Always load core routes
app.use('/api/admin', crawlingRoutes);
app.use('/api/admin', documentsRoutes);
app.use('/api/admin/trial-notifications', trialNotificationsRoutes);

// Widget routes (public endpoints) - Register BEFORE publicApi to ensure /api/widget routes match first
import widgetRoutes from './routes/widget';
app.use('/api/widget', widgetRoutes);
app.use('/api/admin', widgetRoutes); // Also register admin endpoints
adminLogger.info('Widget routes loaded');

// Public API routes (no /api/admin prefix)
import publicApiRoutes from './routes/publicApi';
import dbBlockRoutes from './routes/dbBlock';
import aiModelsRoutes from './routes/aiModels';

app.use('/api', publicApiRoutes);
app.use('/api/admin', aiModelsRoutes);
adminLogger.info('Public API routes loaded');

// API Documentation routes
import apiDocsRoutes from './routes/apiDocs';
app.use('/', apiDocsRoutes);
adminLogger.info('API documentation routes loaded');


// Load test datasets and test runs routes (available in both business and community)
app.use('/api/admin', testDatasetsRoutes);
adminLogger.info('Test datasets routes loaded');

app.use('/api/admin', testRunsRoutes);
app.use('/api/admin', dbBlockRoutes);
adminLogger.info('Test runs routes loaded');

// Load business routes (billing, subscription, enterprise)
// These are consolidated in a separate module that can be easily removed for Community Edition
if (isFeatureEnabled('billing') || isFeatureEnabled('enterprise')) {
  const { registerBusinessRoutes } = require('./routes/business');
  registerBusinessRoutes(app).catch((error: unknown) => {
    adminLogger.error('Error registering business routes', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  });
}

// Test email endpoint (for debugging)
app.get('/api/admin/test-email', async (req, res) => {
  const testEmail = req.query.email as string || 'test@example.com';
  const skipVerify = req.query.skipVerify === 'true';
  
  try {
    const emailService = getEmailService();
    
    // Optionally test connection first (can be skipped if it hangs)
    if (!skipVerify) {
      try {
        const connectionOk = await emailService.verifyConnection();
        
        if (!connectionOk) {
          return res.status(500).json({ 
            error: 'SMTP connection verification failed',
            message: 'Please check your SMTP configuration and credentials. Try ?skipVerify=true to skip verification.'
          });
        }
      } catch (_verifyError: unknown) {
        // Continue anyway - will try to send email directly
      }
    }
    
    // Try to send a test email
    await emailService.sendEmail({
      to: testEmail,
      subject: 'Test Email from CitadelAI',
      htmlBody: '<h1>Test Email</h1><p>This is a test email from CitadelAI email service.</p>',
      textBody: 'Test Email\n\nThis is a test email from CitadelAI email service.',
    });
    
    res.json({ 
      success: true, 
      message: `Test email sent successfully to ${testEmail}`,
      connection: skipVerify ? 'skipped' : 'verified'
    });
  } catch (error: unknown) {
    const errorMessage = error && typeof error === 'object' && 'message' in error 
      ? String(error.message) 
      : 'Unknown error';
    adminLogger.error('Test email failed', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ 
      error: 'Failed to send test email',
      message: errorMessage
    });
  }
});

import { config } from './config';

if (config.NODE_ENV !== 'test') {
  app.listen(port, () => {
    adminLogger.info('Admin backend started', { port, environment: config.NODE_ENV || 'development' });
    
    // Try to initialize email service at startup to catch configuration errors early
    try {
      getEmailService();
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'message' in error 
        ? String(error.message) 
        : 'Unknown error';
      adminLogger.error('Email service initialization failed', { error: new Error(errorMessage) });
      adminLogger.error('Email sending will not work until this is fixed.');
    }
  });
}

// Set up scheduled task for trial notifications (runs daily at 9 AM UTC)
if (isFeatureEnabled('billing')) {
  // Schedule trial notification check to run daily at 9:00 AM UTC
  cron.schedule('0 9 * * *', async () => {
    adminLogger.info('Running scheduled trial notification check');
    try {
      await checkAndSendTrialNotifications();
    } catch (error: unknown) {
      adminLogger.error('Error in scheduled trial notification check', { error: error instanceof Error ? error : new Error(String(error)) });
    }
  }, {
    timezone: 'UTC'
  });
  adminLogger.info('Trial notification scheduler initialized', { schedule: 'daily at 9:00 AM UTC' });
}

export default app;
