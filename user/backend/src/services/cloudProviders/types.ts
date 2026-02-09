/**
 * Cloud Provider Types and Interfaces
 * Shared types for user-backend (same as admin-backend)
 */

export type CloudProviderType = 'nextcloud' | 'googledrive' | 'onedrive' | 'ssh';

export interface CloudFileMetadata {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  modifiedAt?: Date;
  createdAt?: Date;
  webViewLink?: string;
  downloadLink?: string;
  etag?: string;
}

export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;
  accountName?: string;
}

export interface CloudProviderConfig {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  // SSH-specific fields
  host?: string;          // SSH hostname/IP
  port?: number;          // SSH port (default: 22)
  username?: string;      // SSH username
  privateKey?: string;    // SSH private key (encrypted)
  passphrase?: string;    // SSH key passphrase (encrypted, optional)
  password?: string;      // SSH password (encrypted, optional - for key+password auth)
  basePath?: string;      // Base path on remote server (default: /)
}

export interface CloudProvider {
  getProviderId(): CloudProviderType;
  getProviderName(): string;
  listFiles(
    accessToken: string,
    path?: string,
    recursive?: boolean,
    username?: string,
    skipPathBuilding?: boolean,
    progressCallback?: (filesDiscovered: number) => Promise<void>
  ): Promise<CloudFileMetadata[]>;
  getFileMetadata(
    accessToken: string,
    fileId: string,
    username?: string,
    skipPathBuilding?: boolean
  ): Promise<CloudFileMetadata>;
  getFileContent(
    accessToken: string,
    fileId: string,
    username?: string
  ): Promise<Buffer>;
  refreshAccessToken(
    refreshToken: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData>;
  testConnection(accessToken: string, username?: string): Promise<boolean>;
  // OAuth methods are optional (not used in user-backend)
  generateOAuthUrl?: (
    config: CloudProviderConfig,
    redirectUri: string,
    state: string
  ) => string;
  exchangeCodeForToken?: (
    code: string,
    redirectUri: string,
    config: CloudProviderConfig
  ) => Promise<OAuthTokenData>;
}
