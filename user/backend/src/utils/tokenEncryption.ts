/**
 * Token Encryption Utility
 * Decrypts tokens stored in block properties (for cloud storage access tokens)
 */

import crypto from 'crypto';

import { config } from '../config';

// Lazy-load encryption key to allow tests to set up environment variables first
function getEncryptionKey(): Buffer {
  // Priority: CLOUD_ENCRYPTION_KEY (process.env) > SLACK_ENCRYPTION_KEY (process.env) > SLACK_ENCRYPTION_KEY (config) > DB_ENCRYPTION_KEY (process.env) > default
  // CLOUD_ENCRYPTION_KEY and DB_ENCRYPTION_KEY are not in config schema, so check process.env first
  let encryptionKey = process.env.CLOUD_ENCRYPTION_KEY || process.env.SLACK_ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY;
  
  // Only access config if process.env doesn't have any of the keys
  // In test environments or if SLACK_ENCRYPTION_KEY was deleted, use default to avoid config validation errors
  if (!encryptionKey) {
    // Check if we're in a test environment or if the key was explicitly deleted
    const isTestEnv = process.env.NODE_ENV === 'test';
    const keyWasDeleted = !('SLACK_ENCRYPTION_KEY' in process.env);
    
    if (isTestEnv || keyWasDeleted) {
      // In tests or if key was deleted, use default instead of accessing config
      // This prevents process.exit(1) from envalid validation when tests delete env vars
      encryptionKey = 'default-key-change-in-production-32-bytes!!';
    } else {
      // In production, try to access config (should have SLACK_ENCRYPTION_KEY set)
      encryptionKey = config.SLACK_ENCRYPTION_KEY;
    }
  }
  
  // Fallback to default if still no key
  if (!encryptionKey) {
    encryptionKey = 'default-key-change-in-production-32-bytes!!';
  }
  
  const key = Buffer.from(encryptionKey.padEnd(32, '0').substring(0, 32), 'utf8');
  return key;
}

/**
 * Encrypt a token before storing in database
 */
export function encryptToken(token: string): string {
  if (!token) {
    return '';
  }
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Store IV + authTag + encrypted data
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token from database
 */
export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedToken.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
