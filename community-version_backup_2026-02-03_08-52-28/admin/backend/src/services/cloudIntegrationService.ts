/**
 * Cloud Integration Service
 * Helper functions to manage cloud integration data stored in block properties
 */

import { Block } from '@prisma/client';
import { CloudProviderType } from './cloudProviders/types';
import { getCloudAccessToken } from './cloudOAuthService';
import { createCloudProvider } from './cloudProviders/providerFactory';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const cloudIntegrationLogger = logger.child({ service: 'admin-backend', component: 'cloudIntegrationService' });

export interface CloudIntegrationProperties {
  provider?: CloudProviderType;
  // Authentication method
  authMethod?: 'oauth' | 'app_password' | 'ssh_key'; // OAuth, App Password, or SSH Key
  // OAuth credentials (encrypted)
  accessToken?: string; // OAuth token (encrypted), App Password (not encrypted), or SSH private key (encrypted)
  refreshToken?: string;
  tokenExpiresAt?: string; // ISO date string
  // Provider-specific config
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string; // For App Password: Nextcloud username; For SSH: SSH username
  accountId?: string;
  accountName?: string;
  // SSH-specific fields
  host?: string; // SSH hostname/IP
  port?: number; // SSH port (default: 22)
  privateKey?: string; // SSH private key (encrypted) - stored in accessToken, but kept here for clarity
  passphrase?: string; // SSH key passphrase (encrypted, optional)
  password?: string; // SSH password (encrypted, optional - for key+password authentication)
  basePath?: string; // Base path on remote server (default: /)
  // Indexing configuration
  selectedPaths?: string[];
  fileTypeFilters?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  // Scheduled crawling (similar to WebsiteContext)
  cronEnabled?: boolean;
  cronSchedule?: string;
  cronTimezone?: string;
  nextCrawlAt?: string;
  // Indexing status
  indexingCancelled?: boolean; // Flag to cancel ongoing indexing
  lastIndexedAt?: string;
  indexedFileCount?: number;
  filesDiscovered?: number; // Number of files discovered during listing (for progress tracking)
  indexingStatus?: 'idle' | 'indexing' | 'completed' | 'error';
  indexingError?: string;
  // Connection status
  isConnected?: boolean;
  connectedAt?: string;
}

/**
 * Get cloud integration properties from block
 */
export function getCloudIntegration(block: Block): CloudIntegrationProperties {
  return (block.properties || {}) as CloudIntegrationProperties;
}

/**
 * Update cloud integration properties in block
 */
export async function updateCloudIntegration(
  blockId: string,
  updates: Partial<CloudIntegrationProperties>
): Promise<Block> {
  const block = await prisma.block.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    throw new Error('Block not found');
  }

  const currentProperties = (block.properties || {}) as CloudIntegrationProperties;

  // Encrypt SSH credentials if provided
  const processedUpdates = { ...updates };
  if (updates.provider === 'ssh' || currentProperties.provider === 'ssh') {
    const { encryptToken } = await import('./cloudOAuthService');
    
    // Encrypt SSH private key if provided
    if (updates.accessToken && typeof updates.accessToken === 'string') {
      // Check if it's already encrypted (contains colons from encryption format)
      if (!updates.accessToken.includes(':')) {
        processedUpdates.accessToken = encryptToken(updates.accessToken);
      }
    }
    
    // Encrypt SSH passphrase if provided
    if (updates.passphrase && typeof updates.passphrase === 'string') {
      // Check if it's already encrypted
      if (!updates.passphrase.includes(':')) {
        processedUpdates.passphrase = encryptToken(updates.passphrase);
      }
    }
    
    // Encrypt SSH password if provided (for key+password authentication)
    if (updates.password && typeof updates.password === 'string') {
      // Check if it's already encrypted
      if (!updates.password.includes(':')) {
        processedUpdates.password = encryptToken(updates.password);
      }
    }
  }

  return prisma.block.update({
    where: { id: blockId },
    data: {
      properties: {
        ...currentProperties,
        ...processedUpdates,
      },
    },
  });
}

/**
 * Test connection with access token
 */
export async function testCloudConnection(blockId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { id: blockId },
  });

  if (!block) {
    throw new Error('Block not found');
  }

  const properties = getCloudIntegration(block);
  const provider = properties.provider;

  if (!provider) {
    throw new Error('Cloud provider not configured');
  }

  try {
    const authMethod = properties.authMethod || 'oauth';
    
    if (authMethod === 'app_password') {
      // For App Password, use Basic Auth directly (Nextcloud only)
      const username = properties.username as string | undefined;
      const appPassword = properties.accessToken as string | undefined; // App Password stored as accessToken
      
      if (!username || !appPassword) {
        throw new Error('Username and App Password are required for App Password authentication');
      }
      
      const providerConfig = {
        baseUrl: properties.baseUrl,
      };
      const providerInstance = createCloudProvider(provider, providerConfig);
      return await providerInstance.testConnection(appPassword, username);
    } else if (authMethod === 'ssh_key') {
      // SSH key-based authentication
      const encryptedPrivateKey = properties.accessToken as string | undefined;
      const encryptedPassphrase = properties.passphrase as string | undefined;
      
      if (!encryptedPrivateKey) {
        throw new Error('SSH private key is required');
      }
      
      // Decrypt SSH credentials
      const { decryptToken } = await import('./cloudOAuthService');
      let privateKey: string;
      let passphrase: string | undefined;
      
      try {
        privateKey = decryptToken(encryptedPrivateKey);
      } catch (decryptError) {
        const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
        cloudIntegrationLogger.error('Failed to decrypt SSH private key', {
          blockId,
          error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
        });
        throw new Error(`Failed to decrypt SSH private key: ${errorMessage}. The key may be corrupted or encrypted with a different key.`);
      }
      
      if (encryptedPassphrase) {
        try {
          passphrase = decryptToken(encryptedPassphrase);
        } catch (decryptError) {
          const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
          cloudIntegrationLogger.error('Failed to decrypt SSH passphrase', {
            blockId,
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
          throw new Error(`Failed to decrypt SSH passphrase: ${errorMessage}`);
        }
      }
      
      // Validate decrypted key format
      if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
        throw new Error('Invalid SSH private key format after decryption. Please ensure the key is in OpenSSH format.');
      }
      
      // Decrypt password if provided (for key+password authentication)
      let password: string | undefined;
      const encryptedPassword = properties.password as string | undefined;
      if (encryptedPassword) {
        try {
          password = decryptToken(encryptedPassword);
        } catch (decryptError) {
          const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
          cloudIntegrationLogger.error('Failed to decrypt SSH password', {
            blockId,
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
          throw new Error(`Failed to decrypt SSH password: ${errorMessage}`);
        }
      }
      
      const providerConfig = {
        host: properties.host,
        port: properties.port || 22,
        username: properties.username,
        privateKey: privateKey.trim(), // Trim any whitespace
        passphrase: passphrase ? passphrase.trim() : undefined,
        password: password ? password.trim() : undefined,
        basePath: properties.basePath || '/',
      };
      
      const providerInstance = createCloudProvider(provider, providerConfig);
      return await providerInstance.testConnection(privateKey.trim(), properties.username);
    } else {
      // OAuth flow
      const accessToken = await getCloudAccessToken(block);
      
      let providerConfig;
      if (provider === 'googledrive') {
        // Google Drive uses global OAuth credentials
        providerConfig = {
          clientId: config.GOOGLE_DRIVE_CLIENT_ID,
          clientSecret: config.GOOGLE_DRIVE_CLIENT_SECRET,
          // No baseUrl needed for Google Drive
        };
      } else {
        // Nextcloud uses per-block configuration
        providerConfig = {
          baseUrl: properties.baseUrl,
          clientId: properties.clientId,
          clientSecret: properties.clientSecret,
        };
      }

      const providerInstance = createCloudProvider(provider, providerConfig);
      return await providerInstance.testConnection(accessToken);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudIntegrationLogger.error('Cloud connection test failed', {
      blockId,
      provider,
      authMethod: properties.authMethod,
      baseUrl: properties.baseUrl,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error; // Re-throw to propagate error message
  }
}

/**
 * Disconnect cloud integration (remove tokens)
 */
export async function disconnectCloudIntegration(blockId: string): Promise<Block> {
  return updateCloudIntegration(blockId, {
    isConnected: false,
    accessToken: undefined,
    refreshToken: undefined,
    tokenExpiresAt: undefined,
    accountId: undefined,
    accountName: undefined,
    connectedAt: undefined,
    // SSH-specific cleanup
    host: undefined,
    port: undefined,
    privateKey: undefined,
    passphrase: undefined,
    password: undefined,
    basePath: undefined,
  });
}
