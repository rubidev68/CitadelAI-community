import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { createApiTokenAuthMiddleware, ApiToken } from '../../auth/apiTokenAuth';
import type { ApiTokenAuthConfig } from '../../auth/apiTokenAuth';

// Mock logger
const mockLogger = {
  error: vi.fn(),
};

// Mock Prisma
const createMockPrisma = () => ({
  chatbot: {
    findUnique: vi.fn(),
  },
});

describe('createApiTokenAuthMiddleware', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let config: ApiTokenAuthConfig;
  let req: { headers?: { authorization?: string | string[] }; params?: { chatbotId?: string }; [key: string]: unknown };
  let res: Response;
  let next: NextFunction;
  let mockToken: ApiToken;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();

    mockToken = {
      id: 'token-123',
      chatbotId: 'chatbot-123',
      blockId: null,
      name: 'Test Token',
      token: 'test-token-value',
      tokenPrefix: 'test',
      tokenType: 'PERMANENT',
      expiresAt: null,
      maxUsage: null,
      currentUsage: 0,
      isActive: true,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-123',
    };

    const findTokenByValue = vi.fn().mockResolvedValue(mockToken);
    const validateToken = vi.fn().mockResolvedValue({ valid: true });
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    config = {
      findTokenByValue,
      validateToken,
      incrementUsage,
      prisma: mockPrisma as any,
      logger: mockLogger,
    };

    req = {
      headers: {},
      params: { chatbotId: 'chatbot-123' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn() as unknown as NextFunction;

    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'ACTIVE',
    });
  });

  it('should authenticate request with valid API token', async () => {
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(config.findTokenByValue).toHaveBeenCalledWith('test-token-value');
    expect(config.validateToken).toHaveBeenCalledWith(mockToken);
    expect((req as any).apiToken).toEqual(mockToken);
    expect((req as any).chatbotId).toBe('chatbot-123');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject request without authorization header', async () => {
    req.headers = {};

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with invalid authorization format', async () => {
    req.headers = { authorization: 'InvalidFormat' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with token not found', async () => {
    (config.findTokenByValue as any).mockResolvedValue(null);
    req.headers = { authorization: 'Bearer invalid-token' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid API token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request with invalid token', async () => {
    (config.validateToken as any).mockResolvedValue({
      valid: false,
      reason: 'Token expired',
    });
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Token expired',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request when chatbotId is missing', async () => {
    req.params = {};
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'chatbotId is required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request when token chatbotId does not match request chatbotId', async () => {
    req.params = { chatbotId: 'different-chatbot' };
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Token does not belong to this chatbot',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject request when chatbot is not active', async () => {
    mockPrisma.chatbot.findUnique.mockResolvedValue({
      id: 'chatbot-123',
      status: 'INACTIVE',
    });
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Chatbot is not active',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should increment usage for USAGE type tokens', async () => {
    mockToken.tokenType = 'USAGE';
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(config.incrementUsage).toHaveBeenCalledWith('token-123');
    expect(next).toHaveBeenCalled();
  });

  it('should not increment usage for non-USAGE type tokens', async () => {
    mockToken.tokenType = 'PERMANENT';
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(config.incrementUsage).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('should handle incrementUsage errors gracefully', async () => {
    mockToken.tokenType = 'USAGE';
    (config.incrementUsage as any).mockRejectedValue(new Error('Database error'));
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(next).toHaveBeenCalled(); // Should still proceed
  });

  it('should work without incrementUsage function', async () => {
    delete config.incrementUsage;
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle custom extractChatbotId function', async () => {
    const customExtract = vi.fn().mockReturnValue('custom-chatbot-id');
    config.extractChatbotId = customExtract;
    req.headers = { authorization: 'Bearer test-token-value' };

    const middleware = createApiTokenAuthMiddleware(config);
    await middleware(req as any, res, next);

    expect(customExtract).toHaveBeenCalled();
  });
});
