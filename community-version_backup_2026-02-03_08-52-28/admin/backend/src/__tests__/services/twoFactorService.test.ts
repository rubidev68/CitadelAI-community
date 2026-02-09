import { describe, it, expect, vi, beforeEach } from 'vitest';
import twoFactorService from '../../services/twoFactorService';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Mock dependencies
vi.mock('speakeasy', () => ({
  default: {
    generateSecret: vi.fn(),
    totp: {
      verify: vi.fn(),
    },
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('Two Factor Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSecret', () => {
    it('should generate a TOTP secret', () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/CitadelAI%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=CitadelAI',
      };
      vi.mocked(speakeasy.generateSecret).mockReturnValue(mockSecret as any);

      const result = twoFactorService.generateSecret('test@example.com');

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'CitadelAI (test@example.com)',
        issuer: 'CitadelAI',
        length: 32,
      });
      expect(result.secret).toBe(mockSecret.base32);
      expect(result.otpauthUrl).toBe(mockSecret.otpauth_url);
    });

    it('should use custom service name', () => {
      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/MyApp%20(user%40example.com)?secret=JBSWY3DPEHPK3PXP&issuer=MyApp',
      };
      vi.mocked(speakeasy.generateSecret).mockReturnValue(mockSecret as any);

      const result = twoFactorService.generateSecret('user@example.com', 'MyApp');

      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'MyApp (user@example.com)',
        issuer: 'MyApp',
        length: 32,
      });
      expect(result.secret).toBe(mockSecret.base32);
    });

    it('should throw error if secret generation fails', () => {
      vi.mocked(speakeasy.generateSecret).mockReturnValue({
        base32: null,
        otpauth_url: null,
      } as any);

      expect(() => {
        twoFactorService.generateSecret('test@example.com');
      }).toThrow('Failed to generate 2FA secret');
    });

    it('should throw error if otpauth_url is missing', () => {
      vi.mocked(speakeasy.generateSecret).mockReturnValue({
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: null,
      } as any);

      expect(() => {
        twoFactorService.generateSecret('test@example.com');
      }).toThrow('Failed to generate 2FA secret');
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code data URL', async () => {
      const otpauthUrl = 'otpauth://totp/CitadelAI%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP';
      const qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';
      vi.mocked(QRCode.toDataURL).mockResolvedValue(qrCodeDataUrl);

      const result = await twoFactorService.generateQRCode(otpauthUrl);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(otpauthUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
      expect(result).toBe(qrCodeDataUrl);
    });

    it('should throw error if QR code generation fails', async () => {
      const otpauthUrl = 'otpauth://totp/CitadelAI%20(test%40example.com)?secret=JBSWY3DPEHPK3PXP';
      vi.mocked(QRCode.toDataURL).mockRejectedValue(new Error('QR code generation failed'));

      await expect(twoFactorService.generateQRCode(otpauthUrl)).rejects.toThrow(
        'Failed to generate QR code'
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid TOTP token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';
      vi.mocked(speakeasy.totp.verify).mockReturnValue(true);

      const result = twoFactorService.verifyToken(secret, token);

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 1,
      });
      expect(result).toBe(true);
    });

    it('should return false for invalid token', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '000000';
      vi.mocked(speakeasy.totp.verify).mockReturnValue(false);

      const result = twoFactorService.verifyToken(secret, token);

      expect(result).toBe(false);
    });

    it('should use custom window', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';
      vi.mocked(speakeasy.totp.verify).mockReturnValue(true);

      twoFactorService.verifyToken(secret, token, 2);

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2,
      });
    });

    it('should return false on error', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const token = '123456';
      vi.mocked(speakeasy.totp.verify).mockImplementation(() => {
        throw new Error('Verification error');
      });

      const result = twoFactorService.verifyToken(secret, token);

      expect(result).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes', () => {
      const codes = twoFactorService.generateBackupCodes();

      expect(codes).toHaveLength(10);
      codes.forEach((code) => {
        expect(code).toMatch(/^[0-9A-F]{8}$/); // 8 hex characters, uppercase
      });
    });

    it('should generate unique codes', () => {
      const codes1 = twoFactorService.generateBackupCodes();
      const codes2 = twoFactorService.generateBackupCodes();

      // Codes should be unique (very unlikely to be the same)
      const allCodes = [...codes1, ...codes2];
      const uniqueCodes = new Set(allCodes);
      expect(uniqueCodes.size).toBe(allCodes.length);
    });
  });

  describe('hashBackupCode', () => {
    it('should hash a backup code', async () => {
      const code = 'ABCD1234';
      const hashedCode = '$2b$10$hashedcode';
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedCode as never);

      const result = await twoFactorService.hashBackupCode(code);

      expect(bcrypt.hash).toHaveBeenCalledWith(code, 10);
      expect(result).toBe(hashedCode);
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash multiple backup codes', async () => {
      const codes = ['CODE1', 'CODE2', 'CODE3'];
      const hashedCodes = ['$2b$10$hash1', '$2b$10$hash2', '$2b$10$hash3'];
      vi.mocked(bcrypt.hash)
        .mockResolvedValueOnce(hashedCodes[0] as never)
        .mockResolvedValueOnce(hashedCodes[1] as never)
        .mockResolvedValueOnce(hashedCodes[2] as never);

      const result = await twoFactorService.hashBackupCodes(codes);

      expect(bcrypt.hash).toHaveBeenCalledTimes(3);
      expect(result).toEqual(hashedCodes);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify a valid backup code', async () => {
      const code = 'ABCD1234';
      const hashedCode1 = '$2b$10$hash1';
      const hashedCode2 = '$2b$10$hash2';
      const hashedCodes = [hashedCode1, hashedCode2];

      vi.mocked(bcrypt.compare)
        .mockResolvedValueOnce(false as never) // First code doesn't match
        .mockResolvedValueOnce(true as never); // Second code matches

      const result = await twoFactorService.verifyBackupCode(hashedCodes, code);

      expect(result.valid).toBe(true);
      // When hash2 matches: hash1 is checked (doesn't match, so added), hash2 matches (skipped), so remaining is [hash1]
      // Actually, looking at the code: if found=false, we check and if it doesn't match we push it
      // So hash1 doesn't match -> push hash1, hash2 matches -> skip hash2
      expect(result.remainingCodes).toEqual([hashedCode1]); // hash2 was used, hash1 remains
    });

    it('should return false for invalid backup code', async () => {
      const code = 'WRONG';
      const hashedCodes = ['$2b$10$hash1', '$2b$10$hash2'];

      vi.mocked(bcrypt.compare)
        .mockResolvedValueOnce(false as never)
        .mockResolvedValueOnce(false as never);

      const result = await twoFactorService.verifyBackupCode(hashedCodes, code);

      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toEqual(hashedCodes); // All codes remain
    });

    it('should return false for empty hashed codes array', async () => {
      const result = await twoFactorService.verifyBackupCode([], 'CODE');

      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toEqual([]);
    });

    it('should return false for null hashed codes', async () => {
      const result = await twoFactorService.verifyBackupCode(null as any, 'CODE');

      expect(result.valid).toBe(false);
      expect(result.remainingCodes).toEqual([]);
    });

    it('should remove used code from remaining codes', async () => {
      const code = 'USEDCODE';
      const hashedCode1 = '$2b$10$hash1';
      const hashedCode2 = '$2b$10$hash2';
      const hashedCode3 = '$2b$10$hash3';
      const hashedCodes = [hashedCode1, hashedCode2, hashedCode3];

      vi.mocked(bcrypt.compare)
        .mockResolvedValueOnce(false as never) // First doesn't match -> added to remaining
        .mockResolvedValueOnce(true as never) // Second matches -> skipped
        // Third: found=true, so it's added without checking

      const result = await twoFactorService.verifyBackupCode(hashedCodes, code);

      expect(result.valid).toBe(true);
      // hash1: doesn't match, found=false -> push hash1
      // hash2: matches, found=true -> skip hash2
      // hash3: found=true -> push hash3
      expect(result.remainingCodes).toEqual([hashedCode1, hashedCode3]);
    });
  });

  describe('formatManualEntryKey', () => {
    it('should format secret with spaces', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const result = twoFactorService.formatManualEntryKey(secret);

      expect(result).toBe('JBSW Y3DP EHPK 3PXP');
    });

    it('should handle short secrets', () => {
      const secret = 'ABC';
      const result = twoFactorService.formatManualEntryKey(secret);

      expect(result).toBe('ABC');
    });

    it('should handle empty secret', () => {
      const secret = '';
      const result = twoFactorService.formatManualEntryKey(secret);

      expect(result).toBe('');
    });
  });
});
