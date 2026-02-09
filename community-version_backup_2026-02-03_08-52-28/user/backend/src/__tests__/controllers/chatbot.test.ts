import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { getChatbots, setDefaultChatbot, getChatbotById } from '../../controllers/chatbot';
import { createMockAuthRequest, createMockResponse, createMockUser, createMockChatbot, createMockChatbotAccess } from '../helpers';

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
    chatbotAccess: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
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

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

describe('Chatbot Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChatbots', () => {
    it('should return chatbots for authenticated user', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      const mockChatbot = createMockChatbot();
      const mockAccess = createMockChatbotAccess({
        userId: mockUser.id,
        chatbot: mockChatbot,
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.chatbotAccess.findMany.mockResolvedValue([mockAccess]);

      await getChatbots(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(mockPrisma.chatbotAccess.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
        },
        include: {
          chatbot: {
            include: {
              blocks: true,
              connections: true,
            },
          },
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        chatbots: [mockChatbot],
        defaultChatbotId: mockUser.defaultChatbotId,
      });
    });

    it('should return 401 if user is not authenticated', async () => {
      const req = createMockAuthRequest();
      const res = createMockResponse() as Response;

      await getChatbots(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should return 401 if user does not exist', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getChatbots(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    });

    it('should handle errors gracefully', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await getChatbots(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    });
  });

  describe('setDefaultChatbot', () => {
    it('should set default chatbot for authenticated user', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { chatbotId: 'chatbot-123' };
      const res = createMockResponse() as Response;

      const mockAccess = createMockChatbotAccess({
        userId: mockUser.id,
        chatbotId: 'chatbot-123',
      });

      mockPrisma.chatbotAccess.findFirst.mockResolvedValue(mockAccess);
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        defaultChatbotId: 'chatbot-123',
      });

      await setDefaultChatbot(req, res);

      expect(mockPrisma.chatbotAccess.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          chatbotId: 'chatbot-123',
        },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
        },
        data: {
          defaultChatbotId: 'chatbot-123',
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Default chatbot updated successfully',
      });
    });

    it('should return 403 if user does not have access to chatbot', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { chatbotId: 'chatbot-123' };
      const res = createMockResponse() as Response;

      mockPrisma.chatbotAccess.findFirst.mockResolvedValue(null);

      await setDefaultChatbot(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getChatbotById', () => {
    it('should return chatbot if user has access', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'chatbot-123' };
      const res = createMockResponse() as Response;

      const mockChatbot = createMockChatbot({ id: 'chatbot-123' });
      const mockAccess = createMockChatbotAccess({
        userId: mockUser.id,
        chatbotId: 'chatbot-123',
      });

      mockPrisma.chatbotAccess.findFirst.mockResolvedValue(mockAccess);
      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      await getChatbotById(req, res);

      expect(mockPrisma.chatbotAccess.findFirst).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          chatbotId: 'chatbot-123',
        },
      });
      expect(mockPrisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'chatbot-123',
        },
        include: {
          blocks: true,
          connections: true,
        },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockChatbot);
    });

    it('should return 403 if user does not have access', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'chatbot-123' };
      const res = createMockResponse() as Response;

      mockPrisma.chatbotAccess.findFirst.mockResolvedValue(null);

      await getChatbotById(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    });

    it('should return 404 if chatbot not found', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'chatbot-123' };
      const res = createMockResponse() as Response;

      const mockAccess = createMockChatbotAccess({
        userId: mockUser.id,
        chatbotId: 'chatbot-123',
      });

      mockPrisma.chatbotAccess.findFirst.mockResolvedValue(mockAccess);
      mockPrisma.chatbot.findUnique.mockResolvedValue(null);

      await getChatbotById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Chatbot not found' });
    });
  });
});
