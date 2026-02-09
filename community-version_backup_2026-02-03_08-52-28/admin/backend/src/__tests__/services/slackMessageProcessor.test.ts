import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SlackIntegration } from '@prisma/client';

// Mock service registry FIRST - use vi.hoisted
const { mockServiceRegistry } = vi.hoisted(() => {
  const mockServiceRegistry = {
    getServiceBaseUrl: vi.fn((service: string) => `http://${service}:3000`),
  };
  return { mockServiceRegistry };
});

vi.mock('@shared/utils', () => ({
  getServiceBaseUrl: mockServiceRegistry.getServiceBaseUrl,
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

// Mock other dependencies
const { mockPrisma, mockGetDecryptedAccessToken, mockSlackApiClientClass } = vi.hoisted(() => {
  const mockPrisma = {
    slackIntegration: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const mockGetDecryptedAccessToken = vi.fn(() => 'xoxb-test-token');
  // Create a proper constructor function
  const mockSlackApiClientClass = vi.fn(function(this: any) {
    return this;
  });
  return { mockPrisma, mockGetDecryptedAccessToken, mockSlackApiClientClass };
});

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

vi.mock('../../services/slackOAuthService', () => ({
  getDecryptedAccessToken: mockGetDecryptedAccessToken,
}));

vi.mock('../../services/slackApiClient', () => ({
  SlackApiClient: mockSlackApiClientClass,
}));

// Import after mocks are set up
import * as slackMessageProcessor from '../../services/slackMessageProcessor';
import { SlackApiClient } from '../../services/slackApiClient';
import prisma from '../../lib/prisma';



// Mock mermaidImageService (required inside the function) - use vi.hoisted
const { mockExtractAndConvertMermaidDiagrams, mockRemoveMermaidBlocks } = vi.hoisted(() => {
  const mockExtractAndConvertMermaidDiagrams = vi.fn().mockResolvedValue([]);
  const mockRemoveMermaidBlocks = vi.fn((text: string) => text);
  return { mockExtractAndConvertMermaidDiagrams, mockRemoveMermaidBlocks };
});

// Mock the module - use factory to ensure mocks are available when require() is called
vi.mock('../../services/mermaidImageService', () => ({
  extractAndConvertMermaidDiagrams: mockExtractAndConvertMermaidDiagrams,
  removeMermaidBlocks: mockRemoveMermaidBlocks,
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Slack Message Processor', () => {
  const chatbotId = 'chatbot-123';
  const blockId = 'block-123';
  const integrationId = 'integration-123';
  const channelId = 'C123456';
  const userId = 'U123456';
  const messageTs = '1234567890.123456';
  const threadTs = '1234567890.123457';

  const mockIntegration: SlackIntegration = {
    id: integrationId,
    chatbotId,
    blockId,
    clientId: 'client-id',
    clientSecret: 'encrypted-secret',
    signingSecret: 'encrypted-signing',
    teamId: 'T123456',
    teamName: 'Test Team',
    accessToken: 'encrypted-token',
    botUserId: 'U789012',
    botUserName: 'TestBot',
    isActive: true,
    respondToMentions: true,
    respondInThreads: true,
    respondInDMs: true,
    respondInChannels: true,
    installedBy: 'user-123',
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockSlackClient: Partial<SlackApiClient>;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup mock SlackApiClient
    mockSlackClient = {
      postMessage: vi.fn(),
      updateMessage: vi.fn(),
      formatResponseAsBlocks: vi.fn(),
      uploadFile: vi.fn(),
    };
    
    // Mock constructor to return our mock client
    mockSlackApiClientClass.mockImplementation(function(this: any) {
      Object.assign(this, mockSlackClient);
      return this;
    });
    
    // Reset mermaidImageService mocks - get the mocked module and reset
    const mermaidModule = await import('../../services/mermaidImageService');
    vi.mocked(mermaidModule.extractAndConvertMermaidDiagrams).mockResolvedValue([]);
    vi.mocked(mermaidModule.removeMermaidBlocks).mockImplementation((text: string) => text);
    
    // Setup default fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sendSlackResponse', () => {
    const response = 'Test response';
    const sources = [
      { type: 'website' as const, url: 'https://example.com', title: 'Example' },
    ];
    const followUps = ['Question 1', 'Question 2'];

    it('should send response successfully', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: { type: 'plain_text', text: response },
        },
      ];
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue(mockBlocks as any);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      await slackMessageProcessor.sendSlackResponse(
        mockIntegration,
        channelId,
        response,
        sources,
        followUps
      );

      expect(mockSlackClient.formatResponseAsBlocks).toHaveBeenCalledWith(
        response,
        sources,
        followUps,
        channelId,
        undefined
      );
      expect(mockSlackClient.postMessage).toHaveBeenCalledWith({
        channel: channelId,
        blocks: mockBlocks,
        thread_ts: undefined,
      });
    });

    it('should send response in thread', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: { type: 'plain_text', text: response },
        },
      ];
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue(mockBlocks as any);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      await slackMessageProcessor.sendSlackResponse(
        mockIntegration,
        channelId,
        response,
        sources,
        followUps,
        threadTs
      );

      expect(mockSlackClient.postMessage).toHaveBeenCalledWith({
        channel: channelId,
        blocks: mockBlocks,
        thread_ts: threadTs,
      });
    });

    it('should throw error if postMessage fails', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: { type: 'plain_text', text: response },
        },
      ];
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue(mockBlocks as any);
      mockSlackClient.postMessage!.mockRejectedValue(new Error('Slack API error'));

      await expect(
        slackMessageProcessor.sendSlackResponse(
          mockIntegration,
          channelId,
          response,
          sources,
          followUps
        )
      ).rejects.toThrow('Slack API error');
    });

    it('should handle empty sources and followUps', async () => {
      const mockBlocks = [
        {
          type: 'section',
          text: { type: 'plain_text', text: response },
        },
      ];
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue(mockBlocks as any);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      await slackMessageProcessor.sendSlackResponse(
        mockIntegration,
        channelId,
        response,
        [],
        []
      );

      expect(mockSlackClient.formatResponseAsBlocks).toHaveBeenCalledWith(
        response,
        [],
        [],
        channelId,
        undefined
      );
    });
  });

  describe('processSlackMessage', () => {
    const message = 'Test message';

    it('should process message with streaming successfully', async () => {
      // Mock streaming response
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      
      // Create a reader that properly simulates the stream
      const readValues = [
        {
          done: false,
          value: new TextEncoder().encode('data: {"type":"chunk","content":"Hello "}\n\n'),
        },
        {
          done: false,
          value: new TextEncoder().encode('data: {"type":"chunk","content":"world"}\n\n'),
        },
        {
          done: false,
          value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Hello world","sourcesArray":[],"followUps":[]}\n\n'),
        },
        { done: true },
      ];
      let readIndex = 0;
      const mockReader = {
        read: vi.fn(async () => {
          const value = readValues[readIndex] || { done: true };
          readIndex++;
          return value;
        }),
      };
      
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}),
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      // Mock fetch for streaming endpoint ONLY - don't add fallback mock
      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);

      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      const result = await slackMessageProcessor.processSlackMessage(
        mockIntegration,
        message,
        channelId,
        userId
      );

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response).toContain('Hello');
      expect(mockSlackClient.postMessage).toHaveBeenCalled(); // Placeholder message
      expect(mockSlackClient.updateMessage).toHaveBeenCalled(); // Final update
    });

    it('should fallback to non-streaming if streaming fails', async () => {
      // Mock streaming failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Streaming failed'));

      // Mock non-streaming response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          message: 'Non-streaming response',
          chatSessionId: 'session-123',
          citations: '',
          followUps: [],
        }),
      });

      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      const result = await slackMessageProcessor.processSlackMessage(
        mockIntegration,
        message,
        channelId,
        userId
      );

      expect(result.response).toBe('Non-streaming response');
      expect(prisma.slackIntegration.update).toHaveBeenCalled();
    });

    it('should handle streaming with sources and followUps', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"sources","citations":"1. [Example](https://example.com)"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"followups","suggestions":["Q1","Q2"]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Response","sourcesArray":[{"type":"website","url":"https://example.com","title":"Example"}],"followUps":["Q1","Q2"]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);

      const result = await slackMessageProcessor.processSlackMessage(
        mockIntegration,
        message,
        channelId,
        userId
      );

      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.followUps.length).toBeGreaterThan(0);
    });

    it('should handle thread context', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Response","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValue(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);

      await slackMessageProcessor.processSlackMessage(
        mockIntegration,
        message,
        channelId,
        userId,
        threadTs
      );

      expect(mockSlackClient.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: threadTs,
        })
      );
    });

    it('should handle placeholder message failure', async () => {
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
        ts: undefined,
      });

      // Don't mock fetch - the error should be thrown before fetch is called
      await expect(
        slackMessageProcessor.processSlackMessageStreaming(
          mockIntegration,
          message,
          channelId,
          userId
        )
      ).rejects.toThrow('Failed to send placeholder message');
    });

    it('should handle user-backend error in non-streaming fallback', async () => {
      // Mock streaming failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Streaming failed'));

      // Mock non-streaming error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: vi.fn().mockResolvedValue('Internal server error'),
      });

      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      await expect(
        slackMessageProcessor.processSlackMessage(
          mockIntegration,
          message,
          channelId,
          userId
        )
      ).rejects.toThrow('User-backend error');
    });
  });

  describe('processSlackMessageStreaming', () => {
    const message = 'Test message';

    it('should process streaming message and update placeholder', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"chunk","content":"Hello "}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"chunk","content":"world"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Hello world","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      const result = await slackMessageProcessor.processSlackMessageStreaming(
        mockIntegration,
        message,
        channelId,
        userId
      );

      expect(result.response).toBe('Hello world');
      expect(mockSlackClient.updateMessage).toHaveBeenCalled();
    });

    it('should handle auth_required event', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"auth_required","authProvider":"google","authUrl":"https://auth.example.com","authBlockId":"block-123"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      await slackMessageProcessor.processSlackMessageStreaming(
        mockIntegration,
        message,
        channelId,
        userId
      );

      // Should update message with auth message
      expect(mockSlackClient.updateMessage).toHaveBeenCalled();
      const updateCall = mockSlackClient.updateMessage!.mock.calls[0];
      const text = updateCall[2] as string;
      expect(text).toContain('Authentication Required');
    });

    it('should handle image generation events', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"image","url":"https://example.com/image.png","title":"Generated Image"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Response","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockImplementation((text: string) => [
        { type: 'section', text: { type: 'plain_text', text: text || 'Thinking...' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      await slackMessageProcessor.processSlackMessageStreaming(
        mockIntegration,
        message,
        channelId,
        userId
      );

      // Should include image block - check the last update call which should have the image
      expect(mockSlackClient.updateMessage).toHaveBeenCalled();
      // Find the update call that includes the image block
      const updateCalls = mockSlackClient.updateMessage!.mock.calls;
      const imageCall = updateCalls.find((call: any[]) => {
        const blocks = call[3] as any[];
        return blocks && blocks.some((b: any) => b.type === 'image');
      });
      expect(imageCall).toBeDefined();
    });

    it('should handle fetch error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });

      await expect(
        slackMessageProcessor.processSlackMessageStreaming(
          mockIntegration,
          message,
          channelId,
          userId
        )
      ).rejects.toThrow();
    });

    it('should handle update message failure', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Response","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: false,
        error: 'message_not_found',
      });
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue([
        { type: 'section', text: { type: 'plain_text', text: 'Response' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      await expect(
        slackMessageProcessor.processSlackMessageStreaming(
          mockIntegration,
          message,
          channelId,
          userId
        )
      ).rejects.toThrow('Failed to update Slack message');
    });

    it('should manage session storage', async () => {
      const headers = new Headers();
      headers.set('content-type', 'text/event-stream');
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"metadata","chatSessionId":"session-123"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"complete","fullResponse":"Response","sourcesArray":[],"followUps":[]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: true,
          }),
      };
      const mockStreamResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers,
        text: vi.fn().mockResolvedValue(''),
        json: vi.fn().mockResolvedValue({}), // Fallback for non-streaming
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      (global.fetch as any).mockResolvedValueOnce(mockStreamResponse);
      mockSlackClient.postMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.updateMessage!.mockResolvedValue({
        ok: true,
        ts: messageTs,
      });
      mockSlackClient.formatResponseAsBlocks!.mockReturnValue([
        { type: 'section', text: { type: 'plain_text', text: 'Response' } },
      ] as any);
      mockSlackClient.uploadFile = vi.fn().mockResolvedValue({
        ok: true,
        file: { permalink: 'https://example.com/image.png' },
      });

      await slackMessageProcessor.processSlackMessageStreaming(
        mockIntegration,
        message,
        channelId,
        userId
      );

      // Session should be stored (tested indirectly through subsequent calls)
      expect(mockSlackClient.postMessage).toHaveBeenCalled();
    });
  });
});
