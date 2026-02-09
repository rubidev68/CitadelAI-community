/**
 * Nextcloud Cloud Provider Implementation (User Backend)
 * Simplified version for user-backend (no OAuth, only file operations)
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
        rejectUnauthorized: false, // Accept self-signed certificates
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

  // OAuth methods are not implemented in user-backend
  // They are only used in admin-backend

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

    // Ensure baseUrl is normalized (no trailing slash)
    const baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh token';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { error_description?: string } } }).response 
        : undefined;
      const finalErrorMessage = errorResponse?.data?.error_description || errorMessage;
      throw new Error(`Nextcloud token refresh error: ${finalErrorMessage}`);
    }
  }

  /**
   * List files and folders using WebDAV PROPFIND
   * Supports both OAuth Bearer tokens and App Password Basic Auth
   */
  async listFiles(
    accessToken: string,
    path: string = '',
    recursive: boolean = false,
    username?: string,
    skipPathBuilding?: boolean, // Not used for Nextcloud (always builds paths)
    progressCallback?: (filesDiscovered: number) => Promise<void> // Not used in user-backend
  ): Promise<CloudFileMetadata[]> {
    // Ensure baseUrl is normalized (no trailing slash)
    const baseUrl = (this.baseUrl || '').replace(/\/+$/, '');
    const useAppPassword = !!username;
    const userId = useAppPassword ? username : await this.getUserId(accessToken, baseUrl);
    // Normalize path: remove leading/trailing slashes
    let normalizedPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
    // Construct WebDAV URL with trailing slash for PROPFIND
    const webdavUrl = normalizedPath
      ? `${baseUrl}/remote.php/dav/files/${userId}/${normalizedPath}/`
      : `${baseUrl}/remote.php/dav/files/${userId}/`;

    try {
      const depth = recursive ? 'infinity' : '1';
      
      const propfindBody = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns">
  <d:prop>
    <d:getlastmodified/>
    <d:getcontentlength/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:fileid/>
    <oc:permissions/>
    <oc:size/>
    <nc:has-preview/>
  </d:prop>
</d:propfind>`;

      // Use Basic Auth for App Password, Bearer for OAuth
      const authHeader = useAppPassword
        ? `Basic ${Buffer.from(`${username}:${accessToken}`).toString('base64')}`
        : `Bearer ${accessToken}`;

      const response = await this.axiosInstance.request({
        method: 'PROPFIND',
        url: webdavUrl,
        headers: {
          Authorization: authHeader,
          Depth: depth,
          'Content-Type': 'application/xml',
        },
        data: propfindBody,
      });

      // Use normalizedPath (without trailing slash) for parsing
      const basePathForParsing = normalizedPath || '';
      return this.parseWebDAVResponse(response.data, basePathForParsing);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      const errorStatusText = errorResponse && 'statusText' in errorResponse 
        ? (errorResponse as { statusText?: string }).statusText 
        : undefined;
      logger.error('Nextcloud listFiles error', error instanceof Error ? error : undefined, {
        url: webdavUrl,
        status: errorResponse?.status,
        statusText: errorStatusText,
        service: 'nextcloudProvider',
      });
      const errorData = errorResponse && 'data' in errorResponse 
        ? (errorResponse as { data?: unknown }).data 
        : undefined;
      const finalErrorMessage = (typeof errorData === 'string' ? errorData : errorMessage) || 'Failed to list files';
      throw new Error(`Nextcloud listFiles error: ${finalErrorMessage}`);
    }
  }

  /**
   * Parse WebDAV PROPFIND XML response
   */
  private parseWebDAVResponse(xmlText: string, basePath: string): CloudFileMetadata[] {
    const files: CloudFileMetadata[] = [];
    
    const responseMatch = xmlText.match(/<d:response[^>]*>([\s\S]*?)<\/d:response>/g);
    
    if (!responseMatch) {
      return files;
    }

    for (const responseXml of responseMatch) {
      try {
        const hrefMatch = responseXml.match(/<d:href>(.*?)<\/d:href>/);
        if (!hrefMatch) continue;
        
        const href = decodeURIComponent(hrefMatch[1]);
        const relativePath = href
          .replace(/^\/remote\.php\/dav\/files\/[^/]+\//, '')
          .replace(/^\//, '');
        
        if (!relativePath || relativePath === basePath.replace(/^\//, '')) {
          continue;
        }

        const resourceTypeMatch = responseXml.match(/<d:resourcetype>([\s\S]*?)<\/d:resourcetype>/);
        const isFolder = resourceTypeMatch && resourceTypeMatch[1].includes('<d:collection');

        const fileIdMatch = responseXml.match(/<oc:fileid>(.*?)<\/oc:fileid>/);
        const fileId = fileIdMatch ? fileIdMatch[1] : href;

        const sizeMatch = responseXml.match(/<d:getcontentlength>(.*?)<\/d:getcontentlength>/);
        const size = sizeMatch ? parseInt(sizeMatch[1], 10) : undefined;

        const mimeTypeMatch = responseXml.match(/<d:getcontenttype>(.*?)<\/d:getcontenttype>/);
        const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : undefined;

        const lastModifiedMatch = responseXml.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/);
        const modifiedAt = lastModifiedMatch
          ? new Date(lastModifiedMatch[1])
          : undefined;

        const etagMatch = responseXml.match(/<d:getetag>(.*?)<\/d:getetag>/);
        const etag = etagMatch ? etagMatch[1].replace(/"/g, '') : undefined;

        const fileName = relativePath.split('/').pop() || relativePath;

        files.push({
          id: fileId,
          name: fileName,
          path: relativePath,
          type: isFolder ? 'folder' : 'file',
          mimeType: mimeType || (isFolder ? undefined : 'application/octet-stream'),
          size: size,
          modifiedAt: modifiedAt,
          etag: etag,
          downloadLink: href,
        });
      } catch (parseError) {
          logger.warn('Failed to parse WebDAV response item', {
            error: parseError instanceof Error ? parseError.message : String(parseError),
            service: 'nextcloudProvider',
          });
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
    // Ensure baseUrl is normalized (no trailing slash)
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Nextcloud getFileMetadata error', error instanceof Error ? error : undefined, {
        url: webdavUrl,
        status: errorResponse?.status,
        service: 'nextcloudProvider',
      });
      const errorData = errorResponse && 'data' in errorResponse 
        ? (errorResponse as { data?: unknown }).data 
        : undefined;
      const finalErrorMessage = (typeof errorData === 'string' ? errorData : errorMessage) || 'Failed to get file metadata';
      throw new Error(`Nextcloud getFileMetadata error: ${finalErrorMessage}`);
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
    // Ensure baseUrl is normalized (no trailing slash)
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { status?: number } }).response 
        : undefined;
      logger.error('Nextcloud getFileContent error', error instanceof Error ? error : undefined, {
        url: webdavUrl,
        status: errorResponse?.status,
        service: 'nextcloudProvider',
      });
      if (errorResponse?.status === 413 || errorMessage.includes('maxContentLength')) {
        throw new Error('File size exceeds 10MB limit');
      }
      // Check for SSL certificate errors
      const errorCode = error && typeof error === 'object' && 'code' in error 
        ? (error as { code?: string }).code 
        : undefined;
      if (errorMessage.includes('self-signed certificate') || errorCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        throw new Error('Self-signed certificate error - SSL verification failed');
      }
      const errorData = errorResponse && 'data' in errorResponse 
        ? (errorResponse as { data?: unknown }).data 
        : undefined;
      const finalErrorMessage = (typeof errorData === 'string' ? errorData : errorMessage) || 'Failed to download file';
      throw new Error(`Nextcloud getFileContent error: ${finalErrorMessage}`);
    }
  }

  /**
   * Test connection with access token
   */
  async testConnection(accessToken: string, username?: string): Promise<boolean> {
    try {
      await this.listFiles(accessToken, '', false, username);
      return true;
    } catch (error) {
      logger.error('Nextcloud connection test failed', error instanceof Error ? error : undefined, {
        service: 'nextcloudProvider',
      });
      return false;
    }
  }

  /**
   * Get user ID from Nextcloud
   */
  private async getUserId(accessToken: string, baseUrl: string): Promise<string> {
    try {
      // Ensure baseUrl is normalized
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
      const response = await this.axiosInstance.get(`${normalizedBaseUrl}/ocs/v2.php/cloud/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'OCS-APIRequest': 'true',
        },
      });

      const xmlText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const userIdMatch = xmlText.match(/<id>(.*?)<\/id>/);
      return userIdMatch ? userIdMatch[1] : 'unknown';
    } catch (error) {
      logger.warn('Failed to get user ID from Nextcloud, using default', {
        service: 'nextcloudProvider',
      });
      return 'unknown';
    }
  }
}
