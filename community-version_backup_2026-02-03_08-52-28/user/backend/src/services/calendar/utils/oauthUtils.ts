import { OAuthProvider } from '@prisma/client';
import { config } from '../../../config';

export async function generateUserOAuthUrl(
  provider: OAuthProvider,
  userId: string,
  chatbotId: string,
  blockId: string,
  redirectUri: string
): Promise<string> {
  // Generate state token (CSRF protection)
  const state = generateOAuthState({
    userId,
    chatbotId,
    blockId,
    provider,
    redirectUri,
  });
  
  // For Google Calendar, generate OAuth URL
  if (provider === OAuthProvider.GOOGLE_CALENDAR) {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CALENDAR_CLIENT_ID || config.GOOGLE_DRIVE_CLIENT_ID,
      config.GOOGLE_CALENDAR_CLIENT_SECRET || config.GOOGLE_DRIVE_CLIENT_SECRET,
      redirectUri
    );
    
    const scopes = ['https://www.googleapis.com/auth/calendar'];
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent',
    });
    
    return authUrl;
  }
  
  throw new Error(`OAuth URL generation not implemented for provider: ${provider}`);
}

export async function generateCalDAVAuthUrl(
  userId: string,
  chatbotId: string,
  blockId: string,
  serverUrl: string
): Promise<string> {
  return generateCalDAVAuthUrlWithSlackUserId(userId, chatbotId, blockId, serverUrl, null);
}

export async function generateCalDAVAuthUrlWithSlackUserId(
  userId: string,
  chatbotId: string,
  blockId: string,
  serverUrl: string,
  slackUserId: string | null | undefined
): Promise<string> {
  // Generate state token
  const stateData = {
    userId,
    chatbotId,
    blockId,
    provider: OAuthProvider.CALDAV,
    redirectUri: `${config.FRONTEND_URL}/caldav/auth`,
    slackUserId: slackUserId || null,
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
  
  // Build URL with state, server URL, and slackUserId
  const params = new URLSearchParams({
    state: state,
    serverUrl: serverUrl,
  });
  if (slackUserId) {
    params.append('slackUserId', slackUserId);
  }
  
  return `${config.FRONTEND_URL}/caldav/auth?${params.toString()}`;
}

export function generateOAuthState(data: {
  userId: string;
  chatbotId: string;
  blockId: string;
  provider: OAuthProvider;
  redirectUri: string;
}): string {
  const state = JSON.stringify(data);
  // In production, sign/encrypt the state
  return Buffer.from(state).toString('base64');
}

export function parseCalDAVCredentials(decryptedToken: string): { username: string; password: string; serverUrl: string } {
  // decryptedToken is already decrypted by ensureValidUserTokenFromService
  // It should be in format: serverUrl|username|password
  const parts = decryptedToken.split('|');
  
  if (parts.length < 3) {
    throw new Error(`Invalid CalDAV credentials format. Expected format: serverUrl|username|password, got: ${decryptedToken.substring(0, 50)}...`);
  }
  
  return {
    serverUrl: parts[0],
    username: parts[1],
    password: parts[2],
  };
}

export function getRedirectUri(): string {
  return `${config.FRONTEND_URL}/oauth/callback`;
}
