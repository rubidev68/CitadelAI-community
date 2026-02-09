import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for weaviate client and logger
const {
  mockWeaviateClient,
  mockSchemaGetterDo,
  mockClassGetterWithClassName,
  mockClassGetterDo,
  mockClassCreatorWithClass,
  mockClassCreatorDo,
  mockClassDeleterWithClassName,
  mockClassDeleterDo,
  mockLogger,
} = vi.hoisted(() => {
  const mockSchemaGetterDo = vi.fn();
  const mockClassGetterWithClassName = vi.fn().mockReturnThis();
  const mockClassGetterDo = vi.fn();
  const mockClassCreatorWithClass = vi.fn().mockReturnThis();
  const mockClassCreatorDo = vi.fn();
  const mockClassDeleterWithClassName = vi.fn().mockReturnThis();
  const mockClassDeleterDo = vi.fn();

  const mockWeaviateClient = {
    schema: {
      getter: () => ({
        do: mockSchemaGetterDo,
      }),
      classGetter: () => ({
        withClassName: mockClassGetterWithClassName,
        do: mockClassGetterDo,
      }),
      classCreator: () => ({
        withClass: mockClassCreatorWithClass,
        do: mockClassCreatorDo,
      }),
      classDeleter: () => ({
        withClassName: mockClassDeleterWithClassName,
        do: mockClassDeleterDo,
      }),
    },
  };

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    mockWeaviateClient,
    mockSchemaGetterDo,
    mockClassGetterWithClassName,
    mockClassGetterDo,
    mockClassCreatorWithClass,
    mockClassCreatorDo,
    mockClassDeleterWithClassName,
    mockClassDeleterDo,
    mockLogger,
  };
});

vi.mock('weaviate-ts-client', () => {
  const defaultExport = {
    client: vi.fn(() => mockWeaviateClient),
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

describe('updateWeaviateSchemasForRAG', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'development' };
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = ORIGINAL_ENV;
  });

  it('logs and returns when client is not available (NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { updateWeaviateSchemasForRAG } = await import(
      '../../services/updateWeaviateSchemas'
    );

    await updateWeaviateSchemasForRAG();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Weaviate client not available, skipping schema update',
      expect.objectContaining({ service: 'updateWeaviateSchemas' }),
    );
  });

  it('creates WebsiteContent and DocumentContent schemas when none exist', async () => {
    vi.resetModules();
    const { updateWeaviateSchemasForRAG } = await import(
      '../../services/updateWeaviateSchemas'
    );

    mockSchemaGetterDo.mockResolvedValue({
      classes: [],
    });
    mockClassCreatorDo.mockResolvedValue({});
    mockClassGetterDo.mockResolvedValue({}); // not used when not existing

    await updateWeaviateSchemasForRAG();

    // WebsiteContent + DocumentContent classCreator calls
    expect(mockClassCreatorWithClass).toHaveBeenCalledTimes(2);
    const firstConfig = mockClassCreatorWithClass.mock.calls[0][0];
    const secondConfig = mockClassCreatorWithClass.mock.calls[1][0];
    expect(firstConfig.class).toBe('WebsiteContent');
    expect(secondConfig.class).toBe('DocumentContent');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Weaviate schemas are configured for RAG',
      expect.objectContaining({ service: 'updateWeaviateSchemas' }),
    );
  });

  it('logs info and skips WebsiteContent recreation when already using text2vec-openai', async () => {
    vi.resetModules();
    const { updateWeaviateSchemasForRAG } = await import(
      '../../services/updateWeaviateSchemas'
    );

    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [{ class: 'WebsiteContent' }],
    });
    mockClassGetterDo.mockResolvedValueOnce({
      vectorizer: 'text2vec-openai',
    });
    // For DocumentContent: treat as non-existent to keep test simple
    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [],
    });
    mockClassCreatorDo.mockResolvedValue({});

    await updateWeaviateSchemasForRAG();

    expect(mockLogger.info).toHaveBeenCalledWith(
      'WebsiteContent schema already has text2vec-openai vectorizer configured',
      expect.objectContaining({ service: 'updateWeaviateSchemas' }),
    );
    // Should not attempt deletion
    expect(mockClassDeleterWithClassName).not.toHaveBeenCalledWith(
      'WebsiteContent',
    );
  });

  it('recreates WebsiteContent schema when vectorizer differs and ALLOW_WEAVIATE_SCHEMA_RECREATION=true', async () => {
    process.env.ALLOW_WEAVIATE_SCHEMA_RECREATION = 'true';
    vi.resetModules();
    const { updateWeaviateSchemasForRAG } = await import(
      '../../services/updateWeaviateSchemas'
    );

    // WebsiteContent exists with wrong vectorizer
    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [{ class: 'WebsiteContent' }],
    });
    mockClassGetterDo.mockResolvedValueOnce({
      vectorizer: 'none',
    });
    mockClassDeleterDo.mockResolvedValue({});

    // DocumentContent does not exist
    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [],
    });
    mockClassCreatorDo.mockResolvedValue({});

    await updateWeaviateSchemasForRAG();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'WebsiteContent schema exists but vectorizer is not text2vec-openai',
      expect.objectContaining({
        currentVectorizer: 'none',
        service: 'updateWeaviateSchemas',
      }),
    );
    expect(mockClassDeleterWithClassName).toHaveBeenCalledWith('WebsiteContent');
    expect(mockClassCreatorWithClass).toHaveBeenCalledWith(
      expect.objectContaining({ class: 'WebsiteContent' }),
    );
  });

  it('logs guidance when WebsiteContent vectorizer differs and recreation not allowed', async () => {
    process.env.ALLOW_WEAVIATE_SCHEMA_RECREATION = 'false';
    vi.resetModules();
    const { updateWeaviateSchemasForRAG } = await import(
      '../../services/updateWeaviateSchemas'
    );

    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [{ class: 'WebsiteContent' }],
    });
    mockClassGetterDo.mockResolvedValueOnce({
      vectorizer: 'none',
    });

    // For DocumentContent, pretend it already exists with correct vectorizer to keep focus on WebsiteContent path
    mockSchemaGetterDo.mockResolvedValueOnce({
      classes: [{ class: 'DocumentContent' }],
    });
    mockClassGetterDo.mockResolvedValueOnce({
      vectorizer: 'text2vec-openai',
    });

    await updateWeaviateSchemasForRAG();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Cannot update vectorizer without recreating schema (would delete data)',
      expect.objectContaining({ service: 'updateWeaviateSchemas' }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'To enable RAG automatically: Set ALLOW_WEAVIATE_SCHEMA_RECREATION=true',
      expect.objectContaining({ service: 'updateWeaviateSchemas' }),
    );
  });
});

