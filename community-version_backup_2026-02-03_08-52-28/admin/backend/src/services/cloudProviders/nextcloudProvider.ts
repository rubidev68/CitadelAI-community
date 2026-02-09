/**
 * Nextcloud Cloud Provider Implementation
 * Uses OAuth 2.0 and WebDAV API
 */

import axios, { AxiosInstance } from 'axios';
import {
  CloudProvider,
  CloudProviderType,
  CloudFileMetadata,
  OAuthTokenData,
  CloudProviderConfig,
} from './types';
import { logger } from '@shared/utils';
import { config } from '../../config';

const nextcloudProviderLogger = logger.child({ service: 'admin-backend', component: 'nextcloudProvider' });

export class NextcloudProvider implements CloudProvider {
  private baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor(config?: CloudProviderConfig) {
    // Normalize baseUrl: remove trailing slashes
    this.baseUrl = (config?.baseUrl || '').replace(/\/+$/, '');
    
    // Create axios instance with SSL verification disabled for self-signed certificates
    // This is common for self-hosted Nextcloud instances
    const https = require('https');
    this.axiosInstance = axios.create({
      timeout: 60000, // Increased timeout to 60 seconds for slow connections
      headers: {
        'User-Agent': 'CitadelAI-Cloud-Integration/1.0',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Skip SSL certificate verification
        keepAlive: true,
        keepAliveMsecs: 1000,
      }),
    });
  }

  getProviderId(): CloudProviderType {
    return 'nextcloud';
  }

  getProviderName(): string {
    return 'Nextcloud';
  }

  /**
   * Generate OAuth authorization URL for Nextcloud
   */
  generateOAuthUrl(
    config: CloudProviderConfig,
    redirectUri: string,
    state: string
  ): string {
    if (!config.baseUrl) {
      throw new Error('Nextcloud baseUrl is required');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    const clientId = config.clientId || '';
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: 'read', // Request read access to files
    });

    return `${baseUrl}/index.php/apps/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    if (!config.baseUrl) {
      throw new Error('Nextcloud baseUrl is required');
    }
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Nextcloud clientId and clientSecret are required');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const tokenUrl = `${baseUrl}/index.php/apps/oauth2/api/v1/token`;

    try {
      const response = await this.axiosInstance.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      
      // Calculate expiration time (default to 1 hour if not provided)
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000);

      // Get user info to extract account ID
      const accountId = await this.getUserId(data.access_token, baseUrl);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: expiresAt,
        accountId: accountId,
      };
    } catch (error: unknown) {
      interface NextcloudOAuthError {
        response?: {
          data?: {
            error_description?: string;
          };
        };
        message?: string;
      }
      const oauthError = error as NextcloudOAuthError;
      const errorMessage = oauthError.response?.data?.error_description || oauthError.message || 'Failed to exchange code for token';
      throw new Error(`Nextcloud OAuth error: ${errorMessage}`);
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshAccessToken(
    refreshToken: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    if (!config.baseUrl) {
      throw new Error('Nextcloud baseUrl is required');
    }
    if (!config.clientId || !config.clientSecret) {
      throw new Error('Nextcloud clientId and clientSecret are required');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const tokenUrl = `${baseUrl}/index.php/apps/oauth2/api/v1/token`;

    try {
      const response = await this.axiosInstance.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const data = response.data;
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000);

      const accountId = await this.getUserId(data.access_token, baseUrl);

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: expiresAt,
        accountId: accountId,
      };
    } catch (error: unknown) {
      interface NextcloudOAuthError {
        response?: {
          data?: {
            error_description?: string;
          };
        };
        message?: string;
      }
      const oauthError = error as NextcloudOAuthError;
      const errorMessage = oauthError.response?.data?.error_description || oauthError.message || 'Failed to refresh token';
      throw new Error(`Nextcloud token refresh error: ${errorMessage}`);
    }
  }

  /**
   * Get user ID from Nextcloud (cached or fetch)
   */
  private async getUserId(accessToken: string, baseUrl: string): Promise<string> {
    try {
      const response = await this.axiosInstance.get(`${baseUrl}/ocs/v2.php/cloud/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'OCS-APIRequest': 'true',
        },
      });

      // Parse XML response to get user ID
      const xmlText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const userIdMatch = xmlText.match(/<id>(.*?)<\/id>/);
      return userIdMatch ? userIdMatch[1] : 'unknown';
    } catch (error) {
      nextcloudProviderLogger.warn('Failed to get user ID from Nextcloud, using default', { error: error instanceof Error ? error : new Error(String(error)) });
      return 'unknown';
    }
  }

  /**
   * List files and folders using WebDAV PROPFIND
   * Supports both OAuth Bearer tokens and App Password Basic Auth
   * @param progressCallback Optional callback to report progress during folder traversal (for depth=1 fallback)
   */
  async listFiles(
    accessToken: string,
    path: string = '',
    recursive: boolean = false,
    username?: string, // For App Password auth
    skipPathBuilding?: boolean, // Not used for Nextcloud (always builds paths)
    progressCallback?: (filesDiscovered: number) => Promise<void> // Progress callback
  ): Promise<CloudFileMetadata[]> {
    // Ensure baseUrl is normalized (no trailing slash) - constructor should handle this, but double-check
    const baseUrl = (this.baseUrl || '').replace(/\/+$/, '');
    
    // Determine if using App Password (has username) or OAuth Bearer token
    const useAppPassword = !!username;
    const userId = useAppPassword ? username : await this.getUserId(accessToken, baseUrl);
    
    // Normalize path: remove leading/trailing slashes
    let normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, ''); // Remove leading and trailing slashes
    
    // Construct WebDAV URL
    // For root (empty path), URL is: /remote.php/dav/files/username/ (with trailing slash for PROPFIND)
    // For subdirectories, URL is: /remote.php/dav/files/username/folder/ (with trailing slash)
    const webdavUrl = normalizedPath
      ? `${baseUrl}/remote.php/dav/files/${userId}/${normalizedPath}/`
      : `${baseUrl}/remote.php/dav/files/${userId}/`;
    
    // Use normalizedPath (without trailing slash) for parsing
    const basePathForParsing = normalizedPath || '';

    try {
      // Use Basic Auth for App Password, Bearer for OAuth
      const authHeader = useAppPassword
        ? `Basic ${Buffer.from(`${username}:${accessToken}`).toString('base64')}`
        : `Bearer ${accessToken}`;

      // Full PROPFIND body with Nextcloud-specific properties
      const fullPropfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <d:getetag/>
    <oc:fileid/>
    <oc:permissions/>
    <oc:size/>
  </d:prop>
</d:propfind>`;

      // Simplified PROPFIND body - use only standard DAV properties
      // Fallback if full body causes issues
      const simplePropfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <d:getetag/>
  </d:prop>
</d:propfind>`;

      // Try with requested depth first
      let depth = recursive ? 'infinity' : '1';
      let propfindBody = fullPropfindBody;
      let lastError: unknown = null;

      // Attempt the request - try different combinations:
      // 1. Full XML with requested depth
      // 2. Full XML with depth=1 (if infinity failed)
      // 3. Simple XML with depth=1 (if full XML failed)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {

          const response = await this.axiosInstance.request({
            method: 'PROPFIND',
            url: webdavUrl,
            headers: {
              Authorization: authHeader,
              Depth: depth,
              'Content-Type': 'application/xml; charset=utf-8',
            },
            data: propfindBody,
            validateStatus: (status) => status < 500, // Don't throw on 4xx, only 5xx
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          });

          // Check for error status codes
          if (response.status >= 400) {
            const errorText = typeof response.data === 'string' 
              ? response.data 
              : (response.data ? JSON.stringify(response.data) : 'No response body');
            
            // If 500 error and we haven't tried depth=1 yet, retry
            if (response.status >= 500 && depth === 'infinity' && attempt === 0) {
              depth = '1';
              lastError = new Error(`WebDAV PROPFIND failed with status ${response.status}: ${errorText}`);
              continue;
            }
            
            throw new Error(`WebDAV PROPFIND failed with status ${response.status}: ${errorText}`);
          }

          // Success - parse and return
          const files = this.parseWebDAVResponse(response.data, basePathForParsing);
          
          // If we used depth=1 but needed recursive, we need to recurse manually
          // Use iterative approach with queue to avoid stack overflow
          if (recursive && depth === '1') {
            const allFiles: CloudFileMetadata[] = [];
            const folders: CloudFileMetadata[] = files.filter(f => f.type === 'folder');
            
            // Add files from current level
            const currentLevelFiles = files.filter(f => f.type === 'file');
            allFiles.push(...currentLevelFiles);
            
            // Update progress callback if provided
            if (progressCallback && currentLevelFiles.length > 0) {
              try {
                await progressCallback(allFiles.length);
              } catch (error) {
                // Don't fail listing if progress update fails
                nextcloudProviderLogger.warn('Progress callback failed', { error: error instanceof Error ? error : new Error(String(error)) });
              }
            }
            
            // Use iterative queue-based approach instead of recursion to avoid stack overflow
            const CONCURRENT_FOLDERS = config.CLOUD_INDEXING_CONCURRENT_FOLDERS;
            const folderQueue: CloudFileMetadata[] = [...folders]; // Queue of folders to process
            let totalFoldersProcessed = 0;
            let foldersDiscovered = folders.length; // Track total folders discovered (including subfolders)
            
            // Process folders iteratively using a queue (avoids stack overflow)
            while (folderQueue.length > 0) {
              // Take a batch of folders from the queue
              const folderBatch: CloudFileMetadata[] = [];
              const batchSize = Math.min(CONCURRENT_FOLDERS, folderQueue.length);
              for (let i = 0; i < batchSize; i++) {
                const folder = folderQueue.shift();
                if (folder) {
                  folderBatch.push(folder);
                }
              }
              
              if (folderBatch.length === 0) break;
              
              // Process batch in parallel
              const batchResults = await Promise.allSettled(
                folderBatch.map(async (folder) => {
                  totalFoldersProcessed++;
                  try {
                    // List files in this folder (non-recursive, depth=1 only)
                    const subFiles = await this.listFiles(accessToken, folder.path, false, username);
                    
                    // Separate files and folders
                    const subFolders = subFiles.filter(f => f.type === 'folder');
                    const subFilesOnly = subFiles.filter(f => f.type === 'file');
                    
                    // Add files to results
                    allFiles.push(...subFilesOnly);
                    
                    // Track folders discovered
                    foldersDiscovered += subFolders.length;
                    
                    return { files: subFilesOnly, folders: subFolders };
                  } catch (folderError: unknown) {
                    const folderErrorMessage = folderError instanceof Error ? folderError.message : 'Unknown error';
                    nextcloudProviderLogger.warn('Failed to list folder', { folderPath: folder.path, error: folderError instanceof Error ? folderError : new Error(String(folderError)) });
                    return { files: [], folders: [] }; // Return empty on error
                  }
                })
              );
              
              // Add newly discovered folders to queue (after batch completes, thread-safe)
              for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value.folders) {
                  folderQueue.push(...result.value.folders);
                }
              }
              
              // Update progress callback after processing batch
              if (progressCallback && allFiles.length > 0) {
                try {
                  await progressCallback(allFiles.length);
                } catch (error) {
                  // Don't fail listing if progress update fails
                  nextcloudProviderLogger.warn('Progress callback failed', { error: error instanceof Error ? error : new Error(String(error)) });
                }
              }
              
            }
            return allFiles;
          }
          
          return files;
        } catch (error: unknown) {
          lastError = error;
          
          // Retry logic:
          // Attempt 0: Full XML with requested depth
          // Attempt 1: Full XML with depth=1 (if infinity failed)
          // Attempt 2: Simple XML with depth=1 (if full XML failed)
          
          interface NextcloudError {
            response?: {
              status?: number;
            };
          }
          const nextcloudError = error as NextcloudError;
          if (attempt === 0 && nextcloudError.response?.status && nextcloudError.response.status >= 500 && depth === 'infinity') {
            depth = '1';
            continue;
          } else if (attempt === 1 && nextcloudError.response?.status && nextcloudError.response.status >= 500) {
            propfindBody = simplePropfindBody;
            continue;
          }
          
          // Otherwise, break and throw
          break;
        }
      }

      // If we get here, all attempts failed
      throw lastError || new Error('Failed to list files after retries');
    } catch (error: unknown) {
      // Enhanced error logging
      interface NextcloudErrorDetails {
        url: string;
        error?: string;
        status?: number;
        [key: string]: unknown;
      }
      interface NextcloudAxiosError {
        response?: {
          status?: number;
          statusText?: string;
          headers?: unknown;
          data?: unknown;
        };
        message?: string;
        code?: string;
      }
      const axiosError = error as NextcloudAxiosError;
      const errorDetails: NextcloudErrorDetails = {
        url: webdavUrl,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        error: axiosError.message,
        code: axiosError.code,
      };

      // Try to extract response body
      if (axiosError.response?.data) {
        if (typeof axiosError.response.data === 'string') {
          errorDetails.data = axiosError.response.data.substring(0, 500); // Limit length
        } else {
          errorDetails.data = JSON.stringify(axiosError.response.data).substring(0, 500);
        }
      } else {
        errorDetails.data = 'No response data';
      }
      // Log response headers if available
      if (axiosError.response?.headers) {
        errorDetails.responseHeaders = axiosError.response.headers;
      }

      nextcloudProviderLogger.error('Nextcloud listFiles error', { error: axiosError instanceof Error ? axiosError : new Error(String(axiosError)), errorDetails });
      
      // Create a more informative error message
      let nextcloudErrorMessage = axiosError.message || 'Failed to list files';
      if (axiosError.response?.status) {
        nextcloudErrorMessage = `Request failed with status code ${axiosError.response.status}`;
        if (axiosError.response.statusText) {
          nextcloudErrorMessage += ` (${axiosError.response.statusText})`;
        }
        if (errorDetails.data && errorDetails.data !== 'No response data') {
          nextcloudErrorMessage += `: ${errorDetails.data}`;
        }
      }
      
      throw new Error(`Nextcloud listFiles error: ${nextcloudErrorMessage}`);
    }
  }

  /**
   * Parse WebDAV PROPFIND XML response
   */
  private parseWebDAVResponse(xmlText: string, basePath: string): CloudFileMetadata[] {
    const files: CloudFileMetadata[] = [];
    
    // Simple XML parsing using regex (for basic WebDAV responses)
    // In production, consider using a proper XML parser
    const responseMatch = xmlText.match(/<d:response[^>]*>([\s\S]*?)<\/d:response>/g);
    
    if (!responseMatch) {
      return files;
    }

    for (const responseXml of responseMatch) {
      try {
        // Extract href (file path)
        const hrefMatch = responseXml.match(/<d:href>(.*?)<\/d:href>/);
        if (!hrefMatch) continue;
        
        const href = decodeURIComponent(hrefMatch[1]);
        // Remove WebDAV path prefix: /remote.php/dav/files/username/
        const relativePath = href
          .replace(/^\/remote\.php\/dav\/files\/[^/]+\/?/, '')
          .replace(/\/+$/, ''); // Remove trailing slashes
        
        // Skip if it's the current directory itself (empty or matches basePath)
        if (!relativePath || relativePath === basePath) {
          continue;
        }

        // Extract resource type (file or folder)
        const resourceTypeMatch = responseXml.match(/<d:resourcetype>([\s\S]*?)<\/d:resourcetype>/);
        const isFolder = resourceTypeMatch && resourceTypeMatch[1].includes('<d:collection');

        // Extract file ID
        const fileIdMatch = responseXml.match(/<oc:fileid>(.*?)<\/oc:fileid>/);
        const fileId = fileIdMatch ? fileIdMatch[1] : href;

        // Extract size
        const sizeMatch = responseXml.match(/<d:getcontentlength>(.*?)<\/d:getcontentlength>/);
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;

        // Extract MIME type
        const mimeTypeMatch = responseXml.match(/<d:getcontenttype>(.*?)<\/d:getcontenttype>/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : undefined;

        // Extract last modified
        const lastModifiedMatch = responseXml.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/);
        const modifiedAt = lastModifiedMatch
          ? new Date(lastModifiedMatch[1])
          : undefined;

        // Extract ETag
        const etagMatch = responseXml.match(/<d:getetag>(.*?)<\/d:getetag>/);
        const etag = etagMatch ? etagMatch[1].replace(/"/g, '') : undefined;

        // Extract file/folder name (last part of path)
        const pathParts = relativePath.split('/').filter(p => p);
        const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : relativePath;

        files.push({
          id: fileId,
          name: fileName,
          path: relativePath,
          type: isFolder ? 'folder' : 'file',
          mimeType: mimeType || (isFolder ? undefined : 'application/octet-stream'),
          size: size,
          modifiedAt: modifiedAt,
          etag: etag,
          downloadLink: href, // WebDAV URL
        });
      } catch (parseError) {
        nextcloudProviderLogger.warn('Failed to parse WebDAV response item', { error: parseError instanceof Error ? parseError : new Error(String(parseError)) });
        continue;
      }
    }

    return files;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    accessToken: string,
    fileId: string,
    username?: string
  ): Promise<CloudFileMetadata> {
    // For Nextcloud, fileId is the WebDAV path
    const baseUrl = (this.baseUrl || '').replace(/\/+$/, '');
    const useAppPassword = !!username;
    const userId = useAppPassword ? username : await this.getUserId(accessToken, baseUrl);
    // Normalize fileId path
    const normalizedFileId = fileId.replace(/^\/+/, '').replace(/\/+$/, '');
    const webdavUrl = normalizedFileId
      ? `${baseUrl}/remote.php/dav/files/${userId}/${normalizedFileId}/`
      : `${baseUrl}/remote.php/dav/files/${userId}/`;

    const authHeader = useAppPassword
      ? `Basic ${Buffer.from(`${username}:${accessToken}`).toString('base64')}`
      : `Bearer ${accessToken}`;

    try {
      const response = await this.axiosInstance.request({
        method: 'PROPFIND',
        url: webdavUrl,
        headers: {
          Authorization: authHeader,
          Depth: '0',
        },
      });

      const files = this.parseWebDAVResponse(response.data, '');
      if (files.length === 0) {
        throw new Error('File not found');
      }

      return files[0];
    } catch (error: unknown) {
      interface NextcloudAxiosError {
        response?: {
          status?: number;
          statusText?: string;
          data?: unknown;
        };
        message?: string;
      }
      const axiosError = error as NextcloudAxiosError;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      nextcloudProviderLogger.error('Nextcloud getFileMetadata error', {
        url: webdavUrl,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      const metadataErrorMsg = axiosError.response?.data || axiosError.message || 'Failed to get file metadata';
      throw new Error(`Nextcloud getFileMetadata error: ${metadataErrorMsg}`);
    }
  }

  /**
   * Download file content
   */
  async getFileContent(
    accessToken: string,
    fileId: string,
    username?: string
  ): Promise<Buffer> {
    const baseUrl = (this.baseUrl || '').replace(/\/+$/, '');
    const useAppPassword = !!username;
    const userId = useAppPassword ? username : await this.getUserId(accessToken, baseUrl);
    // Normalize fileId path (files don't need trailing slash)
    const normalizedFileId = fileId.replace(/^\/+/, '').replace(/\/+$/, '');
    const webdavUrl = `${baseUrl}/remote.php/dav/files/${userId}/${normalizedFileId}`;

    const authHeader = useAppPassword
      ? `Basic ${Buffer.from(`${username}:${accessToken}`).toString('base64')}`
      : `Bearer ${accessToken}`;

    try {
      const response = await this.axiosInstance.get(webdavUrl, {
        headers: {
          Authorization: authHeader,
        },
        responseType: 'arraybuffer',
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxBodyLength: 10 * 1024 * 1024,
      });

      return Buffer.from(response.data);
    } catch (error: unknown) {
      interface NextcloudError {
        response?: {
          data?: unknown;
        };
        message?: string;
      }
      const nextcloudError = error as NextcloudError;
      const errorMessage = nextcloudError.response?.data || nextcloudError.message || 'Failed to download file';
      interface NextcloudAxiosError {
        response?: {
          status?: number;
          statusText?: string;
        };
        message?: string;
      }
      const axiosError = error as NextcloudAxiosError;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      nextcloudProviderLogger.error('Nextcloud getFileContent error', {
        url: webdavUrl,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      if (axiosError.response?.status === 413 || axiosError.message?.includes('maxContentLength')) {
        throw new Error('File size exceeds 10MB limit');
      }
      throw new Error(`Nextcloud getFileContent error: ${errorMessage}`);
    }
  }

  /**
   * Test connection with access token
   */
  async testConnection(accessToken: string, username?: string): Promise<boolean> {
    try {
      // Try to list root directory
      await this.listFiles(accessToken, '', false, username);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      interface NextcloudAxiosError {
        response?: {
          status?: number;
          statusText?: string;
          data?: unknown;
        };
        message?: string;
      }
      const axiosError = error as NextcloudAxiosError;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      nextcloudProviderLogger.error('Nextcloud connection test failed', {
        baseUrl: this.baseUrl,
        username: username || 'N/A',
        error: error instanceof Error ? error : new Error(String(error)),
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        responseData: axiosError.response?.data,
      });
      throw error; // Re-throw to get better error messages
    }
  }

}
