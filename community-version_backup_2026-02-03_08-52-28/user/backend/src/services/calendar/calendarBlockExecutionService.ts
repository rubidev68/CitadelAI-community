import { Block, BlockType, OAuthProvider, UserOAuthConnection } from '@prisma/client';
import { getCalendarProvider } from '../calendarProviders/providerFactory';
import { CalendarProvider } from '../calendarProviders/types';
import { CalDAVProvider } from '../calendarProviders/caldavProvider';
import { ensureValidUserToken as ensureValidUserTokenFromService, invalidateUserOAuthConnection, getUserOAuthConnection } from '../userOAuthService';
import { clearBlockCache } from '../calendarCacheService';
import prisma from '../../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../../config';
import { CalendarBlockProperties, CalendarBlockResult, ExtractedEventDetails, CachedEventInfo } from './types';
import { executeCalendarContextBlock } from './execution/contextExecution';
import { executeCalendarActionBlock } from './execution/actionExecution';
import { generateUserOAuthUrl, generateCalDAVAuthUrlWithSlackUserId, parseCalDAVCredentials, getRedirectUri } from './utils/oauthUtils';

/**
 * Execute calendar block (CONTEXT or ACTION mode)
 */
export async function executeCalendarBlock(
  block: Block,
  userId: string | null | undefined,
  chatbotId: string,
  userMessage: string,
  sessionData: Record<string, any>,
  slackUserId?: string, // Slack user ID for OAuth connection storage
  sessionId?: string, // Session ID for caching calendar results
  extractedEventDetails?: ExtractedEventDetails, // AI-extracted event details (from intent detection)
  actionType?: 'create' | 'update' | 'delete', // AI-detected action type
  cachedEventInfo?: CachedEventInfo // Cached event info from intent detection (to avoid re-searching)
): Promise<CalendarBlockResult> {
  // Log prefix depends on block type
  const logPrefix = block.type === BlockType.ACTION ? '[Manage Events]' : '[Calendar Block]';
  // 1. Get block properties
  const properties = block.properties as unknown as CalendarBlockProperties;
  // Provider will be determined after checking credential sharing (may inherit from context block)
  
  // For Slack/API requests without userId, use slackUserId if available
  // If we have slackUserId, we can look up/store OAuth connections
  if (!userId && slackUserId) {
    // Use slackUserId to find/create a User record for this Slack user
    // This allows us to store OAuth connections per Slack user
    const slackUserEmail = `slack-${slackUserId}@slack.local`;
    let slackUser = await prisma.user.findUnique({
      where: { email: slackUserEmail },
    });
    
    if (!slackUser) {
      // Create a User record for this Slack user
      const bcrypt = require('bcrypt');
      const randomPassword = await bcrypt.hash(Math.random().toString(), 10);
      
      slackUser = await prisma.user.create({
        data: {
          email: slackUserEmail,
          password: randomPassword, // Won't be used for login
          name: `Slack User ${slackUserId}`,
        },
      });
    }
    
    // Use the Slack user's ID for OAuth connections
    userId = slackUser.id;
    logger.debug('Using Slack user ID for calendar block', {
      slackUserId,
      userId: slackUser.id,
      service: 'calendarBlockExecutionService',
    });
  }
  
  // For Slack/API requests without userId or slackUserId, return auth requirement
  if (!userId) {
    const frontendUrl = config.FRONTEND_URL;
    let authUrl = '';
    
    // Use finalProvider if available, otherwise default to google_calendar
    const authProvider = properties.provider || 'google_calendar';
    
    if (authProvider === 'caldav') {
      // Generate state token with chatbotId, blockId, and slackUserId (if available)
      // Include slackUserId in state so we can associate the connection with the Slack user
      const stateData = {
        userId: userId || null, // Will be set from slackUserId if available
        chatbotId,
        blockId: block.id,
        provider: OAuthProvider.CALDAV,
        redirectUri: `${frontendUrl}/caldav/auth`,
        slackUserId: slackUserId || null, // Include Slack user ID for connection storage
      };
      const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
      
      // Get server URL from block properties
      const serverUrl = properties.caldavConfig?.serverUrl || '';
      
      // Build URL with state and serverUrl
      const params = new URLSearchParams({
        state: state,
        chatbotId: chatbotId,
        blockId: block.id,
      });
      if (serverUrl) {
        params.append('serverUrl', serverUrl);
      }
      if (slackUserId) {
        params.append('slackUserId', slackUserId);
      }
      
      authUrl = `${frontendUrl}/caldav/auth?${params.toString()}`;
    } else {
      authUrl = `${frontendUrl}/oauth/start?provider=GOOGLE_CALENDAR&chatbotId=${chatbotId}&blockId=${block.id}`;
    }
    
    return {
      requiresAuth: true,
      authUrl: authUrl,
      provider: authProvider,
      blockId: block.id,
      serverUrl: properties.caldavConfig?.serverUrl,
      retryCount: 0,
      error: 'Calendar authentication required. Please authenticate via the web interface.',
    };
  }
  
  // Check retry count from session data
  const retryKey = `calendar_auth_retry_${block.id}`;
  const retryCount = sessionData[retryKey] || 0;
  const maxRetries = 1;
  
  // 2. Get user's OAuth connection (or CalDAV credentials)
  let connection: UserOAuthConnection | null = null;
  let accessToken: string;
  let effectiveBlockId = block.id; // Block ID to use for credential lookup
  
  // Check if this action block should share credentials with a context block
  if (block.type === BlockType.ACTION) {
    if (properties.shareCredentialsWithBlockId) {
      effectiveBlockId = properties.shareCredentialsWithBlockId;
      logger.debug('Action block sharing credentials', {
        actionBlockId: block.id,
        contextBlockId: effectiveBlockId,
        service: 'calendarBlockExecutionService',
      });
      
      // Get the context block to inherit its provider and CalDAV config
      const contextBlock = await prisma.block.findUnique({
        where: { id: effectiveBlockId },
      });
      
      if (contextBlock) {
        const contextProperties = contextBlock.properties as unknown as CalendarBlockProperties;
        // Always inherit provider from context block when sharing credentials
        if (contextProperties.provider) {
          properties.provider = contextProperties.provider;
        }
        // Always inherit CalDAV config from context block when sharing credentials
        if (contextProperties.caldavConfig) {
          properties.caldavConfig = {
            ...contextProperties.caldavConfig,
            // Action block can still override specific fields if needed, but defaults to context block
            ...properties.caldavConfig,
          };
        }
      } else {
        logger.warn('Referenced context block not found', {
          effectiveBlockId,
          service: 'calendarBlockExecutionService',
        });
        // Fallback: use action block's own configuration
      }
    } else {
      // Action block without shared credentials - this is not recommended
      logger.warn('Action block not linked to context block. Users will need to authenticate separately', {
        service: 'calendarBlockExecutionService',
      });
    }
  }
  
  // For action blocks, require link to context block
  if (block.type === BlockType.ACTION && !properties.shareCredentialsWithBlockId) {
    logger.error('Action block not linked to context block', undefined, {
      service: 'calendarBlockExecutionService',
    });
    return {
      requiresAuth: false,
      error: 'This action block must be linked to a Calendar context block. Please configure the link in the block properties.',
      blockId: block.id,
    };
  }
  
  // Update provider after potential inheritance
  const finalProvider = properties.provider || 'google_calendar';
  
  logger.debug('Provider configuration', {
    finalProvider,
    effectiveBlockId,
    shareCredentialsWithBlockId: properties.shareCredentialsWithBlockId || 'none',
    service: 'calendarBlockExecutionService',
  });
  
  if (finalProvider === 'caldav') {
    logger.debug('Using CalDAV provider', {
      service: 'calendarBlockExecutionService',
    });
    // CalDAV uses Basic Auth, stored differently
    const oauthProvider = OAuthProvider.CALDAV;
    connection = await getUserOAuthConnection(userId, chatbotId, effectiveBlockId, oauthProvider);
    
    if (!connection || !connection.isActive) {
      logger.debug('CalDAV authentication required (no active connection)', {
        service: 'calendarBlockExecutionService',
      });
      const authUrl = await generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, effectiveBlockId, properties.caldavConfig?.serverUrl || '', slackUserId);
      return {
        requiresAuth: true,
        authUrl: authUrl,
        provider: finalProvider,
        blockId: block.id,
        retryCount,
      };
    }
    
    // For CalDAV, accessToken contains encrypted serverUrl|username|password
    if (!connection.accessToken) {
      logger.debug('CalDAV authentication required (no access token)', {
        service: 'calendarBlockExecutionService',
      });
      const authUrl = await generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, effectiveBlockId, properties.caldavConfig?.serverUrl || '', slackUserId);
      return {
        requiresAuth: true,
        authUrl: authUrl,
        provider: finalProvider,
        error: 'No access token found for CalDAV connection',
        blockId: block.id,
        retryCount,
      };
    }
    
    try {
      logger.debug('Validating CalDAV token', {
        service: 'calendarBlockExecutionService',
      });
      accessToken = await ensureValidUserTokenFromService(connection);
      logger.debug('CalDAV token validated successfully', {
        service: 'calendarBlockExecutionService',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'CalDAV token validation failed';
      logger.error('CalDAV token validation error', error instanceof Error ? error : undefined, {
        retryCount,
        service: 'calendarBlockExecutionService',
      });
      // Invalid token - invalidate it
      await invalidateUserOAuthConnection(userId, chatbotId, effectiveBlockId, oauthProvider);
      
      if (retryCount < maxRetries) {
        const authUrl = await generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, effectiveBlockId, properties.caldavConfig?.serverUrl || '', slackUserId);
        return {
          requiresAuth: true,
          authUrl: authUrl,
          provider: finalProvider,
          error: `Authentication failed: ${errorMessage}. Please log in again.`,
          blockId: block.id,
          retryCount: retryCount + 1,
        };
      } else {
        return {
          requiresAuth: false,
          error: `Authentication failed after ${maxRetries} retry. Please try again later.`,
          blockId: block.id,
          retryCount,
        };
      }
    }
  } else {
    // OAuth providers (Google Calendar)
    logger.debug('Using OAuth provider', {
      provider: finalProvider,
      service: 'calendarBlockExecutionService',
    });
    const oauthProvider = OAuthProvider.GOOGLE_CALENDAR;
    connection = await getUserOAuthConnection(userId, chatbotId, effectiveBlockId, oauthProvider);
    
    if (!connection || !connection.isActive) {
      logger.debug('OAuth authentication required (no active connection)', {
        service: 'calendarBlockExecutionService',
      });
      return {
        requiresAuth: true,
        authUrl: await generateUserOAuthUrl(oauthProvider, userId, chatbotId, effectiveBlockId, getRedirectUri()),
        provider: finalProvider,
        blockId: block.id,
        retryCount,
      };
    }
    
    logger.debug('OAuth connection found, validating token', {
      service: 'calendarBlockExecutionService',
    });
    
    // Ensure valid OAuth token
    try {
      accessToken = await ensureValidUserTokenFromService(connection);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Token validation failed';
      logger.error('Calendar block token error', error instanceof Error ? error : undefined, {
        service: 'calendarBlockExecutionService',
      });
      // Invalid token - invalidate it
      await invalidateUserOAuthConnection(userId, chatbotId, effectiveBlockId, oauthProvider);
      
      if (retryCount < maxRetries) {
        return {
          requiresAuth: true,
          authUrl: await generateUserOAuthUrl(oauthProvider, userId, chatbotId, effectiveBlockId, getRedirectUri()),
          provider: finalProvider,
          error: `Authentication failed: ${errorMessage}. Please log in again.`,
          blockId: block.id,
          retryCount: retryCount + 1,
        };
      } else {
        return {
          requiresAuth: false,
          error: `Authentication failed after ${maxRetries} retry. Please try again later.`,
          blockId: block.id,
          retryCount,
        };
      }
    }
  }
  
  // 5. Get calendar provider
  const calendarProvider = getCalendarProvider(finalProvider);
  
  // 6. Set CalDAV config if needed
  if (finalProvider === 'caldav' && calendarProvider instanceof CalDAVProvider) {
    try {
      const { username, password, serverUrl } = parseCalDAVCredentials(accessToken);
      calendarProvider.setConfig({
        serverUrl,
        username,
        password,
        calendarPath: properties.caldavConfig?.calendarPath,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Calendar context block failed';
      logger.error('Calendar context block error', error instanceof Error ? error : undefined, {
        service: 'calendarBlockExecutionService',
      });
      // Invalid credentials - invalidate token
      await invalidateUserOAuthConnection(userId, chatbotId, effectiveBlockId, OAuthProvider.CALDAV);
      
      if (retryCount < maxRetries) {
        const authUrl = await generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, effectiveBlockId, properties.caldavConfig?.serverUrl || '', slackUserId);
        return {
          requiresAuth: true,
          authUrl: authUrl,
          provider: finalProvider,
          error: `Failed to parse CalDAV credentials: ${errorMessage}. Please log in again.`,
          blockId: block.id,
          retryCount: retryCount + 1,
        };
      } else {
        return {
          requiresAuth: false,
          error: `Failed to parse credentials after ${maxRetries} retry. Please try again later.`,
          blockId: block.id,
          retryCount,
        };
      }
    }
  }
  
  // 7. Execute based on block type
  try {
    if (block.type === BlockType.CONTEXT) {
      logger.debug('Executing CONTEXT block', {
        service: 'calendarBlockExecutionService',
      });
      return await executeCalendarContextBlock(block, calendarProvider, accessToken, userMessage, sessionData, sessionId, userId);
    } else if (block.type === BlockType.ACTION) {
      logger.debug('Executing ACTION block', {
        service: 'calendarBlockExecutionService',
      });
      // Clear cache when action blocks modify calendar (create/update/delete)
      // This ensures next context fetch gets fresh data
      if (sessionId) {
        // Clear cache for all calendar blocks in this session to be safe
        clearBlockCache(sessionId, block.id);
      }
      return await executeCalendarActionBlock(
        block, 
        calendarProvider, 
        accessToken, 
        userMessage, 
        sessionData,
        sessionId,
        userId,
        extractedEventDetails,
        actionType,
        cachedEventInfo // Pass cached event info to avoid re-searching
      );
    } else {
      logger.error('Invalid block type', undefined, {
        blockType: block.type,
        service: 'calendarBlockExecutionService',
      });
      throw new Error(`Invalid block type for calendar block: ${block.type}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Calendar block execution failed';
    logger.error('Calendar block execution error', error instanceof Error ? error : undefined, {
      blockId: block.id,
      blockType: block.type,
      service: 'calendarBlockExecutionService',
    });
    // Check if it's an auth-related error
    const errorMessageLower = errorMessage.toLowerCase();
    const isAuthError = errorMessageLower.includes('unauthorized') || 
                       errorMessageLower.includes('authentication') || 
                       errorMessageLower.includes('invalid token') ||
                       errorMessageLower.includes('expired');
    
    if (isAuthError && retryCount < maxRetries) {
      // Invalidate token and request re-auth
      const oauthProvider = finalProvider === 'caldav' ? OAuthProvider.CALDAV : OAuthProvider.GOOGLE_CALENDAR;
      await invalidateUserOAuthConnection(userId, chatbotId, effectiveBlockId, oauthProvider);
      
      const authUrl = finalProvider === 'caldav' 
        ? await generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, effectiveBlockId, properties.caldavConfig?.serverUrl || '', slackUserId)
        : await generateUserOAuthUrl(OAuthProvider.GOOGLE_CALENDAR, userId, chatbotId, effectiveBlockId, getRedirectUri());
      return {
        requiresAuth: true,
        authUrl: authUrl,
        provider: finalProvider,
        error: `Authentication failed: ${errorMessage}. Please log in again.`,
        blockId: block.id,
        retryCount: retryCount + 1,
      };
    }
    
    // Non-auth error or max retries reached
    return {
      requiresAuth: false,
      error: errorMessage || 'Failed to execute calendar block',
      blockId: block.id,
      retryCount,
    };
  }
}

// Re-export formatEventForContext for backward compatibility
export { formatEventForContext } from './execution/resultFormatter';
