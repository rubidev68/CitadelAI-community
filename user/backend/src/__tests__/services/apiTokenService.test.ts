import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateToken,
  getTokenPrefix,
  hashToken,
  verifyToken,
  validateToken,
  findTokenByValue,
  incrementUsage,
  updateLastUsed,
} from '../../services/apiTokenService';
import { ApiToken, ApiTokenType } from '@prisma/client';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    apiToken: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock @prisma/client to include ApiTokenType
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  ApiTokenType: {
    PERMANENT: 'PERMANENT',
    DURATION: 'DURATION',
    USAGE: 'USAGE',
  },
}));

// Mock bcrypt - use vi.hoisted
const { mockBcrypt } = vi.hoisted(() => {
  const mockBcrypt = {
    hash: vi.fn(),
    compare: vi.fn(),
  };
  return { mockBcrypt };
});

vi.mock('bcrypt', () => ({
  default: mockBcrypt,
}));

describe('API Token Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a token with cat_ prefix', () => {
      const token = generateToken();
      expect(token).toMatch(/^cat_[0-9a-f]{32}$/);
      expect(token.length).toBe(36); // 'cat_' (4) + 32 hex chars = 36
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens with correct format', () => {
      const tokens = Array.from({ length: 10 }, () => generateToken());
      tokens.forEach(token => {
        expect(token).toMatch(/^cat_[0-9a-f]{32}$/);
        expect(token.startsWith('cat_')).toBe(true);
      });
    });
  });

  describe('getTokenPrefix', () => {
    it('should return first 8 characters of token', () => {
      const token = 'cat_1234567890abcdef';
      const prefix = getTokenPrefix(token);
      expect(prefix).toBe('cat_1234');
      expect(prefix.length).toBe(8);
    });

    it('should handle tokens shorter than 8 characters', () => {
      const token = 'cat_123';
      const prefix = getTokenPrefix(token);
      expect(prefix).toBe('cat_123');
      expect(prefix.length).toBe(7);
    });

    it('should handle empty string', () => {
      const token = '';
      const prefix = getTokenPrefix(token);
      expect(prefix).toBe('');
    });
  });

  describe('hashToken', () => {
    it('should hash a token using bcrypt', async () => {
      const token = 'cat_test123';
      const hashedToken = '$2b$10$hashedtoken';
      mockBcrypt.hash.mockResolvedValue(hashedToken);

      const result = await hashToken(token);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(token, 10);
      expect(result).toBe(hashedToken);
    });

    it('should handle bcrypt errors', async () => {
      const token = 'cat_test123';
      mockBcrypt.hash.mockRejectedValue(new Error('Bcrypt error'));

      await expect(hashToken(token)).rejects.toThrow('Bcrypt error');
    });
  });

  describe('verifyToken', () => {
    it('should verify a token matches the hash', async () => {
      const hashedToken = '$2b$10$hashedtoken';
      const providedToken = 'cat_test123';
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await verifyToken(hashedToken, providedToken);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(providedToken, hashedToken);
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const hashedToken = '$2b$10$hashedtoken';
      const providedToken = 'cat_wrong';
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await verifyToken(hashedToken, providedToken);

      expect(result).toBe(false);
    });

    it('should handle bcrypt compare errors', async () => {
      const hashedToken = '$2b$10$hashedtoken';
      const providedToken = 'cat_test123';
      mockBcrypt.compare.mockRejectedValue(new Error('Compare error'));

      await expect(verifyToken(hashedToken, providedToken)).rejects.toThrow('Compare error');
    });
  });

  describe('validateToken', () => {
    it('should return valid for active PERMANENT token', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return invalid for revoked token', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token has been revoked');
    });

    it('should return invalid for expired DURATION token', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.DURATION,
        expiresAt: new Date(Date.now() - 1000), // Expired
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token has expired');
    });

    it('should return valid for non-expired DURATION token', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.DURATION,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
    });

    it('should return valid for DURATION token with null expiresAt', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.DURATION,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
    });

    it('should return invalid for USAGE token that reached limit', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.USAGE,
        expiresAt: null,
        maxUsage: 100,
        currentUsage: 100, // At limit
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Token usage limit reached');
    });

    it('should return valid for USAGE token within limit', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.USAGE,
        expiresAt: null,
        maxUsage: 100,
        currentUsage: 50, // Under limit
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
    });

    it('should return valid for USAGE token with null maxUsage', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.USAGE,
        expiresAt: null,
        maxUsage: null, // No limit
        currentUsage: 1000,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
    });

    it('should return valid for USAGE token with currentUsage below maxUsage', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.USAGE,
        expiresAt: null,
        maxUsage: 100,
        currentUsage: 99, // Just below limit
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      const result = await validateToken(token);

      expect(result.valid).toBe(true);
    });
  });

  describe('findTokenByValue', () => {
    it('should find token by value when hash matches', async () => {
      const tokenValue = 'cat_test123';
      const hashedToken = '$2b$10$hashed';
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: hashedToken,
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      mockPrisma.apiToken.findMany.mockResolvedValue([token]);
      mockBcrypt.compare.mockResolvedValueOnce(true);

      const result = await findTokenByValue(tokenValue);

      expect(mockPrisma.apiToken.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith(tokenValue, hashedToken);
      expect(result).toEqual(token);
    });

    it('should return null if no active tokens found', async () => {
      const tokenValue = 'cat_wrong';
      mockPrisma.apiToken.findMany.mockResolvedValue([]);

      const result = await findTokenByValue(tokenValue);

      expect(result).toBeNull();
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null if no tokens match hash', async () => {
      const tokenValue = 'cat_test123';
      const hashedToken = '$2b$10$hashed';
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: hashedToken,
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      mockPrisma.apiToken.findMany.mockResolvedValue([token]);
      mockBcrypt.compare.mockResolvedValueOnce(false);

      const result = await findTokenByValue(tokenValue);

      expect(result).toBeNull();
    });

    it('should check multiple tokens until match is found', async () => {
      const tokenValue = 'cat_test123';
      const hashedToken1 = '$2b$10$hashed1';
      const hashedToken2 = '$2b$10$hashed2';
      const token1: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token 1',
        token: hashedToken1,
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };
      const token2: ApiToken = {
        id: 'token-2',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token 2',
        token: hashedToken2,
        tokenPrefix: 'cat_5678',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      mockPrisma.apiToken.findMany.mockResolvedValue([token1, token2]);
      mockBcrypt.compare
        .mockResolvedValueOnce(false) // First token doesn't match
        .mockResolvedValueOnce(true); // Second token matches

      const result = await findTokenByValue(tokenValue);

      expect(mockBcrypt.compare).toHaveBeenCalledTimes(2);
      expect(result).toEqual(token2);
    });

    it('should handle database errors', async () => {
      const tokenValue = 'cat_test123';
      mockPrisma.apiToken.findMany.mockRejectedValue(new Error('Database error'));

      await expect(findTokenByValue(tokenValue)).rejects.toThrow('Database error');
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage counter and update lastUsedAt', async () => {
      const tokenId = 'token-1';
      const updatedToken: ApiToken = {
        id: tokenId,
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 1,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      };

      mockPrisma.apiToken.update.mockResolvedValue(updatedToken);

      await incrementUsage(tokenId);

      expect(mockPrisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: {
          currentUsage: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors', async () => {
      const tokenId = 'token-1';
      mockPrisma.apiToken.update.mockRejectedValue(new Error('Database error'));

      await expect(incrementUsage(tokenId)).rejects.toThrow('Database error');
    });
  });

  describe('updateLastUsed', () => {
    it('should update lastUsedAt timestamp', async () => {
      const tokenId = 'token-1';
      const updatedToken: ApiToken = {
        id: tokenId,
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      };

      mockPrisma.apiToken.update.mockResolvedValue(updatedToken);

      await updateLastUsed(tokenId);

      expect(mockPrisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: {
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should handle database errors', async () => {
      const tokenId = 'token-1';
      mockPrisma.apiToken.update.mockRejectedValue(new Error('Database error'));

      await expect(updateLastUsed(tokenId)).rejects.toThrow('Database error');
    });
  });
});
