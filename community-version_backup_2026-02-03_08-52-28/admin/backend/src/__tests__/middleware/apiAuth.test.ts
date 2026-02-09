import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { ApiTokenType } from '@prisma/client';
import { authenticateApiToken, ApiAuthRequest } from '../../middleware/apiAuth';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { 
      findUnique: vi.fn(), 
      findFirst: vi.fn(), 
      findMany: vi.fn(), 
      create: vi.fn(), 
      update: vi.fn(), 
      delete: vi.fn(),
    },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    apiToken: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    tokenUsageLog: { create: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  ApiTokenType: {
    PERMANENT: 'PERMANENT',
    DURATION: 'DURATION',
    USAGE: 'USAGE',
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

// Mock shared middleware - use importOriginal to partially mock
vi.mock('@shared/middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/middleware')>();
  const mockRateLimiterMiddleware = vi.fn((req: any, res: any, next: any) => {
    next();
  });
  
  return {
    ...actual,
    createApiTokenRateLimiter: vi.fn(() => {
      return mockRateLimiterMiddleware;
    }),
  };
});

describe('authenticateApiToken Middleware', () => {
  let req: Partial<ApiAuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      headers: {},
      params: { chatbotId: 'chatbot-123' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should return 401 if Authorization header is missing', async () => {
    req.headers = {};

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if Authorization header does not start with Bearer', async () => {
    req.headers = {
      authorization: 'Invalid token123',
    };

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is not found', async () => {
    req.headers = {
      authorization: 'Bearer invalid-token',
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(null);

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid API token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if token validation fails', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({
      valid: false,
      reason: 'Token expired',
    });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Token expired',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 if chatbotId is missing from params', async () => {
    req.params = {};
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'chatbotId is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if token does not belong to chatbot', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'different-chatbot',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Token does not belong to this chatbot',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 404 if chatbot not found', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue(null);

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Chatbot not found',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 if chatbot is not active', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'INACTIVE',
    });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Chatbot is not active',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() if authentication succeeds', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
      currentUsage: 0,
      maxUsage: null,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.apiToken).toEqual(mockToken);
    expect(req.chatbotId).toBe('chatbot-123');
  });

  it('should increment usage for USAGE type tokens', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.USAGE,
      currentUsage: 5,
      maxUsage: 100,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });
    mockApiTokenService.incrementUsage.mockResolvedValue(undefined);

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockApiTokenService.incrementUsage).toHaveBeenCalledWith('token-id');
  });

  it('should not increment usage for PERMANENT type tokens', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.PERMANENT,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockApiTokenService.incrementUsage).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    mockApiTokenService.findTokenByValue.mockRejectedValue(new Error('Database error'));

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle incrementUsage error without failing request', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.USAGE,
      currentUsage: 5,
      maxUsage: 100,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });
    // Make incrementUsage fail
    mockApiTokenService.incrementUsage.mockRejectedValue(new Error('Usage tracking failed'));

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    // Should still call next() even if incrementUsage fails
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockApiTokenService.incrementUsage).toHaveBeenCalledWith('token-id');
  });
});

describe('checkRateLimit Middleware', () => {
  let req: Partial<ApiAuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear REDIS_URL to use in-memory fallback
    delete process.env.REDIS_URL;

    req = {
      apiToken: {
        id: 'token-id',
        chatbotId: 'chatbot-123',
        tokenType: ApiTokenType.PERMANENT,
        rateLimitPerMinute: null,
      } as any,
      chatbotId: 'chatbot-123',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should call next() (pass-through implementation)', async () => {
    // Reset the rate limiter to ensure it's initialized
    const apiAuthModule = await import('../../middleware/apiAuth');
    
    // Initialize the rate limiter
    await apiAuthModule.initializeTokenRateLimiter();
    
    await apiAuthModule.checkRateLimit(req as ApiAuthRequest, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
