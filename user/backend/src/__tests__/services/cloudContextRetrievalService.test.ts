import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoisted mocks for dependencies
const {
  mockWeaviateClient,
  mockGraphqlGet,
  mockSchemaGetterDo,
  mockLogger,
  mockPrismaBlockFindUnique,
  mockDecryptToken,
  mockCreateCloudProvider,
  mockProviderGetFileContent,
  mockPdfParse,
} = vi.hoisted(() => {
  const mockSchemaGetterDo = vi.fn();
  const graphqlBuilder: any = {};
  graphqlBuilder.withClassName = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.withFields = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.withHybrid = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.withBm25 = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.withWhere = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.withLimit = vi.fn().mockReturnValue(graphqlBuilder);
  graphqlBuilder.do = vi.fn();

  const mockGraphqlGet = vi.fn(() => graphqlBuilder);

  const mockWeaviateClient = {
    schema: {
      getter: () => ({
        do: mockSchemaGetterDo,
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

  const mockPrismaBlockFindUnique = vi.fn();
  const mockDecryptToken = vi.fn();

  const mockProviderGetFileContent = vi.fn();
  const mockCreateCloudProvider = vi.fn(() => ({
    getFileContent: mockProviderGetFileContent,
  }));

  const mockPdfParse = vi.fn();

  return {
    mockWeaviateClient,
    mockGraphqlGet,
    mockSchemaGetterDo,
    graphqlBuilder,
    mockLogger,
    mockPrismaBlockFindUnique,
    mockDecryptToken,
    mockCreateCloudProvider,
    mockProviderGetFileContent,
    mockPdfParse,
  };
});

// Mock weaviate client (ESM default export)
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

// Mock logger
vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

// Mock prisma
vi.mock('../../lib/prisma', () => ({
  default: {
    block: {
      findUnique: mockPrismaBlockFindUnique,
    },
  },
}));

// Mock tokenEncryption
vi.mock('../../utils/tokenEncryption', () => ({
  decryptToken: mockDecryptToken,
}));

// Mock cloud provider factory
vi.mock('../../services/cloudProviders/providerFactory', () => ({
  createCloudProvider: (...args: unknown[]) => mockCreateCloudProvider(...args),
}));

// Mock pdf-parse (CommonJS require)
vi.mock('pdf-parse', () => mockPdfParse);

describe('cloudContextRetrievalService - getCloudContextFromWeaviate', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = ORIGINAL_ENV;
  });

  it('returns empty context and logs warn when client is null (NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'test';
    vi.resetModules();
    const { getCloudContextFromWeaviate } = await import('../../services/cloudContextRetrievalService');

    const result = await getCloudContextFromWeaviate('query', 'chatbot-1');

    expect(result).toEqual({ context: '', sources: [] });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Weaviate client not initialized, cannot retrieve cloud context',
      expect.objectContaining({ service: 'cloudContextRetrievalService' }),
    );
  });

  it('returns empty context when CloudFileContent schema does not exist', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getCloudContextFromWeaviate } = await import('../../services/cloudContextRetrievalService');

    mockSchemaGetterDo.mockResolvedValue({ classes: [{ class: 'OtherClass' }] });

    const result = await getCloudContextFromWeaviate('query', 'chatbot-1');

    expect(result).toEqual({ context: '', sources: [] });
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'CloudFileContent schema does not exist in Weaviate',
      expect.objectContaining({ service: 'cloudContextRetrievalService' }),
    );
  });

  it('returns empty context when schema check throws', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getCloudContextFromWeaviate } = await import('../../services/cloudContextRetrievalService');

    const schemaError = new Error('schema failed');
    mockSchemaGetterDo.mockRejectedValue(schemaError);

    const result = await getCloudContextFromWeaviate('query', 'chatbot-1');

    expect(result).toEqual({ context: '', sources: [] });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Error checking CloudFileContent schema',
      schemaError,
      expect.objectContaining({ service: 'cloudContextRetrievalService' }),
    );
  });

  it('returns empty context when cloud search fails', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getCloudContextFromWeaviate } = await import('../../services/cloudContextRetrievalService');

    mockSchemaGetterDo.mockResolvedValue({ classes: [{ class: 'CloudFileContent' }] });

    // Make graphql builder .do() reject for hybrid and BM25
    const { graphqlBuilder } = vi.hoisted(() => ({} as any)); // just to satisfy types, real builder already in closure
    // But we already have builder in hoisted scope; access via (mockGraphqlGet as any).mock.results[0]? Simpler: override implementation here:
    (mockWeaviateClient.graphql.get as any).mockImplementation(() => {
      const builder: any = {};
      builder.withClassName = vi.fn().mockReturnValue(builder);
      builder.withFields = vi.fn().mockReturnValue(builder);
      builder.withHybrid = vi.fn().mockReturnValue(builder);
      builder.withBm25 = vi.fn().mockReturnValue(builder);
      builder.withWhere = vi.fn().mockReturnValue(builder);
      builder.withLimit = vi.fn().mockReturnValue(builder);
      builder.do = vi.fn().mockRejectedValue(new Error('search failed'));
      return builder;
    });

    const result = await getCloudContextFromWeaviate('query', 'chatbot-1');

    expect(result).toEqual({ context: '', sources: [] });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Cloud file search failed',
      expect.any(Error),
      expect.objectContaining({ service: 'cloudContextRetrievalService' }),
    );
  });

  it('builds context from fetched cloud files (Google Drive, text file)', async () => {
    process.env.NODE_ENV = 'development';
    vi.resetModules();
    const { getCloudContextFromWeaviate } = await import('../../services/cloudContextRetrievalService');

    mockSchemaGetterDo.mockResolvedValue({ classes: [{ class: 'CloudFileContent' }] });

    // Single successful response from graphql
    (mockWeaviateClient.graphql.get as any).mockImplementation(() => {
      const builder: any = {};
      builder.withClassName = vi.fn().mockReturnValue(builder);
      builder.withFields = vi.fn().mockReturnValue(builder);
      builder.withHybrid = vi.fn().mockReturnValue(builder);
      builder.withBm25 = vi.fn().mockReturnValue(builder);
      builder.withWhere = vi.fn().mockReturnValue(builder);
      builder.withLimit = vi.fn().mockReturnValue(builder);
      builder.do = vi.fn().mockResolvedValue({
        data: {
          Get: {
            CloudFileContent: [
              {
                chatbotId: 'chatbot-1',
                blockId: 'block-1',
                provider: 'googledrive',
                fileId: 'file-1',
                fileName: 'notes.txt',
                filePath: 'file-1-path',
                mimeType: 'text/plain',
                summary: 'Summary from index',
              },
            ],
          },
        },
      });
      return builder;
    });

    mockPrismaBlockFindUnique.mockResolvedValue({
      id: 'block-1',
      properties: {
        provider: 'googledrive',
        authMethod: 'oauth',
        accessToken: 'encrypted-token',
      },
    });

    process.env.GOOGLE_DRIVE_CLIENT_ID = 'drive-client-id';
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'drive-client-secret';
    // Reset config cache after setting env vars to ensure they're used
    const { resetConfig } = await import('../../config');
    resetConfig();
    mockDecryptToken.mockReturnValue('decrypted-token');
    mockProviderGetFileContent.mockResolvedValue(Buffer.from('This is the content of the cloud text file.'));

    const result = await getCloudContextFromWeaviate('query', 'chatbot-1');

    expect(mockDecryptToken).toHaveBeenCalledWith('encrypted-token');
    expect(mockCreateCloudProvider).toHaveBeenCalledWith('googledrive', {
      clientId: 'drive-client-id',
      clientSecret: 'drive-client-secret',
    });
    expect(result.context).toContain('File: notes.txt');
    expect(result.context).toContain('This is the content of the cloud text file.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toEqual({
      type: 'cloud',
      title: 'notes.txt',
      blockId: 'block-1',
      url: 'file-1-path',
    });
  });
});

