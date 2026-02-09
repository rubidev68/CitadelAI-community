import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { mockPrisma } from './setup';

export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    ...overrides,
  };
};

export const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    write: vi.fn().mockReturnThis(),
    writeHead: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    headersSent: false,
  };
  return res;
};

export const createMockAuthRequest = (user?: { id: string; email: string }): AuthRequest => {
  return {
    ...createMockRequest(),
    user,
  } as AuthRequest;
};

// Import vi from vitest
import { vi } from 'vitest';

export const createMockNext = () => vi.fn();

export const resetPrismaMocks = () => {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function') {
          method.mockReset();
        }
      });
    }
  });
};

export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  password: 'hashed-password',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  defaultChatbotId: null,
  ...overrides,
});

export const createMockChatSession = (overrides: Partial<any> = {}) => ({
  id: 'session-123',
  userId: 'user-123',
  chatbotId: 'chatbot-123',
  title: 'New Chat',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockChatMessage = (overrides: Partial<any> = {}) => ({
  id: 'message-123',
  chatSessionId: 'session-123',
  role: 'USER',
  content: 'Test message',
  createdAt: new Date(),
  ...overrides,
});

export const createMockChatbot = (overrides: Partial<any> = {}) => ({
  id: 'chatbot-123',
  name: 'Test Chatbot',
  status: 'ACTIVE',
  ownerId: 'admin-123',
  createdAt: new Date(),
  updatedAt: new Date(),
  blocks: [],
  connections: [],
  ...overrides,
});

export const createMockBlock = (overrides: Partial<any> = {}) => ({
  id: 'block-123',
  chatbotId: 'chatbot-123',
  type: 'LOGIC',
  subtype: 'System Prompt',
  title: 'System Prompt',
  position: {},
  properties: {
    botName: 'Test Bot',
    companyName: 'Test Company',
    behavior: 'helpful',
  },
  ...overrides,
});

export const createMockChatbotAccess = (overrides: Partial<any> = {}) => ({
  id: 'access-123',
  chatbotId: 'chatbot-123',
  userId: 'user-123',
  userEmail: 'test@example.com',
  assignedAt: new Date(),
  chatbot: createMockChatbot(),
  ...overrides,
});
