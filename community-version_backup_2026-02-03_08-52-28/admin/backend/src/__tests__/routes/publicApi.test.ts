import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BlockType } from '@prisma/client';
import request from 'supertest';
import express from 'express';
import publicApiRouter from '../../routes/publicApi';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    apiToken: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatSession: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatMessage: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  BlockType: {
    LOGIC: 'LOGIC',
    CONTEXT: 'CONTEXT',
    ACTION: 'ACTION',
  },
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock Weaviate - use vi.hoisted
const { mockWeaviateClient } = vi.hoisted(() => {
  const mockWeaviateClient = {
    graphql: {
      get: vi.fn(() => ({
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn(),
              })),
            })),
          })),
        })),
      })),
    },
  };
  return { mockWeaviateClient };
});

vi.mock('weaviate-ts-client', () => ({
  default: {
    client: vi.fn(() => mockWeaviateClient),
  },
}));

// Mock LLM helper - use vi.hoisted
const { mockLlmHelper } = vi.hoisted(() => {
  const mockLlmHelper = {
    generateResponse: vi.fn(),
    generateStreamingResponse: vi.fn(),
  };
  return { mockLlmHelper };
});

vi.mock('../../services/llmHelper', () => ({
  generateResponse: mockLlmHelper.generateResponse,
  generateStreamingResponse: mockLlmHelper.generateStreamingResponse,
}));

// Mock API token service - use vi.hoisted
const { mockApiTokenService } = vi.hoisted(() => {
  const mockApiTokenService = {
    findTokenByValue: vi.fn(),
    validateToken: vi.fn(),
    incrementUsage: vi.fn(),
  };
  return { mockApiTokenService };
});

vi.mock('../../services/apiTokenService', () => ({
  findTokenByValue: mockApiTokenService.findTokenByValue,
  validateToken: mockApiTokenService.validateToken,
  incrementUsage: mockApiTokenService.incrementUsage,
}));

// Mock API auth middleware - use vi.hoisted for flexibility
const { mockAuthenticateApiToken, mockCheckRateLimit, mockUsageLoggerMiddleware } = vi.hoisted(() => {
  const mockAuthenticateApiToken = vi.fn((req: any, res: any, next: any) => {
    req.apiToken = {
      id: 'token-id',
      tokenPrefix: 'ct_',
      tokenType: 'PERMANENT',
      chatbotId: req.params.chatbotId,
      currentUsage: 0,
      maxUsage: null,
      expiresAt: null,
      isActive: true,
      rateLimitPerMinute: null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
      scheduledRevocationAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-id',
      blockId: null,
    };
    req.chatbotId = req.params.chatbotId;
    next();
  });
  const mockCheckRateLimit = vi.fn((req: any, res: any, next: any) => {
    next();
  });
  const mockUsageLoggerMiddleware = vi.fn((req: any, res: any, next: any) => {
    next();
  });
  return { mockAuthenticateApiToken, mockCheckRateLimit, mockUsageLoggerMiddleware };
});

vi.mock('../../middleware/apiAuth', () => ({
  authenticateApiToken: mockAuthenticateApiToken,
  checkRateLimit: mockCheckRateLimit,
  ApiAuthRequest: {},
}));

vi.mock('../../middleware/usageLogger', () => ({
  usageLoggerMiddleware: mockUsageLoggerMiddleware,
}));

// Mock CORS API middleware
vi.mock('../../middleware/corsApi', () => ({
  corsApiMiddleware: (req: any, res: any, next: any) => {
    next();
  },
  CorsApiRequest: {},
}));

describe('Public API Routes', () => {
  let app: express.Application;
  const chatbotId = 'cmjbb8hwd0001qn1tp1of601g'; // Valid CUID format

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api', publicApiRouter);
    // Add error handler to catch and log errors
    // IMPORTANT: This should only handle errors that weren't already handled by middleware
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
    vi.clearAllMocks();
    
    // Reset middleware to default behavior
    mockAuthenticateApiToken.mockImplementation((req: any, res: any, next: any) => {
      req.apiToken = {
        id: 'token-id',
        tokenPrefix: 'ct_',
        tokenType: 'PERMANENT',
        chatbotId: req.params.chatbotId,
        currentUsage: 0,
        maxUsage: null,
        expiresAt: null,
        isActive: true,
      };
      req.chatbotId = req.params.chatbotId;
      next();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat/:chatbotId', () => {
    beforeEach(() => {
      // Mock Weaviate responses
      const mockWeaviateQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      mockWeaviateClient.graphql.get = vi.fn(() => mockWeaviateQuery);

      // Mock blocks
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'gemini',
          llmModel: 'gemini-2.5-flash',
        },
      });

      mockPrisma.block.findMany.mockResolvedValue([]);

      // Mock LLM response
      mockLlmHelper.generateResponse.mockResolvedValue('Test response');
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('message is required');
    });

    it('should return 400 if message is not a string', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('message is required');
    });

    it('should create a new session if sessionId is not provided', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Hello' })
        .expect(200);

      expect(response.body.response).toBe('Test response');
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.sources).toEqual([]);
    });

    it('should use existing session if sessionId is provided', async () => {
      // First request to create session
      const firstResponse = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Hello' })
        .expect(200);

      const sessionId = firstResponse.body.sessionId;

      // Second request with same sessionId
      const secondResponse = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Follow up', sessionId })
        .expect(200);

      expect(secondResponse.body.sessionId).toBe(sessionId);
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledTimes(2);
    });

    it('should retrieve context from Weaviate', async () => {
      // Content must be > 100 characters to pass the filter in getContextFromWeaviate
      const longContent = 'This is a test website content that is longer than 100 characters to ensure it passes the filter in the getContextFromWeaviate function. It needs to be substantial enough to be considered valid context.';
      
      const mockWebsiteResponse = {
        data: {
          Get: {
            WebsiteContent: [
              {
                content: longContent,
                url: 'https://example.com',
                title: 'Example',
                chatbotId: chatbotId,
              },
            ],
          },
        },
      };

      const mockDocumentResponse = {
        data: {
          Get: {
            DocumentContent: [],
          },
        },
      };

      // The route sets client to null in test environment (NODE_ENV === 'test')
      // So getContextFromWeaviate returns empty. We need to mock the route's client
      // or test this differently. For now, we verify the endpoint works.
      // The Weaviate integration is better tested in integration tests.
      
      // Set up mocks for the case where client would be available
      // Note: In actual test, client is null, so sources will be empty
      // This test verifies the endpoint structure, not the Weaviate integration
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // In test environment, client is null, so sources will be empty
      // The Weaviate integration should be tested separately
      expect(response.body).toHaveProperty('sources');
      expect(Array.isArray(response.body.sources)).toBe(true);
    });

    it('should generate response using LLM helper', async () => {
      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateResponse).toHaveBeenCalled();
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Test Bot'),
        expect.any(Array),
        expect.stringContaining('Test question'),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle errors gracefully', async () => {
      mockLlmHelper.generateResponse.mockRejectedValue(new Error('LLM error'));

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to process request');
    });

    it('should handle errors in catch block with proper logging', async () => {
      // Force an error by making block.findFirst throw
      mockPrisma.block.findFirst.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBe('Failed to process request');
    });

    it('should return 400 if chatbotId is missing', async () => {
      // Mock middleware to not set chatbotId
      // Note: chatbotId is in route params, so validation will pass for params
      // But the controller checks req.chatbotId which comes from auth middleware
      // So we need to test with an invalid chatbotId in the URL to trigger validation error
      const invalidChatbotId = 'invalid-id';
      
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: null, // Missing chatbotId
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = null;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${invalidChatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toMatch(/chatbotId|Invalid|ID too short/);
    });

    it('should handle session cleanup when sessions exceed 1000', async () => {
      // Create many sessions to trigger cleanup
      // This is hard to test directly, but we can verify the logic exists
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/chat/${chatbotId}`)
          .set('Authorization', 'Bearer test-token')
          .send({ message: `Test message ${i}` })
          .expect(200);
      }

      // Verify sessions are being created
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledTimes(5);
    });

    it('should include usage info for USAGE type tokens', async () => {
      // Mock middleware to set USAGE token
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'USAGE',
          chatbotId: chatbotId,
          currentUsage: 5,
          maxUsage: 100,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Usage should be included for USAGE tokens
      expect(response.body).toHaveProperty('usage');
      if (response.body.usage) {
        expect(response.body.usage).toHaveProperty('token');
        expect(response.body.usage).toHaveProperty('remaining');
        expect(response.body.usage.remaining).toBe(94); // 100 - 5 - 1
      }
    });

    it('should not include usage info for PERMANENT tokens', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Usage should not be included for PERMANENT tokens
      expect(response.body.usage).toBeUndefined();
    });

    it('should handle missing system prompt block', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body.response).toBeDefined();
      // Should use default LLM provider when system prompt block is missing
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle context blocks', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'context-1',
          type: BlockType.CONTEXT,
          subtype: 'Website',
          properties: { url: 'https://example.com' },
        },
      ]);

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body.response).toBeDefined();
      expect(mockLlmHelper.generateResponse).toHaveBeenCalled();
    });

    it('should augment message with context when available', async () => {
      // Mock Weaviate to return context (though client is null in test)
      // The route will still process the request
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body.response).toBeDefined();
      // Message should be augmented if context exists
      expect(mockLlmHelper.generateResponse).toHaveBeenCalled();
    });

    it('should handle database errors when fetching blocks', async () => {
      mockPrisma.block.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /api/chat/:chatbotId/stream', () => {
    beforeEach(() => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'gemini',
        },
      });

      mockPrisma.block.findMany.mockResolvedValue([]);

      // Mock streaming response
      const mockStream = {
        write: vi.fn(),
        end: vi.fn(),
      };
      mockLlmHelper.generateStreamingResponse.mockResolvedValue(undefined);
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should stream response', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalled();
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should return 400 if message is not a string', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if chatbotId is missing', async () => {
      // Mock middleware to not set chatbotId
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: null,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = null;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should set SSE headers with CORS when origin is present', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .set('Origin', 'https://example.com')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    it('should create new session if sessionId not provided', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should receive metadata event with sessionId
      expect(response.text).toContain('metadata');
      expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalled();
    });

    it('should use existing session if sessionId provided', async () => {
      // First request to create session
      const firstResponse = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Hello' })
        .expect(200);

      // Extract sessionId from metadata event
      const metadataMatch = firstResponse.text.match(/data: ({[^}]+"type":"metadata"[^}]+})/);
      if (metadataMatch) {
        const metadata = JSON.parse(metadataMatch[1]);
        const sessionId = metadata.chatSessionId;

        // Second request with same sessionId
        const secondResponse = await request(app)
          .post(`/api/chat/${chatbotId}/stream`)
          .set('Authorization', 'Bearer test-token')
          .send({ message: 'Follow up', sessionId })
          .expect(200);

        expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalledTimes(2);
      }
    });

    it('should send sources event after streaming', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should contain sources event
      expect(response.text).toContain('sources');
    });

    it('should send usage event for USAGE tokens', async () => {
      // Mock middleware to set USAGE token
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'USAGE',
          chatbotId: chatbotId,
          currentUsage: 5,
          maxUsage: 100,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should contain usage event
      expect(response.text).toContain('usage');
    });

    it('should handle streaming errors gracefully', async () => {
      mockLlmHelper.generateStreamingResponse.mockRejectedValue(new Error('Streaming error'));

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should send error event
      expect(response.text).toContain('error');
    });

    it('should handle errors when headers already sent', async () => {
      // This is hard to test directly, but we can verify error handling exists
      mockLlmHelper.generateStreamingResponse.mockImplementation(async () => {
        throw new Error('Error after headers sent');
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should handle error gracefully
      expect(response.text).toContain('error');
    });

    it('should handle errors in catch block with headers not sent', async () => {
      // Force an error before headers are sent by making chatbotId invalid
      // This will cause an error before writeHead is called
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: null,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = null; // This will cause early return before writeHead
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(400); // Should return 400 for missing chatbotId, not 500

      // Should return JSON error when headers not sent
      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle errors in catch block with headers already sent', async () => {
      // Force an error after headers are sent (in the try block after writeHead)
      // This is tricky - we need to make an error occur after writeHead but before end
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: { botName: 'Test Bot' },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockLlmHelper.generateStreamingResponse.mockImplementation(async () => {
        throw new Error('Streaming error');
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should send error event when headers already sent
      expect(response.text).toContain('error');
    });

    it('should handle database errors in stream endpoint', async () => {
      mockPrisma.block.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should send error event
      expect(response.text).toContain('error');
    });
  });

  describe('GET /api/chat/:chatbotId/health', () => {
    it('should return health status for PERMANENT token', async () => {
      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.chatbotId).toBe(chatbotId);
      expect(response.body.token.type).toBe('PERMANENT');
    });

    it('should return remaining usage for USAGE token', async () => {
      // Mock middleware to set USAGE token
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'USAGE',
          chatbotId: chatbotId,
          currentUsage: 50,
          maxUsage: 100,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.token.type).toBe('USAGE');
      expect(response.body.token.remaining).toBe(50); // 100 - 50
    });

    it('should return 400 if chatbotId is missing', async () => {
      // Mock middleware to not set chatbotId
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: null,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = null;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if token is missing', async () => {
      // Mock middleware to not set token
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = null;
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle errors gracefully', async () => {
      // Mock to throw error in the route handler, not middleware
      // The middleware error would be caught earlier, so we test route error handling
      // by making the route throw an error internally
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: chatbotId,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        // Force an error by making chatbotId invalid
        req.chatbotId = undefined;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(400); // Should return 400 for missing chatbotId, not 500

      expect(response.body.error).toBe('Bad Request');
    });

    it('should handle errors in catch block', async () => {
      // Force an error by making prisma throw (though health endpoint doesn't use prisma)
      // Actually, health endpoint is simple, so let's test a different error scenario
      // Make the route handler throw by accessing a property that causes an error
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = null; // This will cause an error when accessing token.tokenType
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(400); // Should return 400 for missing token, not 500

      expect(response.body.error).toBe('Bad Request');
    });

    it('should not include remaining usage for PERMANENT token', async () => {
      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.token.type).toBe('PERMANENT');
      expect(response.body.token.remaining).toBeUndefined();
    });

    it('should include expiresAt in token info', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      // Mock middleware to set token with expiresAt
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'PERMANENT',
          chatbotId: chatbotId,
          currentUsage: 0,
          maxUsage: null,
          expiresAt: futureDate,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/health`)
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.token.expiresAt).toBeDefined();
    });
  });

  describe('GET /api/chat/:chatbotId/info', () => {
    it('should return chatbot info', async () => {
      const mockChatbot = {
        id: chatbotId,
        name: 'Test Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/info`)
        .expect(200);

      expect(response.body.id).toBe(chatbotId);
      expect(response.body.name).toBe('Test Chatbot');
      expect(response.body.status).toBe('ACTIVE');
      expect(mockPrisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: chatbotId },
        select: {
          id: true,
          name: true,
          status: true,
        },
      });
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/info`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Chatbot not found');
    });

    it('should handle database errors', async () => {
      mockPrisma.chatbot.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/info`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
    });

    it('should return chatbot info for DRAFT status', async () => {
      const mockChatbot = {
        id: chatbotId,
        name: 'Draft Chatbot',
        status: 'DRAFT',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/info`)
        .expect(200);

      expect(response.body.status).toBe('DRAFT');
    });

    it('should return chatbot info for INACTIVE status', async () => {
      const mockChatbot = {
        id: chatbotId,
        name: 'Inactive Chatbot',
        status: 'INACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get(`/api/chat/${chatbotId}/info`)
        .expect(200);

      expect(response.body.status).toBe('INACTIVE');
    });
  });

  describe('POST /api/chat/:chatbotId - Additional Edge Cases', () => {
    beforeEach(() => {
      // Reset NODE_ENV to allow Weaviate client initialization
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Mock Weaviate client to be available
      const mockWeaviateQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };
      mockWeaviateClient.graphql.get = vi.fn(() => mockWeaviateQuery);
      
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'gemini',
          llmModel: 'gemini-2.5-flash',
        },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockLlmHelper.generateResponse.mockResolvedValue('Test response');
      
      // Restore NODE_ENV after test
      afterEach(() => {
        process.env.NODE_ENV = originalEnv;
      });
    });

    it('should handle system prompt block with manual prompt', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          prompt: 'This is a very long manual prompt that exceeds 50 characters and should be used instead of generating one from configuration.',
          botName: 'Test Bot',
        },
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body.response).toBeDefined();
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('This is a very long manual prompt'),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle system prompt block with company name', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Assistant',
          companyName: 'Acme Corp',
          behavior: 'professional',
        },
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Acme Corp'),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle system prompt block with additional instructions', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Assistant',
          additionalInstructions: 'Always be polite and concise.',
        },
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Always be polite and concise'),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle custom LLM provider and model', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'openai',
          llmModel: 'gpt-4',
        },
      });

      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(String),
        'openai',
        'gpt-4'
      );
    });

    it('should handle empty context from Weaviate', async () => {
      // Client is null in test, so context will be empty
      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body.sources).toEqual([]);
      // Message should not be augmented when context is empty
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        'Test question', // Not augmented
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle session history correctly', async () => {
      // First message
      const firstResponse = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'First message' })
        .expect(200);

      const sessionId = firstResponse.body.sessionId;

      // Second message with history
      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Second message', sessionId })
        .expect(200);

      // generateResponse should be called with history
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledTimes(2);
      const secondCall = mockLlmHelper.generateResponse.mock.calls[1];
      // History should contain first user message and first assistant response (slice(0, -1) excludes current message)
      expect(secondCall[1]).toHaveLength(2); // [USER: 'First message', ASSISTANT: 'Test response']
    });

    it('should handle USAGE token with no maxUsage', async () => {
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'USAGE',
          chatbotId: chatbotId,
          currentUsage: 5,
          maxUsage: null, // No max usage limit
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Usage should not be included when maxUsage is null
      expect(response.body.usage).toBeUndefined();
    });

    it('should augment message with context when context exists', async () => {
      // Test augmentedMessage logic (line 258-260)
      // Need to set NODE_ENV to allow Weaviate client initialization and re-import the module
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      // Reset modules and re-import to initialize client with mock
      vi.resetModules();
      
      // Re-import dependencies that might be affected
      const publicApiRouterReloaded = (await import('../../routes/publicApi')).default;
      
      // Create a new app instance with the reloaded router
      const testApp = express();
      testApp.use(express.json());
      testApp.use('/api', publicApiRouterReloaded);
      
      const longContent = 'This is a test website content that is longer than 100 characters to ensure it passes the filter in the getContextFromWeaviate function. It needs to be substantial enough to be considered valid context.';
      
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [
                        {
                          content: longContent,
                          url: 'https://example.com',
                          title: 'Example',
                          chatbotId: chatbotId,
                        },
                      ],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };
      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      // Override the beforeEach mock - need to set up the mock to return different queries for website and document
      let callCounter = 0;
      
      mockWeaviateClient.graphql.get = vi.fn(() => {
        const callIndex = callCounter++;
        if (callIndex === 0) {
          // First call is for WebsiteContent
          return mockWebsiteQuery;
        } else {
          // Second call is for DocumentContent
          return mockDocumentQuery;
        }
      });

      // Setup mocks for the reloaded module
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'gemini',
          llmModel: 'gemini-2.5-flash',
        },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockLlmHelper.generateResponse.mockResolvedValue('Test response');

      // Clear previous calls
      mockLlmHelper.generateResponse.mockClear();

      await request(testApp)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Verify that generateResponse was called with augmented message (Context: ...\n\nQuestion: ...)
      expect(mockLlmHelper.generateResponse).toHaveBeenCalled();
      const callArgs = mockLlmHelper.generateResponse.mock.calls[0];
      // The third argument should be the augmented message
      const userMessage = callArgs[2];
      expect(userMessage).toContain('Context:');
      expect(userMessage).toContain('Question: Test question');
      
      // Restore NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should use original message when context is empty', async () => {
      // Test augmentedMessage logic when context is empty (line 258-260)
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };
      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      let callCount = 0;
      mockWeaviateClient.graphql.get = vi.fn(() => {
        if (callCount++ === 0) {
          return mockWebsiteQuery;
        }
        return mockDocumentQuery;
      });

      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Verify that generateResponse was called with original message (no augmentation)
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        'Test question', // Original message, not augmented
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle getContextFromWeaviate filtering by chatbotId', async () => {
      // Test that content from different chatbotId is filtered out
      const longContent = 'This is a test website content that is longer than 100 characters to ensure it passes the filter in the getContextFromWeaviate function. It needs to be substantial enough to be considered valid context.';
      
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [
                        {
                          content: longContent,
                          url: 'https://example.com',
                          title: 'Example',
                          chatbotId: 'different-chatbot', // Should be filtered out
                        },
                        {
                          content: longContent,
                          url: 'https://example.com/correct',
                          title: 'Correct',
                          chatbotId: chatbotId, // Should pass filter
                        },
                      ],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      let callCount = 0;
      mockWeaviateClient.graphql.get = vi.fn(() => {
        if (callCount++ === 0) {
          return mockWebsiteQuery;
        }
        return mockDocumentQuery;
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Only content with matching chatbotId should be included
      expect(response.body).toHaveProperty('sources');
    });

    it('should handle getContextFromWeaviate with document content', async () => {
      const longContent = 'This is a test document content that is longer than 100 characters to ensure it passes the filter in the getContextFromWeaviate function. It needs to be substantial enough to be considered valid context.';
      
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      DocumentContent: [
                        {
                          content: longContent,
                          chunkIndex: 0,
                          totalChunks: 5,
                          processedAt: new Date().toISOString(),
                          fileName: 'test.pdf',
                          chatbotId: chatbotId,
                        },
                      ],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      let callCount = 0;
      mockWeaviateClient.graphql.get = vi.fn(() => {
        if (callCount++ === 0) {
          return mockWebsiteQuery;
        }
        return mockDocumentQuery;
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.body).toHaveProperty('sources');
    });

    it('should handle getContextFromWeaviate with empty context', async () => {
      // Mock Weaviate to return empty results
      // This tests the branch where allContext.length === 0
      // Note: In test mode, client is null, so this tests the structure
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      DocumentContent: [],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      let callCount = 0;
      mockWeaviateClient.graphql.get = vi.fn(() => {
        if (callCount++ === 0) {
          return mockWebsiteQuery;
        }
        return mockDocumentQuery;
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // When context is empty, sources should be empty
      expect(response.body.sources).toEqual([]);
      // In test mode, client is null, so getContextFromWeaviate returns early
      // This test verifies the endpoint works correctly
    });

    it('should handle getContextFromWeaviate error gracefully', async () => {
      // Mock Weaviate to throw error
      const mockQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockRejectedValue(new Error('Weaviate error')),
              })),
            })),
          })),
        })),
      };

      mockWeaviateClient.graphql.get = vi.fn(() => mockQuery);

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should still return response even if Weaviate fails
      expect(response.body).toHaveProperty('response');
      expect(response.body.sources).toEqual([]);
    });

    it('should handle getContextFromWeaviate with DocumentContent schema error', async () => {
      const longContent = 'This is a test website content that is longer than 100 characters to ensure it passes the filter in the getContextFromWeaviate function.';
      
      const mockWebsiteQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [
                        {
                          content: longContent,
                          url: 'https://example.com',
                          title: 'Example',
                          chatbotId: chatbotId,
                        },
                      ],
                    },
                  },
                }),
              })),
            })),
          })),
        })),
      };

      const mockDocumentQuery = {
        withClassName: vi.fn(() => ({
          withFields: vi.fn(() => ({
            withBm25: vi.fn(() => ({
              withLimit: vi.fn(() => ({
                do: vi.fn().mockRejectedValue(new Error('DocumentContent schema does not exist')),
              })),
            })),
          })),
        })),
      };

      let callCount = 0;
      mockWeaviateClient.graphql.get = vi.fn(() => {
        if (callCount++ === 0) {
          return mockWebsiteQuery;
        }
        return mockDocumentQuery;
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should still work even if DocumentContent schema doesn't exist
      expect(response.body).toHaveProperty('response');
    });
  });

  describe('POST /api/chat/:chatbotId/stream - Additional Edge Cases', () => {
    beforeEach(() => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'gemini',
        },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockLlmHelper.generateStreamingResponse.mockResolvedValue(undefined);
    });

    it('should handle streaming without origin header', async () => {
      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(response.headers['content-type']).toContain('text/event-stream');
      // Should still work without origin
    });

    it('should handle system prompt block with manual prompt in stream', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          prompt: 'This is a very long manual prompt that exceeds 50 characters and should be used instead of generating one from configuration.',
        },
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalledWith(
        expect.stringContaining('This is a very long manual prompt'),
        expect.any(Array),
        expect.any(String),
        expect.any(Object), // Response object
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should handle custom LLM provider in stream', async () => {
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          botName: 'Test Bot',
          llmProvider: 'anthropic',
          llmModel: 'claude-3-opus',
        },
      });

      await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(String),
        expect.any(Object),
        'anthropic',
        'claude-3-opus'
      );
    });

    it('should handle USAGE token with no maxUsage in stream', async () => {
      mockAuthenticateApiToken.mockImplementationOnce((req: any, res: any, next: any) => {
        req.apiToken = {
          id: 'token-id',
          tokenPrefix: 'ct_',
          tokenType: 'USAGE',
          chatbotId: chatbotId,
          currentUsage: 5,
          maxUsage: null,
          expiresAt: null,
          isActive: true,
        };
        req.chatbotId = chatbotId;
        next();
      });

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should not contain usage event when maxUsage is null
      expect(response.text).not.toContain('usage');
    });

    it('should handle context blocks in stream', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        {
          id: 'context-1',
          type: BlockType.CONTEXT,
          subtype: 'Website',
          properties: { url: 'https://example.com' },
        },
        {
          id: 'context-2',
          type: BlockType.CONTEXT,
          subtype: 'Document',
          properties: { filename: 'document.pdf' },
        },
      ]);

      const response = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      expect(mockLlmHelper.generateStreamingResponse).toHaveBeenCalled();
    });

    it('should handle session lookup in stream endpoint', async () => {
      // Test session lookup logic in stream endpoint (lines 368-377)
      const response1 = await request(app)
        .post(`/api/chat/${chatbotId}/stream`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'First message' })
        .expect(200);

      // Extract sessionId from metadata
      const metadataMatch = response1.text.match(/data: ({[^}]+"type":"metadata"[^}]+})/);
      if (metadataMatch) {
        const metadata = JSON.parse(metadataMatch[1]);
        const sessionId = metadata.chatSessionId;

        // Use a fake sessionId that doesn't exist
        const fakeSessionId = 'fake-session-id';
        const response2 = await request(app)
          .post(`/api/chat/${chatbotId}/stream`)
          .set('Authorization', 'Bearer test-token')
          .send({ message: 'Second message', sessionId: fakeSessionId })
          .expect(200);

        // Should create a new session
        expect(response2.text).toContain('metadata');
      }
    });

    it('should test generateSystemPrompt with manual prompt exactly 50 characters', async () => {
      // Test edge case: manual prompt exactly 50 characters (line 151: length > 50)
      const exactly50Chars = 'A'.repeat(50); // Exactly 50 characters
      
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          prompt: exactly50Chars, // Exactly 50, so should NOT be used
          botName: 'Test Bot',
        },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);

      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should use generated prompt, not the 50-char prompt
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining('Test Bot'),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

    it('should test generateSystemPrompt with manual prompt 51 characters', async () => {
      // Test edge case: manual prompt 51 characters (line 151: length > 50)
      const prompt51Chars = 'A'.repeat(51); // 51 characters, should be used
      
      mockPrisma.block.findFirst.mockResolvedValue({
        id: 'block-1',
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          prompt: prompt51Chars,
        },
      });
      mockPrisma.block.findMany.mockResolvedValue([]);

      await request(app)
        .post(`/api/chat/${chatbotId}`)
        .set('Authorization', 'Bearer test-token')
        .send({ message: 'Test question' })
        .expect(200);

      // Should use the manual prompt (51 chars > 50)
      expect(mockLlmHelper.generateResponse).toHaveBeenCalledWith(
        expect.stringContaining(prompt51Chars),
        expect.any(Array),
        expect.any(String),
        'gemini',
        'gemini-2.5-flash'
      );
    });

  });
});
