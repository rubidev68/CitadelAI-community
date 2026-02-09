import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminAuthMiddleware, AdminAuthRequest } from '../../middleware/adminAuth';
import { createMockRequest, createMockResponse, createMockNext } from '../helpers';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: {
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

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

describe('Admin Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate admin user with valid token', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token',
      },
    }) as AdminAuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    const decoded = { id: 'admin-123', email: 'admin@example.com' };
    const mockAdmin = {
      id: 'admin-123',
      email: 'admin@example.com',
      password: 'hashed-password',
      name: 'Admin User',
      role: 'ARCHITECT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    interface MockJwtVerify {
      mockReturnValue: (value: unknown) => void;
      mockImplementation: (fn: () => unknown) => void;
    }
    (jwt.verify as unknown as MockJwtVerify).mockReturnValue(decoded);
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdmin);

    await adminAuthMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
    expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'admin-123' },
    });
    expect(req.adminUser).toEqual({ id: 'admin-123', email: 'admin@example.com' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if no token is provided', async () => {
    const req = createMockRequest() as AdminAuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    await adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer invalid-token',
      },
    }) as AdminAuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    interface MockJwtVerify {
      mockImplementation: (fn: () => unknown) => void;
    }
    (jwt.verify as unknown as MockJwtVerify).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(req.adminUser).toBeUndefined();
  });

  it('should return 401 if admin user does not exist', async () => {
    const req = createMockRequest({
      headers: {
        authorization: 'Bearer valid-token',
      },
    }) as AdminAuthRequest;
    const res = createMockResponse() as Response;
    const next = createMockNext() as NextFunction;

    const decoded = { id: 'admin-123', email: 'admin@example.com' };

    interface MockJwtVerify {
      mockReturnValue: (value: unknown) => void;
      mockImplementation: (fn: () => unknown) => void;
    }
    (jwt.verify as unknown as MockJwtVerify).mockReturnValue(decoded);
    mockPrisma.adminUser.findUnique.mockResolvedValue(null);

    await adminAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(req.adminUser).toBeUndefined();
  });
});
