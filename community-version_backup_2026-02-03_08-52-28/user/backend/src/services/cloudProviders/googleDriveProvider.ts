/**
 * Google Drive Cloud Provider Implementation
 * Uses OAuth 2.0 and Google Drive API v3
 */

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import {
  CloudProvider,
  CloudProviderType,
  CloudFileMetadata,
  OAuthTokenData,
  CloudProviderConfig,
} from './types';
import type { GoogleDriveFileMetadata } from '@shared/types';
import { logger } from '@shared/utils';
import { config } from '../../config';

export class GoogleDriveProvider implements CloudProvider {
  private clientId?: string;
  private clientSecret?: string;

  constructor(config?: CloudProviderConfig) {
    this.clientId = config?.clientId;
    this.clientSecret = config?.clientSecret;
  }

  getProviderId(): CloudProviderType {
    return 'googledrive';
  }

  getProviderName(): string {
    return 'Google Drive';
  }

  /**
   * Generate OAuth authorization URL for Google Drive
   */
  generateOAuthUrl(
    config: CloudProviderConfig,
    redirectUri: string,
    state: string
  ): string {
    if (!config.clientId) {
      throw new Error('Google Drive clientId is required');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    );

    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Google Drive clientId and clientSecret are required');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    );

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received from Google');
      }

      // Calculate expiration time
      const expiresAt = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000); // Default to 1 hour

      // Get user info to extract account ID
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const about = await drive.about.get({ fields: 'user' });

      const accountId = about.data.user?.emailAddress || 'unknown';
      const accountName = about.data.user?.displayName || accountId;

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: expiresAt,
        accountId: accountId,
        accountName: accountName,
      };
    } catch (error: unknown) {
      interface GoogleOAuthError {
        response?: {
          data?: {
            error_description?: string;
          };
        };
        message?: string;
      }
      const oauthError = error as GoogleOAuthError;
      const errorMessage = oauthError.response?.data?.error_description || oauthError.message || 'Failed to exchange code for token';
      throw new Error(`Google Drive OAuth error: ${errorMessage}`);
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Google Drive clientId and clientSecret are required');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh');
      }

      const expiresAt = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      // Get user info
      oauth2Client.setCredentials(credentials);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      const about = await drive.about.get({ fields: 'user' });

      const accountId = about.data.user?.emailAddress || 'unknown';
      const accountName = about.data.user?.displayName || accountId;

      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresAt: expiresAt,
        accountId: accountId,
      };
    } catch (error: unknown) {
      interface GoogleOAuthError {
        response?: {
          data?: {
            error_description?: string;
          };
        };
        message?: string;
      }
      const oauthError = error as GoogleOAuthError;
      const errorMessage = oauthError.response?.data?.error_description || oauthError.message || 'Failed to refresh token';
      throw new Error(`Google Drive token refresh error: ${errorMessage}`);
    }
  }

  /**
   * Get authenticated Drive client
   */
  private getDriveClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
  }

  /**
   * Build file path by traversing parent relationships
   */
  private async buildFilePath(
    fileId: string,
    drive: drive_v3.Drive,
    cache: Map<string, string> = new Map()
  ): Promise<string> {
    if (cache.has(fileId)) {
      return cache.get(fileId)!;
    }

    const pathParts: string[] = [];
    let currentId: string | null = fileId;

    while (currentId && currentId !== 'root') {
      if (cache.has(currentId)) {
        const cachedPath = cache.get(currentId)!;
        const fullPath = pathParts.length > 0
          ? `${cachedPath}/${pathParts.join('/')}`
          : cachedPath;
        cache.set(fileId, fullPath);
        return fullPath;
      }

      try {
        const fileResponse: { data: drive_v3.Schema$File } = await drive.files.get({
          fileId: currentId,
          fields: 'id,name,parents',
        }) as { data: drive_v3.Schema$File };

        const fileData = fileResponse.data;
        const fileName = (fileData.name as string | undefined) || 'Unknown';
        pathParts.unshift(fileName);

        // Cache this path
        const currentPath = pathParts.join('/');
        cache.set(currentId, currentPath);

        currentId = (fileData.parents as string[] | undefined | null)?.[0] || null;
      } catch (error) {
        logger.warn('Failed to get parent for Google Drive file', {
          fileId: currentId,
          error: error instanceof Error ? error.message : String(error),
          service: 'googleDriveProvider',
        });
        break;
      }
    }

    const fullPath = pathParts.join('/') || 'Root';
    cache.set(fileId, fullPath);
    return fullPath;
  }

  /**
   * List shared folders (folders shared with the user)
   */
  async listSharedFolders(accessToken: string): Promise<CloudFileMetadata[]> {
    const drive = this.getDriveClient(accessToken);
    const query = `sharedWithMe=true and trashed=false and mimeType='application/vnd.google-apps.folder'`;
    
    try {
      const response = await this.listFilesPaginated(drive, query);
      
      return response.map((file: GoogleDriveFileMetadata) => ({
        id: file.id,
        name: file.name || 'Unknown',
        path: file.id, // Use file ID as path for shared folders
        type: 'folder' as const,
        mimeType: file.mimeType,
        size: undefined,
        modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
        webViewLink: file.webViewLink,
        downloadLink: file.webViewLink,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Google Drive listSharedFolders error', error instanceof Error ? error : undefined, {
        status: errorResponse?.status,
        service: 'googleDriveProvider',
      });
      throw new Error(`Google Drive listSharedFolders error: ${errorMessage}`);
    }
  }

  /**
   * List files and folders
   * @param accessToken OAuth access token
   * @param path Folder ID to list (empty string or 'root' for root) - for Google Drive, this is actually a folder ID
   * @param recursive Whether to include subdirectories
   * @param username Not used for Google Drive, kept for interface compatibility
   * @param skipPathBuilding Skip expensive path building (use file ID as path) - for bulk operations
   * @param progressCallback Optional callback to report progress during recursive listing
   */
  async listFiles(
    accessToken: string,
    path: string = 'root',
    recursive: boolean = false,
    username?: string, // Not used for Google Drive, kept for interface compatibility
    skipPathBuilding: boolean = false, // New parameter to skip path building for performance
    progressCallback?: (filesDiscovered: number) => Promise<void> // Progress callback for recursive listing
  ): Promise<CloudFileMetadata[]> {
    const drive = this.getDriveClient(accessToken);
    const files: CloudFileMetadata[] = [];
    const pathCache = new Map<string, string>();

    try {
      // For Google Drive, path parameter is actually a folder ID
      const folderId = path || 'root';
      
      // Build query for folder contents
      let query = `'${folderId}' in parents and trashed=false`;
      
      if (recursive) {
        // For recursive, we need to traverse folders
        // Start with the folder and recursively list all
        const allFiles = await this.listFilesRecursive(drive, folderId, pathCache, skipPathBuilding, progressCallback);
        return allFiles;
      } else {
        // Non-recursive: just list direct children
        const response = await this.listFilesPaginated(drive, query);
        
        for (const file of response) {
          // Google Drive API returns file objects directly, not wrapped in .data
          if (!file || !file.id) {
            logger.warn('Skipping invalid file object', {
              file,
              service: 'googleDriveProvider',
            });
            continue;
          }
          
          // Skip expensive path building for bulk operations (like indexing)
          const filePath = skipPathBuilding 
            ? file.id // Use file ID as path for performance
            : await this.buildFilePath(file.id, drive, pathCache);
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
          
          files.push({
            id: file.id,
            name: file.name || 'Unknown',
            path: filePath,
            type: isFolder ? 'folder' : 'file',
            mimeType: file.mimeType,
            size: file.size ? parseInt(file.size, 10) : undefined,
            modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
            webViewLink: file.webViewLink,
            downloadLink: file.webViewLink, // Will be converted to download link when needed
          });
        }
      }

      return files;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Google Drive listFiles error', error instanceof Error ? error : undefined, {
        path,
        status: errorResponse?.status,
        service: 'googleDriveProvider',
      });
      throw new Error(`Google Drive listFiles error: ${errorMessage}`);
    }
  }

  /**
   * List files with pagination
   * Optimized to use maximum page size and proper field selection
   */
  private async listFilesPaginated(drive: drive_v3.Drive, query: string): Promise<GoogleDriveFileMetadata[]> {
    const allFiles: GoogleDriveFileMetadata[] = [];
    let pageToken: string | undefined;

    do {
      try {
        const response = await drive.files.list({
          q: query,
          pageSize: 1000, // Maximum allowed by Google Drive API
          pageToken: pageToken,
          fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, parents, webViewLink)',
          orderBy: 'folder,name', // Folders first, then alphabetical
        });

        const files = (response.data.files || []) as GoogleDriveFileMetadata[];
        allFiles.push(...files);
        pageToken = response.data.nextPageToken || undefined;
      } catch (error: unknown) {
        const errorResponse = error && typeof error === 'object' && 'response' in error 
          ? (error as { response?: { status?: number; headers?: Record<string, unknown> }; code?: number }).response 
          : undefined;
        const errorCode = error && typeof error === 'object' && 'code' in error 
          ? (error as { code?: number }).code 
          : undefined;
        // Handle rate limiting with exponential backoff
        if (errorResponse?.status === 429 || errorCode === 429) {
          const retryAfter = (errorResponse?.headers?.['retry-after'] as string) || '60';
          const waitTime = parseInt(retryAfter, 10) * 1000;
          logger.warn('Google Drive API rate limit hit, waiting before retry', {
            waitTime,
            service: 'googleDriveProvider',
          });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue; // Retry the same request
        }
        throw error; // Re-throw to be handled by outer catch
      }
    } while (pageToken);

    return allFiles;
  }

  /**
   * Recursively list all files in a folder with parallel batch processing
   */
  private async listFilesRecursive(
    drive: drive_v3.Drive,
    folderId: string,
    pathCache: Map<string, string>,
    skipPathBuilding: boolean = false,
    progressCallback?: (filesDiscovered: number) => Promise<void>
  ): Promise<CloudFileMetadata[]> {
    const allFiles: CloudFileMetadata[] = [];
    const foldersToProcess: string[] = [folderId];
    
    // Use environment variable for concurrency, default to 5 (same as Nextcloud)
    const CONCURRENT_FOLDERS = config.CLOUD_INDEXING_CONCURRENT_FOLDERS;

    while (foldersToProcess.length > 0) {
      // Take a batch of folders from the queue for parallel processing
      const folderBatch: string[] = [];
      const batchSize = Math.min(CONCURRENT_FOLDERS, foldersToProcess.length);
      for (let i = 0; i < batchSize; i++) {
        const folderId = foldersToProcess.shift();
        if (folderId) {
          folderBatch.push(folderId);
        }
      }
      
      if (folderBatch.length === 0) break;
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        folderBatch.map(async (currentFolderId) => {
          const query = `'${currentFolderId}' in parents and trashed=false`;
          const files = await this.listFilesPaginated(drive, query);
          
          const folderFiles: CloudFileMetadata[] = [];
          const subFolders: string[] = [];
          
          for (const file of files) {
            // Google Drive API returns file objects directly, not wrapped in .data
            if (!file || !file.id) {
              logger.warn('Skipping invalid file object', {
              file,
              service: 'googleDriveProvider',
            });
              continue;
            }
            
            // Skip expensive path building for bulk operations (like indexing)
            const filePath = skipPathBuilding 
              ? file.id // Use file ID as path for performance
              : await this.buildFilePath(file.id, drive, pathCache);
            const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

            folderFiles.push({
              id: file.id,
              name: file.name || 'Unknown',
              path: filePath,
              type: isFolder ? 'folder' : 'file',
              mimeType: file.mimeType,
              size: file.size ? parseInt(file.size, 10) : undefined,
              modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
              webViewLink: file.webViewLink,
              downloadLink: file.webViewLink,
            });

            // Add folders to processing queue
            if (isFolder) {
              subFolders.push(file.id);
            }
          }
          
          return { files: folderFiles, folders: subFolders };
        })
      );
      
      // Collect results and add newly discovered folders to queue
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allFiles.push(...result.value.files);
          foldersToProcess.push(...result.value.folders);
        } else {
          logger.warn('Failed to process folder batch', {
            reason: result.reason,
            service: 'googleDriveProvider',
          });
        }
      }
      
      // Update progress callback after processing batch
      if (progressCallback && allFiles.length > 0) {
        try {
          await progressCallback(allFiles.length);
        } catch (error) {
          // Don't fail listing if progress update fails
          logger.warn('Progress callback failed', {
            error: error instanceof Error ? error.message : String(error),
            service: 'googleDriveProvider',
          });
        }
      }
    }

    return allFiles;
  }

  /**
   * Get file metadata
   * @param skipPathBuilding Skip expensive path building (use file ID as path) - for bulk operations
   */
  async getFileMetadata(
    accessToken: string,
    fileId: string,
    username?: string, // Not used for Google Drive
    skipPathBuilding: boolean = false // New parameter to skip path building for performance
  ): Promise<CloudFileMetadata> {
    const drive = this.getDriveClient(accessToken);

    try {
      const file = await drive.files.get({
        fileId: fileId,
        fields: 'id,name,mimeType,size,modifiedTime,parents,webViewLink',
      });

      // Skip expensive path building for bulk operations (like indexing)
      const path = skipPathBuilding 
        ? fileId // Use file ID as path for performance
        : await this.buildFilePath(fileId, drive);
      const isFolder = file.data.mimeType === 'application/vnd.google-apps.folder';

      return {
        id: file.data.id!,
        name: file.data.name || 'Unknown',
        path: path,
        type: isFolder ? 'folder' : 'file',
        mimeType: file.data.mimeType || undefined,
        size: file.data.size ? parseInt(file.data.size, 10) : undefined,
        modifiedAt: file.data.modifiedTime ? new Date(file.data.modifiedTime) : undefined,
        webViewLink: file.data.webViewLink || undefined,
        downloadLink: file.data.webViewLink || undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Google Drive getFileMetadata error', error instanceof Error ? error : undefined, {
        fileId,
        status: errorResponse?.status,
        service: 'googleDriveProvider',
      });
      throw new Error(`Google Drive getFileMetadata error: ${errorMessage}`);
    }
  }

  /**
   * Download file content
   */
  async getFileContent(
    accessToken: string,
    fileId: string,
    username?: string // Not used for Google Drive
  ): Promise<Buffer> {
    const drive = this.getDriveClient(accessToken);

    try {
      // First get file metadata to check MIME type
      const file = await drive.files.get({
        fileId: fileId,
        fields: 'mimeType',
      });

      const mimeType = file.data.mimeType;

      // Handle Google Workspace files (Docs, Sheets, Slides)
      if (mimeType === 'application/vnd.google-apps.document') {
        // Export Google Doc as text
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain',
        }, { responseType: 'arraybuffer' });
        return Buffer.from(response.data as ArrayBuffer);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Export Google Sheet as CSV
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'text/csv',
        }, { responseType: 'arraybuffer' });
        return Buffer.from(response.data as ArrayBuffer);
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Export Google Slides as PDF
        const response = await drive.files.export({
          fileId: fileId,
          mimeType: 'application/pdf',
        }, { responseType: 'arraybuffer' });
        return Buffer.from(response.data as ArrayBuffer);
      } else {
        // Regular file - download directly
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, { responseType: 'arraybuffer' });
        return Buffer.from(response.data as ArrayBuffer);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Google Drive getFileContent error', error instanceof Error ? error : undefined, {
        fileId,
        status: errorResponse?.status,
        service: 'googleDriveProvider',
      });
      
      if (errorResponse?.status === 413 || errorMessage.includes('maxContentLength')) {
        throw new Error('File size exceeds 10MB limit');
      }
      
      throw new Error(`Google Drive getFileContent error: ${errorMessage}`);
    }
  }

  /**
   * Test connection with access token
   */
  async testConnection(accessToken: string, username?: string): Promise<boolean> {
    try {
      const drive = this.getDriveClient(accessToken);
      // Try to get user info to verify token is valid
      await drive.about.get({ fields: 'user' });
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Google Drive connection test failed', error instanceof Error ? error : undefined, {
        status: errorResponse?.status,
        service: 'googleDriveProvider',
      });
      throw error; // Re-throw to get better error messages
    }
  }
}
