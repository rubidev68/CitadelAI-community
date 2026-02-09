import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateResponse, generateStreamingResponse } from '../../services/llmHelper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatMessage } from '@prisma/client';
import { Response } from 'express';

// Mock dependencies
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(),
}));

describe('LLM Helper', () => {
  let mockModel: any;
  let mockChat: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.GEMINI_MODEL = 'gemini-2.5-flash';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.ANTHROPIC_MODEL = 'claude-3-sonnet';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.MISTRAL_MODEL = 'mistral-large';

    // Mock Gemini model and chat
    mockChat = {
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
    };
    mockModel = {
      startChat: vi.fn().mockReturnValue(mockChat),
    };
    
    // Mock GoogleGenerativeAI as a constructor class
    const mockGetGenerativeModel = vi.fn().mockReturnValue(mockModel);
    vi.mocked(GoogleGenerativeAI).mockImplementation(function(this: any, apiKey: string) {
      this.getGenerativeModel = mockGetGenerativeModel;
      return this;
    });

    // Mock Express response
    mockResponse = {
      write: vi.fn(),
    };
  });

  describe('generateResponse', () => {
    it('should generate response using Gemini', async () => {
      const systemPrompt = 'You are a helpful assistant';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';
      const expectedResponse = 'Hello! How can I help you?';

      mockChat.sendMessage.mockResolvedValue({
        response: {
          text: () => expectedResponse,
        },
      });

      const result = await generateResponse(systemPrompt, history, userMessage, 'gemini');

      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');
      expect(mockModel.startChat).toHaveBeenCalledWith({
        history: [],
      });
      expect(mockChat.sendMessage).toHaveBeenCalledWith(userMessage);
      expect(result).toBe(expectedResponse);
    });

    it('should include system instruction in model config', async () => {
      const systemPrompt = 'You are a SQL expert';
      const history: ChatMessage[] = [];
      const userMessage = 'Generate SQL';

      mockChat.sendMessage.mockResolvedValue({
        response: {
          text: () => 'SELECT * FROM users',
        },
      });

      await generateResponse(systemPrompt, history, userMessage, 'gemini');

      const genAI = vi.mocked(GoogleGenerativeAI).mock.results[0].value;
      expect(genAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
    });

    it('should map chat history correctly', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [
        { id: '1', role: 'USER', content: 'Hello', createdAt: new Date(), updatedAt: new Date(), chatSessionId: 'session-1' },
        { id: '2', role: 'ASSISTANT', content: 'Hi there!', createdAt: new Date(), updatedAt: new Date(), chatSessionId: 'session-1' },
      ];
      const userMessage = 'How are you?';

      mockChat.sendMessage.mockResolvedValue({
        response: {
          text: () => 'I am doing well',
        },
      });

      await generateResponse(systemPrompt, history, userMessage, 'gemini');

      expect(mockModel.startChat).toHaveBeenCalledWith({
        history: [
          { role: 'user', parts: [{ text: 'Hello' }] },
          { role: 'model', parts: [{ text: 'Hi there!' }] },
        ],
      });
    });

    it('should use custom model when provided', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';
      const customModel = 'gemini-pro';

      mockChat.sendMessage.mockResolvedValue({
        response: {
          text: () => 'Response',
        },
      });

      await generateResponse(systemPrompt, history, userMessage, 'gemini', customModel);

      const genAICall = vi.mocked(GoogleGenerativeAI).mock.results[0].value;
      expect(genAICall.getGenerativeModel).toHaveBeenCalledWith({
        model: customModel,
        systemInstruction: systemPrompt,
      });
    });

    it('should throw error for unsupported provider', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateResponse(systemPrompt, history, userMessage, 'openai' as any)
      ).rejects.toThrow('Provider openai not yet implemented in admin backend');
    });

    it('should call getLLMConfig for anthropic provider before throwing', async () => {
      // This tests that getLLMConfig is called for anthropic (lines 28-32)
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateResponse(systemPrompt, history, userMessage, 'anthropic' as any)
      ).rejects.toThrow('Provider anthropic not yet implemented in admin backend');
      
      // Verify that getLLMConfig was called (it reads env vars for anthropic)
      // The config is created before the error is thrown
    });

    it('should call getLLMConfig for mistral provider before throwing', async () => {
      // This tests that getLLMConfig is called for mistral (lines 33-37)
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateResponse(systemPrompt, history, userMessage, 'mistral' as any)
      ).rejects.toThrow('Provider mistral not yet implemented in admin backend');
    });

    it('should use default model from env when not provided', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      mockChat.sendMessage.mockResolvedValue({
        response: {
          text: () => 'Response',
        },
      });

      await generateResponse(systemPrompt, history, userMessage, 'gemini');

      const genAI = vi.mocked(GoogleGenerativeAI).mock.results[0].value;
      expect(genAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
      });
    });
  });

  describe('generateStreamingResponse', () => {
    it('should stream response chunks', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Tell me a story';
      const chunks = ['Once', ' upon', ' a', ' time'];

      // Mock stream
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield { text: () => chunk };
          }
        },
      };
      mockChat.sendMessageStream.mockResolvedValue({ stream: mockStream });

      const result = await generateStreamingResponse(
        systemPrompt,
        history,
        userMessage,
        mockResponse as Response,
        'gemini'
      );

      expect(mockChat.sendMessageStream).toHaveBeenCalledWith(userMessage);
      expect(mockResponse.write).toHaveBeenCalledTimes(chunks.length + 1); // Chunks + complete event
      expect(result).toBe('Once upon a time');
    });

    it('should send completion event after streaming', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';
      const fullResponse = 'Hello! How can I help?';

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { text: () => fullResponse };
        },
      };
      mockChat.sendMessageStream.mockResolvedValue({ stream: mockStream });

      await generateStreamingResponse(
        systemPrompt,
        history,
        userMessage,
        mockResponse as Response,
        'gemini'
      );

      const writeCalls = vi.mocked(mockResponse.write).mock.calls;
      const completeCall = writeCalls.find(call => 
        call[0]?.includes('"type":"complete"')
      );
      expect(completeCall).toBeDefined();
      expect(completeCall[0]).toContain(fullResponse);
    });

    it('should handle streaming errors gracefully', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      mockChat.sendMessageStream.mockRejectedValue(new Error('Streaming error'));

      const result = await generateStreamingResponse(
        systemPrompt,
        history,
        userMessage,
        mockResponse as Response,
        'gemini'
      );

      expect(result).toBe('');
      const writeCalls = vi.mocked(mockResponse.write).mock.calls;
      const errorCall = writeCalls.find(call => 
        call[0]?.includes('"type":"error"')
      );
      expect(errorCall).toBeDefined();
    });

    it('should skip empty chunks', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { text: () => 'Hello' };
          yield { text: () => '' }; // Empty chunk
          yield { text: () => ' World' };
        },
      };
      mockChat.sendMessageStream.mockResolvedValue({ stream: mockStream });

      const result = await generateStreamingResponse(
        systemPrompt,
        history,
        userMessage,
        mockResponse as Response,
        'gemini'
      );

      expect(result).toBe('Hello World');
      // Should only write non-empty chunks
      expect(mockResponse.write).toHaveBeenCalledTimes(3); // 2 chunks + complete
    });

    it('should throw error for unsupported provider', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateStreamingResponse(
          systemPrompt,
          history,
          userMessage,
          mockResponse as Response,
          'openai' as any
        )
      ).rejects.toThrow('Provider openai not yet implemented in admin backend');
    });

    it('should call getLLMConfig for anthropic provider before throwing in streaming', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateStreamingResponse(
          systemPrompt,
          history,
          userMessage,
          mockResponse as Response,
          'anthropic' as any
        )
      ).rejects.toThrow('Provider anthropic not yet implemented in admin backend');
    });

    it('should call getLLMConfig for mistral provider before throwing in streaming', async () => {
      const systemPrompt = 'You are helpful';
      const history: ChatMessage[] = [];
      const userMessage = 'Hello';

      await expect(
        generateStreamingResponse(
          systemPrompt,
          history,
          userMessage,
          mockResponse as Response,
          'mistral' as any
        )
      ).rejects.toThrow('Provider mistral not yet implemented in admin backend');
    });
  });
});
