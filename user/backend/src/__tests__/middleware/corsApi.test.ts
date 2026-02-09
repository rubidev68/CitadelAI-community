import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { corsApiMiddleware, CorsApiRequest } from '../../middleware/corsApi';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    block: {
      findFirst: vi.fn(),
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

describe('corsApiMiddleware', () => {
  let req: Partial<CorsApiRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FRONTEND_URL = 'https://admin.citadelai.app';

    req = {
      headers: {},
      params: { chatbotId: 'chatbot-123' },
      method: 'GET',
      path: '/api/chat/chatbot-123/info',
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    next = vi.fn();
  });

  describe('OPTIONS requests (preflight)', () => {
    it('should allow all origins for info endpoint OPTIONS', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/info';
      req.headers = { origin: 'https://example.com' };

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow admin frontend origin for OPTIONS', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce(null);

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny OPTIONS when origin is not in allowed list (admin frontend is auto-added)', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://example.com' };
      // No origins configured - admin frontend will be auto-added, but example.com won't be allowed
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {},
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CORS origin not allowed',
        message: 'Origin "https://example.com" is not in the allowed origins list. Please add it in the API block settings.',
      });
      expect(res.end).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow OPTIONS when origin is in allowed list', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://allowed.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['https://allowed.com', 'https://other.com'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://allowed.com');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it('should deny OPTIONS when origin is not in allowed list', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://disallowed.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['https://allowed.com'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CORS origin not allowed',
        message: 'Origin "https://disallowed.com" is not in the allowed origins list. Please add it in the API block settings.',
      });
    });

    it('should allow OPTIONS when wildcard is in allowed origins', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://any-origin.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['*'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://any-origin.com');
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should deny OPTIONS when chatbotId or origin is missing', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = {};
      req.params = { chatbotId: 'chatbot-123' };

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Bad Request' });
    });

    it('should deny OPTIONS when chatbotId is missing', async () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://example.com' };
      req.params = {};

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Bad Request' });
    });
  });

  describe('GET/POST requests (non-OPTIONS)', () => {
    it('should allow all origins for info endpoint', async () => {
      req.path = '/api/chat/chatbot-123/info';
      req.headers = { origin: 'https://example.com' };
      req.method = 'GET';

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
      expect(next).toHaveBeenCalled();
    });

    it('should allow admin frontend origin for non-info endpoints', async () => {
      req.method = 'POST';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce(null);

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(next).toHaveBeenCalled();
    });

    it('should deny when origin is not in allowed list for non-info endpoint (admin frontend is auto-added)', async () => {
      req.method = 'POST';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://example.com' };
      // No origins configured - admin frontend will be auto-added, but example.com won't be allowed
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {},
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CORS origin not allowed',
        message: 'Origin "https://example.com" is not in the allowed origins list. Please add it in the API block settings.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow when origin is in allowed list', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://allowed.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['https://allowed.com'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://allowed.com');
      expect(next).toHaveBeenCalled();
    });

    it('should deny when origin is not in allowed list', async () => {
      req.method = 'POST';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://disallowed.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['https://allowed.com'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CORS origin not allowed',
        message: 'Origin "https://disallowed.com" is not in the allowed origins list. Please add it in the API block settings.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow when wildcard is in allowed origins', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://any-origin.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['*'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://any-origin.com');
      expect(next).toHaveBeenCalled();
    });

    it('should call next() if no origin header', async () => {
      req.headers = {};
      req.method = 'GET';

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('should call next() if no chatbotId and no origin', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = {};
      req.params = {};

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getAllowedOrigins function behavior', () => {
    it('should add admin frontend origin when not present', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['https://other.com'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      // Should allow admin frontend even if not in configured list
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(next).toHaveBeenCalled();
    });

    it('should not add admin frontend when wildcard is present', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://example.com' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: {
          allowedOrigins: ['*'],
        },
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(next).toHaveBeenCalled();
    });

    it('should fallback to admin frontend on error fetching origins', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockRejectedValueOnce(new Error('Database error'));

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      // Should still allow admin frontend on error
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(next).toHaveBeenCalled();
    });

    it('should handle API block with null properties', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce({
        properties: null,
      });

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing API block', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce(null);

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://admin.citadelai.app');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('CORS headers', () => {
    it('should set all required CORS headers', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/info';
      req.headers = { origin: 'https://example.com' };

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Timezone');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
    });

    it('should use default maxAge for non-info endpoints', async () => {
      req.method = 'GET';
      req.path = '/api/chat/chatbot-123/chat';
      req.headers = { origin: 'https://admin.citadelai.app' };
      (mockPrisma.block.findFirst as vi.Mock).mockResolvedValueOnce(null);

      await corsApiMiddleware(req as CorsApiRequest, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
    });
  });
});
