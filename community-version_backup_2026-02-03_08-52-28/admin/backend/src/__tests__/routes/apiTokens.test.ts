import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ApiTokenType } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import apiTokensRouter from '../../routes/apiTokens';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    apiToken: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  ApiTokenType: {
    DURATION: 'DURATION',
    USAGE: 'USAGE',
    PERMANENT: 'PERMANENT',
  },
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock API token service - use vi.hoisted
const { mockApiTokenService } = vi.hoisted(() => {
  const mockApiTokenService = {
    createApiToken: vi.fn(),
    revokeToken: vi.fn(),
    updateToken: vi.fn(),
  };
  return { mockApiTokenService };
});

vi.mock('../../services/apiTokenService', () => ({
  createApiToken: mockApiTokenService.createApiToken,
  revokeToken: mockApiTokenService.revokeToken,
  updateToken: mockApiTokenService.updateToken,
}));

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
    };
    next();
  },
  AdminAuthRequest: {},
}));

describe('API Tokens Routes', () => {
  let app: express.Application;
  const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', apiTokensRouter);
    // Add error handler to catch and log errors
    app.use((err: any, req: any, res: any, next: any) => {
      // CRITICAL: If response already sent (e.g., by validation middleware), don't send another response
      // Check both headersSent and writableEnded to be absolutely sure
      if (res.headersSent || res.writableEnded || res.finished) {
        // Response already sent - don't interfere
        return;
      }
      // Log error for debugging
      if (process.env.DEBUG) {
        console.error('Express error handler:', err);
      }
      // Only send error response if headers haven't been sent
      // Double-check before sending to prevent double responses
      if (!res.headersSent && !res.writableEnded && !res.finished) {
        try {
          res.status(err.status || 500).json({
            error: err.status === 400 ? 'Bad Request' : 'Internal Server Error',
            message: err.message || 'An error occurred',
          });
        } catch (sendError) {
          // If sending fails, response might have already been sent
          // Just return silently
          return;
        }
      }
    });
    // Don't clear all mocks here - it clears implementations which breaks test-specific overrides
    // The inner beforeEach will set up default mocks, and tests can override them
  });

  afterEach(() => {
    // Don't clear all mocks here - it interferes with test-specific mock overrides
  });

  describe('POST /api/admin/chatbots/:chatbotId/api-tokens', () => {
    beforeEach(() => {
      // Don't call vi.clearAllMocks() here - it clears implementations
      // Just set up the default mocks
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });
      // Default: block exists (can be overridden in individual tests)
      // Set this here so tests that don't override it will have a default
      // Use mockResolvedValue so tests can easily override with mockResolvedValue
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-id',
        chatbotId: chatbotId,
      });
      // Default mock for createApiToken
      mockApiTokenService.createApiToken.mockResolvedValue({
        token: {
          id: 'token-id',
          name: 'Test Token',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId,
          blockId: null,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'admin-id',
        },
        rawToken: 'ct_test_token',
      });
    });

    it('should return 400 if name is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          tokenType: 'PERMANENT',
        })
        .expect(400);

      expect(response.body.message).toContain('name is required');
    });

    it('should return 400 if tokenType is missing', async () => {
      // Note: tokenType has a default value 'DURATION' in the schema
      // So when tokenType is missing, it defaults to 'DURATION'
      // Then the controller requires expiresAt for DURATION tokens
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
        })
        .expect(400);

      // With default DURATION, it will require expiresAt
      expect(response.body.error).toContain('expiresAt is required for DURATION tokens');
    });

    it('should return 400 if tokenType is invalid', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'INVALID',
        })
        .expect(400);

      expect(response.body.message).toMatch(/tokenType|Invalid/);
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'PERMANENT',
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Chatbot not found' });
    });

    it('should return 404 if block not found when blockId provided', async () => {
      // Use a valid CUID format that doesn't exist
      const nonExistentBlockId = 'cmjbb8hwd0001qn1tp1of999y'; // Valid CUID format but doesn't exist
      // Ensure chatbot exists - this is called first in the controller
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });
      // Block should not exist - override the default mock from beforeEach
      // The inner beforeEach sets mockResolvedValue, so we can override it
      // Since the outer beforeEach doesn't call vi.clearAllMocks(), the inner beforeEach's mock is set
      // We need to override it - use mockImplementation to completely replace it
      mockPrisma.block.findFirst.mockImplementation(async () => null);
      // Ensure createApiToken is not called (should return 404 before reaching it)
      mockApiTokenService.createApiToken.mockClear();

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'PERMANENT',
          blockId: nonExistentBlockId,
        })
        .expect(404);

      expect(response.body).toEqual({ error: 'Block not found' });
      // Verify createApiToken was not called since we returned 404
      expect(mockApiTokenService.createApiToken).not.toHaveBeenCalled();
      // Verify block.findFirst was called (it should have been called to check for the block)
      expect(mockPrisma.block.findFirst).toHaveBeenCalled();
    });

    it('should return 400 if DURATION token missing expiresAt', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'DURATION',
        })
        .expect(400);

      expect(response.body.error).toContain('expiresAt is required for DURATION tokens');
    });

    it('should return 400 if DURATION token has invalid expiresAt', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'DURATION',
          expiresAt: 'invalid-date',
        })
        .expect(400);

      expect(response.body.message).toMatch(/Invalid datetime|Invalid expiresAt date format/);
    });

    it('should return 400 if DURATION token expiresAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'DURATION',
          expiresAt: pastDate.toISOString(),
        })
        .expect(400);

      expect(response.body.error).toContain('expiresAt must be in the future');
    });

    it('should return 400 if USAGE token missing maxUsage', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'USAGE',
        })
        .expect(400);

      expect(response.body.error).toContain('maxUsage must be a positive number for USAGE tokens');
    });

    it('should return 400 if USAGE token has invalid maxUsage', async () => {
      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'USAGE',
          maxUsage: 0,
        })
        .expect(400);

      // Validation middleware catches this first, or controller catches it
      expect(response.body.message || response.body.error).toMatch(/maxUsage|Number must be greater|positive number/);
    });

    it('should create PERMANENT token successfully', async () => {
      // Ensure block mock is set (no blockId in this test, so block check won't run)
      // But set it anyway to be safe
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-id',
        chatbotId: chatbotId,
      });
      
      const mockToken = {
        id: 'token-123',
        name: 'Test Token',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const mockRawToken = 'ct_test_token_value';

      mockApiTokenService.createApiToken.mockResolvedValue({
        token: mockToken,
        rawToken: mockRawToken,
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'PERMANENT',
        })
        .expect(201);

      expect(response.body.id).toBe('token-123');
      expect(response.body.name).toBe('Test Token');
      expect(response.body.token).toBe(mockRawToken);
      expect(response.body.tokenType).toBe('PERMANENT');
      expect(mockApiTokenService.createApiToken).toHaveBeenCalledWith({
        chatbotId,
        blockId: undefined,
        name: 'Test Token',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: undefined,
        maxUsage: undefined,
        createdBy: 'admin-id',
      });
    });

    it('should create DURATION token successfully', async () => {
      // Ensure block mock is set (no blockId in this test, so block check won't run)
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-id',
        chatbotId: chatbotId,
      });
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const mockToken = {
        id: 'token-123',
        name: 'Test Token',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.DURATION,
        expiresAt: futureDate,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        createdAt: new Date(),
      };

      mockApiTokenService.createApiToken.mockResolvedValue({
        token: mockToken,
        rawToken: 'ct_test_token',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'DURATION',
          expiresAt: futureDate.toISOString(),
        })
        .expect(201);

      expect(response.body.tokenType).toBe('DURATION');
      expect(response.body.expiresAt).toBeDefined();
    });

    it('should create USAGE token successfully', async () => {
      // Ensure block mock is set (no blockId in this test, so block check won't run)
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-id',
        chatbotId: chatbotId,
      });
      
      const mockToken = {
        id: 'token-123',
        name: 'Test Token',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.USAGE,
        expiresAt: null,
        maxUsage: 100,
        currentUsage: 0,
        isActive: true,
        createdAt: new Date(),
      };

      mockApiTokenService.createApiToken.mockResolvedValue({
        token: mockToken,
        rawToken: 'ct_test_token',
      });

      const response = await request(app)
        .post(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .send({
          name: 'Test Token',
          tokenType: 'USAGE',
          maxUsage: 100,
        })
        .expect(201);

      expect(response.body.tokenType).toBe('USAGE');
      expect(response.body.maxUsage).toBe(100);
    });
  });

  describe('GET /api/admin/chatbots/:chatbotId/api-tokens', () => {
    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Chatbot not found' });
    });

    it('should return list of tokens', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      const mockTokens = [
        {
          id: 'token-1',
          name: 'Token 1',
          tokenPrefix: 'ct_',
          tokenType: ApiTokenType.PERMANENT,
          expiresAt: null,
          maxUsage: null,
          currentUsage: 0,
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          blockId: null,
        },
        {
          id: 'token-2',
          name: 'Token 2',
          tokenPrefix: 'ct_',
          tokenType: ApiTokenType.DURATION,
          expiresAt: new Date(),
          maxUsage: null,
          currentUsage: 5,
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          blockId: null,
        },
      ];

      mockPrisma.apiToken.findMany.mockResolvedValue(mockTokens);

      const response = await request(app)
        .get(`/api/admin/chatbots/${chatbotId}/api-tokens`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe('token-1');
      expect(response.body[0]).not.toHaveProperty('hashedToken');
      expect(response.body[1].id).toBe('token-2');
    });
  });

  describe('GET /api/admin/api-tokens/:tokenId', () => {
    const tokenId = 'cmjbb8hwd0001qn1tp1of603i'; // Valid CUID format

    it('should return 404 if token not found', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/api-tokens/${tokenId}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Token not found' });
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: tokenId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/api-tokens/${tokenId}`)
        .expect(403);

      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('should return token details', async () => {
      const mockToken = {
        id: tokenId,
        name: 'Test Token',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        blockId: null,
        chatbotId: chatbotId,
        chatbot: {
          ownerId: 'admin-id',
        },
      };

      mockPrisma.apiToken.findUnique.mockResolvedValue(mockToken);

      const response = await request(app)
        .get(`/api/admin/api-tokens/${tokenId}`)
        .expect(200);

      expect(response.body.id).toBe(tokenId);
      expect(response.body.name).toBe('Test Token');
      expect(response.body).not.toHaveProperty('hashedToken');
    });
  });

  describe('PATCH /api/admin/api-tokens/:tokenId', () => {
    const tokenId = 'cmjbb8hwd0001qn1tp1of603i'; // Valid CUID format

    beforeEach(() => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: tokenId,
        chatbot: {
          ownerId: 'admin-id',
        },
      });
    });

    it('should return 404 if token not found', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body).toEqual({ error: 'Token not found' });
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: tokenId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({ name: 'Updated Name' })
        .expect(403);

      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('should update token name', async () => {
      const updatedToken = {
        id: tokenId,
        name: 'Updated Name',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockApiTokenService.updateToken.mockResolvedValue(updatedToken);

      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(mockApiTokenService.updateToken).toHaveBeenCalledWith(tokenId, {
        name: 'Updated Name',
      });
    });

    it('should return 400 if expiresAt is invalid', async () => {
      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({
          expiresAt: 'invalid-date',
        })
        .expect(400);

      expect(response.body.message).toMatch(/Invalid datetime|Invalid expiresAt date format/);
    });

    it('should return 400 if expiresAt is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({
          expiresAt: pastDate.toISOString(),
        })
        .expect(400);

      expect(response.body.error).toContain('expiresAt must be in the future');
    });

    it('should return 400 if maxUsage is invalid', async () => {
      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({
          maxUsage: 0,
        })
        .expect(400);

      // Validation middleware catches this first, or controller validates it
      expect(response.body.message || response.body.error).toMatch(/maxUsage|Number must be greater|positive number/);
    });

    it('should update expiresAt to null', async () => {
      const updatedToken = {
        id: tokenId,
        name: 'Test Token',
        tokenPrefix: 'ct_',
        tokenType: ApiTokenType.PERMANENT,
        expiresAt: null,
        maxUsage: null,
        currentUsage: 0,
        isActive: true,
        lastUsedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockApiTokenService.updateToken.mockResolvedValue(updatedToken);

      const response = await request(app)
        .patch(`/api/admin/api-tokens/${tokenId}`)
        .send({ expiresAt: null })
        .expect(200);

      expect(response.body.expiresAt).toBeNull();
    });
  });

  describe('DELETE /api/admin/api-tokens/:tokenId', () => {
    const tokenId = 'cmjbb8hwd0001qn1tp1of603i'; // Valid CUID format

    it('should return 404 if token not found', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/api-tokens/${tokenId}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Token not found' });
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: tokenId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .delete(`/api/admin/api-tokens/${tokenId}`)
        .expect(403);

      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('should revoke token successfully', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: tokenId,
        chatbot: {
          ownerId: 'admin-id',
        },
      });

      mockApiTokenService.revokeToken.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/admin/api-tokens/${tokenId}`)
        .expect(200);

      expect(response.body.message).toBe('Token revoked successfully');
      expect(mockApiTokenService.revokeToken).toHaveBeenCalledWith(tokenId, {
        revokedBy: 'admin-id',
        revocationReason: undefined,
        scheduledRevocationAt: undefined,
      });
    });
  });
});
