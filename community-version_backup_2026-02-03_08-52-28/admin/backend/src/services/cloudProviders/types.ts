/**
 * Cloud Provider Types and Interfaces
 * Defines common interfaces for all cloud storage providers
 */

export type CloudProviderType = 'nextcloud' | 'googledrive' | 'onedrive' | 'ssh';

export interface CloudFileMetadata {
  id: string;              // Provider-specific file ID
  name: string;            // File name
  path: string;            // Full path from root
  type: 'file' | 'folder';
  mimeType?: string;       // MIME type (e.g., 'application/pdf')
  size?: number;           // Size in bytes
  modifiedAt?: Date;       // Last modified date
  createdAt?: Date;        // Creation date
  webViewLink?: string;    // URL to view file in browser
  downloadLink?: string;   // URL to download file
  etag?: string;          // ETag for change detection
}

export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountId: string;       // Provider account/user ID
  accountName?: string;    // Provider account/user name
}

export interface CloudProviderConfig {
  baseUrl?: string;        // For Nextcloud: server URL
  clientId?: string;      // OAuth client ID (if needed)
  clientSecret?: string;  // OAuth client secret (if needed)
  // SSH-specific fields
  host?: string;          // SSH hostname/IP
  port?: number;          // SSH port (default: 22)
  username?: string;      // SSH username
  privateKey?: string;    // SSH private key (encrypted)
  passphrase?: string;    // SSH key passphrase (encrypted, optional)
  password?: string;      // SSH password (encrypted, optional - for key+password auth)
  basePath?: string;      // Base path on remote server (default: /)
}

/**
 * Base interface for all cloud storage providers
 */
export interface CloudProvider {
  /**
   * Get provider identifier
   */
  getProviderId(): CloudProviderType;

  /**
   * Get human-readable provider name
   */
  getProviderName(): string;

  /**
   * Generate OAuth authorization URL
   */
  generateOAuthUrl(
    config: CloudProviderConfig,
    redirectUri: string,
    state: string
  ): string;

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(
    code: string,
    redirectUri: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData>;

  /**
   * Refresh an expired access token
   */
  refreshAccessToken(
    refreshToken: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData>;

  /**
   * List files and folders in a directory
   * @param accessToken OAuth access token or App Password
   * @param path Directory path (empty string for root)
   * @param recursive Whether to include subdirectories
   * @param username Optional username for App Password auth
   * @param skipPathBuilding Skip expensive path building (use file ID as path) - for bulk operations
   * @param progressCallback Optional callback to report progress during recursive listing
   */
  listFiles(
    accessToken: string,
    path?: string,
    recursive?: boolean,
    username?: string,
    skipPathBuilding?: boolean,
    progressCallback?: (filesDiscovered: number) => Promise<void>
  ): Promise<CloudFileMetadata[]>;

  /**
   * List shared folders (Google Drive only - folders shared with the user)
   * Optional method - not all providers support this
   */
  listSharedFolders?(accessToken: string): Promise<CloudFileMetadata[]>;

  /**
   * Get file metadata
   * @param accessToken OAuth access token or App Password
   * @param fileId Provider-specific file ID
   * @param username Optional username for App Password auth
   * @param skipPathBuilding Skip expensive path building (use file ID as path) - for bulk operations
   */
  getFileMetadata(
    accessToken: string,
    fileId: string,
    username?: string,
    skipPathBuilding?: boolean
  ): Promise<CloudFileMetadata>;

  /**
   * Download file content
   * @param accessToken OAuth access token or App Password
   * @param fileId Provider-specific file ID
   * @param username Optional username for App Password auth
   * @returns File content as Buffer
   */
  getFileContent(
    accessToken: string,
    fileId: string,
    username?: string
  ): Promise<Buffer>;

  /**
   * Test connection with access token
   * @param username Optional username for App Password auth
   */
  testConnection(accessToken: string, username?: string): Promise<boolean>;
}
