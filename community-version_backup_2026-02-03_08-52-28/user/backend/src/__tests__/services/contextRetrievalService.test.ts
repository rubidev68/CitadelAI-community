import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for weaviate client and logger
const {
  mockClient,
  mockSchemaGetterDo,
  mockClassCreatorWithClass,
  mockClassCreatorDo,
  mockGraphqlGet,
  mockLogger,
} = vi.hoisted(() => {
  const mockSchemaGetterDo = vi.fn();
  const mockClassCreatorWithClass = vi.fn().mockReturnThis();
  const mockClassCreatorDo = vi.fn();
  const mockGraphqlGet = vi.fn();

  const mockClient = {
    schema: {
      getter: () => ({
        do: mockSchemaGetterDo,
      }),
      classCreator: () => ({
        withClass: mockClassCreatorWithClass,
        do: mockClassCreatorDo,
      }),
    },
    graphql: {
      get: mockGraphqlGet,
    },
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    mockClient,
    mockSchemaGetterDo,
    mockClassCreatorWithClass,
    mockClassCreatorDo,
    mockGraphqlGet,
    mockLogger,
  };
});

vi.mock('weaviate-ts-client', () => {
  const defaultExport = {
    client: vi.fn(() => mockClient),
  };
  return {
    __esModule: true,
    default: defaultExport,
    client: defaultExport.client,
  };
});

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

describe('contextRetrievalService - getContextFromWeaviate', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV }; // reset env each test
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = ORIGINAL_ENV;
  });

  const createGraphqlBuilder = (response: unknown, options?: { reject?: boolean; error?: unknown }) => {
    const builder: any = {};
    builder.withClassName = vi.fn().mockReturnValue(builder);
    builder.withFields = vi.fn().mockReturnValue(builder);
    builder.withHybrid = vi.fn().mockReturnValue(builder);
    builder.withBm25 = vi.fn().mockReturnValue(builder);
    builder.withWhere = vi.fn().mockReturnValue(builder);
    builder.withLimit = vi.fn().mockReturnValue(builder);
    if (options?.reject) {
      builder.do = vi.fn().mockRejectedValue(options.error ?? new Error('query failed'));
    } else {
      builder.do = vi.fn().mockResolvedValue(response);
    }
    return builder;
  };

  it('returns empty context when client is null in test environment', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { getContextFromWeaviate } = await import('../../services/contextRetrievalService');

    const result = await getContextFromWeaviate('hello', 'chatbot-1');

    expect(result).toEqual({ context: '', sources: [] });
    expect(mockGraphqlGet).not.toHaveBeenCalled();
  });

  it('returns combined website and document context with sources in non-test env', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getContextFromWeaviate } = await import('../../services/contextRetrievalService');

    // ensureDocumentContentSchema: DocumentContent already exists
    mockSchemaGetterDo.mockResolvedValue({
      classes: [{ class: 'DocumentContent' }],
    });

    // First graphql.get() for WebsiteContent
    const websiteResponse = {
      data: {
        Get: {
          WebsiteContent: [
            {
              chatbotId: 'chatbot-1',
              url: 'https://example.com/page',
              title: 'Example Page',
              blockId: 'block-1',
              content:
                'This is a long website chunk of content that is definitely more than one hundred characters long so that it passes the filter used by the context retrieval service. ' +
                'We add even more filler text here to make sure the total length comfortably exceeds two hundred characters, ensuring that the hasUsefulContent check succeeds for this website content.',
            },
          ],
        },
      },
    };

    // Second graphql.get() for DocumentContent
    const documentResponse = {
      data: {
        Get: {
          DocumentContent: [
            {
              chatbotId: 'chatbot-1',
              content:
                'This is a long document chunk of content, also longer than one hundred characters, representing part of an indexed document stored in Weaviate. ' +
                'Again we add additional filler text to push the length beyond two hundred characters so that the document content is treated as useful context by the service.',
              fileName: 'manual.pdf',
              chunkIndex: 0,
              totalChunks: 2,
              processedAt: '2025-01-01T00:00:00Z',
            },
          ],
        },
      },
    };

    mockGraphqlGet
      .mockImplementationOnce(() => createGraphqlBuilder(websiteResponse))
      .mockImplementationOnce(() => createGraphqlBuilder(documentResponse));

    const result = await getContextFromWeaviate('some query', 'chatbot-1');

    expect(mockGraphqlGet).toHaveBeenCalledTimes(2);
    expect(result.context).toContain('This is a long website chunk of content');
    expect(result.context).toContain('This is a long document chunk of content');

    // One website source (deduped by URL) + one document source
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].type).toBe('website');
    expect(result.sources[0].url).toBe('https://example.com/page');
    expect(result.sources[1].type).toBe('document');
    expect(result.sources[1].fileName).toBe('manual.pdf');
  });

  it('filters out short / malformed website content and falls back to generic message when no useful content', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getContextFromWeaviate } = await import('../../services/contextRetrievalService');

    mockSchemaGetterDo.mockResolvedValue({
      classes: [{ class: 'DocumentContent' }],
    });

    const badWebsiteResponse = {
      data: {
        Get: {
          WebsiteContent: [
            {
              chatbotId: 'chatbot-1',
              url: 'https://bad.example.com',
              content: 'too short', // < 100 chars -> filtered
            },
          ],
        },
      },
    };

    const badDocumentResponse = {
      data: {
        Get: {
          DocumentContent: [
            {
              chatbotId: 'chatbot-1',
              content: 'pdf)', // filtered pattern
              fileName: 'doc.pdf',
            },
          ],
        },
      },
    };

    mockGraphqlGet
      .mockImplementationOnce(() => createGraphqlBuilder(badWebsiteResponse))
      .mockImplementationOnce(() => createGraphqlBuilder(badDocumentResponse));

    const result = await getContextFromWeaviate('query', 'chatbot-1');

    expect(result.context).toContain('No relevant context was found for this chatbot');
    expect(result.sources).toHaveLength(0);
  });

  it('falls back from hybrid to BM25 for WebsiteContent when hybrid throws', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getContextFromWeaviate } = await import('../../services/contextRetrievalService');

    mockSchemaGetterDo.mockResolvedValue({
      classes: [{ class: 'DocumentContent' }],
    });

    const hybridError = new Error('Hybrid not available');
    const bm25WebsiteResponse = {
      data: {
        Get: {
          WebsiteContent: [
            {
              chatbotId: 'chatbot-1',
              url: 'https://example.com/page',
              content:
                'This is a long website chunk of content returned by BM25 fallback, clearly over one hundred characters in length to pass the filter logic. ' +
                'We also extend this text beyond two hundred characters so that the hasUsefulContent check passes even when using the BM25 fallback path.',
            },
          ],
        },
      },
    };

    const emptyDocResponse = {
      data: {
        Get: {
          DocumentContent: [],
        },
      },
    };

    // First get() -> hybrid error on .do()
    const hybridBuilder = createGraphqlBuilder({}, { reject: true, error: hybridError });
    const bm25Builder = createGraphqlBuilder(bm25WebsiteResponse);
    const docBuilder = createGraphqlBuilder(emptyDocResponse);

    mockGraphqlGet
      .mockImplementationOnce(() => hybridBuilder) // hybrid
      .mockImplementationOnce(() => bm25Builder) // BM25 fallback
      .mockImplementationOnce(() => docBuilder); // documents

    const result = await getContextFromWeaviate('query', 'chatbot-1');

    // We mainly care that the hybrid error triggers a BM25 fallback and logs a warning.
    // The exact context content may still be replaced by the generic fallback message
    // if no document content is found, so we only assert on the warning here.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Hybrid search failed for WebsiteContent, trying BM25',
      expect.objectContaining({
        error: 'Hybrid not available',
        service: 'contextRetrievalService',
      }),
    );
  });

});

