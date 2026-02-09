/**
 * Cloud OAuth Service
 * Handles OAuth flows for cloud storage providers
 */

import crypto from 'crypto';
import { Block } from '@prisma/client';
import { createCloudProvider, CloudProviderType } from './cloudProviders/providerFactory';
import { CloudProviderConfig } from './cloudProviders/types';
import prisma from '../lib/prisma';
import { config } from '../config';

const CLOUD_ENCRYPTION_KEY = config.SLACK_ENCRYPTION_KEY;

// Ensure encryption key is 32 bytes for AES-256
function getEncryptionKey(): Buffer {
  const key = Buffer.from(CLOUD_ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32), 'utf8');
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
 * Decrypt a token from database
 */
function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate OAuth state parameter for CSRF protection
 */
export function generateOAuthState(chatbotId: string, blockId: string, provider?: CloudProviderType): string {
  const state = JSON.stringify({ chatbotId, blockId, provider, timestamp: Date.now() });
  return Buffer.from(state).toString('base64');
}

/**
 * Parse and validate OAuth state
 */
export function parseOAuthState(state: string): { chatbotId: string; blockId: string; provider?: CloudProviderType } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    // Validate state is not too old (5 minutes)
    if (Date.now() - decoded.timestamp > 5 * 60 * 1000) {
      return null;
    }
    return { chatbotId: decoded.chatbotId, blockId: decoded.blockId, provider: decoded.provider };
  } catch {
    return null;
  }
}

/**
 * Generate OAuth URL for cloud provider
 */
export async function generateCloudOAuthUrl(
  provider: CloudProviderType,
  chatbotId: string,
  blockId: string
): Promise<string> {
  // SSH doesn't use OAuth
  if (provider === 'ssh') {
    throw new Error('SSH provider does not use OAuth. Please configure SSH credentials directly in block properties.');
  }
  
  // OneDrive temporarily disabled
  if (provider === 'onedrive') {
    throw new Error('OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.');
  }

  // Get block to retrieve configuration
  const block = await prisma.block.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    throw new Error('Block not found');
  }

  const properties = block.properties as Record<string, unknown>;
  let providerConfig: CloudProviderConfig;
  // Use type assertion to avoid TypeScript narrowing issues
  // Note: OneDrive is already filtered out above, so providerType can only be 'googledrive' | 'nextcloud'
  const providerType = provider as CloudProviderType;

  if (providerType === 'googledrive') {
    // Google Drive uses global OAuth credentials from environment
    const clientId = config.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = config.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google Drive OAuth credentials not configured. Please contact administrator.');
    }

    providerConfig = {
      clientId,
      clientSecret,
      // No baseUrl needed for Google Drive
    };
  } else {
    // Nextcloud (OneDrive is already filtered out above)
    providerConfig = {
      baseUrl: properties.baseUrl as string | undefined,
      clientId: properties.clientId as string | undefined,
      clientSecret: properties.clientSecret as string | undefined,
    };

    if (!providerConfig.baseUrl) {
      throw new Error(`${provider} baseUrl is required. Please configure it in block properties.`);
    }

    if (providerType === 'nextcloud' && (!providerConfig.clientId || !providerConfig.clientSecret)) {
      throw new Error('Nextcloud clientId and clientSecret are required. Please configure OAuth app in Nextcloud.');
    }
  }

  const providerInstance = createCloudProvider(providerType, providerConfig);
  const state = generateOAuthState(chatbotId, blockId, providerType);
  
  const apiUrl = config.API_URL;
  const redirectUri = `${apiUrl}/api/admin/cloud/oauth/callback`;

  return providerInstance.generateOAuthUrl(providerConfig, redirectUri, state);
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCloudCodeForToken(
  provider: CloudProviderType,
  code: string,
  blockId: string
): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName?: string;
}> {
  // SSH doesn't use OAuth
  if (provider === 'ssh') {
    throw new Error('SSH provider does not use OAuth. Please configure SSH credentials directly in block properties.');
  }
  
  // OneDrive temporarily disabled
  if (provider === 'onedrive') {
    throw new Error('OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.');
  }

  // Get block to retrieve configuration
  const block = await prisma.block.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    throw new Error('Block not found');
  }

  const properties = block.properties as Record<string, unknown>;
  let providerConfig: CloudProviderConfig;
  // Use type assertion to avoid TypeScript narrowing issues
  // Note: OneDrive is already filtered out above, so providerType can only be 'googledrive' | 'nextcloud'
  const providerType = provider as CloudProviderType;

  if (providerType === 'googledrive') {
    // Google Drive uses global OAuth credentials from environment
    const clientId = config.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = config.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google Drive OAuth credentials not configured. Please contact administrator.');
    }

    providerConfig = {
      clientId,
      clientSecret,
      // No baseUrl needed for Google Drive
    };
  } else {
    // Nextcloud (OneDrive is already filtered out above)
    providerConfig = {
      baseUrl: properties.baseUrl as string | undefined,
      clientId: properties.clientId as string | undefined,
      clientSecret: properties.clientSecret as string | undefined,
    };

    if (!providerConfig.baseUrl) {
      throw new Error(`${provider} baseUrl is required`);
    }
  }

  const providerInstance = createCloudProvider(providerType, providerConfig);
  
  const apiUrl = config.API_URL;
  const redirectUri = `${apiUrl}/api/admin/cloud/oauth/callback`;

  const tokenData = await providerInstance.exchangeCodeForToken(code, redirectUri, providerConfig);

  // Encrypt tokens before storing
  return {
    accessToken: encryptToken(tokenData.accessToken),
    refreshToken: tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : undefined,
    expiresAt: tokenData.expiresAt,
    accountId: tokenData.accountId,
    accountName: tokenData.accountName,
  };
}

/**
 * Refresh access token if expired
 */
export async function refreshCloudAccessToken(block: Block): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}> {
  const properties = block.properties as Record<string, unknown>;
  const provider = properties.provider as CloudProviderType | undefined;

  if (!provider) {
    throw new Error('Provider not configured');
  }

  // SSH doesn't use token refresh (keys don't expire)
  if (provider === 'ssh') {
    throw new Error('SSH provider does not use token refresh. SSH keys do not expire.');
  }

  // OneDrive temporarily disabled
  if (provider === 'onedrive') {
    throw new Error('OneDrive integration is currently disabled. Please use Nextcloud or Google Drive instead.');
  }

  const encryptedRefreshToken = properties.refreshToken as string | undefined;
  if (!encryptedRefreshToken) {
    throw new Error('Refresh token not available');
  }

  const refreshToken = decryptToken(encryptedRefreshToken);
  let providerConfig: CloudProviderConfig;
  // Use type assertion to avoid TypeScript narrowing issues
  // Note: OneDrive is already filtered out above, so providerType can only be 'googledrive' | 'nextcloud'
  const providerType = provider as CloudProviderType;

  if (providerType === 'googledrive') {
    // Google Drive uses global OAuth credentials from environment
    const clientId = config.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = config.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google Drive OAuth credentials not configured. Please contact administrator.');
    }

    providerConfig = {
      clientId,
      clientSecret,
      // No baseUrl needed for Google Drive
    };
  } else {
    // Nextcloud (OneDrive is already filtered out above)
    providerConfig = {
      baseUrl: properties.baseUrl as string | undefined,
      clientId: properties.clientId as string | undefined,
      clientSecret: properties.clientSecret as string | undefined,
    };
  }

  const providerInstance = createCloudProvider(providerType, providerConfig);
  const tokenData = await providerInstance.refreshAccessToken(refreshToken, providerConfig);

  return {
    accessToken: encryptToken(tokenData.accessToken),
    refreshToken: tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : undefined,
    expiresAt: tokenData.expiresAt,
  };
}

/**
 * Get decrypted access token (with automatic refresh if expired)
 */
export async function getCloudAccessToken(block: Block): Promise<string> {
  const properties = block.properties as Record<string, unknown>;
  const provider = properties.provider as CloudProviderType | undefined;
  const authMethod = properties.authMethod as string | undefined || 'oauth';
  const encryptedAccessToken = properties.accessToken as string | undefined;

  if (!encryptedAccessToken) {
    throw new Error('Access token not available. Please reconnect to cloud storage.');
  }

  // SSH doesn't use token expiration/refresh
  if (provider === 'ssh' || authMethod === 'ssh_key') {
    // For SSH, accessToken is the encrypted private key
    return decryptToken(encryptedAccessToken);
  }

  // Check if token is expired
  const expiresAt = properties.tokenExpiresAt as string | undefined;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    // Token expired, try to refresh
    try {
      const refreshed = await refreshCloudAccessToken(block);
      
      // Update block with new tokens
      await prisma.block.update({
        where: { id: block.id },
        data: {
          properties: {
            ...properties,
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: refreshed.expiresAt?.toISOString(),
          },
        },
      });

      return decryptToken(refreshed.accessToken);
    } catch (error) {
      throw new Error(`Token expired and refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return decryptToken(encryptedAccessToken);
}

// Export encryption functions for use in other services
export { encryptToken, decryptToken };
