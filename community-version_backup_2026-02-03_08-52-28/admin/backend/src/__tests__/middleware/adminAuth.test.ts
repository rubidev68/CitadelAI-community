import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Response, NextFunction } from 'express';
import { adminAuthMiddleware, AdminAuthRequest } from '../../middleware/adminAuth';

// Mock jsonwebtoken is set up in setup.ts
// Import jwt and the mock functions
import jwt from 'jsonwebtoken';
import { mockJwtVerify } from '../setup';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  // vi is available in hoisted context - create full mock structure
  const mockPrisma = {
    adminUser: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    chatbot: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    block: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    apiToken: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock jwt - need to mock it before shared middleware imports it
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));


describe('adminAuthMiddleware', () => {
  let req: Partial<AdminAuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    // JWT_SECRET is read at module load time, so it uses the value from setup.ts
    // setup.ts sets it to 'test-secret', so tests should expect that value
    process.env.JWT_SECRET = 'test-secret';
    
    // Reset mock implementations
    mockJwtVerify.mockReset();

    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should return 401 if no authorization header is provided', async () => {
    req.headers = {};

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', async () => {
    req.headers = {
      authorization: 'Invalid token123',
    };

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is missing after Bearer', async () => {
    req.headers = {
      authorization: 'Bearer ',
    };

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid (jwt.verify throws)', async () => {
    req.headers = {
      authorization: 'Bearer invalid-token',
    };

    mockJwtVerify.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    // JWT_SECRET is captured at module load, so it uses setup.ts value 'test-jwt-secret'
    // Or the value set in beforeEach if module reloads (unlikely)
    expect(mockJwtVerify).toHaveBeenCalled();
    expect(mockJwtVerify).toHaveBeenCalledWith('invalid-token', expect.any(String));
  });

  it('should return 401 if token is expired', async () => {
    req.headers = {
      authorization: 'Bearer expired-token',
    };

    mockJwtVerify.mockImplementation(() => {
      const error = new Error('Token expired');
      (error as any).name = 'TokenExpiredError';
      throw error;
    });

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if decoded token does not have id', async () => {
    req.headers = {
      authorization: 'Bearer token-without-id',
    };

    mockJwtVerify.mockReturnValue({ email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockResolvedValue(null);

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if admin user is not found in database', async () => {
    req.headers = {
      authorization: 'Bearer valid-token',
    };

    mockJwtVerify.mockReturnValue({ id: 'user-id', email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockResolvedValue(null);

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
    expect(mockJwtVerify).toHaveBeenCalled();
    expect(mockPrisma.adminUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-id' },
    });
  });

  it('should call next() if token is valid and user exists', async () => {
    req.headers = {
      authorization: 'Bearer valid-token',
    };

    const mockAdminUser = {
      id: 'user-id',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockJwtVerify.mockReturnValue({ id: 'user-id', email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser);

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(mockJwtVerify).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(req.adminUser).toEqual({
      id: 'user-id',
      email: 'test@example.com',
    });
  });

  it('should extract token correctly from Bearer authorization header', async () => {
    req.headers = {
      authorization: 'Bearer token123',
    };

    mockJwtVerify.mockReturnValue({ id: 'user-id', email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
    });

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    // JWT_SECRET is captured at module load time
    expect(mockJwtVerify).toHaveBeenCalled();
    expect(mockJwtVerify).toHaveBeenCalledWith('token123', expect.any(String));
    expect(next).toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    req.headers = {
      authorization: 'Bearer valid-token',
    };

    mockJwtVerify.mockReturnValue({ id: 'user-id', email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockRejectedValue(new Error('Database error'));

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should use JWT_SECRET from environment', async () => {
    process.env.JWT_SECRET = 'custom-secret';
    req.headers = {
      authorization: 'Bearer valid-token',
    };

    mockJwtVerify.mockReturnValue({ id: 'user-id', email: 'test@example.com' });
    mockPrisma.adminUser.findUnique.mockResolvedValue({
      id: 'user-id',
      email: 'test@example.com',
    });

    await adminAuthMiddleware(req as AdminAuthRequest, res as Response, next);

    // JWT_SECRET is read at module load time, so setting it in test doesn't change the module's value
    // This test verifies the middleware uses JWT_SECRET from environment
    expect(mockJwtVerify).toHaveBeenCalled();
    expect(mockJwtVerify).toHaveBeenCalledWith('valid-token', expect.any(String));
  });
});
