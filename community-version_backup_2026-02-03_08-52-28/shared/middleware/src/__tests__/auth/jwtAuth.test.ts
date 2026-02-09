import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createJwtAuthMiddleware } from '../../auth/jwtAuth';
import type { JwtAuthConfig } from '../../auth/types';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

// Mock logger
const mockLogger = {
  error: vi.fn(),
};

// Mock Prisma
const createMockPrisma = () => ({
  adminUser: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
});

describe('createJwtAuthMiddleware', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let config: JwtAuthConfig;
  let req: { headers?: { authorization?: string }; [key: string]: unknown };
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    
    config = {
      prisma: mockPrisma as any,
      jwtSecret: 'test-secret',
      model: 'user',
      requestProperty: 'user',
      logger: mockLogger,
    };

    req = {
      headers: {},
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn() as unknown as NextFunction;
  });

  describe('User authentication', () => {
    it('should authenticate user with valid token', async () => {
      const decoded = { userId: 'user-123', email: 'test@example.com' };
      (jwt.verify as any).mockReturnValue(decoded);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      });

      req.headers = { authorization: 'Bearer valid-token' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect((req as any).user).toEqual({ id: 'user-123', email: 'test@example.com' });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without authorization header', async () => {
      req.headers = {};

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token format', async () => {
      req.headers = { authorization: 'InvalidFormat' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid JWT token', async () => {
      (jwt.verify as any).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      req.headers = { authorization: 'Bearer invalid-token' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockLogger.error).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request when user not found in database', async () => {
      const decoded = { userId: 'user-123', email: 'test@example.com' };
      (jwt.verify as any).mockReturnValue(decoded);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      req.headers = { authorization: 'Bearer valid-token' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockLogger.error).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Admin authentication', () => {
    beforeEach(() => {
      config.model = 'adminUser';
      config.requestProperty = 'adminUser';
    });

    it('should authenticate admin with valid token', async () => {
      const decoded = { id: 'admin-123', email: 'admin@example.com' };
      (jwt.verify as any).mockReturnValue(decoded);
      mockPrisma.adminUser.findUnique.mockResolvedValue({
        id: 'admin-123',
        email: 'admin@example.com',
      });

      req.headers = { authorization: 'Bearer valid-token' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
        where: { id: 'admin-123' },
      });
      expect((req as any).adminUser).toEqual({ id: 'admin-123', email: 'admin@example.com' });
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const decoded = { userId: 'user-123', email: 'test@example.com' };
      (jwt.verify as any).mockReturnValue(decoded);
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      req.headers = { authorization: 'Bearer valid-token' };

      const middleware = createJwtAuthMiddleware(config);
      await middleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error if JWT_SECRET is missing', () => {
      config.jwtSecret = '';

      expect(() => createJwtAuthMiddleware(config)).toThrow('JWT_SECRET is required');
    });
  });
});
