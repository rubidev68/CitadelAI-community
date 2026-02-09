import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { ApiTokenType } from '@prisma/client';
import { authenticateApiToken, ApiAuthRequest } from '../../middleware/apiAuth';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    chatbot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

// Mock @prisma/client to include ApiTokenType
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

// Mock API token service - use vi.hoisted to avoid hoisting issues
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

  it('should return 400 if chatbotId is missing', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };
    req.params = {};

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
    req.params = { chatbotId: 'chatbot-456' };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123', // Different chatbot
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

  it('should return 404 if chatbot is not found', async () => {
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

  it('should handle errors when incrementing usage', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    const mockToken = {
      id: 'token-id',
      chatbotId: 'chatbot-123',
      tokenType: ApiTokenType.USAGE,
    };

    mockApiTokenService.findTokenByValue.mockResolvedValue(mockToken);
    mockApiTokenService.validateToken.mockResolvedValue({ valid: true });
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });
    mockApiTokenService.incrementUsage.mockRejectedValue(new Error('Database error'));

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    // Should still call next() even if usage increment fails
    expect(next).toHaveBeenCalled();
    expect(mockApiTokenService.incrementUsage).toHaveBeenCalledWith('token-id');
  });

  it('should handle general errors and return 500', async () => {
    req.headers = {
      authorization: 'Bearer test-token',
    };

    mockApiTokenService.findTokenByValue.mockRejectedValue(new Error('Database connection failed'));

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Authentication failed',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle validation with no reason provided', async () => {
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
      reason: undefined,
    });

    await authenticateApiToken(req as ApiAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Token is not valid',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
