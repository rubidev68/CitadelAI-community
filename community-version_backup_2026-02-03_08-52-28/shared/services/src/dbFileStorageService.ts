/**
 * Database File Storage Service
 * Handles storage, validation, and management of uploaded database files
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@shared/utils';

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

  constructor() {
    this.config = {
      storagePath: process.env.DB_FILE_STORAGE_PATH || './storage/db-files',
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedExtensions: ['.db', '.sqlite', '.sqlite3'],
    };
    this.storageDir = this.config.storagePath;
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

    // Write file
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
    
    try {
      const files = await fs.readdir(blockDir);
      
      // Find file that matches (we'll need to reconstruct or store mapping)
      // For now, we'll search for files in the directory
      // In production, you might want to store this mapping in a database
      for (const file of files) {
        const filePath = path.join(blockDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          // Check if this file matches the fileId (simplified - in production use DB)
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
      
      throw new Error(`File not found for fileId: ${fileId}`);
    } catch (error) {
      throw new Error(`Failed to get file path: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
      const filePath = await this.getFilePath(chatbotId, blockId, fileId);
      await fs.unlink(filePath);
      
      // Try to remove directory if empty
      const blockDir = path.join(this.storageDir, chatbotId, blockId);
      try {
        const files = await fs.readdir(blockDir);
        if (files.length === 0) {
          await fs.rmdir(blockDir);
        }
      } catch {
        // Ignore errors when removing directory
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
      const chatbotDir = path.join(this.storageDir, chatbotId);
      await fs.rm(chatbotDir, { recursive: true, force: true });
    } catch (error) {
      dbFileStorageLogger.error('Failed to cleanup files for chatbot', { chatbotId, error: error instanceof Error ? error : new Error(String(error)) });
    }
  }
}

export const dbFileStorageService = new DbFileStorageService();
