import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

describe('Credential Encryption', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('encryptCredentials', () => {
    it('should encrypt a password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials } = await import('../credentialEncryption');
      
      const password = 'my-secret-password';
      const encrypted = encryptCredentials(password);
      
      // Should be in format: iv:authTag:encrypted
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBeGreaterThan(0); // IV (hex)
      expect(parts[1].length).toBeGreaterThan(0); // Auth tag (hex)
      expect(parts[2].length).toBeGreaterThan(0); // Encrypted data (hex)
    });

    it('should return empty string for empty password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials } = await import('../credentialEncryption');
      
      const result = encryptCredentials('');
      
      expect(result).toBe('');
    });

    it('should return empty string for null/undefined password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials } = await import('../credentialEncryption');
      
      expect(encryptCredentials(null as any)).toBe('');
      expect(encryptCredentials(undefined as any)).toBe('');
    });

    it('should produce different encrypted values for same password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials } = await import('../credentialEncryption');
      
      const password = 'same-password';
      const encrypted1 = encryptCredentials(password);
      const encrypted2 = encryptCredentials(password);
      
      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should use DB_ENCRYPTION_KEY when available', async () => {
      const keyString = '12345678901234567890123456789012';
      process.env.DB_ENCRYPTION_KEY = keyString;
      delete process.env.SLACK_ENCRYPTION_KEY;
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should fallback to SLACK_ENCRYPTION_KEY when DB_ENCRYPTION_KEY not set', async () => {
      delete process.env.DB_ENCRYPTION_KEY;
      const keyString = '12345678901234567890123456789012';
      process.env.SLACK_ENCRYPTION_KEY = keyString;
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should use default key when no environment variables set', async () => {
      delete process.env.DB_ENCRYPTION_KEY;
      delete process.env.SLACK_ENCRYPTION_KEY;
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const defaultKey = 'default-key-change-in-production-32-bytes!!';
      const key = Buffer.from(defaultKey.padEnd(32, '0').substring(0, 32), 'utf8');
      
      // Encrypt with the default key manually
      const password = 'test-password';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      const expectedEncrypted = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
      
      // Now decrypt using the function
      const decrypted = decryptCredentials(expectedEncrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should pad short keys to 32 bytes', async () => {
      const shortKey = 'short-key';
      process.env.DB_ENCRYPTION_KEY = shortKey;
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should truncate long keys to 32 bytes', async () => {
      const longKey = 'very-long-key-that-exceeds-32-bytes-in-length-for-testing';
      process.env.DB_ENCRYPTION_KEY = longKey;
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should handle passwords with special characters', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const passwords = [
        'p@ssw0rd!',
        'password with spaces',
        'password\nwith\nnewlines',
        'password\twith\ttabs',
        'password"with"quotes',
        'password\'with\'apostrophes',
        'password/with/slashes',
        'password\\with\\backslashes',
      ];

      for (const password of passwords) {
        const encrypted = encryptCredentials(password);
        const decrypted = decryptCredentials(encrypted);
        expect(decrypted).toBe(password);
      }
    });
  });

  describe('decryptCredentials', () => {
    it('should decrypt an encrypted password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'my-secret-password';
      const encrypted = encryptCredentials(password);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(password);
    });

    it('should return empty string for empty encrypted password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptCredentials } = await import('../credentialEncryption');
      
      const result = decryptCredentials('');
      
      expect(result).toBe('');
    });

    it('should return empty string for null/undefined encrypted password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptCredentials } = await import('../credentialEncryption');
      
      expect(decryptCredentials(null as any)).toBe('');
      expect(decryptCredentials(undefined as any)).toBe('');
    });

    it('should throw error for invalid format (missing parts)', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptCredentials } = await import('../credentialEncryption');
      
      const invalidFormats = [
        'iv:authTag', // Missing encrypted part
        'iv', // Only one part
        '', // Empty string (handled separately)
        'iv:authTag:', // Missing encrypted part (empty)
        ':authTag:encrypted', // Missing IV
        'iv::encrypted', // Missing authTag
      ];

      for (const format of invalidFormats) {
        if (format === '') continue; // Empty string returns empty string
        expect(() => decryptCredentials(format)).toThrow('Invalid encrypted password format');
      }
    });

    it('should throw error for invalid hex in IV', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { decryptCredentials } = await import('../credentialEncryption');
      
      const encryptedPassword = 'invalid-hex:authTagHex:encryptedHex';
      
      expect(() => decryptCredentials(encryptedPassword)).toThrow();
    });

    it('should throw error for invalid hex in authTag', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const parts = encrypted.split(':');
      const invalidEncrypted = `invalid-hex:${parts[1]}:${parts[2]}`;
      
      expect(() => decryptCredentials(invalidEncrypted)).toThrow();
    });

    it('should throw error for invalid encrypted data', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const parts = encrypted.split(':');
      const invalidEncrypted = `${parts[0]}:${parts[1]}:invalid-encrypted-data`;
      
      expect(() => decryptCredentials(invalidEncrypted)).toThrow();
    });

    it('should throw error when auth tag verification fails', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      const parts = encrypted.split(':');
      // Use wrong auth tag
      const wrongAuthTag = crypto.randomBytes(16).toString('hex');
      const invalidEncrypted = `${parts[0]}:${wrongAuthTag}:${parts[2]}`;
      
      expect(() => decryptCredentials(invalidEncrypted)).toThrow();
    });

    it('should decrypt password encrypted with different key source', async () => {
      // Encrypt with DB_ENCRYPTION_KEY
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      delete process.env.SLACK_ENCRYPTION_KEY;
      // Reset config cache before importing to ensure env vars are used
      const { encryptCredentials } = await import('../credentialEncryption');
      
      const password = 'test-password';
      const encrypted = encryptCredentials(password);
      
      // Decrypt with same key
      vi.resetModules();
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      delete process.env.SLACK_ENCRYPTION_KEY;
      const { decryptCredentials } = await import('../credentialEncryption');
      
      const decrypted = decryptCredentials(encrypted);
      expect(decrypted).toBe(password);
    });

    it('should handle long passwords', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const longPassword = 'a'.repeat(1000);
      const encrypted = encryptCredentials(longPassword);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(longPassword);
    });

    it('should handle unicode characters in password', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const unicodePassword = 'password with émojis 🎉 and 中文 characters';
      const encrypted = encryptCredentials(unicodePassword);
      const decrypted = decryptCredentials(encrypted);
      
      expect(decrypted).toBe(unicodePassword);
    });
  });

  describe('Integration tests', () => {
    it('should encrypt and decrypt round-trip correctly', async () => {
      process.env.DB_ENCRYPTION_KEY = '12345678901234567890123456789012';
      const { encryptCredentials, decryptCredentials } = await import('../credentialEncryption');
      
      const testPasswords = [
        'simple',
        'complex-p@ssw0rd!',
        'password with spaces',
        'very-long-password-that-might-cause-issues-if-not-handled-properly',
        '🎉unicode🎉',
      ];

      for (const password of testPasswords) {
        const encrypted = encryptCredentials(password);
        const decrypted = decryptCredentials(encrypted);
        expect(decrypted).toBe(password);
      }
    });

    it('should work with different key sources', async () => {
      const keyString = '12345678901234567890123456789012';
      
      // Test DB_ENCRYPTION_KEY
      process.env.DB_ENCRYPTION_KEY = keyString;
      delete process.env.SLACK_ENCRYPTION_KEY;
      // Reset config cache before importing
      const { encryptCredentials: encrypt1, decryptCredentials: decrypt1 } = await import('../credentialEncryption');
      const password = 'test-password';
      const encrypted1 = encrypt1(password);
      expect(decrypt1(encrypted1)).toBe(password);
      
      // Test SLACK_ENCRYPTION_KEY fallback
      vi.resetModules();
      delete process.env.DB_ENCRYPTION_KEY;
      process.env.SLACK_ENCRYPTION_KEY = keyString;
      const { encryptCredentials: encrypt2, decryptCredentials: decrypt2 } = await import('../credentialEncryption');
      const encrypted2 = encrypt2(password);
      expect(decrypt2(encrypted2)).toBe(password);
    });
  });
});
