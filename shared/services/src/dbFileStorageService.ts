/**
 * Database File Storage Service
 * Handles storage, validation, and management of uploaded database files
 * Supports local storage and S3 for scalability
 */

import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@shared/utils';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const dbFileStorageLogger = logger.child({ service: 'shared-services', component: 'dbFileStorageService' });

export interface StoredDbFile {
  fileId: string;
  chatbotId: string;
  blockId: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileSize: number;
  uploadedAt: Date;
  lastAccessedAt?: Date;
}

interface DbFileStorageConfig {
  storagePath: string;
  maxFileSize: number;
  allowedExtensions: string[];
}

class DbFileStorageService {
  private config: DbFileStorageConfig;
  private storageDir: string;
  private s3Client: S3Client | null = null;
  private s3Bucket: string | undefined;

  constructor() {
    this.config = {
      storagePath: process.env.DB_FILE_STORAGE_PATH || './storage/db-files',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedExtensions: ['.db', '.sqlite', '.sqlite3'],
    };
    this.storageDir = this.config.storagePath;
    this.initS3Client();
  }

  /**
   * Initialize S3 client
   */
  private initS3Client(): void {
    const endpoint = process.env.S3_ENDPOINT;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    const region = process.env.S3_REGION || 'us-east-1';
    this.s3Bucket = process.env.S3_BUCKET_NAME;

    if (endpoint && accessKeyId && secretAccessKey && this.s3Bucket) {
      try {
        // Ensure endpoint has protocol
        const endpointUrl = endpoint.startsWith('http') ? endpoint : `https://${endpoint}`;
        
        this.s3Client = new S3Client({
          region,
          endpoint: endpointUrl,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
          forcePathStyle: true,
        });
        dbFileStorageLogger.info('S3 client initialized for DB storage', { bucket: this.s3Bucket });
      } catch (error) {
        dbFileStorageLogger.error('Failed to initialize S3 client', { error: error instanceof Error ? error : new Error(String(error)) });
      }
    } else {
      dbFileStorageLogger.warn('S3 configuration missing, falling back to local storage only');
    }
  }

  /**
   * Initialize storage directory structure
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      dbFileStorageLogger.error('Failed to create storage directory', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to initialize file storage');
    }
  }

  /**
   * Validate uploaded file
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.config.maxFileSize / 1024 / 1024}MB`,
      };
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.config.allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
      };
    }

    // Check MIME type (if available)
    const allowedMimeTypes = [
      'application/x-sqlite3',
      'application/vnd.sqlite3',
      'application/octet-stream',
    ];
    if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
      // Don't fail on MIME type mismatch, just warn (some systems don't set it correctly)
      dbFileStorageLogger.warn('Unexpected MIME type for SQLite file', { mimetype: file.mimetype });
    }

    return { valid: true };
  }

  /**
   * Validate SQLite file integrity by checking magic bytes
   */
  async validateSqliteFile(filePath: string): Promise<boolean> {
    try {
      const buffer = Buffer.alloc(16);
      const fd = await fs.open(filePath, 'r');
      await fd.read(buffer, 0, 16, 0);
      await fd.close();

      // SQLite magic bytes: "SQLite format 3\000"
      const magicBytes = buffer.toString('utf8', 0, 16);
      return magicBytes.startsWith('SQLite format 3');
    } catch (error) {
      dbFileStorageLogger.error('Error validating SQLite file', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFileName(originalFileName: string): string {
    const ext = path.extname(originalFileName);
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  /**
   * Get S3 key for a file
   */
  private getS3Key(chatbotId: string, blockId: string, storedFileName: string): string {
    return `db-files/${chatbotId}/${blockId}/${storedFileName}`;
  }

  /**
   * Upload file to S3
   */
  private async uploadToS3(chatbotId: string, blockId: string, storedFileName: string, filePath: string): Promise<void> {
    if (!this.s3Client || !this.s3Bucket) return;

    try {
      const fileContent = await fs.readFile(filePath);
      const key = this.getS3Key(chatbotId, blockId, storedFileName);

      await this.s3Client.send(new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: fileContent,
      }));
      
      dbFileStorageLogger.info('Uploaded DB file to S3', { key });
    } catch (error) {
      dbFileStorageLogger.error('Failed to upload DB file to S3', { error: error instanceof Error ? error : new Error(String(error)) });
      // We don't throw here to avoid failing the whole request if S3 is down but local storage worked
    }
  }

  /**
   * Download file from S3
   */
  private async downloadFromS3(chatbotId: string, blockId: string, storedFileName: string, localPath: string): Promise<boolean> {
    if (!this.s3Client || !this.s3Bucket) return false;

    try {
      const key = this.getS3Key(chatbotId, blockId, storedFileName);
      
      const response = await this.s3Client.send(new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      }));

      if (!response.Body) {
        return false;
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      // Stream to file
      const readable = response.Body as Readable;
      await pipeline(readable, createWriteStream(localPath));
      
      dbFileStorageLogger.info('Downloaded DB file from S3', { key, localPath });
      return true;
    } catch (error) {
      // File might not exist in S3 or other error
      dbFileStorageLogger.warn('Failed to download DB file from S3', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(chatbotId: string, blockId: string, storedFileName: string): Promise<void> {
    if (!this.s3Client || !this.s3Bucket) return;

    try {
      const key = this.getS3Key(chatbotId, blockId, storedFileName);
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      }));
      dbFileStorageLogger.info('Deleted DB file from S3', { key });
    } catch (error) {
      dbFileStorageLogger.error('Failed to delete DB file from S3', { error: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  /**
   * Store uploaded database file
   */
  async storeFile(
    file: Express.Multer.File,
    chatbotId: string,
    blockId: string
  ): Promise<StoredDbFile> {
    await this.initialize();

    // Validate file
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Create directory for this chatbot/block
    const blockDir = path.join(this.storageDir, chatbotId, blockId);
    await fs.mkdir(blockDir, { recursive: true });

    // Generate unique filename
    const storedFileName = this.generateUniqueFileName(file.originalname);
    const filePath = path.join(blockDir, storedFileName);

    // Write file locally
    await fs.writeFile(filePath, file.buffer);

    // Validate SQLite file integrity
    const isValid = await this.validateSqliteFile(filePath);
    if (!isValid) {
      // Clean up invalid file
      await fs.unlink(filePath).catch(() => {});
      throw new Error('Invalid SQLite file. File does not appear to be a valid SQLite database.');
    }

    // Set file permissions (read-only for others)
    await fs.chmod(filePath, 0o644);

    // Upload to S3 (async, but wait to ensure persistence if required)
    await this.uploadToS3(chatbotId, blockId, storedFileName, filePath);

    const fileId = crypto
      .createHash('sha256')
      .update(`${chatbotId}:${blockId}:${storedFileName}`)
      .digest('hex')
      .substring(0, 16);

    const storedFile: StoredDbFile = {
      fileId,
      chatbotId,
      blockId,
      originalFileName: file.originalname,
      storedFileName,
      filePath,
      fileSize: file.size,
      uploadedAt: new Date(),
    };

    return storedFile;
  }

  /**
   * Get file path by file ID (requires chatbotId and blockId)
   */
  async getFilePath(chatbotId: string, blockId: string, fileId: string): Promise<string> {
    const blockDir = path.join(this.storageDir, chatbotId, blockId);
    
    // First, try to find it locally
    try {
      // Ensure dir exists to avoid error on reading
      await fs.mkdir(blockDir, { recursive: true });
      
      const files = await fs.readdir(blockDir);
      
      for (const file of files) {
        const filePath = path.join(blockDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          const computedFileId = crypto
            .createHash('sha256')
            .update(`${chatbotId}:${blockId}:${file}`)
            .digest('hex')
            .substring(0, 16);
          
          if (computedFileId === fileId) {
            return filePath;
          }
        }
      }
    } catch (error) {
      // Ignore error, proceed to S3 check
      dbFileStorageLogger.debug('Local file search failed', { error: error instanceof Error ? error.message : String(error) });
    }

    // If not found locally, try S3
    if (this.s3Client && this.s3Bucket) {
      dbFileStorageLogger.info('File not found locally, searching in S3', { chatbotId, blockId, fileId });
      
      try {
        // We need to find the storedFileName from S3 files
        // List files in the block prefix
        const prefix = `db-files/${chatbotId}/${blockId}/`;
        const command = new ListObjectsV2Command({
          Bucket: this.s3Bucket,
          Prefix: prefix,
        });

        const response = await this.s3Client.send(command);
        
        if (response.Contents) {
          for (const obj of response.Contents) {
            if (obj.Key) {
              const storedFileName = path.basename(obj.Key);
              const computedFileId = crypto
                .createHash('sha256')
                .update(`${chatbotId}:${blockId}:${storedFileName}`)
                .digest('hex')
                .substring(0, 16);
              
              if (computedFileId === fileId) {
                // Found match in S3, download it
                const localPath = path.join(blockDir, storedFileName);
                const downloaded = await this.downloadFromS3(chatbotId, blockId, storedFileName, localPath);
                if (downloaded) {
                  return localPath;
                }
              }
            }
          }
        }
      } catch (error) {
        dbFileStorageLogger.error('Failed to search S3 for file', { error: error instanceof Error ? error : new Error(String(error)) });
      }
    }
    
    throw new Error(`File not found for fileId: ${fileId}`);
  }

  /**
   * Get file path directly (if we have the stored filename)
   */
  getFilePathDirect(chatbotId: string, blockId: string, storedFileName: string): string {
    return path.join(this.storageDir, chatbotId, blockId, storedFileName);
  }

  /**
   * Delete database file
   */
  async deleteFile(chatbotId: string, blockId: string, fileId: string): Promise<void> {
    try {
      // Get file path (this might trigger download if not local, but we need the filename)
      // Actually, we should iterate to find filename without downloading if possible
      // But getFilePath logic handles finding the filename.
      // Optimization: if we already have logic to find filename, reuse it.
      // But for now, getFilePath works.
      
      let filePath: string | undefined;
      try {
        filePath = await this.getFilePath(chatbotId, blockId, fileId);
      } catch {
        // File might not exist locally or in S3, just ignore
      }

      // Delete locally
      if (filePath) {
        await fs.unlink(filePath).catch(() => {});
        const storedFileName = path.basename(filePath);
        
        // Delete from S3
        await this.deleteFromS3(chatbotId, blockId, storedFileName);
      } else {
        // If we couldn't resolve path (e.g. S3 list failed), we can't delete from S3 reliably
        // without knowing the filename.
        // But if we could list S3 to find it (as we do in getFilePath), we should do that here too.
        if (this.s3Client && this.s3Bucket) {
          // Try to find file in S3 to delete it
          const prefix = `db-files/${chatbotId}/${blockId}/`;
           const command = new ListObjectsV2Command({
            Bucket: this.s3Bucket,
            Prefix: prefix,
          });
          const response = await this.s3Client.send(command);
           if (response.Contents) {
            for (const obj of response.Contents) {
              if (obj.Key) {
                const storedFileName = path.basename(obj.Key);
                const computedFileId = crypto
                  .createHash('sha256')
                  .update(`${chatbotId}:${blockId}:${storedFileName}`)
                  .digest('hex')
                  .substring(0, 16);
                
                if (computedFileId === fileId) {
                  await this.deleteFromS3(chatbotId, blockId, storedFileName);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Try to remove directory if empty
      const blockDir = path.join(this.storageDir, chatbotId, blockId);
      try {
        const files = await fs.readdir(blockDir).catch(() => []);
        if (files.length === 0) {
          await fs.rmdir(blockDir).catch(() => {});
        }
      } catch {
        // Ignore errors
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(chatbotId: string, blockId: string, fileId: string): Promise<StoredDbFile> {
    const filePath = await this.getFilePath(chatbotId, blockId, fileId);
    const stats = await fs.stat(filePath);
    const storedFileName = path.basename(filePath);
    
    return {
      fileId,
      chatbotId,
      blockId,
      originalFileName: storedFileName, // We don't store original name separately, use stored name
      storedFileName,
      filePath,
      fileSize: stats.size,
      uploadedAt: stats.birthtime,
      lastAccessedAt: stats.atime,
    };
  }

  /**
   * Update last accessed time
   */
  async updateLastAccessed(filePath: string): Promise<void> {
    try {
      await fs.utimes(filePath, new Date(), new Date());
    } catch (error) {
      // Ignore errors updating access time
      dbFileStorageLogger.warn('Failed to update last accessed time', { error: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  /**
   * Clean up files for a block (when block is deleted)
   */
  async cleanupBlockFiles(chatbotId: string, blockId: string): Promise<void> {
    try {
      // Delete from S3
      if (this.s3Client && this.s3Bucket) {
        const prefix = `db-files/${chatbotId}/${blockId}/`;
        const listCommand = new ListObjectsV2Command({
          Bucket: this.s3Bucket,
          Prefix: prefix,
        });
        const response = await this.s3Client.send(listCommand);
        
        if (response.Contents && response.Contents.length > 0) {
           for (const obj of response.Contents) {
             if (obj.Key) {
               await this.s3Client.send(new DeleteObjectCommand({
                 Bucket: this.s3Bucket,
                 Key: obj.Key
               }));
             }
           }
        }
      }

      // Delete locally
      const blockDir = path.join(this.storageDir, chatbotId, blockId);
      await fs.rm(blockDir, { recursive: true, force: true });
    } catch (error) {
      dbFileStorageLogger.error('Failed to cleanup files for block', { blockId, error: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  /**
   * Clean up files for a chatbot (when chatbot is deleted)
   */
  async cleanupChatbotFiles(chatbotId: string): Promise<void> {
    try {
       // Delete from S3
      if (this.s3Client && this.s3Bucket) {
        const prefix = `db-files/${chatbotId}/`;
        // Note: ListObjectsV2 only returns up to 1000 items. 
        // For a full cleanup we might need pagination, but likely sufficient for now.
        const listCommand = new ListObjectsV2Command({
          Bucket: this.s3Bucket,
          Prefix: prefix,
        });
        const response = await this.s3Client.send(listCommand);
        
        if (response.Contents && response.Contents.length > 0) {
           for (const obj of response.Contents) {
             if (obj.Key) {
               await this.s3Client.send(new DeleteObjectCommand({
                 Bucket: this.s3Bucket,
                 Key: obj.Key
               }));
             }
           }
        }
      }

      // Delete locally
      const chatbotDir = path.join(this.storageDir, chatbotId);
      await fs.rm(chatbotDir, { recursive: true, force: true });
    } catch (error) {
      dbFileStorageLogger.error('Failed to cleanup files for chatbot', { chatbotId, error: error instanceof Error ? error : new Error(String(error)) });
    }
  }
}

export const dbFileStorageService = new DbFileStorageService();
