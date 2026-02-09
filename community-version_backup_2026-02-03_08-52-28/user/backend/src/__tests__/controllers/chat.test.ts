import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { respond, getHistory, getChatSessions, createChatSession, generateTitle, deleteChatSession } from '../../controllers/chat';
import { createMockAuthRequest, createMockResponse, createMockUser, createMockChatSession, createMockChatMessage, createMockBlock } from '../helpers';

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
    chatSession: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    chatMessage: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    block: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aICall: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
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

// Mock LLM service
vi.mock('../../services/llmService', () => ({
  createLLMService: vi.fn(() => ({
    generateResponse: vi.fn().mockResolvedValue('Mocked LLM response'),
    generateStreamingResponse: vi.fn().mockResolvedValue('Mocked streaming response'),
  })),
  LLMProvider: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    MISTRAL: 'mistral',
  },
}));

// Mock followUpGenerator
vi.mock('../../services/followUpGenerator', () => ({
  generateFollowUps: vi.fn().mockResolvedValue([
    { id: '1', text: 'Follow up 1', icon: 'HelpCircle' },
    { id: '2', text: 'Follow up 2', icon: 'Lightbulb' },
    { id: '3', text: 'Follow up 3', icon: 'Search' },
  ]),
}));

// Mock systemPromptGenerator
vi.mock('../../utils/systemPromptGenerator', () => ({
  generateSystemPrompt: vi.fn().mockReturnValue('Mocked system prompt'),
}));

describe('Chat Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('respond', () => {
    it('should create a new chat session and respond to message', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.body = { message: 'Hello', chatSessionId: null };
      const res = createMockResponse() as Response;

      const mockChatSession = createMockChatSession({ userId: mockUser.id });
      const mockSystemPromptBlock = createMockBlock({ subtype: 'System Prompt' });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.chatSession.findUnique.mockResolvedValue(null);
      mockPrisma.chatSession.create.mockResolvedValue(mockChatSession);
      mockPrisma.chatMessage.create.mockResolvedValue(createMockChatMessage());
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.block.findFirst.mockResolvedValue(mockSystemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([]);

      await respond(req, res);

      expect(mockPrisma.chatSession.create).toHaveBeenCalled();
      expect(mockPrisma.chatMessage.create).toHaveBeenCalledTimes(2); // User message + Assistant response
      expect(res.json).toHaveBeenCalled();
    });

    it('should use existing chat session if provided', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.body = { message: 'Hello', chatSessionId: 'session-123' };
      const res = createMockResponse() as Response;

      const mockChatSession = createMockChatSession({ id: 'session-123', userId: mockUser.id });
      const mockSystemPromptBlock = createMockBlock({ subtype: 'System Prompt' });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.chatSession.findUnique.mockResolvedValue(mockChatSession);
      mockPrisma.chatMessage.create.mockResolvedValue(createMockChatMessage());
      mockPrisma.chatMessage.findMany.mockResolvedValue([]);
      mockPrisma.block.findFirst.mockResolvedValue(mockSystemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([]);

      await respond(req, res);

      expect(mockPrisma.chatSession.findUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        select: {
          id: true,
          chatbotId: true,
        },
      });
      expect(mockPrisma.chatSession.create).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', async () => {
      const req = createMockAuthRequest();
      req.body = { message: 'Hello' };
      const res = createMockResponse() as Response;

      await respond(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle errors gracefully', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.body = { message: 'Hello' };
      const res = createMockResponse() as Response;

      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database error'));

      await respond(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
    });
  });

  describe('getHistory', () => {
    it('should return chat history for authenticated user', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.query = { sessionId: 'session-123' };
      const res = createMockResponse() as Response;

      const mockMessages = [
        createMockChatMessage({ role: 'USER', content: 'Hello' }),
        createMockChatMessage({ role: 'ASSISTANT', content: 'Hi there!' }),
      ];

      mockPrisma.chatMessage.findMany.mockResolvedValue(mockMessages);

      await getHistory(req, res);

      expect(mockPrisma.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          chatSessionId: 'session-123',
          chatSession: {
            userId: mockUser.id,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockMessages);
    });

    it('should return 401 if user is not authenticated', async () => {
      const req = createMockAuthRequest();
      req.query = { sessionId: 'session-123' };
      const res = createMockResponse() as Response;

      await getHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('getChatSessions', () => {
    it('should return all chat sessions for authenticated user', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.query = {};
      const res = createMockResponse() as Response;

      const mockSessions = [
        createMockChatSession({ id: 'session-1', userId: mockUser.id }),
        createMockChatSession({ id: 'session-2', userId: mockUser.id }),
      ];

      mockPrisma.chatSession.findMany.mockResolvedValue(mockSessions);

      await getChatSessions(req, res);

      expect(mockPrisma.chatSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockSessions);
    });

    it('should filter by chatbotId if provided', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.query = { chatbotId: 'chatbot-123' };
      const res = createMockResponse() as Response;

      const mockSessions = [createMockChatSession({ chatbotId: 'chatbot-123' })];

      mockPrisma.chatSession.findMany.mockResolvedValue(mockSessions);

      await getChatSessions(req, res);

      expect(mockPrisma.chatSession.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          chatbotId: 'chatbot-123',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('createChatSession', () => {
    it('should create a new chat session', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.body = { chatbotId: 'chatbot-123' };
      const res = createMockResponse() as Response;

      const mockChatSession = createMockChatSession({
        userId: mockUser.id,
        chatbotId: 'chatbot-123',
      });

      mockPrisma.chatSession.create.mockResolvedValue(mockChatSession);

      await createChatSession(req, res);

      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          chatbotId: 'chatbot-123',
          title: 'New Chat',
        },
      });
      expect(res.json).toHaveBeenCalledWith(mockChatSession);
    });

    it('should use default chatbot if none provided', async () => {
      const mockUser = createMockUser({ defaultChatbotId: 'default-chatbot' });
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.body = {};
      const res = createMockResponse() as Response;

      const mockChatSession = createMockChatSession({
        userId: mockUser.id,
        chatbotId: 'default-chatbot',
      });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.chatSession.create.mockResolvedValue(mockChatSession);

      await createChatSession(req, res);

      expect(mockPrisma.chatSession.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          chatbotId: 'default-chatbot',
          title: 'New Chat',
        },
      });
    });
  });

  describe('generateTitle', () => {
    it('should generate a title for a chat session', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'session-123' };
      const res = createMockResponse() as Response;

      const mockChatSession = {
        ...createMockChatSession({ id: 'session-123', userId: mockUser.id }),
        chatMessages: [
          createMockChatMessage({ content: 'What is the weather?' }),
        ],
      };

      mockPrisma.chatSession.findFirst.mockResolvedValue(mockChatSession);
      mockPrisma.chatSession.update.mockResolvedValue({
        ...mockChatSession,
        title: 'Weather Question',
      });

      await generateTitle(req, res);

      expect(mockPrisma.chatSession.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'session-123',
          userId: mockUser.id,
        },
        include: {
          chatMessages: {
            orderBy: {
              createdAt: 'asc',
            },
            take: 1,
          },
        },
      });
      expect(res.json).toHaveBeenCalled();
    });

    it('should return 404 if chat session not found', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'session-123' };
      const res = createMockResponse() as Response;

      mockPrisma.chatSession.findFirst.mockResolvedValue(null);

      await generateTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Chat session not found or no messages yet',
      });
    });
  });

  describe('deleteChatSession', () => {
    it('should delete a chat session and its messages', async () => {
      const mockUser = createMockUser();
      const req = createMockAuthRequest({ id: mockUser.id, email: mockUser.email });
      req.params = { id: 'session-123' };
      const res = createMockResponse() as Response;

      mockPrisma.chatMessage.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.chatSession.delete.mockResolvedValue(
        createMockChatSession({ id: 'session-123' })
      );

      await deleteChatSession(req, res);

      expect(mockPrisma.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: {
          chatSessionId: 'session-123',
          chatSession: {
            userId: mockUser.id,
          },
        },
      });
      expect(mockPrisma.chatSession.delete).toHaveBeenCalledWith({
        where: {
          id: 'session-123',
          userId: mockUser.id,
        },
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });
  });
});
