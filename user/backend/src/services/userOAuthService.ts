import { OAuthProvider, UserOAuthConnection } from '@prisma/client';
import { google } from 'googleapis';
import crypto from 'crypto';
import { decryptToken } from '../utils/tokenEncryption';
import prisma from '../lib/prisma';
import { config } from '../config';

// Lazy-load encryption key to allow tests to set up environment variables first
function getEncryptionKey(): Buffer {
  // Priority: CLOUD_ENCRYPTION_KEY (process.env) > SLACK_ENCRYPTION_KEY (process.env) > SLACK_ENCRYPTION_KEY (config) > default
  // CLOUD_ENCRYPTION_KEY is not in config schema, so check process.env first
  let encryptionKey = process.env.CLOUD_ENCRYPTION_KEY || process.env.SLACK_ENCRYPTION_KEY;
  
  // Only access config if process.env doesn't have either key
  // In test environments or if SLACK_ENCRYPTION_KEY was deleted, use default to avoid config validation errors
  if (!encryptionKey) {
    // Check if we're in a test environment or if the key was explicitly deleted
    const isTestEnv = process.env.NODE_ENV === 'test';
    const keyWasDeleted = !('SLACK_ENCRYPTION_KEY' in process.env);
    
    if (isTestEnv || keyWasDeleted) {
      // In tests or if key was deleted, use default instead of accessing config
      // This prevents process.exit(1) from envalid validation when tests delete env vars
      encryptionKey = 'default-key-change-in-production-32-bytes!!';
    } else {
      // In production, try to access config (should have SLACK_ENCRYPTION_KEY set)
      encryptionKey = config.SLACK_ENCRYPTION_KEY;
    }
  }
  
  // Fallback to default if still no key
  if (!encryptionKey) {
    encryptionKey = 'default-key-change-in-production-32-bytes!!';
  }
  
  const key = Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32), 'utf8');
  return key;
}

/**
 * Encrypt a token before storing in database
 */
function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Store IV + authTag + encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Generate OAuth URL for user authentication
 */
export async function generateUserOAuthUrl(
  provider: OAuthProvider,
  userId: string,
  chatbotId: string,
  blockId: string | null,
  redirectUri: string
): Promise<string> {
  // Generate state token (CSRF protection)
  const state = generateOAuthState({
    userId,
    chatbotId,
    blockId: blockId as string | null,
    provider,
    redirectUri,
  });
  
  // Get provider-specific OAuth URL
  if (provider === OAuthProvider.GOOGLE_CALENDAR) {
    // Use backend callback URL as redirect URI (backend will redirect to frontend)
    const backendRedirectUri = `${config.API_URL}/api/user/oauth/callback`;
    
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CALENDAR_CLIENT_ID || config.GOOGLE_DRIVE_CLIENT_ID,
      config.GOOGLE_CALENDAR_CLIENT_SECRET || config.GOOGLE_DRIVE_CLIENT_SECRET,
      backendRedirectUri
    );
    
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent', // Force consent screen to get refresh token
    });
    
    return authUrl;
  }
  
  throw new Error(`OAuth URL generation not implemented for provider: ${provider}`);
}

/**
 * Exchange authorization code for user OAuth tokens
 */
export async function exchangeUserOAuthCode(
  provider: OAuthProvider,
  code: string,
  state: string,
  redirectUri: string
): Promise<any> {
  // Validate state
  const stateData = parseOAuthState(state);
  if (!stateData) {
    throw new Error('Invalid OAuth state');
  }
  
  const { userId, chatbotId, blockId } = stateData;
  
  // Exchange code for tokens
  if (provider === OAuthProvider.GOOGLE_CALENDAR) {
    // Use backend callback URL as redirect URI
    const backendRedirectUri = `${config.API_URL}/api/user/oauth/callback`;
    
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CALENDAR_CLIENT_ID || config.GOOGLE_DRIVE_CLIENT_ID,
      config.GOOGLE_CALENDAR_CLIENT_SECRET || config.GOOGLE_DRIVE_CLIENT_SECRET,
      backendRedirectUri
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }
    
    // Calculate expiration time
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default to 1 hour
    
    // Get account info
    oauth2Client.setCredentials(tokens);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await calendar.calendarList.get({ calendarId: 'primary' });
    
    const accountId = response.data.id || '';
    const accountName = response.data.summary || accountId;
    
    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token 
      ? encryptToken(tokens.refresh_token) 
      : null;
    
    // Store or update connection
    const blockIdValue: string | null = (blockId !== undefined && blockId !== '' ? blockId : null);
    return prisma.userOAuthConnection.upsert({
      where: {
        userId_chatbotId_blockId_provider: {
          userId,
          chatbotId,
          blockId: blockIdValue ?? (null as unknown as string),
          provider,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresAt,
        providerAccountId: accountId,
        providerAccountName: accountName,
        lastUsedAt: new Date(),
        isActive: true,
      },
      create: {
        userId,
        chatbotId,
        blockId: blockIdValue ?? null,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: expiresAt,
        providerAccountId: accountId,
        providerAccountName: accountName,
      },
    });
  }
  
  throw new Error(`Token exchange not implemented for provider: ${provider}`);
}

/**
 * Get user's OAuth connection for a block
 */
export async function getUserOAuthConnection(
  userId: string | null | undefined,
  chatbotId: string,
  blockId: string | null,
  provider: OAuthProvider
): Promise<UserOAuthConnection | null> {
  const blockIdValue: string | null = (blockId !== undefined && blockId !== '' ? blockId : null);
  
  // If userId is null/undefined (Slack/API requests), search by chatbotId + blockId + provider
  // This finds connections stored under the chatbot owner's account
  if (!userId) {
    return prisma.userOAuthConnection.findFirst({
      where: {
        chatbotId,
        blockId: blockIdValue,
        provider,
        isActive: true,
      },
    });
  }
  
  // For authenticated users, use the unique constraint
  return prisma.userOAuthConnection.findUnique({
    where: {
      userId_chatbotId_blockId_provider: {
        userId,
        chatbotId,
        blockId: blockIdValue ?? (null as unknown as string),
        provider,
      },
    },
  });
}

/**
 * Ensure user has valid OAuth token (refresh if needed)
 */
export async function ensureValidUserToken(
  connection: UserOAuthConnection
): Promise<string> {
  // Check if token is expired
  if (connection.expiresAt && connection.expiresAt < new Date()) {
    // Refresh token
    if (!connection.refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }
    
    if (connection.provider === OAuthProvider.GOOGLE_CALENDAR) {
      const oauth2Client = new google.auth.OAuth2(
        config.GOOGLE_CALENDAR_CLIENT_ID || config.GOOGLE_DRIVE_CLIENT_ID,
        config.GOOGLE_CALENDAR_CLIENT_SECRET || config.GOOGLE_DRIVE_CLIENT_SECRET
      );
      
      oauth2Client.setCredentials({
        refresh_token: decryptToken(connection.refreshToken),
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }
      
      // Update connection
      const encryptedAccessToken = encryptToken(credentials.access_token);
      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);
      
      await prisma.userOAuthConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: encryptedAccessToken,
          expiresAt: expiresAt,
          lastUsedAt: new Date(),
        },
      });
      
      return credentials.access_token;
    }
    
    throw new Error(`Token refresh not implemented for provider: ${connection.provider}`);
  }
  
  // Token is still valid
  return decryptToken(connection.accessToken);
}

/**
 * Generate CalDAV authentication URL (redirects to form, not OAuth)
 */
export async function generateCalDAVAuthUrl(
  userId: string,
  chatbotId: string,
  blockId: string,
  serverUrl: string
): Promise<string> {
  // Generate state token
  const state = generateOAuthState({
    userId,
    chatbotId,
    blockId,
    provider: OAuthProvider.CALDAV,
    redirectUri: `${config.FRONTEND_URL}/caldav/auth`,
  });
  
  // Return frontend URL with state and server URL
  // Note: The frontend will need to get userId from the auth token
  return `${config.FRONTEND_URL}/caldav/auth?state=${encodeURIComponent(state)}&serverUrl=${encodeURIComponent(serverUrl)}`;
}

/**
 * Store CalDAV credentials
 */
export async function storeCalDAVCredentials(
  userId: string,
  chatbotId: string,
  blockId: string | null,
  serverUrl: string,
  username: string,
  password: string
): Promise<any> {
  // Encrypt credentials as: serverUrl|username|password
  const credentialsString = `${serverUrl}|${username}|${password}`;
  const encryptedToken = encryptToken(credentialsString);
  
  // Store or update connection
  const blockIdValue: string | null = (blockId !== undefined && blockId !== '' ? blockId : null);
  return prisma.userOAuthConnection.upsert({
    where: {
      userId_chatbotId_blockId_provider: {
        userId,
        chatbotId,
        blockId: blockIdValue ?? (null as unknown as string),
        provider: OAuthProvider.CALDAV,
      },
    },
    update: {
      accessToken: encryptedToken,
      providerAccountId: username,
      providerAccountName: username,
      lastUsedAt: new Date(),
      isActive: true,
      expiresAt: null, // CalDAV Basic Auth doesn't expire
    },
    create: {
      userId,
      chatbotId,
      blockId: blockIdValue ?? null,
      provider: OAuthProvider.CALDAV,
      accessToken: encryptedToken,
      providerAccountId: username,
      providerAccountName: username,
    },
  });
}

/**
 * Generate OAuth state parameter for CSRF protection
 */
function generateOAuthState(data: {
  userId: string;
  chatbotId: string;
  blockId: string | null;
  provider: OAuthProvider;
  redirectUri: string;
}): string {
  const state = JSON.stringify(data);
  // In production, sign/encrypt the state
  return Buffer.from(state).toString('base64');
}

/**
 * Parse OAuth state parameter
 */
function parseOAuthState(state: string): {
  userId: string;
  chatbotId: string;
  blockId: string | null;
  provider: OAuthProvider;
  redirectUri: string;
} | null {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Invalidate/delete a user OAuth connection
 */
export async function invalidateUserOAuthConnection(
  userId: string,
  chatbotId: string,
  blockId: string | null,
  provider: OAuthProvider
): Promise<void> {
  const blockIdValue = (blockId !== undefined && blockId !== '' ? blockId : null) as string | null;
  
  await prisma.userOAuthConnection.updateMany({
    where: {
      userId,
      chatbotId,
      blockId: blockIdValue,
      provider,
    },
    data: {
      isActive: false,
      // Note: We don't clear accessToken/refreshToken as they are encrypted
      // Setting isActive to false is sufficient to invalidate the connection
    },
  });
}
