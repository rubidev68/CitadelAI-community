import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { register, login, logout, getMe } from '../../controllers/auth';
import { createMockRequest, createMockResponse, createMockAuthRequest, createMockUser } from '../helpers';

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
      deleteMany: vi.fn(),
    },
    chatbotAccess: {
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

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

describe('Auth Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'newuser@example.com',
        name: 'New User',
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.chatbotAccess.findMany.mockResolvedValue([]);
      interface MockBcryptHash {
        mockResolvedValue: (value: unknown) => void;
      }
      interface MockJwtSign {
        mockReturnValue: (value: unknown) => void;
      }
      (bcrypt.hash as unknown as MockBcryptHash).mockResolvedValue('hashed-password');
      (jwt.sign as unknown as MockJwtSign).mockReturnValue('mock-token');

      await register(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'newuser@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        token: 'mock-token',
        user: mockUser,
      });
    });

    it('should return error if user already exists', async () => {
      const req = createMockRequest({
        body: {
          email: 'existing@example.com',
          password: 'password123',
          name: 'Existing User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const existingUser = createMockUser({ email: 'existing@example.com' });
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User already exists' });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should claim pending chatbot accesses on registration', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'newuser@example.com',
        name: 'New User',
      });

      const pendingAccess = {
        id: 'access-123',
        userEmail: 'newuser@example.com',
        userId: null,
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.chatbotAccess.findMany.mockResolvedValue([pendingAccess]);
      mockPrisma.chatbotAccess.update.mockResolvedValue({
        ...pendingAccess,
        userId: mockUser.id,
      });
      interface MockBcryptHash {
        mockResolvedValue: (value: unknown) => void;
      }
      interface MockJwtSign {
        mockReturnValue: (value: unknown) => void;
      }
      (bcrypt.hash as unknown as MockBcryptHash).mockResolvedValue('hashed-password');
      (jwt.sign as unknown as MockJwtSign).mockReturnValue('mock-token');

      await register(req, res);

      expect(mockPrisma.chatbotAccess.findMany).toHaveBeenCalledWith({
        where: {
          userEmail: 'newuser@example.com',
          userId: null,
        },
      });
      expect(mockPrisma.chatbotAccess.update).toHaveBeenCalledWith({
        where: { id: 'access-123' },
        data: { userId: mockUser.id },
      });
    });

    it('should handle errors during registration', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'User already exists' });
    });

    it('should handle missing email in registration', async () => {
      const req = createMockRequest({
        body: {
          password: 'password123',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      // Email is undefined, which will cause findUnique to be called with undefined
      // This tests the error handling path
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Invalid input'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle missing password in registration', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockResolvedValue(null);
      // Password is undefined, bcrypt.hash will fail
      interface MockBcryptHash {
        mockRejectedValue: (value: unknown) => void;
      }
      (bcrypt.hash as unknown as MockBcryptHash).mockRejectedValue(new Error('Invalid password'));

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle multiple pending chatbot accesses', async () => {
      const req = createMockRequest({
        body: {
          email: 'newuser@example.com',
          password: 'password123',
          name: 'New User',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'newuser@example.com',
        name: 'New User',
      });

      const pendingAccesses = [
        { id: 'access-1', userEmail: 'newuser@example.com', userId: null },
        { id: 'access-2', userEmail: 'newuser@example.com', userId: null },
        { id: 'access-3', userEmail: 'newuser@example.com', userId: null },
      ];

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.chatbotAccess.findMany.mockResolvedValue(pendingAccesses);
      mockPrisma.chatbotAccess.update.mockResolvedValue({
        ...pendingAccesses[0],
        userId: mockUser.id,
      });
      interface MockBcryptHash {
        mockResolvedValue: (value: unknown) => void;
      }
      interface MockJwtSign {
        mockReturnValue: (value: unknown) => void;
      }
      (bcrypt.hash as unknown as MockBcryptHash).mockResolvedValue('hashed-password');
      (jwt.sign as unknown as MockJwtSign).mockReturnValue('mock-token');

      await register(req, res);

      expect(mockPrisma.chatbotAccess.update).toHaveBeenCalledTimes(3);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      interface MockBcryptCompare {
        mockResolvedValue: (value: unknown) => void;
      }
      interface MockJwtSign {
        mockReturnValue: (value: unknown) => void;
      }
      (bcrypt.compare as unknown as MockBcryptCompare).mockResolvedValue(true);
      (jwt.sign as unknown as MockJwtSign).mockReturnValue('mock-token');

      await login(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        token: 'mock-token',
        user: mockUser,
      });
    });

    it('should return error for non-existent user', async () => {
      const req = createMockRequest({
        body: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should return error for invalid password', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'wrong-password',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      interface MockBcryptCompare {
        mockResolvedValue: (value: unknown) => void;
      }
      (bcrypt.compare as unknown as MockBcryptCompare).mockResolvedValue(false);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should handle errors during login', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });

    it('should handle missing email in login', async () => {
      const req = createMockRequest({
        body: {
          password: 'password123',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      // Email is undefined, findUnique will be called with undefined
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
    });

    it('should handle missing password in login', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      // Password is undefined, bcrypt.compare will fail
      interface MockBcryptCompare {
        mockRejectedValue: (value: unknown) => void;
      }
      (bcrypt.compare as unknown as MockBcryptCompare).mockRejectedValue(new Error('Invalid password'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle bcrypt comparison errors', async () => {
      const req = createMockRequest({
        body: {
          email: 'test@example.com',
          password: 'password123',
        },
      }) as Request;
      const res = createMockResponse() as Response;

      const mockUser = createMockUser({
        email: 'test@example.com',
        password: 'hashed-password',
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      interface MockBcryptCompare {
        mockRejectedValue: (value: unknown) => void;
      }
      (bcrypt.compare as unknown as MockBcryptCompare).mockRejectedValue(new Error('Bcrypt error'));

      await login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as Response;

      await logout(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    });
  });

  describe('getMe', () => {
    it('should return user information for authenticated user', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      const userData = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      mockPrisma.user.findUnique.mockResolvedValue(userData);

      await getMe(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(res.json).toHaveBeenCalledWith(userData);
    });

    it('should return error if user is not authenticated', async () => {
      const req = createMockAuthRequest();
      const res = createMockResponse() as Response;

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should handle errors during getMe', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await getMe(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });

    it('should handle user not found after authentication', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      // User was authenticated but no longer exists in database
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getMe(req, res);

      // Should return null user data, not an error
      expect(res.json).toHaveBeenCalledWith(null);
    });

    it('should return user without password field', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      const userData = {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      };

      mockPrisma.user.findUnique.mockResolvedValue(userData);

      await getMe(req, res);

      expect(res.json).toHaveBeenCalledWith(userData);
      // Verify password is not included
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ password: expect.anything() })
      );
    });
  });
});
