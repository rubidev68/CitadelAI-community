import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateToken,
  getTokenPrefix,
  hashToken,
  verifyToken,
  validateToken,
  incrementUsage,
  findTokenByValue,
  createApiToken,
  revokeToken,
  updateToken,
} from '../../services/apiTokenService';
import { ApiToken, ApiTokenType } from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    apiToken: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
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
  });

  describe('getTokenPrefix', () => {
    it('should return first 8 characters of token', () => {
      const token = 'cat_1234567890abcdef';
      const prefix = getTokenPrefix(token);
      expect(prefix).toBe('cat_1234');
      expect(prefix.length).toBe(8);
    });
  });

  describe('hashToken', () => {
    it('should hash a token using bcrypt', async () => {
      const token = 'cat_test123';
      const hashedToken = '$2b$10$hashedtoken';
      vi.mocked(bcrypt.hash).mockResolvedValue(hashedToken as never);

      const result = await hashToken(token);

      expect(bcrypt.hash).toHaveBeenCalledWith(token, 10);
      expect(result).toBe(hashedToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify a token matches the hash', async () => {
      const hashedToken = '$2b$10$hashedtoken';
      const providedToken = 'cat_test123';
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await verifyToken(hashedToken, providedToken);

      expect(bcrypt.compare).toHaveBeenCalledWith(providedToken, hashedToken);
      expect(result).toBe(true);
    });

    it('should return false for invalid token', async () => {
      const hashedToken = '$2b$10$hashedtoken';
      const providedToken = 'cat_wrong';
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await verifyToken(hashedToken, providedToken);

      expect(result).toBe(false);
    });
  });

  describe('validateToken', () => {
    it('should return valid for active token', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: 'PERMANENT' as ApiTokenType,
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
        tokenType: 'PERMANENT' as ApiTokenType,
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
        tokenType: 'DURATION' as ApiTokenType,
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
        tokenType: 'DURATION' as ApiTokenType,
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

    it('should return invalid for USAGE token that exceeded limit', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: 'USAGE' as ApiTokenType,
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
      expect(result.reason).toBe('Token usage limit exceeded');
    });

    it('should return valid for USAGE token within limit', async () => {
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: 'USAGE' as ApiTokenType,
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
  });

  describe('incrementUsage', () => {
    it('should increment usage counter and update lastUsedAt', async () => {
      const tokenId = 'token-1';
      vi.mocked(prisma.apiToken.update).mockResolvedValue({} as ApiToken);

      await incrementUsage(tokenId);

      expect(prisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: {
          currentUsage: { increment: 1 },
          lastUsedAt: expect.any(Date),
        },
      });
    });
  });

  describe('findTokenByValue', () => {
    it('should find token by value', async () => {
      const tokenValue = 'cat_test123';
      const hashedToken = '$2b$10$hashed';
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: hashedToken,
        tokenPrefix: 'cat_1234',
        tokenType: 'PERMANENT' as ApiTokenType,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      vi.mocked(prisma.apiToken.findMany).mockResolvedValue([token]);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

      const result = await findTokenByValue(tokenValue);

      expect(prisma.apiToken.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(tokenValue, hashedToken);
      expect(result).toEqual(token);
    });

    it('should return null if token not found', async () => {
      const tokenValue = 'cat_wrong';
      vi.mocked(prisma.apiToken.findMany).mockResolvedValue([]);

      const result = await findTokenByValue(tokenValue);

      expect(result).toBeNull();
    });

    it('should return null if no tokens match', async () => {
      const tokenValue = 'cat_test123';
      const hashedToken = '$2b$10$hashed';
      const token: ApiToken = {
        id: 'token-1',
        chatbotId: 'chatbot-1',
        blockId: null,
        name: 'Test Token',
        token: hashedToken,
        tokenPrefix: 'cat_1234',
        tokenType: 'PERMANENT' as ApiTokenType,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      vi.mocked(prisma.apiToken.findMany).mockResolvedValue([token]);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      const result = await findTokenByValue(tokenValue);

      expect(result).toBeNull();
    });
  });

  describe('createApiToken', () => {
    it('should create a new API token', async () => {
      const data = {
        chatbotId: 'chatbot-1',
        blockId: 'block-1',
        name: 'Test Token',
        tokenType: 'PERMANENT' as ApiTokenType,
        expiresAt: undefined,
        maxUsage: undefined,
        createdBy: 'user-1',
      };

      const rawToken = 'cat_test1234567890abcdef1234567890abcdef';
      const hashedToken = '$2b$10$hashed';
      const createdToken: ApiToken = {
        id: 'token-1',
        chatbotId: data.chatbotId,
        blockId: data.blockId,
        name: data.name,
        token: hashedToken,
        tokenPrefix: 'cat_test',
        tokenType: data.tokenType,
        expiresAt: data.expiresAt,
        maxUsage: data.maxUsage,
        currentUsage: 0,
        isActive: true,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedToken as never);
      vi.mocked(prisma.apiToken.create).mockResolvedValue(createdToken);

      const result = await createApiToken(data);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(prisma.apiToken.create).toHaveBeenCalledWith({
        data: {
          chatbotId: data.chatbotId,
          blockId: data.blockId,
          name: data.name,
          token: hashedToken,
          tokenPrefix: expect.any(String),
          tokenType: data.tokenType,
          expiresAt: data.expiresAt,
          maxUsage: data.maxUsage,
          createdBy: data.createdBy,
          isActive: true,
          currentUsage: 0,
        },
      });
      expect(result.token).toEqual(createdToken);
      expect(result.rawToken).toMatch(/^cat_[0-9a-f]{32}$/);
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token', async () => {
      const tokenId = 'token-1';
      vi.mocked(prisma.apiToken.update).mockResolvedValue({} as ApiToken);

      await revokeToken(tokenId);

      expect(prisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: expect.objectContaining({
          isActive: false,
          revokedAt: expect.any(Date),
          revokedBy: null,
          revocationReason: null,
          scheduledRevocationAt: null,
        }),
      });
    });
  });

  describe('updateToken', () => {
    it('should update token properties', async () => {
      const tokenId = 'token-1';
      const updates = {
        name: 'Updated Name',
        expiresAt: new Date(),
        maxUsage: 200,
      };
      const updatedToken: ApiToken = {
        id: tokenId,
        chatbotId: 'chatbot-1',
        blockId: null,
        name: updates.name!,
        token: 'hashed',
        tokenPrefix: 'cat_1234',
        tokenType: 'PERMANENT' as ApiTokenType,
        expiresAt: updates.expiresAt!,
        maxUsage: updates.maxUsage!,
        currentUsage: 0,
        isActive: true,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
      };

      vi.mocked(prisma.apiToken.update).mockResolvedValue(updatedToken);

      const result = await updateToken(tokenId, updates);

      expect(prisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: tokenId },
        data: updates,
      });
      expect(result).toEqual(updatedToken);
    });
  });
});
