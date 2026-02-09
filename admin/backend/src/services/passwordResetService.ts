import crypto from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Password Reset Service
 * Handles secure token generation, hashing, and verification for password reset flows
 */
class PasswordResetService {
  /**
   * Generate a cryptographically secure random token for password reset
   * @returns 32-byte token encoded as hex (64 characters)
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a reset token before storing in database
   * Uses bcrypt with salt rounds 10 (same as password hashing)
   * @param token Plain text token
   * @returns Hashed token
   */
  async hashResetToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
  }

  /**
   * Verify a reset token matches the stored hash
   * @param token Plain text token from user
   * @param hashedToken Hashed token from database
   * @returns true if token matches hash
   */
  async verifyResetToken(token: string, hashedToken: string): Promise<boolean> {
    return bcrypt.compare(token, hashedToken);
  }

  /**
   * Check if a token has expired
   * @param expiresAt Expiration timestamp
   * @returns true if token is expired
   */
  isTokenExpired(expiresAt: Date | null): boolean {
    if (!expiresAt) {
      return true;
    }
    return expiresAt.getTime() < Date.now();
  }

  /**
   * Calculate expiration time (default: 1 hour from now)
   * @param hoursFromNow Hours until expiration (default: 1)
   * @returns Expiration Date
   */
  calculateExpiration(hoursFromNow: number = 1): Date {
    const expirationTime = Date.now() + hoursFromNow * 60 * 60 * 1000;
    return new Date(expirationTime);
  }

  /**
   * Check if enough time has passed since last reset request (rate limiting)
   * @param requestedAt Timestamp of last request
   * @param cooldownMinutes Minutes required between requests (default: 15)
   * @returns true if enough time has passed
   */
  canRequestReset(requestedAt: Date | null, cooldownMinutes: number = 15): boolean {
    if (!requestedAt) {
      return true;
    }
    const cooldownMs = cooldownMinutes * 60 * 1000;
    return Date.now() - requestedAt.getTime() >= cooldownMs;
  }
}

// Export singleton instance
const passwordResetService = new PasswordResetService();
export default passwordResetService;
