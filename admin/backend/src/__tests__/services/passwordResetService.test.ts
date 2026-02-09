import { describe, it, expect, vi, beforeEach } from 'vitest';
import passwordResetService from '../../services/passwordResetService';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('Password Reset Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateResetToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = passwordResetService.generateResetToken();
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes = 64 hex characters
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = passwordResetService.generateResetToken();
      const token2 = passwordResetService.generateResetToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('hashResetToken', () => {
    it('should hash a token using bcrypt', async () => {
      const token = 'test-token';
      const hashedToken = '$2b$10$hashedtoken';
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedToken as never);

      const result = await passwordResetService.hashResetToken(token);

      expect(bcrypt.hash).toHaveBeenCalledWith(token, 10);
      expect(result).toBe(hashedToken);
    });
  });

  describe('verifyResetToken', () => {
    it('should verify a token matches the hash', async () => {
      const token = 'test-token';
      const hashedToken = '$2b$10$hashedtoken';
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await passwordResetService.verifyResetToken(token, hashedToken);

      expect(bcrypt.compare).toHaveBeenCalledWith(token, hashedToken);
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const token = 'wrong-token';
      const hashedToken = '$2b$10$hashedtoken';
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await passwordResetService.verifyResetToken(token, hashedToken);

      expect(result).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for null expiration', () => {
      const result = passwordResetService.isTokenExpired(null);
      expect(result).toBe(true);
    });

    it('should return true for expired token', () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      const result = passwordResetService.isTokenExpired(expiredDate);
      expect(result).toBe(true);
    });

    it('should return false for future expiration', () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const result = passwordResetService.isTokenExpired(futureDate);
      expect(result).toBe(false);
    });
  });

  describe('calculateExpiration', () => {
    it('should calculate expiration 1 hour from now by default', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const expiration = passwordResetService.calculateExpiration();

      expect(expiration.getTime()).toBe(now + 60 * 60 * 1000);
    });

    it('should calculate expiration with custom hours', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const expiration = passwordResetService.calculateExpiration(2);

      expect(expiration.getTime()).toBe(now + 2 * 60 * 60 * 1000);
    });
  });

  describe('canRequestReset', () => {
    it('should return true if no previous request', () => {
      const result = passwordResetService.canRequestReset(null);
      expect(result).toBe(true);
    });

    it('should return true if cooldown period has passed', () => {
      const now = Date.now();
      const requestedAt = new Date(now - 16 * 60 * 1000); // 16 minutes ago
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = passwordResetService.canRequestReset(requestedAt, 15);

      expect(result).toBe(true);
    });

    it('should return false if cooldown period has not passed', () => {
      const now = Date.now();
      const requestedAt = new Date(now - 10 * 60 * 1000); // 10 minutes ago
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = passwordResetService.canRequestReset(requestedAt, 15);

      expect(result).toBe(false);
    });

    it('should use default cooldown of 15 minutes', () => {
      const now = Date.now();
      const requestedAt = new Date(now - 16 * 60 * 1000); // 16 minutes ago
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const result = passwordResetService.canRequestReset(requestedAt);

      expect(result).toBe(true);
    });
  });
});
