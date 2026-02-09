import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for dependencies used by chatAnsweringService
const {
  mockCreateLLMService,
  mockLlmGenerateResponse,
  mockGenerateSystemPrompt,
  mockGenerateFollowUps,
  mockGetContextFromWeaviate,
  mockExecuteDbBlocksForChatbot,
  mockCanSendMessage,
  mockTrackAICall,
  mockFormatCitations,
  mockPrisma,
  mockLogger,
  // New module mocks
  mockGetOrCreateSession,
  mockSaveAssistantMessage,
  mockRetrieveAllContexts,
  mockCombineContexts,
  mockBuildSystemPrompt,
  mockGenerateStreamingResponse,
  mockGenerateNonStreamingResponse,
} = vi.hoisted(() => {
  const mockLlmGenerateResponse = vi.fn();
  const mockCreateLLMService = vi.fn(() => ({
    generateResponse: mockLlmGenerateResponse,
    generateStreamingResponse: vi.fn(),
  }));

  const mockGenerateSystemPrompt = vi.fn(() => 'SYSTEM_PROMPT');
  const mockGenerateFollowUps = vi.fn(async () => [
    { id: 'fu-1', text: 'Follow-up 1', icon: '💬' },
  ]);

  const mockGetContextFromWeaviate = vi.fn(async () => ({
    context: 'CTX',
    sources: [{ type: 'website', url: 'https://example.com', title: 'Example' }],
  }));

  const mockExecuteDbBlocksForChatbot = vi.fn(async () => []);

  const mockCanSendMessage = vi.fn(async () => ({
    allowed: true,
    message: '',
    code: undefined,
    currentCount: 0,
    maxAllowed: 100,
    remaining: 100,
  }));
  const mockTrackAICall = vi.fn(async () => {});

  const mockFormatCitations = vi.fn(() => 'CITATIONS');

  const mockPrisma = {
    block: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
    },
    chatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    chatSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userOAuthConnection: {
      findUnique: vi.fn(),
    },
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // New module mocks
  const mockGetOrCreateSession = vi.fn(async (userId, sessionId, chatbotId, message, providedHistory) => ({
    sessionId: sessionId || '',
    chatbotId: chatbotId || 'cb-1',
    history: providedHistory || [],
    chatSession: null,
  }));

  const mockSaveAssistantMessage = vi.fn(async () => {});

  const mockRetrieveAllContexts = vi.fn(async () => ({
    weaviateContext: 'CTX',
    cloudContext: '',
    dbContext: '',
    calendarContext: '',
    sources: [{ type: 'website', url: 'https://example.com', title: 'Example' }],
    authRequirements: [],
    availableCalendarEvents: [],
  }));

  const mockCombineContexts = vi.fn((weaviate, db, cloud, calendar) => {
    return [weaviate, db, cloud, calendar].filter(Boolean).join('\n\n');
  });

  const mockBuildSystemPrompt = vi.fn(() => 'SYSTEM_PROMPT');

  const mockGenerateStreamingResponse = vi.fn(async () => 'STREAMING_RESPONSE');
  const mockGenerateNonStreamingResponse = vi.fn(async () => 'LLM_RESPONSE');

  return {
    mockCreateLLMService,
    mockLlmGenerateResponse,
    mockGenerateSystemPrompt,
    mockGenerateFollowUps,
    mockGetContextFromWeaviate,
    mockExecuteDbBlocksForChatbot,
    mockCanSendMessage,
    mockTrackAICall,
    mockFormatCitations,
    mockPrisma,
    mockLogger,
    mockGetOrCreateSession,
    mockSaveAssistantMessage,
    mockRetrieveAllContexts,
    mockCombineContexts,
    mockBuildSystemPrompt,
    mockGenerateStreamingResponse,
    mockGenerateNonStreamingResponse,
  };
});

vi.mock('../../services/llmService', () => ({
  createLLMService: (...args: unknown[]) => mockCreateLLMService(...args),
  LLMProvider: {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    MISTRAL: 'mistral',
  },
}));

vi.mock('../../utils/systemPromptGenerator', () => ({
  generateSystemPrompt: (...args: unknown[]) => mockGenerateSystemPrompt(...args),
}));

vi.mock('../../services/followUpGenerator', () => ({
  generateFollowUps: (...args: unknown[]) => mockGenerateFollowUps(...args),
}));

vi.mock('../../services/contextRetrievalService', () => ({
  getContextFromWeaviate: (...args: unknown[]) => mockGetContextFromWeaviate(...args),
}));

vi.mock('../../services/dbBlockHelper', () => ({
  executeDbBlocksForChatbot: (...args: unknown[]) => mockExecuteDbBlocksForChatbot(...args),
}));

vi.mock('../../utils/aiCallTracking', () => ({
  canSendMessage: (...args: unknown[]) => mockCanSendMessage(...args),
  trackAICall: (...args: unknown[]) => mockTrackAICall(...args),
}));

vi.mock('../../services/outputFormatters/chatFormatter', () => ({
  formatCitations: (...args: unknown[]) => mockFormatCitations(...args),
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

// Mock new extracted modules
vi.mock('../../services/chat/sessionManager', () => ({
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
  saveAssistantMessage: (...args: unknown[]) => mockSaveAssistantMessage(...args),
}));

vi.mock('../../services/chat/contextRetrieval', () => ({
  retrieveAllContexts: (...args: unknown[]) => mockRetrieveAllContexts(...args),
}));

vi.mock('../../services/chat/promptGeneration/contextCombiner', () => ({
  combineContexts: (...args: unknown[]) => mockCombineContexts(...args),
}));

vi.mock('../../services/chat/promptGeneration/systemPromptBuilder', () => ({
  buildSystemPrompt: (...args: unknown[]) => mockBuildSystemPrompt(...args),
}));

vi.mock('../../services/chat/responseGeneration/streamingHandler', () => ({
  generateStreamingResponse: (...args: unknown[]) => mockGenerateStreamingResponse(...args),
}));

vi.mock('../../services/chat/responseGeneration/nonStreamingHandler', () => ({
  generateNonStreamingResponse: (...args: unknown[]) => mockGenerateNonStreamingResponse(...args),
}));

describe('chatAnsweringService - generateChatAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns non-streaming answer with context and follow-ups (in-memory session)', async () => {
    const { generateChatAnswer } = await import('../../services/chatAnsweringService');

    const history = [
      {
        id: 'm1',
        chatSessionId: 's1',
        role: 'USER',
        content: 'Hi',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    ];

    mockLlmGenerateResponse.mockResolvedValue('LLM_RESPONSE');

    const result = await generateChatAnswer({
      message: 'Hello there',
      chatbotId: 'cb-1',
      history,
      useInMemorySession: true,
      includeMermaidDiagrams: true,
    });

    expect(result).toBeDefined();
    if (!result) return;

    // Verify new module calls
    expect(mockGetOrCreateSession).toHaveBeenCalled();
    expect(mockRetrieveAllContexts).toHaveBeenCalled();
    expect(mockCombineContexts).toHaveBeenCalled();
    expect(mockBuildSystemPrompt).toHaveBeenCalled();
    expect(mockGenerateNonStreamingResponse).toHaveBeenCalledWith(
      'cb-1',
      'SYSTEM_PROMPT',
      history,
      'Hello there',
      'CTX', // combinedContext from mockCombineContexts
      'gemini',
      'gemini-2.5-flash',
      undefined, // customProviderConfig (optional parameter)
    );

    expect(result.response).toBe('LLM_RESPONSE');
    expect(result.sources).toEqual([
      { type: 'website', url: 'https://example.com', title: 'Example' },
    ]);
    expect(result.followUps).toEqual([
      { id: 'fu-1', text: 'Follow-up 1', icon: '💬' },
    ]);
    expect(result.sessionId).toBe('');
    expect(result.metadata).toEqual({
      chatbotId: 'cb-1',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
  });

  it('wraps and rethrows LLM errors in non-streaming mode', async () => {
    const { generateChatAnswer } = await import('../../services/chatAnsweringService');

    const error = new Error('LLM failed');
    mockGenerateNonStreamingResponse.mockRejectedValue(error);

    await expect(
      generateChatAnswer({
        message: 'Hello there',
        chatbotId: 'cb-1',
        useInMemorySession: true,
      }),
    ).rejects.toThrow('LLM failed');

    // Error handler should be called (via handleStreamError)
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

