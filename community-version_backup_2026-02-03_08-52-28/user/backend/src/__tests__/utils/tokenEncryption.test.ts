import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

describe('Token Encryption', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    // Reset config cache to allow env var changes
    const { resetConfig } = await import('../../config');
    resetConfig();
  });

  afterEach(async () => {
    // Reset config cache before restoring env
    const { resetConfig } = await import('../../config');
    resetConfig();
    // Restore original environment
    process.env = originalEnv;
    // Ensure SLACK_ENCRYPTION_KEY is restored to prevent config validation errors in other tests
    if (!process.env.SLACK_ENCRYPTION_KEY) {
      process.env.SLACK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    }
    resetConfig();
  });

  describe('decryptToken', () => {
    it('should decrypt a valid encrypted token', async () => {
      // Set environment before importing
      process.env.CLOUD_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      // Create a valid encrypted token format: iv:authTag:encrypted
      // Use exactly 32-character key to avoid truncation issues
      const keyString = '12345678901234567890123456789012'; // Exactly 32 chars
      const key = Buffer.from(keyString, 'utf8');
      
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token-value';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Key is already set before import
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should throw error for invalid format (missing parts)', async () => {
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const invalidTokens = [
        'iv:authTag', // Missing encrypted part
        'iv', // Only one part
        '', // Empty string
        'iv:authTag:', // Missing encrypted part (empty)
        ':authTag:encrypted', // Missing IV
        'iv::encrypted', // Missing authTag
      ];

      for (const token of invalidTokens) {
        expect(() => decryptToken(token)).toThrow('Invalid encrypted token format');
      }
    });

    it('should throw error for invalid hex in IV', async () => {
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const encryptedToken = 'invalid-hex:authTagHex:encryptedHex';
      
      expect(() => decryptToken(encryptedToken)).toThrow();
    });

    it('should throw error for invalid hex in authTag', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const key = Buffer.from('test-key-32-bytes-long-for-aes-256!!', 'utf8');
      const iv = crypto.randomBytes(16);
      
      const encryptedToken = `${iv.toString('hex')}:invalid-hex:encryptedHex`;
      
      process.env.CLOUD_ENCRYPTION_KEY = 'test-key-32-bytes-long-for-aes-256!!';
      
      expect(() => decryptToken(encryptedToken)).toThrow();
    });

    it('should throw error for invalid encrypted data', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const key = Buffer.from('test-key-32-bytes-long-for-aes-256!!', 'utf8');
      const iv = crypto.randomBytes(16);
      const authTag = crypto.randomBytes(16);
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:invalid-encrypted-data`;
      
      process.env.CLOUD_ENCRYPTION_KEY = 'test-key-32-bytes-long-for-aes-256!!';
      
      expect(() => decryptToken(encryptedToken)).toThrow();
    });

    it('should throw error when auth tag verification fails', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const keyString = '12345678901234567890123456789012'; // Exactly 32 chars
      const key = Buffer.from(keyString, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token-value';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = Buffer.from('wrong-auth-tag-16-bytes', 'hex'); // Wrong auth tag
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      process.env.CLOUD_ENCRYPTION_KEY = 'test-key-32-bytes-long-for-aes-256!!';
      
      expect(() => decryptToken(encryptedToken)).toThrow();
    });

    it('should use CLOUD_ENCRYPTION_KEY when available', async () => {
      const keyString = '12345678901234567890123456789012'; // Exactly 32 bytes
      process.env.CLOUD_ENCRYPTION_KEY = keyString;
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const key = Buffer.from(keyString, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Key already set before import
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should fallback to SLACK_ENCRYPTION_KEY when CLOUD_ENCRYPTION_KEY not set', async () => {
      delete process.env.CLOUD_ENCRYPTION_KEY;
      const keyString = '12345678901234567890123456789012'; // Exactly 32 bytes
      process.env.SLACK_ENCRYPTION_KEY = keyString;
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const key = Buffer.from(keyString, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Key already set before import
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should fallback to DB_ENCRYPTION_KEY when others not set', async () => {
      delete process.env.CLOUD_ENCRYPTION_KEY;
      delete process.env.SLACK_ENCRYPTION_KEY;
      const keyString = '12345678901234567890123456789012'; // Exactly 32 bytes
      process.env.DB_ENCRYPTION_KEY = keyString;
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const key = Buffer.from(keyString, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Key already set before import
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should use default key when no environment variables set', async () => {
      delete process.env.CLOUD_ENCRYPTION_KEY;
      delete process.env.SLACK_ENCRYPTION_KEY;
      delete process.env.DB_ENCRYPTION_KEY;
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const defaultKey = 'default-key-change-in-production-32-bytes!!';
      const key = Buffer.from(defaultKey.padEnd(32, '0').substring(0, 32), 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      delete process.env.CLOUD_ENCRYPTION_KEY;
      delete process.env.SLACK_ENCRYPTION_KEY;
      delete process.env.DB_ENCRYPTION_KEY;
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should pad short keys to 32 bytes', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = 'short-key';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const shortKey = 'short-key';
      const paddedKey = shortKey.padEnd(32, '0').substring(0, 32);
      const key = Buffer.from(paddedKey, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      process.env.CLOUD_ENCRYPTION_KEY = shortKey;
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should truncate long keys to 32 bytes', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = 'very-long-key-that-exceeds-32-bytes-in-length-for-testing';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const longKey = 'very-long-key-that-exceeds-32-bytes-in-length-for-testing';
      const truncatedKey = longKey.substring(0, 32);
      const key = Buffer.from(truncatedKey, 'utf8');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      const plaintext = 'test-token';
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      process.env.CLOUD_ENCRYPTION_KEY = longKey;
      
      const result = decryptToken(encryptedToken);
      
      expect(result).toBe(plaintext);
    });

    it('should handle tokens with different plaintext lengths', async () => {
      process.env.CLOUD_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptToken } = await import('../../utils/tokenEncryption');
      const testCases = [
        'a',
        'short',
        'medium-length-token',
        'very-long-token-that-contains-many-characters-and-should-still-work-correctly',
      ];

      const keyString = '12345678901234567890123456789012'; // Exactly 32 chars
      process.env.CLOUD_ENCRYPTION_KEY = keyString;

      for (const plaintext of testCases) {
        const key = Buffer.from(keyString, 'utf8');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        
        const encryptedToken = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        
        const result = decryptToken(encryptedToken);
        expect(result).toBe(plaintext);
      }
    });
  });
});
