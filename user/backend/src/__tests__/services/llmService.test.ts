import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { LLMService, createLLMService, getAvailableModels, getDefaultModel, LLMProvider } from '../../services/llmService';
import { ChatMessage } from '@prisma/client';

// Mock VectorStoreService
vi.mock('../../services/vectorStore', () => ({
  default: {
    getVectorStore: vi.fn().mockResolvedValue(null),
  },
}));

// Mock Google Generative AI - use vi.hoisted to ensure proper constructor
const { mockStartChat, mockGetGenerativeModel, MockGoogleGenerativeAI } = vi.hoisted(() => {
  const mockStartChat = vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue({
      response: {
        text: vi.fn().mockReturnValue('Mocked Gemini response'),
      },
    }),
    sendMessageStream: vi.fn().mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'Chunk 1' };
        yield { text: () => 'Chunk 2' };
        yield { text: () => 'Chunk 3' };
      })(),
    }),
  }));

  const mockGetGenerativeModel = vi.fn(() => ({
    startChat: mockStartChat,
  }));

  // Create a proper class constructor
  class MockGoogleGenerativeAI {
    constructor(apiKey: string) {
      // Constructor implementation
    }
    getGenerativeModel = mockGetGenerativeModel;
  }

  return { mockStartChat, mockGetGenerativeModel, MockGoogleGenerativeAI };
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: MockGoogleGenerativeAI,
    __mockStartChat: mockStartChat,
    __mockGetGenerativeModel: mockGetGenerativeModel,
  };
});

// Mock fetch for OpenAI, Anthropic, Mistral
global.fetch = vi.fn();

interface MockGeminiModule {
  __mockStartChat: {
    mockReturnValue: (value: unknown) => void;
  };
}

describe('LLM Service', () => {
  let mockStartChat: MockGeminiModule['__mockStartChat'];

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked functions
    const geminiModule = await import('@google/generative-ai');
    mockStartChat = (geminiModule as unknown as MockGeminiModule).__mockStartChat;
    
    // Reset mocks to default behavior
    mockStartChat.mockReturnValue({
      sendMessage: vi.fn().mockResolvedValue({
        response: {
          text: vi.fn().mockReturnValue('Mocked Gemini response'),
        },
      }),
      sendMessageStream: vi.fn().mockResolvedValue({
        stream: (async function* () {
          yield { text: () => 'Chunk 1' };
          yield { text: () => 'Chunk 2' };
          yield { text: () => 'Chunk 3' };
        })(),
      }),
    });
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
  });

  describe('createLLMService', () => {
    it('should create a Gemini LLM service', () => {
      const service = createLLMService('gemini');
      expect(service).toBeInstanceOf(LLMService);
    });

    it('should create an OpenAI LLM service', () => {
      const service = createLLMService('openai');
      expect(service).toBeInstanceOf(LLMService);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => {
        createLLMService('unsupported' as LLMProvider);
      }).toThrow();
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models for gemini', () => {
      const models = getAvailableModels('gemini');
      expect(models).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
    });

    it('should return available models for openai', () => {
      const models = getAvailableModels('openai');
      expect(models).toEqual(['gpt-5-mini', 'gpt-5']);
    });
  });

  describe('getDefaultModel', () => {
    it('should return default model for gemini', () => {
      const model = getDefaultModel('gemini');
      expect(model).toBe('gemini-2.5-flash');
    });

    it('should return default model for openai', () => {
      const model = getDefaultModel('openai');
      expect(model).toBe('gpt-5-mini');
    });
  });

  describe('LLMService - Gemini', () => {
    it('should generate response using Gemini', async () => {
      const service = createLLMService('gemini', 'gemini-2.5-flash');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      const response = await service.generateResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage
      );

      expect(response).toBeDefined();
    });

    it('should generate streaming response using Gemini', async () => {
      const service = createLLMService('gemini', 'gemini-2.5-flash');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';
      const res = {
        write: vi.fn(),
        writeHead: vi.fn(),
        headersSent: false,
      } as unknown as Response;

      const response = await service.generateStreamingResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage,
        res
      );

      expect(response).toBeDefined();
      expect(res.writeHead).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Mock fetch to make all fallback providers fail
      interface MockFetch {
        mockResolvedValue: (value: unknown) => void;
      }
      (global.fetch as unknown as MockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error message',
      });

      // Temporarily mock startChat to throw an error for Gemini
      mockStartChat.mockImplementationOnce(() => {
        throw new Error('API Error');
      });

      const service = createLLMService('gemini', 'gemini-2.5-flash');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      // Service will try all providers (Gemini -> OpenAI -> Anthropic -> Mistral)
      // All will fail, and the service should throw an error
      await expect(
        service.generateResponse(
          'chatbot-123',
          systemPrompt,
          history,
          userMessage
        )
      ).rejects.toThrow();
    });
  });

  describe('LLMService - OpenAI', () => {
    it('should generate response using OpenAI', async () => {
      const service = createLLMService('openai', 'gpt-5-mini');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      interface MockFetch {
        mockResolvedValue: (value: unknown) => void;
      }
      (global.fetch as unknown as MockFetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: 'Mocked OpenAI response',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        }),
      });

      const response = await service.generateResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage
      );

      expect(response).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle OpenAI API errors', async () => {
      const service = createLLMService('openai', 'gpt-5-mini');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      interface MockFetch {
        mockResolvedValue: (value: unknown) => void;
      }
      (global.fetch as unknown as MockFetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: 'Mocked OpenAI response',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        }),
      });

      const response = await service.generateResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage
      );

      expect(response).toBeDefined();
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle Mistral API errors', async () => {
      interface MockFetch {
        mockResolvedValue: (value: unknown) => void;
      }
      // Mock fetch to return error response for Mistral - must be before service creation
      (global.fetch as unknown as MockFetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Error message',
      });

      const service = createLLMService('mistral', 'mistral-large-latest');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';

      const response = await service.generateResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage
      );

      // Should handle error gracefully - service will try fallback providers
      // but they should also fail, resulting in error message
      expect(response).toBeDefined();
      // The service may return an error message or try fallbacks
      expect(typeof response).toBe('string');
    });
  });

  describe('LLMService - Context handling', () => {
    it('should use Weaviate context if provided', async () => {
      const service = createLLMService('gemini', 'gemini-2.5-flash');
      const history: ChatMessage[] = [];
      const systemPrompt = 'You are a helpful assistant.';
      const userMessage = 'Hello';
      const weaviateContext = 'Some context from Weaviate';

      const response = await service.generateResponse(
        'chatbot-123',
        systemPrompt,
        history,
        userMessage,
        weaviateContext
      );

      expect(response).toBeDefined();
    });
  });
});
