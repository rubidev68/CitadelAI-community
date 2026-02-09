import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { createMockRequest, createMockResponse, createMockNext, createMockUser } from '../helpers';

// Mock jsonwebtoken is set up in setup.ts
// Import jwt and the mock functions
import jwt from 'jsonwebtoken';
import { mockJwtVerify } from '../setup';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
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

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate user with valid token', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token',
      },
    }) as AuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    const decoded = { userId: 'user-123', email: 'test@example.com' };
    const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });

    mockJwtVerify.mockReturnValue(decoded);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    await authMiddleware(req, res, next);

    expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
    });
    expect(req.user).toEqual({ id: 'user-123', email: 'test@example.com' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is provided', async () => {
    const req = createMockRequest() as AuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer invalid-token',
      },
    }) as AuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    mockJwtVerify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should return 401 if user does not exist', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token',
      },
    }) as AuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    const decoded = { userId: 'user-123', email: 'test@example.com' };

    mockJwtVerify.mockReturnValue(decoded);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  it('should handle database errors', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token',
      },
    }) as AuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    const decoded = { userId: 'user-123', email: 'test@example.com' };

    mockJwtVerify.mockReturnValue(decoded);
    mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });
});
