import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbFileStorageService, StoredDbFile } from '../dbFileStorageService';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Mock dependencies
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    rmdir: vi.fn(),
    rm: vi.fn(),
    utimes: vi.fn(),
    open: vi.fn(),
    chmod: vi.fn(),
  },
}));

describe('DB File Storage Service', () => {
  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.db',
    encoding: '7bit',
    mimetype: 'application/x-sqlite3',
    size: 1024,
    buffer: Buffer.from('SQLite format 3\0test data'),
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DB_FILES_STORAGE_PATH = './test-storage';
    // Reset the service instance to pick up new env var
    // Note: Since it's a singleton, we can't easily reset it, but the tests should work
  });

  describe('validateFile', () => {
    it('should validate valid SQLite file', () => {
      const result = dbFileStorageService.validateFile(mockFile);

      expect(result.valid).toBe(true);
    });

    it('should reject file exceeding max size', () => {
      const largeFile = {
        ...mockFile,
        size: 101 * 1024 * 1024, // 101MB
      };

      const result = dbFileStorageService.validateFile(largeFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should reject file with invalid extension', () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.txt',
      };

      const result = dbFileStorageService.validateFile(invalidFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should accept .db extension', () => {
      const dbFile = {
        ...mockFile,
        originalname: 'database.db',
      };

      const result = dbFileStorageService.validateFile(dbFile);

      expect(result.valid).toBe(true);
    });

    it('should accept .sqlite extension', () => {
      const sqliteFile = {
        ...mockFile,
        originalname: 'database.sqlite',
      };

      const result = dbFileStorageService.validateFile(sqliteFile);

      expect(result.valid).toBe(true);
    });

    it('should accept .sqlite3 extension', () => {
      const sqlite3File = {
        ...mockFile,
        originalname: 'database.sqlite3',
      };

      const result = dbFileStorageService.validateFile(sqlite3File);

      expect(result.valid).toBe(true);
    });

    it('should handle case-insensitive extensions', () => {
      const upperCaseFile = {
        ...mockFile,
        originalname: 'database.DB',
      };

      const result = dbFileStorageService.validateFile(upperCaseFile);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateSqliteFile', () => {
    it('should validate valid SQLite file', async () => {
      const filePath = '/path/to/test.db';
      const mockBuffer = Buffer.from('SQLite format 3\0');
      const mockFd = {
        read: vi.fn().mockResolvedValue({ bytesRead: 16 }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
      // Mock the buffer being filled
      mockFd.read.mockImplementation((buffer: Buffer) => {
        mockBuffer.copy(buffer);
        return Promise.resolve({ bytesRead: 16 });
      });

      const result = await dbFileStorageService.validateSqliteFile(filePath);

      expect(fs.open).toHaveBeenCalledWith(filePath, 'r');
      expect(result).toBe(true);
    });

    it('should return false for invalid SQLite file', async () => {
      const filePath = '/path/to/invalid.db';
      const mockBuffer = Buffer.from('Invalid format');
      const mockFd = {
        read: vi.fn().mockResolvedValue({ bytesRead: 16 }),
        close: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
      mockFd.read.mockImplementation((buffer: Buffer) => {
        mockBuffer.copy(buffer);
        return Promise.resolve({ bytesRead: 16 });
      });

      const result = await dbFileStorageService.validateSqliteFile(filePath);

      expect(result).toBe(false);
    });

    it('should return false on file read error', async () => {
      const filePath = '/path/to/nonexistent.db';

      vi.mocked(fs.open).mockRejectedValue(new Error('File not found'));

      const result = await dbFileStorageService.validateSqliteFile(filePath);

      expect(result).toBe(false);
    });
  });

  describe('storeFile', () => {
    it('should store file successfully', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const filePath = path.join('./test-storage', chatbotId, blockId, 'stored-file.db');

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      // Mock chmod
      const mockChmod = vi.fn().mockResolvedValue(undefined);
      (fs as any).chmod = mockChmod;
      
      // Mock validateSqliteFile to return true
      const mockFd = {
        read: vi.fn().mockResolvedValue({ bytesRead: 16 }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
      mockFd.read.mockImplementation((buffer: Buffer) => {
        Buffer.from('SQLite format 3\0').copy(buffer);
        return Promise.resolve({ bytesRead: 16 });
      });

      const result = await dbFileStorageService.storeFile(mockFile, chatbotId, blockId);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result.chatbotId).toBe(chatbotId);
      expect(result.blockId).toBe(blockId);
      expect(result.originalFileName).toBe(mockFile.originalname);
      expect(result.fileSize).toBe(mockFile.size);
    });

    it('should throw error for invalid file', async () => {
      const invalidFile = {
        ...mockFile,
        originalname: 'test.txt',
      };

      await expect(
        dbFileStorageService.storeFile(invalidFile, 'chatbot-1', 'block-1')
      ).rejects.toThrow('Invalid file type');
    });

    it('should throw error for invalid SQLite file', async () => {
      const invalidSqliteFile = {
        ...mockFile,
        buffer: Buffer.from('Invalid data'),
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const mockFd = {
        read: vi.fn().mockResolvedValue({ bytesRead: 16 }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
      mockFd.read.mockImplementation((buffer: Buffer) => {
        Buffer.from('Invalid format').copy(buffer);
        return Promise.resolve({ bytesRead: 16 });
      });
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await expect(
        dbFileStorageService.storeFile(invalidSqliteFile, 'chatbot-1', 'block-1')
      ).rejects.toThrow('Invalid SQLite file');
    });
  });

  describe('getFilePath', () => {
    it('should get file path by fileId', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const fileId = 'abc123';
      const storedFileName = '1234567890-abcdef.db';
      const expectedPath = path.join('./test-storage', chatbotId, blockId, storedFileName);

      // Mock fileId computation
      const computedFileId = crypto
        .createHash('sha256')
        .update(`${chatbotId}:${blockId}:${storedFileName}`)
        .digest('hex')
        .substring(0, 16);

      vi.mocked(fs.readdir).mockResolvedValue([storedFileName] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);

      // Use the computed fileId
      const result = await dbFileStorageService.getFilePath(chatbotId, blockId, computedFileId);

      expect(fs.readdir).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error if file not found', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const fileId = 'nonexistent';

      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      await expect(
        dbFileStorageService.getFilePath(chatbotId, blockId, fileId)
      ).rejects.toThrow('File not found');
    });
  });

  describe('getFilePathDirect', () => {
    it('should return direct file path', () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const storedFileName = 'file.db';

      const result = dbFileStorageService.getFilePathDirect(chatbotId, blockId, storedFileName);

      // The service uses the storageDir which is set from config (default or env)
      expect(result).toContain(chatbotId);
      expect(result).toContain(blockId);
      expect(result).toContain(storedFileName);
    });
  });

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const fileId = 'abc123';
      const filePath = '/path/to/file.db';

      vi.mocked(fs.readdir).mockResolvedValue(['file.db'] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValueOnce(['file.db'] as any).mockResolvedValueOnce([] as any);
      vi.mocked(fs.rmdir).mockResolvedValue(undefined);

      // Mock getFilePath
      const storedFileName = 'file.db';
      const computedFileId = crypto
        .createHash('sha256')
        .update(`${chatbotId}:${blockId}:${storedFileName}`)
        .digest('hex')
        .substring(0, 16);

      await dbFileStorageService.deleteFile(chatbotId, blockId, computedFileId);

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should remove empty directory after deletion', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const storedFileName = 'file.db';
      const computedFileId = crypto
        .createHash('sha256')
        .update(`${chatbotId}:${blockId}:${storedFileName}`)
        .digest('hex')
        .substring(0, 16);

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce([storedFileName] as any)
        .mockResolvedValueOnce([] as any);
      vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.rmdir).mockResolvedValue(undefined);

      await dbFileStorageService.deleteFile(chatbotId, blockId, computedFileId);

      expect(fs.rmdir).toHaveBeenCalled();
    });

    it('should throw error on deletion failure', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const fileId = 'abc123';

      vi.mocked(fs.readdir).mockRejectedValue(new Error('Directory not found'));

      await expect(
        dbFileStorageService.deleteFile(chatbotId, blockId, fileId)
      ).rejects.toThrow('Failed to delete file');
    });
  });

  describe('getFileInfo', () => {
    it('should get file info', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';
      const storedFileName = 'file.db';
      const computedFileId = crypto
        .createHash('sha256')
        .update(`${chatbotId}:${blockId}:${storedFileName}`)
        .digest('hex')
        .substring(0, 16);
      const filePath = path.join('./test-storage', chatbotId, blockId, storedFileName);

      vi.mocked(fs.readdir).mockResolvedValue([storedFileName] as any);
      vi.mocked(fs.stat).mockResolvedValue({
        isFile: () => true,
        size: 1024,
        birthtime: new Date('2024-01-01'),
        atime: new Date('2024-01-02'),
      } as any);

      const result = await dbFileStorageService.getFileInfo(chatbotId, blockId, computedFileId);

      expect(result.fileId).toBe(computedFileId);
      expect(result.chatbotId).toBe(chatbotId);
      expect(result.blockId).toBe(blockId);
      expect(result.fileSize).toBe(1024);
      expect(result.uploadedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateLastAccessed', () => {
    it('should update last accessed time', async () => {
      const filePath = '/path/to/file.db';

      vi.mocked(fs.utimes).mockResolvedValue(undefined);

      await dbFileStorageService.updateLastAccessed(filePath);

      expect(fs.utimes).toHaveBeenCalledWith(filePath, expect.any(Date), expect.any(Date));
    });

    it('should handle update errors gracefully', async () => {
      const filePath = '/path/to/file.db';

      vi.mocked(fs.utimes).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(dbFileStorageService.updateLastAccessed(filePath)).resolves.toBeUndefined();
    });
  });

  describe('cleanupBlockFiles', () => {
    it('should cleanup block files', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';

      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await dbFileStorageService.cleanupBlockFiles(chatbotId, blockId);

      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining(path.join(chatbotId, blockId)),
        { recursive: true, force: true }
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const chatbotId = 'chatbot-1';
      const blockId = 'block-1';

      vi.mocked(fs.rm).mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(dbFileStorageService.cleanupBlockFiles(chatbotId, blockId)).resolves.toBeUndefined();
    });
  });

  describe('cleanupChatbotFiles', () => {
    it('should cleanup chatbot files', async () => {
      const chatbotId = 'chatbot-1';

      vi.mocked(fs.rm).mockResolvedValue(undefined);

      await dbFileStorageService.cleanupChatbotFiles(chatbotId);

      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining(chatbotId),
        { recursive: true, force: true }
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const chatbotId = 'chatbot-1';

      vi.mocked(fs.rm).mockRejectedValue(new Error('Cleanup failed'));

      // Should not throw
      await expect(dbFileStorageService.cleanupChatbotFiles(chatbotId)).resolves.toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should initialize storage directory', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await dbFileStorageService.initialize();

      // The service uses the storageDir which is set from config
      expect(fs.mkdir).toHaveBeenCalled();
      const mkdirCall = vi.mocked(fs.mkdir).mock.calls[0];
      // Check that it was called with a path and recursive option
      expect(mkdirCall[0]).toBeDefined();
      expect(typeof mkdirCall[0]).toBe('string');
      expect(mkdirCall[1]).toEqual({ recursive: true });
    });

    it('should throw error on initialization failure', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      await expect(dbFileStorageService.initialize()).rejects.toThrow('Failed to initialize file storage');
    });
  });
});
