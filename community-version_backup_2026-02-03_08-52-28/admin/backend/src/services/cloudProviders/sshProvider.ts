/**
 * SSH/SFTP Cloud Provider Implementation
 * Uses SSH key-based authentication and SFTP for file operations
 */

import Client from 'ssh2-sftp-client';
import {
  CloudProvider,
  CloudProviderType,
  CloudFileMetadata,
  OAuthTokenData,
  CloudProviderConfig,
} from './types';
import { logger } from '@shared/utils';
import { config } from '../../config';

const sshProviderLogger = logger.child({ service: 'admin-backend', component: 'sshProvider' });

interface SFTPFileInfo {
  type: 'd' | '-' | 'l'; // directory, file, or link
  name: string;
  size: number;
  modifyTime: number;
  accessTime: number;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
}

export class SSHProvider implements CloudProvider {
  private host?: string;
  private port: number;
  private username?: string;
  private privateKey?: string;
  private passphrase?: string;
  private password?: string;
  private basePath: string;

  constructor(config?: CloudProviderConfig) {
    this.host = config?.host;
    this.port = config?.port || 22;
    this.username = config?.username;
    this.privateKey = config?.privateKey;
    this.passphrase = config?.passphrase;
    this.password = config?.password;
    this.basePath = (config?.basePath || '/').replace(/\/+$/, ''); // Remove trailing slashes, default to /
  }

  getProviderId(): CloudProviderType {
    return 'ssh';
  }

  getProviderName(): string {
    return 'SSH/SFTP';
  }

  /**
   * Generate OAuth authorization URL - Not applicable for SSH
   */
  generateOAuthUrl(
    config: CloudProviderConfig,
    redirectUri: string,
    state: string
  ): string {
    throw new Error('SSH provider does not use OAuth. Use direct credential configuration instead.');
  }

  /**
   * Exchange authorization code for access token - Not applicable for SSH
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    throw new Error('SSH provider does not use OAuth. Use direct credential configuration instead.');
  }

  /**
   * Refresh access token - Not applicable for SSH (keys don't expire)
   */
  async refreshAccessToken(
    refreshToken: string,
    config: CloudProviderConfig
  ): Promise<OAuthTokenData> {
    throw new Error('SSH provider does not use token refresh. SSH keys do not expire.');
  }

  /**
   * Create and configure SFTP client
   */
  private createSFTPClient(privateKey: string, username?: string): Client {
    // Note: Connection config is passed to connect() method, not constructor
    return new Client();
  }

  /**
   * Normalize path - ensure it starts with basePath and handle relative paths
   */
  private normalizePath(path?: string): string {
    if (!path || path === '') {
      return this.basePath;
    }

    // If basePath is root, paths starting with / are relative to root
    if (this.basePath === '/') {
      // Paths starting with / are absolute paths from root
      if (path.startsWith('/')) {
        return path;
      } else {
        // Relative path - combine with root
        return `/${path}`.replace(/\/+/g, '/');
      }
    }

    // If basePath starts with ~, handle it specially
    if (this.basePath.startsWith('~')) {
      // Paths starting with / are treated as relative to basePath (not absolute from root)
      if (path.startsWith('/')) {
        // Remove leading / and combine with basePath
        const pathWithoutSlash = path.replace(/^\/+/, '');
        return `${this.basePath}/${pathWithoutSlash}`.replace(/\/+/g, '/');
      } else {
        // Relative path - combine with basePath
        return `${this.basePath}/${path}`.replace(/\/+/g, '/');
      }
    }

    // If path is absolute, use it directly (but ensure it's within basePath if basePath is set)
    if (path.startsWith('/')) {
      // If path starts with basePath, use it as-is
      if (path.startsWith(this.basePath)) {
        return path;
      } else {
        // Path is outside basePath, combine them
        return `${this.basePath}${path}`.replace(/\/+/g, '/');
      }
    }

    // Relative path - combine with basePath
    const combined = `${this.basePath}/${path}`.replace(/\/+/g, '/');
    return combined;
  }

  /**
   * Convert SFTP file info to CloudFileMetadata
   */
  private fileInfoToMetadata(
    fileInfo: SFTPFileInfo,
    fullPath: string,
    basePath: string
  ): CloudFileMetadata {
    const isDirectory = fileInfo.type === 'd';
    let relativePath: string;
    if (basePath === '/') {
      // For root basePath, keep the leading slash to indicate it's from root
      relativePath = fullPath;
    } else if (basePath.startsWith('~')) {
      // For basePath starting with ~, remove basePath prefix
      if (fullPath.startsWith(basePath)) {
        relativePath = fullPath.substring(basePath.length).replace(/^\/+/, '') || fileInfo.name;
      } else {
        // Path doesn't start with basePath, use as-is
        relativePath = fullPath;
      }
    } else if (fullPath.startsWith(basePath)) {
      // Remove basePath prefix and clean up leading slashes
      relativePath = fullPath.substring(basePath.length).replace(/^\/+/, '') || fileInfo.name;
    } else {
      // Path doesn't start with basePath, use as-is
      relativePath = fullPath;
    }

    return {
      id: fullPath, // Use full path as ID for SSH
      name: fileInfo.name,
      path: relativePath,
      type: isDirectory ? 'folder' : 'file',
      mimeType: isDirectory ? undefined : this.guessMimeType(fileInfo.name),
      size: isDirectory ? undefined : fileInfo.size,
      modifiedAt: new Date(fileInfo.modifyTime),
      createdAt: new Date(fileInfo.accessTime),
      etag: `${fileInfo.modifyTime}-${fileInfo.size}`, // Simple etag based on mtime and size
    };
  }

  /**
   * Guess MIME type from file extension
   */
  private guessMimeType(filename: string): string | undefined {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'md': 'text/markdown',
    };
    return ext ? mimeTypes[ext] : undefined;
  }

  /**
   * List files and folders
   */
  async listFiles(
    accessToken: string, // For SSH, this is the private key
    path: string = '',
    recursive: boolean = false,
    username?: string,
    skipPathBuilding?: boolean,
    progressCallback?: (filesDiscovered: number) => Promise<void>
  ): Promise<CloudFileMetadata[]> {
    const sftp = this.createSFTPClient(accessToken, username);
    const normalizedPath = this.normalizePath(path);
    const files: CloudFileMetadata[] = [];

    try {
      if (!this.host) {
        throw new Error('SSH host is not configured');
      }
      const finalUsername = username || this.username;
      if (!finalUsername) {
        throw new Error('SSH username is not configured');
      }
      
      // Validate private key format
      if (!accessToken.includes('BEGIN') || !accessToken.includes('PRIVATE KEY')) {
        throw new Error('Invalid SSH private key format. The key must include "-----BEGIN ... PRIVATE KEY-----" and "-----END ... PRIVATE KEY-----" lines.');
      }
      
      // Log connection attempt (without sensitive data)
      sshProviderLogger.debug('Attempting SSH connection', {
        host: this.host,
        port: this.port,
        username: finalUsername,
        keyFormat: accessToken.includes('OPENSSH') ? 'OpenSSH' : accessToken.includes('RSA') ? 'RSA' : 'Unknown',
        hasPassphrase: !!this.passphrase,
        hasPassword: !!this.password,
        authMethod: this.password ? 'key+password' : 'key-only',
      });
      
      const connectOptions: {
        host: string;
        port: number;
        username: string;
        privateKey?: string;
        passphrase?: string;
        password?: string;
        readyTimeout: number;
        retries: number;
        retry_factor: number;
        retry_delay: number;
      } = {
        host: this.host!,
        port: this.port,
        username: finalUsername,
        readyTimeout: 30000, // 30 seconds timeout
        retries: 1,
        retry_factor: 2,
        retry_delay: 2000,
      };
      
      // Add private key if provided
      if (accessToken.trim()) {
        connectOptions.privateKey = accessToken.trim();
        if (this.passphrase) {
          connectOptions.passphrase = this.passphrase.trim();
        }
      }
      
      // Add password if provided (for key+password authentication)
      if (this.password) {
        connectOptions.password = this.password.trim();
      }
      
      await sftp.connect(connectOptions);

      if (recursive) {
        // Recursive listing
        const allFiles = await this.listFilesRecursive(
          sftp,
          normalizedPath,
          this.basePath,
          progressCallback
        );
        files.push(...allFiles);
      } else {
        // Non-recursive: list direct children
        // Always use absolute paths - never use '.' as it depends on current working directory
        const pathToList = normalizedPath || this.basePath || '/';
        
        sshProviderLogger.debug('Listing SSH directory', {
          requestedPath: path,
          normalizedPath,
          basePath: this.basePath,
          pathToList,
        });
        
        const fileList = await sftp.list(pathToList);
        
        for (const fileInfo of fileList) {
          // Construct full path by combining the listed path with the file name
          const fullPath = `${pathToList}/${fileInfo.name}`.replace(/\/+/g, '/');
          const metadata = this.fileInfoToMetadata(
            fileInfo as SFTPFileInfo,
            fullPath,
            this.basePath
          );
          files.push(metadata);
        }
      }

      return files;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sshProviderLogger.error('SSH listFiles error', {
        path: normalizedPath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw new Error(`SSH listFiles error: ${errorMessage}`);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Recursively list all files in a directory
   */
  private async listFilesRecursive(
    sftp: Client,
    startPath: string,
    basePath: string,
    progressCallback?: (filesDiscovered: number) => Promise<void>
  ): Promise<CloudFileMetadata[]> {
    const allFiles: CloudFileMetadata[] = [];
    const foldersToProcess: string[] = [startPath];
    
    // Use environment variable for concurrency, default to 5
    const CONCURRENT_FOLDERS = config.CLOUD_INDEXING_CONCURRENT_FOLDERS || 5;

    while (foldersToProcess.length > 0) {
      // Take a batch of folders from the queue
      const folderBatch: string[] = [];
      const batchSize = Math.min(CONCURRENT_FOLDERS, foldersToProcess.length);
      for (let i = 0; i < batchSize; i++) {
        const folder = foldersToProcess.shift();
        if (folder) {
          folderBatch.push(folder);
        }
      }
      
      if (folderBatch.length === 0) break;
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        folderBatch.map(async (folderPath) => {
          try {
            const fileList = await sftp.list(folderPath);
            const folderFiles: CloudFileMetadata[] = [];
            const subFolders: string[] = [];
            
            for (const fileInfo of fileList) {
              const fullPath = `${folderPath}/${fileInfo.name}`.replace(/\/+/g, '/');
              const metadata = this.fileInfoToMetadata(
                fileInfo as SFTPFileInfo,
                fullPath,
                basePath
              );
              folderFiles.push(metadata);
              
              if (metadata.type === 'folder') {
                subFolders.push(fullPath);
              }
            }
            
            return { files: folderFiles, folders: subFolders };
          } catch (folderError: unknown) {
            sshProviderLogger.warn('Failed to list folder', {
              folderPath,
              error: folderError instanceof Error ? folderError : new Error(String(folderError)),
            });
            return { files: [], folders: [] };
          }
        })
      );
      
      // Collect results and add newly discovered folders to queue
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allFiles.push(...result.value.files);
          foldersToProcess.push(...result.value.folders);
        } else {
          sshProviderLogger.warn('Failed to process folder batch', {
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          });
        }
      }
      
      // Update progress callback after processing batch
      if (progressCallback && allFiles.length > 0) {
        try {
          await progressCallback(allFiles.length);
        } catch (error) {
          // Don't fail listing if progress update fails
          sshProviderLogger.warn('Progress callback failed', {
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    }

    return allFiles;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(
    accessToken: string, // For SSH, this is the private key
    fileId: string, // For SSH, this is the file path
    username?: string,
    skipPathBuilding?: boolean
  ): Promise<CloudFileMetadata> {
    const sftp = this.createSFTPClient(accessToken, username);
    const normalizedPath = this.normalizePath(fileId);

    try {
      if (!this.host) {
        throw new Error('SSH host is not configured');
      }
      const finalUsername = username || this.username;
      if (!finalUsername) {
        throw new Error('SSH username is not configured');
      }
      
      // Validate private key format
      if (!accessToken.includes('BEGIN') || !accessToken.includes('PRIVATE KEY')) {
        throw new Error('Invalid SSH private key format. The key must include "-----BEGIN ... PRIVATE KEY-----" and "-----END ... PRIVATE KEY-----" lines.');
      }
      
      // Log connection attempt (without sensitive data)
      sshProviderLogger.debug('Attempting SSH connection', {
        host: this.host,
        port: this.port,
        username: finalUsername,
        keyFormat: accessToken.includes('OPENSSH') ? 'OpenSSH' : accessToken.includes('RSA') ? 'RSA' : 'Unknown',
        hasPassphrase: !!this.passphrase,
        hasPassword: !!this.password,
        authMethod: this.password ? 'key+password' : 'key-only',
      });
      
      const connectOptions: {
        host: string;
        port: number;
        username: string;
        privateKey?: string;
        passphrase?: string;
        password?: string;
        readyTimeout: number;
        retries: number;
        retry_factor: number;
        retry_delay: number;
      } = {
        host: this.host!,
        port: this.port,
        username: finalUsername,
        readyTimeout: 30000, // 30 seconds timeout
        retries: 1,
        retry_factor: 2,
        retry_delay: 2000,
      };
      
      // Add private key if provided
      if (accessToken.trim()) {
        connectOptions.privateKey = accessToken.trim();
        if (this.passphrase) {
          connectOptions.passphrase = this.passphrase.trim();
        }
      }
      
      // Add password if provided (for key+password authentication)
      if (this.password) {
        connectOptions.password = this.password.trim();
      }
      
      await sftp.connect(connectOptions);

      const fileInfo = await sftp.stat(normalizedPath);
      const metadata = this.fileInfoToMetadata(
        fileInfo as SFTPFileInfo,
        normalizedPath,
        this.basePath
      );

      return metadata;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sshProviderLogger.error('SSH getFileMetadata error', {
        fileId: normalizedPath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw new Error(`SSH getFileMetadata error: ${errorMessage}`);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Download file content
   */
  async getFileContent(
    accessToken: string, // For SSH, this is the private key
    fileId: string, // For SSH, this is the file path
    username?: string
  ): Promise<Buffer> {
    const sftp = this.createSFTPClient(accessToken, username);
    const normalizedPath = this.normalizePath(fileId);

    try {
      if (!this.host) {
        throw new Error('SSH host is not configured');
      }
      const finalUsername = username || this.username;
      if (!finalUsername) {
        throw new Error('SSH username is not configured');
      }
      
      // Validate private key format
      if (!accessToken.includes('BEGIN') || !accessToken.includes('PRIVATE KEY')) {
        throw new Error('Invalid SSH private key format. The key must include "-----BEGIN ... PRIVATE KEY-----" and "-----END ... PRIVATE KEY-----" lines.');
      }
      
      // Log connection attempt (without sensitive data)
      sshProviderLogger.debug('Attempting SSH connection', {
        host: this.host,
        port: this.port,
        username: finalUsername,
        keyFormat: accessToken.includes('OPENSSH') ? 'OpenSSH' : accessToken.includes('RSA') ? 'RSA' : 'Unknown',
        hasPassphrase: !!this.passphrase,
        hasPassword: !!this.password,
        authMethod: this.password ? 'key+password' : 'key-only',
      });
      
      const connectOptions: {
        host: string;
        port: number;
        username: string;
        privateKey?: string;
        passphrase?: string;
        password?: string;
        readyTimeout: number;
        retries: number;
        retry_factor: number;
        retry_delay: number;
      } = {
        host: this.host!,
        port: this.port,
        username: finalUsername,
        readyTimeout: 30000, // 30 seconds timeout
        retries: 1,
        retry_factor: 2,
        retry_delay: 2000,
      };
      
      // Add private key if provided
      if (accessToken.trim()) {
        connectOptions.privateKey = accessToken.trim();
        if (this.passphrase) {
          connectOptions.passphrase = this.passphrase.trim();
        }
      }
      
      // Add password if provided (for key+password authentication)
      if (this.password) {
        connectOptions.password = this.password.trim();
      }
      
      await sftp.connect(connectOptions);

      // Check file size first (limit to 10MB)
      const fileInfo = await sftp.stat(normalizedPath);
      if (fileInfo.size && fileInfo.size > 10 * 1024 * 1024) {
        throw new Error('File size exceeds 10MB limit');
      }

      const fileContent = await sftp.get(normalizedPath);
      // When no destination is provided, get() returns Buffer or string
      if (!fileContent) {
        throw new Error('Failed to retrieve file content');
      }
      // Handle both Buffer and string return types
      if (Buffer.isBuffer(fileContent)) {
        return fileContent;
      }
      if (typeof fileContent === 'string') {
        return Buffer.from(fileContent, 'utf-8');
      }
      // Fallback: try to convert to Buffer
      return Buffer.from(fileContent as ArrayBuffer);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      sshProviderLogger.error('SSH getFileContent error', {
        fileId: normalizedPath,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      
      if (errorMessage.includes('10MB')) {
        throw new Error('File size exceeds 10MB limit');
      }
      
      throw new Error(`SSH getFileContent error: ${errorMessage}`);
    } finally {
      await sftp.end();
    }
  }

  /**
   * Test connection with SSH credentials
   */
  async testConnection(accessToken: string, username?: string): Promise<boolean> {
    const sftp = this.createSFTPClient(accessToken, username);
    
    // Define finalUsername before try block so it's available in catch block
    const finalUsername = username || this.username;

    try {
      if (!this.host) {
        throw new Error('SSH host is not configured');
      }
      if (!finalUsername) {
        throw new Error('SSH username is not configured');
      }
      
      // Validate private key format
      if (!accessToken.includes('BEGIN') || !accessToken.includes('PRIVATE KEY')) {
        throw new Error('Invalid SSH private key format. The key must include "-----BEGIN ... PRIVATE KEY-----" and "-----END ... PRIVATE KEY-----" lines.');
      }
      
      // Log connection attempt (without sensitive data)
      sshProviderLogger.debug('Attempting SSH connection', {
        host: this.host,
        port: this.port,
        username: finalUsername,
        keyFormat: accessToken.includes('OPENSSH') ? 'OpenSSH' : accessToken.includes('RSA') ? 'RSA' : 'Unknown',
        hasPassphrase: !!this.passphrase,
        hasPassword: !!this.password,
        authMethod: this.password ? 'key+password' : 'key-only',
      });
      
      const connectOptions: {
        host: string;
        port: number;
        username: string;
        privateKey?: string;
        passphrase?: string;
        password?: string;
        readyTimeout: number;
        retries: number;
        retry_factor: number;
        retry_delay: number;
      } = {
        host: this.host!,
        port: this.port,
        username: finalUsername,
        readyTimeout: 30000, // 30 seconds timeout
        retries: 1,
        retry_factor: 2,
        retry_delay: 2000,
      };
      
      // Add private key if provided
      if (accessToken.trim()) {
        connectOptions.privateKey = accessToken.trim();
        if (this.passphrase) {
          connectOptions.passphrase = this.passphrase.trim();
        }
      }
      
      // Add password if provided (for key+password authentication)
      if (this.password) {
        connectOptions.password = this.password.trim();
      }
      
      await sftp.connect(connectOptions);

      // Try to list the base path to verify connection works
      // Use basePath if set, otherwise use root
      const pathToTest = this.basePath && this.basePath !== '' ? this.basePath : '/';
      await sftp.list(pathToTest);
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide more helpful error messages for common issues
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Timed out') || errorMessage.includes('timeout')) {
        userFriendlyMessage = `Connection timeout: Unable to connect to ${this.host}:${this.port}. Please check:
- The SSH server is running and accessible
- The host and port are correct
- Network connectivity from this server to the SSH host
- Firewall rules allow connections on port ${this.port}`;
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) {
        userFriendlyMessage = `Connection refused: The SSH server at ${this.host}:${this.port} is not accepting connections. Please check:
- The SSH service is running on the remote server
- The port number is correct
- The server firewall allows connections`;
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        userFriendlyMessage = `Host not found: Unable to resolve hostname "${this.host}". Please check:
- The hostname or IP address is correct
- DNS resolution is working (if using hostname)`;
      } else if (errorMessage.includes('Authentication') || errorMessage.includes('auth') || errorMessage.includes('All configured authentication methods failed')) {
        const authMethodNote = this.password 
          ? '\nNote: Your server requires both a key AND a password. Ensure both are provided correctly.'
          : '\nNote: If your server requires both a key and password, add the password in the SSH configuration.';
        
        userFriendlyMessage = `Authentication failed: ${errorMessage}${authMethodNote}

Troubleshooting steps:
1. Verify the private key is correct:
   - Ensure you copied the complete private key (including BEGIN and END lines)
   - Check that the key format is OpenSSH (starts with "-----BEGIN OPENSSH PRIVATE KEY-----")
   - If using an older key format (RSA with "-----BEGIN RSA PRIVATE KEY-----"), you may need to convert it

2. Verify the public key is authorized on the server:
   - The public key corresponding to your private key must be in ~/.ssh/authorized_keys on the server
   - Check with: cat ~/.ssh/authorized_keys on the remote server
   - If missing, add it with: echo "your-public-key" >> ~/.ssh/authorized_keys

3. Verify the username is correct:
   - Current username: ${finalUsername}
   - Ensure this matches the user account on the SSH server

4. If the key has a passphrase:
   - Ensure you entered the correct passphrase
   - The passphrase is case-sensitive

5. Test the key manually:
   - Try: ssh -i /path/to/private/key ${finalUsername}@${this.host}
   - If that works, the key format is correct and the issue is with how it's being used

6. Check server logs:
   - On the SSH server, check: sudo tail -f /var/log/auth.log
   - Look for authentication failure messages`;
      }
      
      sshProviderLogger.error('SSH connection test failed', {
        host: this.host,
        port: this.port,
        username: username || this.username,
        basePath: this.basePath,
        error: error instanceof Error ? error : new Error(String(error)),
        userFriendlyMessage,
      });
      
      // Throw a more user-friendly error
      throw new Error(userFriendlyMessage);
    } finally {
      await sftp.end();
    }
  }
}
