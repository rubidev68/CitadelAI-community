import express, { Request, Response } from 'express';
import { userAuthMiddleware, UserAuthRequest } from '../middleware/auth';
import { 
  generateUserOAuthUrl, 
  exchangeUserOAuthCode, 
  generateCalDAVAuthUrl,
  storeCalDAVCredentials 
} from '../services/userOAuthService';
import { OAuthProvider } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { logger, validateRequest, sanitizeString, sanitizeUrl } from '@shared/utils';
import { config } from '../config';
import {
  startOAuthSchema,
  oauthCallbackSchema,
  caldavAuthSchema,
} from '../validation/oauthSchemas';

const router = express.Router();
const JWT_SECRET = config.JWT_SECRET;

/**
 * Start user OAuth flow
 * GET /api/user/oauth/start?provider=GOOGLE_CALENDAR&chatbotId=xxx&blockId=yyy
 */
router.get('/oauth/start', userAuthMiddleware, validateRequest(startOAuthSchema) as any, (async (req: UserAuthRequest, res: Response) => {
  const { provider, chatbotId, blockId } = req.query;
  const userId = req.user?.id;
  
  if (!userId || !provider || !chatbotId || !blockId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  try {
    const redirectUri = `${config.FRONTEND_URL}/oauth/callback`;
    const oauthUrl = await generateUserOAuthUrl(
      provider as OAuthProvider,
      userId,
      chatbotId as string,
      blockId as string,
      redirectUri
    );
    
    res.json({ oauthUrl });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate OAuth URL';
    logger.error('OAuth URL generation error', error instanceof Error ? error : undefined, {
      service: 'userOAuth-routes',
    });
    res.status(500).json({ error: errorMessage });
  }
}) as any);

/**
 * OAuth callback handler
 * GET /api/user/oauth/callback?code=xxx&state=yyy
 */
router.get('/oauth/callback', validateRequest(oauthCallbackSchema) as any, async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`${config.FRONTEND_URL}/oauth/callback?oauth_error=${encodeURIComponent(error as string)}`);
  }
  
  if (!code || !state) {
    return res.redirect(`${config.FRONTEND_URL}/oauth/callback?oauth_error=missing_params`);
  }
  
  try {
    // Parse state to get provider and user info
    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString('utf8'));
    const provider = stateData.provider as OAuthProvider;
    
    // Use backend callback URL as redirect URI (matches what we used in generateUserOAuthUrl)
    const backendRedirectUri = `${config.API_URL}/api/user/oauth/callback`;
    
    await exchangeUserOAuthCode(
      provider,
      code as string,
      state as string,
      backendRedirectUri
    );
    
    // Redirect to frontend callback page with success
    res.redirect(`${config.FRONTEND_URL}/oauth/callback?oauth_success=true`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';
    logger.error('OAuth callback error', error instanceof Error ? error : undefined, {
      service: 'userOAuth-routes',
    });
    res.redirect(`${config.FRONTEND_URL}/oauth/callback?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Store CalDAV credentials
 * POST /api/user/caldav/auth
 * Can be called with or without authentication:
 * - With auth: Uses authenticated user's ID
 * - Without auth: Uses chatbot owner's ID (for Slack/API integrations)
 */
router.post('/caldav/auth', validateRequest(caldavAuthSchema) as any, async (req: Request, res: Response) => {
  logger.debug('CalDAV Auth request received', {
    method: req.method,
    url: req.url,
    path: req.path,
    hasAuthHeader: !!req.headers.authorization,
    bodyKeys: Object.keys(req.body || {}),
    serverUrl: req.body?.serverUrl ? '***' : undefined,
    hasUsername: !!req.body?.username,
    hasPassword: !!req.body?.password,
    service: 'userOAuth-routes',
  });
  
  // Try to get userId from auth token (if provided, optional for Slack/API)
  let authenticatedUserId: string | undefined;
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (user) {
        authenticatedUserId = user.id;
        logger.debug('User authenticated for CalDAV Auth', {
          userId: authenticatedUserId,
          service: 'userOAuth-routes',
        });
      }
    } catch (error) {
      // Invalid token - continue without authentication (for Slack/API)
      logger.debug('Invalid or missing auth token, proceeding without authentication', {
        service: 'userOAuth-routes',
      });
    }
  }
  let { chatbotId, blockId, serverUrl, username, password, slackUserId } = req.body;
  
  // Sanitize inputs
  if (serverUrl) {
    serverUrl = sanitizeUrl(serverUrl);
  }
  if (username) {
    username = sanitizeString(username);
  }
  if (slackUserId) {
    slackUserId = sanitizeString(slackUserId);
  }
  
  // Also check URL params for slackUserId (from auth URL)
  if (!slackUserId) {
    slackUserId = typeof req.query.slackUserId === 'string' ? sanitizeString(req.query.slackUserId) : undefined;
  }
  
  if (!chatbotId || !serverUrl || !username || !password) {
    logger.warn('Missing required parameters for CalDAV Auth', {
      chatbotId: !!chatbotId,
      serverUrl: !!serverUrl,
      username: !!username,
      password: !!password,
      service: 'userOAuth-routes',
    });
    return res.status(400).json({ error: 'Missing required parameters: chatbotId, serverUrl, username, and password are required' });
  }
  
  // blockId is optional (can be null for chatbot-level connections)
  const blockIdValue = blockId || null;
  const originalServerUrl = serverUrl; // Keep original for error messages
  
  // Get chatbot to find owner
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { id: true, ownerId: true },
  });
  
  if (!chatbot) {
    logger.warn('Chatbot not found for CalDAV Auth', {
      chatbotId,
      service: 'userOAuth-routes',
    });
    return res.status(404).json({ error: 'Chatbot not found' });
  }
  
  // Determine userId:
  // 1. If user is authenticated, use their ID (but verify they have access)
  // 2. If slackUserId is provided, use/create a User record for that Slack user
  // 3. If not authenticated and no slackUserId, use chatbot owner's ID (fallback)
  let userId: string;
  
  if (authenticatedUserId) {
    // User is authenticated - verify they have access to this chatbot
    const hasAccess = await prisma.chatbotAccess.findFirst({
      where: {
        chatbotId,
        userId: authenticatedUserId,
      },
    });
    
    if (!hasAccess) {
      // Check if user is the chatbot owner (by email match)
      const owner = await prisma.adminUser.findUnique({
        where: { id: chatbot.ownerId },
        select: { email: true },
      });
      const user = await prisma.user.findUnique({
        where: { id: authenticatedUserId },
        select: { email: true },
      });
      
      if (!hasAccess && owner?.email !== user?.email) {
        logger.warn('User does not have access to chatbot for CalDAV Auth', {
          userId: authenticatedUserId,
          chatbotId,
          service: 'userOAuth-routes',
        });
        return res.status(403).json({ error: 'You do not have access to this chatbot' });
      }
    }
    
    userId = authenticatedUserId;
  } else if (slackUserId) {
    // Slack user - create/find User record for this Slack user
    const slackUserEmail = `slack-${slackUserId}@slack.local`;
    let slackUser = await prisma.user.findUnique({
      where: { email: slackUserEmail },
    });
    
    if (!slackUser) {
      // Create a User record for this Slack user
      const randomPassword = await bcrypt.hash(Math.random().toString(), 10);
      
      slackUser = await prisma.user.create({
        data: {
          email: slackUserEmail,
          password: randomPassword, // Won't be used for login
          name: `Slack User ${slackUserId}`,
        },
      });
      logger.debug('Created User record for Slack user', {
        slackUserId,
        userId: slackUser.id,
        service: 'userOAuth-routes',
      });
    }
    
    userId = slackUser.id;
    logger.debug('Using Slack user ID for CalDAV Auth', {
      slackUserId,
      userId,
      chatbotId,
      service: 'userOAuth-routes',
    });
  } else {
    // Not authenticated and no slackUserId - use chatbot owner's ID (fallback)
    const owner = await prisma.adminUser.findUnique({
      where: { id: chatbot.ownerId },
      select: { id: true, email: true },
    });
    
    if (!owner) {
      return res.status(404).json({ error: 'Chatbot owner not found' });
    }
    
    // Find or create a User record for the owner
    let ownerUser = await prisma.user.findUnique({
      where: { email: owner.email },
    });
    
    if (!ownerUser) {
      // Create a user record for the owner
      const randomPassword = await bcrypt.hash(Math.random().toString(), 10);
      
      ownerUser = await prisma.user.create({
        data: {
          email: owner.email,
          password: randomPassword, // Won't be used for login
          name: owner.email.split('@')[0],
        },
      });
    }
    
    userId = ownerUser.id;
    logger.debug('Using chatbot owner user ID for unauthenticated request', {
      userId,
      chatbotId,
      ownerId: chatbot.ownerId,
      service: 'userOAuth-routes',
    });
  }
  
  logger.debug('Using userId for CalDAV Auth', {
    userId,
    chatbotId,
    blockId: blockIdValue,
    isAuthenticated: !!authenticatedUserId,
    service: 'userOAuth-routes',
  });
  
  logger.debug('Testing CalDAV connection', {
    serverUrl,
    username,
    passwordLength: password?.length || 0,
    userId,
    chatbotId,
    service: 'userOAuth-routes',
  });
  
  // Test CalDAV connection before storing
  try {
    // Skip SSL certificate validation for self-hosted CalDAV servers
    const https = require('https');
    
    // Helper function to test CalDAV connection at a specific URL
    interface CalDAVTestResult {
      success: boolean;
      response?: { status: number; statusText: string; data?: unknown; headers?: Record<string, unknown> };
      error?: { status?: number; statusText?: string; message?: string; response?: { status?: number; statusText?: string; headers?: Record<string, unknown> } };
    }
    const testCalDAVConnection = async (testUrl: string): Promise<CalDAVTestResult> => {
      try {
        logger.debug('Testing PROPFIND for CalDAV', {
          testUrl,
          service: 'userOAuth-routes',
        });
        const response = await axios.request({
          method: 'PROPFIND',
          url: testUrl,
          auth: {
            username,
            password,
          },
          headers: {
            'Depth': '1',
            'Content-Type': 'application/xml',
          },
          data: `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname />
  </d:prop>
</d:propfind>`,
          validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
          httpsAgent: new https.Agent({
            rejectUnauthorized: false, // Skip SSL certificate validation
          }),
        });
        
        logger.debug('PROPFIND response for CalDAV', {
          url: testUrl,
          status: response.status,
          statusText: response.statusText,
          allowHeader: response.headers['allow'] || response.headers['Allow'],
          service: 'userOAuth-routes',
        });
        
        return { success: response.status < 400, response };
      } catch (err: unknown) {
        const axiosError = err && typeof err === 'object' && 'response' in err ? err as { response?: { status?: number; statusText?: string } } : null;
        const errMessage = err instanceof Error ? err.message : 'PROPFIND request failed';
        logger.debug('PROPFIND error for CalDAV', {
          testUrl,
          status: axiosError?.response?.status,
          statusText: axiosError?.response?.statusText,
          message: errMessage,
          service: 'userOAuth-routes',
        });
        const errorResult: { status?: number; statusText?: string; message?: string } = {
          status: axiosError?.response?.status,
          statusText: axiosError?.response?.statusText,
          message: errMessage,
        };
        return { success: false, error: errorResult };
      }
    };
    
    // Try the provided URL first
    let connectionResult = await testCalDAVConnection(serverUrl);
    
    // If we get a 405 (Method Not Allowed), try common CalDAV paths
    if (!connectionResult.success && (connectionResult.response?.status === 405 || connectionResult.error?.response?.status === 405)) {
      logger.debug('Got 405 at base URL, trying common CalDAV paths', {
        service: 'userOAuth-routes',
      });
      
      // Parse the base URL
      const urlObj = new URL(serverUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      const basePath = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
      
      // Common CalDAV paths to try
      const commonPaths = [
        '/remote.php/dav/calendars/' + username + '/',
        '/remote.php/dav/',
        '/dav/calendars/' + username + '/',
        '/dav/',
        '/caldav/',
        '/.well-known/caldav',
      ];
      
      // If the base path is not empty, try prepending it
      const pathsToTry = basePath 
        ? [...commonPaths, ...commonPaths.map(p => basePath + p)]
        : commonPaths;
      
      for (const path of pathsToTry) {
        const testUrl = baseUrl + path;
        logger.debug('Trying alternative CalDAV path', {
          testUrl,
          service: 'userOAuth-routes',
        });
        connectionResult = await testCalDAVConnection(testUrl);
        
        if (connectionResult.success) {
          logger.info('Found working CalDAV endpoint', {
            testUrl,
            service: 'userOAuth-routes',
          });
          // Update serverUrl to the working endpoint
          serverUrl = testUrl;
          break;
        }
      }
    }
    
    // Check final result
    if (!connectionResult.success) {
      const finalResponse = connectionResult.response || connectionResult.error?.response;
      const status = finalResponse?.status || connectionResult.error?.response?.status || 'unknown';
      const statusText = finalResponse?.statusText || connectionResult.error?.response?.statusText || 'Unknown error';
      const allowedMethods = finalResponse?.headers?.['allow'] || finalResponse?.headers?.['Allow'] || 'unknown';
      
      logger.warn('All CalDAV connection attempts failed', {
        status,
        service: 'userOAuth-routes',
      });
      
      return res.status(401).json({ 
        error: 'Failed to connect to CalDAV server.',
        details: status === 405 
          ? `PROPFIND method not allowed at "${originalServerUrl}". Please provide the full CalDAV endpoint URL (e.g., https://server.com/remote.php/dav/calendars/username/calendar-name) instead of just the base server URL.`
          : `Server returned status ${status}: ${statusText}`,
        debug: {
          originalUrl: originalServerUrl,
          testedUrls: [originalServerUrl, ...(connectionResult.error ? [] : [])],
          status,
          statusText,
          allowedMethods,
          suggestion: status === 405 
            ? 'For Nextcloud/ownCloud, use: https://your-server.com/remote.php/dav/calendars/username/calendar-name\nFor other CalDAV servers, check your server documentation for the correct CalDAV endpoint path.'
            : 'Please verify your server URL, username, and password are correct.',
        }
      });
    }
    
    logger.info('CalDAV connection test successful', {
      serverUrl,
      service: 'userOAuth-routes',
    });
  } catch (error: unknown) {
    interface AxiosErrorLike {
      code?: string;
      response?: {
        status: number;
        statusText: string;
        headers: Record<string, unknown>;
        data: string | unknown;
      };
    }
    interface ErrorDetails {
      message: string;
      code?: string;
      response?: {
        status: number;
        statusText: string;
        headers: Record<string, unknown>;
        data: string | unknown;
      };
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const axiosError = error && typeof error === 'object' && ('code' in error || 'response' in error) ? error as AxiosErrorLike : null;
    const errorDetails: ErrorDetails = error instanceof Error ? {
      message: error.message,
      code: axiosError?.code,
      response: axiosError?.response ? {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        headers: axiosError.response.headers,
        data: typeof axiosError.response.data === 'string' 
          ? axiosError.response.data.substring(0, 500)
          : 'non-string',
      } : undefined,
    } : { message: 'Unknown error' };
    
    logger.error('CalDAV connection test error', error instanceof Error ? error : undefined, {
      errorDetails,
      service: 'userOAuth-routes',
    });
    
    // If it's a 405 error, provide more specific guidance
    if (axiosError?.response?.status === 405 || errorDetails.response?.status === 405) {
      logger.error('405 Method Not Allowed - PROPFIND may not be supported at this URL', undefined, {
        service: 'userOAuth-routes',
      });
      return res.status(401).json({ 
        error: 'CalDAV server does not support PROPFIND method at this URL.',
        details: `Server returned 405 Method Not Allowed. The URL "${serverUrl}" may not be a valid CalDAV endpoint. Try using the base CalDAV URL (e.g., https://server.com/remote.php/dav/calendars/username/calendar-name)`,
        debug: {
          requestedUrl: serverUrl,
          method: 'PROPFIND',
          serverResponse: errorDetails.response,
        }
      });
    }
    
    return res.status(401).json({ 
      error: 'Failed to connect to CalDAV server. Please check your credentials.',
      details: errorMessage,
      debug: errorDetails
    });
  }
  
  // Store credentials
  logger.debug('Connection test passed, storing credentials', {
    service: 'userOAuth-routes',
  });
  try {
    const connection = await storeCalDAVCredentials(
      userId,
      chatbotId,
      blockIdValue,
      serverUrl,
      username,
      password
    );
    
    logger.info('CalDAV credentials stored successfully', {
      connectionId: connection.id,
      userId,
      chatbotId,
      blockId: blockIdValue,
      provider: 'CALDAV',
      service: 'userOAuth-routes',
    });
    
    res.json({ 
      success: true,
      connectionId: connection.id,
      message: 'CalDAV calendar connected successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to store credentials';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('CalDAV credential storage error', error instanceof Error ? error : undefined, {
      userId,
      chatbotId,
      blockId: blockIdValue,
      service: 'userOAuth-routes',
    });
    res.status(500).json({ error: errorMessage });
  }
});

/**
 * Get user's OAuth connections
 * GET /api/user/oauth/connections?chatbotId=xxx
 */
router.get('/oauth/connections', userAuthMiddleware, (async (req: UserAuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { chatbotId } = req.query;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const connections = await prisma.userOAuthConnection.findMany({
      where: {
        userId: userId,
        chatbotId: chatbotId as string,
        isActive: true,
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        providerAccountName: true,
        connectedAt: true,
        lastUsedAt: true,
        blockId: true,
      },
    });
    
    res.json({ connections });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get connections';
    logger.error('Get connections error', error instanceof Error ? error : undefined, {
      service: 'userOAuth-routes',
    });
    res.status(500).json({ error: errorMessage });
  }
}) as any);

export default router;
