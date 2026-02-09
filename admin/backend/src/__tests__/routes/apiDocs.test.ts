import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiDocsRouter from '../../routes/apiDocs';

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    chatbot: {
      findUnique: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

const app = express();
app.use('/', apiDocsRouter);

describe('API Docs Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api-docs/:chatbotId', () => {
    it('should return HTML documentation for a chatbot', async () => {
      const mockChatbot = {
        id: 'chatbot-123',
        name: 'Test Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get('/api-docs/chatbot-123')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('Test Chatbot');
      expect(response.text).toContain('chatbot-123');
      expect(response.text).toContain('/api/chat/chatbot-123');
      expect(response.text).toContain('API Documentation');
    });

    it('should include correct API base URL in documentation', async () => {
      const mockChatbot = {
        id: 'chatbot-456',
        name: 'Another Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get('/api-docs/chatbot-456')
        .set('host', 'example.com')
        .expect(200);

      expect(response.text).toContain('/api/chat/chatbot-456');
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api-docs/non-existent')
        .expect(404);

      expect(response.text).toBe('Chatbot not found');
    });

    it('should return 500 on database error', async () => {
      mockPrisma.chatbot.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api-docs/chatbot-123')
        .expect(500);

      expect(response.text).toBe('Error generating documentation');
    });

    it('should include all required sections in HTML', async () => {
      const mockChatbot = {
        id: 'chatbot-789',
        name: 'Full Test Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get('/api-docs/chatbot-789')
        .expect(200);

      const html = response.text;
      
      // Check for key sections
      expect(html).toContain('Getting Started');
      expect(html).toContain('Authentication');
      expect(html).toContain('Endpoints');
      expect(html).toContain('Send Message');
      expect(html).toContain('Stream Message');
      expect(html).toContain('Health Check');
      expect(html).toContain('Chatbot Info');
      expect(html).toContain('Code Examples');
      expect(html).toContain('Error Handling');
      expect(html).toContain('Token Management');
      expect(html).toContain('Session Management');
    });

    it('should include JavaScript, Python, and cURL examples', async () => {
      const mockChatbot = {
        id: 'chatbot-examples',
        name: 'Examples Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get('/api-docs/chatbot-examples')
        .expect(200);

      const html = response.text;
      
      expect(html).toContain('JavaScript (Fetch API)');
      expect(html).toContain('Python (Requests)');
      expect(html).toContain('cURL');
      expect(html).toContain('fetch');
      expect(html).toContain('requests');
      expect(html).toContain('curl');
    });

    it('should include error status codes table', async () => {
      const mockChatbot = {
        id: 'chatbot-errors',
        name: 'Errors Chatbot',
        status: 'ACTIVE',
      };

      mockPrisma.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const response = await request(app)
        .get('/api-docs/chatbot-errors')
        .expect(200);

      const html = response.text;
      
      expect(html).toContain('401');
      expect(html).toContain('403');
      expect(html).toContain('404');
      expect(html).toContain('429');
      expect(html).toContain('500');
      expect(html).toContain('Unauthorized');
      expect(html).toContain('Forbidden');
      expect(html).toContain('Not Found');
    });
  });
});
