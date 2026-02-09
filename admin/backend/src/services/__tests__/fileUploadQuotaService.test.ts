/**
 * Unit Tests for File Upload Quota Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { checkUploadQuota, updateUploadQuota, getUploadQuota } from '../fileUploadQuotaService';

// Mock Prisma
vi.mock('../../lib/prisma', () => {
  const mockPrisma = {
    adminUser: {
      findUnique: vi.fn(),
    },
    userUploadQuota: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return {
    default: mockPrisma,
  };
});

import prisma from '../../lib/prisma';

describe('File Upload Quota Service', () => {
  const userId = 'cmjbb8hwd0001qn1tp1of601g';
  const starterLimit = 50 * 1024 * 1024; // 50MB
  const proLimit = 500 * 1024 * 1024; // 500MB

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkUploadQuota', () => {
    it('should allow upload within Starter plan limit', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(10 * 1024 * 1024), // 10MB used
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await checkUploadQuota(userId, 5 * 1024 * 1024); // 5MB upload

      expect(result.allowed).toBe(true);
      expect(result.usedBytes).toBe(10 * 1024 * 1024);
      expect(result.limitBytes).toBe(starterLimit);
      expect(result.remainingBytes).toBeGreaterThan(0);
      expect(result.warning).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should allow upload within Pro plan limit', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Pro' },
        },
      };

      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(100 * 1024 * 1024), // 100MB used
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await checkUploadQuota(userId, 50 * 1024 * 1024); // 50MB upload

      expect(result.allowed).toBe(true);
      expect(result.limitBytes).toBe(proLimit);
      expect(result.remainingBytes).toBeGreaterThan(0);
    });

    it('should reject upload that exceeds Starter plan limit', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(45 * 1024 * 1024), // 45MB used (90% of 50MB)
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await checkUploadQuota(userId, 10 * 1024 * 1024); // 10MB upload would exceed limit

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Upload quota exceeded');
    });

    it('should warn when approaching 80% of limit', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      // Use 39MB to ensure that after adding 1MB, we're at exactly 80% (40MB/50MB)
      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(39 * 1024 * 1024), // 39MB used
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await checkUploadQuota(userId, 1 * 1024 * 1024); // 1MB upload (will be 40MB total = 80%)

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('80%');
    });

    it('should create quota record if it does not exist', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(null);
      (prisma.userUploadQuota.create as any).mockResolvedValue({
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(0),
        lastUpdated: new Date(),
      });

      const result = await checkUploadQuota(userId, 5 * 1024 * 1024);

      expect(prisma.userUploadQuota.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalUploadedBytes: 0,
        },
      });
      expect(result.allowed).toBe(true);
    });

    it('should default to Starter plan if no subscription', async () => {
      const mockUser = {
        id: userId,
        subscription: null,
      };

      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(0),
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await checkUploadQuota(userId, 5 * 1024 * 1024);

      expect(result.limitBytes).toBe(starterLimit);
    });

    it('should throw error if user not found', async () => {
      (prisma.adminUser.findUnique as any).mockResolvedValue(null);

      await expect(checkUploadQuota(userId, 5 * 1024 * 1024)).rejects.toThrow('User not found');
    });
  });

  describe('updateUploadQuota', () => {
    it('should create quota record if it does not exist', async () => {
      (prisma.userUploadQuota.upsert as any).mockResolvedValue({
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(5 * 1024 * 1024),
      });

      await updateUploadQuota(userId, 5 * 1024 * 1024);

      expect(prisma.userUploadQuota.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          totalUploadedBytes: 5 * 1024 * 1024,
        },
        update: {
          totalUploadedBytes: {
            increment: 5 * 1024 * 1024,
          },
        },
      });
    });

    it('should increment existing quota', async () => {
      (prisma.userUploadQuota.upsert as any).mockResolvedValue({
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(10 * 1024 * 1024),
      });

      await updateUploadQuota(userId, 5 * 1024 * 1024);

      expect(prisma.userUploadQuota.upsert).toHaveBeenCalled();
    });
  });

  describe('getUploadQuota', () => {
    it('should return quota information for Starter plan', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      const mockQuota = {
        id: 'quota-1',
        userId,
        totalUploadedBytes: BigInt(25 * 1024 * 1024), // 25MB used
        lastUpdated: new Date(),
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(mockQuota);

      const result = await getUploadQuota(userId);

      expect(result.usedBytes).toBe(25 * 1024 * 1024);
      expect(result.limitBytes).toBe(starterLimit);
      expect(result.remainingBytes).toBe(25 * 1024 * 1024);
      expect(result.usagePercent).toBe(0.5); // 50%
    });

    it('should return zero usage if quota does not exist', async () => {
      const mockUser = {
        id: userId,
        subscription: {
          plan: { name: 'Starter' },
        },
      };

      (prisma.adminUser.findUnique as any).mockResolvedValue(mockUser);
      (prisma.userUploadQuota.findUnique as any).mockResolvedValue(null);

      const result = await getUploadQuota(userId);

      expect(result.usedBytes).toBe(0);
      expect(result.usagePercent).toBe(0);
    });
  });
});
