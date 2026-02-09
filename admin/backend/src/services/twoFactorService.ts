import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { logger } from '@shared/utils';

const twoFactorLogger = logger.child({ service: 'admin-backend', component: 'twoFactorService' });

class TwoFactorService {
  /**
   * Generate a TOTP secret for a user
   * @param {string} userEmail - User's email address
   * @param {string} serviceName - Service name (e.g., "CitadelAI")
   * @returns {Object} Secret object with base32 secret
   */
  generateSecret(userEmail: string, serviceName: string = 'CitadelAI'): { secret: string; otpauthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `${serviceName} (${userEmail})`,
      issuer: serviceName,
      length: 32
    });

    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error('Failed to generate 2FA secret');
    }

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    };
  }

  /**
   * Generate QR code data URL from secret
   * @param {string} otpauthUrl - OTP Auth URL
   * @returns {Promise<string>} Data URL of QR code image
   */
  async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1
      });
      return qrCodeDataUrl;
    } catch (error) {
      twoFactorLogger.error('Error generating QR code', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify a TOTP token against a secret
   * @param {string} secret - Base32 encoded secret
   * @param {string} token - 6-digit OTP token
   * @param {number} window - Time window in steps (default: 1 = ±30 seconds)
   * @returns {boolean} True if token is valid
   */
  verifyToken(secret: string, token: string, window: number = 1): boolean {
    try {
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window // Allow ±1 step (60 seconds total) for clock drift
      });
      return verified;
    } catch (error) {
      twoFactorLogger.error('Error verifying token', { error: error instanceof Error ? error : new Error(String(error)) });
      return false;
    }
  }

  /**
   * Generate backup codes (10 codes, 8 characters each)
   * @returns {Array<string>} Array of backup codes
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash a backup code for storage
   * @param {string} code - Backup code to hash
   * @returns {Promise<string>} Hashed code
   */
  async hashBackupCode(code: string): Promise<string> {
    return await bcrypt.hash(code, 10);
  }

  /**
   * Hash multiple backup codes
   * @param {Array<string>} codes - Array of backup codes
   * @returns {Promise<Array<string>>} Array of hashed codes
   */
  async hashBackupCodes(codes: string[]): Promise<string[]> {
    return Promise.all(codes.map(code => this.hashBackupCode(code)));
  }

  /**
   * Verify a backup code against an array of hashed codes
   * @param {Array<string>} hashedCodes - Array of hashed backup codes
   * @param {string} code - Backup code to verify
   * @returns {Promise<{valid: boolean, remainingCodes: Array<string>}>} Verification result
   */
  async verifyBackupCode(hashedCodes: string[], code: string): Promise<{ valid: boolean; remainingCodes: string[] }> {
    if (!hashedCodes || !Array.isArray(hashedCodes) || hashedCodes.length === 0) {
      return { valid: false, remainingCodes: [] };
    }

    const remainingCodes: string[] = [];
    let found = false;

    // Check each hashed code
    for (const hashedCode of hashedCodes) {
      if (!found) {
        const isValid = await bcrypt.compare(code, hashedCode);
        if (isValid) {
          found = true;
          // Don't add this code to remaining codes (it's been used)
          continue;
        }
      }
      // Add unused codes to remaining list
      remainingCodes.push(hashedCode);
    }

    return {
      valid: found,
      remainingCodes: remainingCodes
    };
  }

  /**
   * Format manual entry key for display (XXXX XXXX XXXX XXXX)
   * @param {string} secret - Base32 secret
   * @returns {string} Formatted secret
   */
  formatManualEntryKey(secret: string): string {
    // Group secret into 4-character chunks
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }
}

export default new TwoFactorService();
