import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDbBlock } from '../../services/dbBlockExecutionService';
import { Block, BlockType } from '@prisma/client';
import * as dbConnectionService from '../../services/dbConnectionService';
import { formatDbResult } from '@shared/utils';
import * as dbQueryGenerator from '../../services/dbQueryGenerator';

// Mock the shared service
const { mockSharedExecuteDbBlock } = vi.hoisted(() => {
  const mockExecuteDbBlock = vi.fn();
  return { mockSharedExecuteDbBlock: mockExecuteDbBlock };
});

vi.mock('@shared/services', () => ({
  executeDbBlock: (...args: any[]) => mockSharedExecuteDbBlock(...args),
  shouldExecuteDbBlock: vi.fn(),
}));

// Mock dependencies
vi.mock('../../services/dbConnectionService', () => ({
  getDbConnection: vi.fn(),
  executeSelectQuery: vi.fn(),
}));

vi.mock('@shared/utils', async () => {
  const actual = await vi.importActual('@shared/utils');
  return {
    ...actual as any,
    formatDbResult: vi.fn(),
  };
});

vi.mock('../../services/dbQueryGenerator', () => ({
  generateSqlQuery: vi.fn(),
}));

describe('DB Block Execution Service', () => {
  const mockBlock: Block = {
    id: 'block-123',
    chatbotId: 'chatbot-123',
    type: BlockType.DB,
    name: 'Test DB Block',
    properties: {
      connectionMode: 'server',
      dbType: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'testdb',
      username: 'testuser',
      password: 'testpass',
      ssl: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserMessage = 'Show me all users';
  const mockSessionData = { userId: 'user-123', sessionId: 'session-123' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeDbBlock', () => {
    it('should call shared executeDbBlock with correct dependencies', async () => {
      const mockResult = { rows: [{ id: 1, name: 'Test' }], executionTime: 100 };
      mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

      await executeDbBlock(mockBlock, mockUserMessage, mockSessionData);

      expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        expect.objectContaining({
          getDbConnection: expect.any(Function),
          executeSelectQuery: expect.any(Function),
          formatDbResult: expect.any(Function),
          generateSqlQuery: expect.any(Function),
        }),
        undefined, // llmService
        'gemini', // default llmProvider
        undefined // llmModel
      );
    });

    it('should pass custom LLM provider and model', async () => {
      const mockResult = { rows: [], executionTime: 50 };
      mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

      await executeDbBlock(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        undefined,
        'openai',
        'gpt-4'
      );

      expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        expect.any(Object),
        undefined,
        'openai',
        'gpt-4'
      );
    });

    it('should provide getDbConnection dependency that calls dbConnectionService', async () => {
      const mockConnection = { type: 'postgresql' } as any;
      vi.mocked(dbConnectionService.getDbConnection).mockResolvedValue(mockConnection);

      const mockResult = { rows: [], executionTime: 50 };
      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        // Call getDbConnection through dependencies
        const connection = await deps.getDbConnection({
          connectionMode: 'server',
          dbType: 'postgresql',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          username: 'testuser',
          password: 'testpass',
          ssl: false,
          fileId: undefined,
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
        });
        return { connection, rows: [], executionTime: 50 };
      });

      await executeDbBlock(mockBlock, mockUserMessage, mockSessionData);

      expect(dbConnectionService.getDbConnection).toHaveBeenCalledWith({
        connectionMode: 'server',
        dbType: 'postgresql',
        connectionString: undefined,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'testuser',
        password: 'testpass',
        ssl: false,
        fileId: undefined,
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
      });
    });

    it('should provide executeSelectQuery dependency that calls dbConnectionService', async () => {
      const mockConnection = { type: 'postgresql' } as any;
      const mockQueryResult = {
        rows: [{ id: 1, name: 'Test' }],
        executionTime: 100,
      };
      vi.mocked(dbConnectionService.executeSelectQuery).mockResolvedValue(mockQueryResult);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        const result = await deps.executeSelectQuery(mockConnection, 'SELECT * FROM users', {}, 5000);
        return result;
      });

      const result = await executeDbBlock(mockBlock, mockUserMessage, mockSessionData);

      expect(dbConnectionService.executeSelectQuery).toHaveBeenCalledWith(
        mockConnection,
        'SELECT * FROM users',
        {},
        5000
      );
      expect(result).toEqual({
        rows: mockQueryResult.rows,
        executionTime: mockQueryResult.executionTime,
      });
    });

    it('should provide formatDbResult dependency that calls dbResultFormatter', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      const mockFormatted = '| id | name |\n| 1 | Test |';
      vi.mocked(dbResultFormatter.formatDbResult).mockReturnValue(mockFormatted);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        const formatted = deps.formatDbResult(mockRows, 'table', undefined);
        return { formatted, rows: mockRows, executionTime: 50 };
      });

      const { formatDbResult } = await import('@shared/utils');

      const result = await executeDbBlock(mockBlock, mockUserMessage, mockSessionData);

      expect(formatDbResult).toHaveBeenCalledWith(
        mockRows,
        'table',
        undefined
      );
      expect(result).toEqual({
        formatted: mockFormatted,
        rows: mockRows,
        executionTime: 50,
      });
    });

    it('should provide formatDbResult with custom template', async () => {
      const mockRows = [{ id: 1, name: 'Test' }];
      const mockFormatted = 'User {id}: {name}';
      vi.mocked(dbResultFormatter.formatDbResult).mockReturnValue(mockFormatted);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        const formatted = deps.formatDbResult(mockRows, 'custom', 'User {id}: {name}');
        return { formatted, rows: mockRows, executionTime: 50 };
      });
      
      const { formatDbResult } = await import('@shared/utils');

      await executeDbBlock(mockBlock, mockUserMessage, mockSessionData);

      expect(formatDbResult).toHaveBeenCalledWith(
        mockRows,
        'custom',
        'User {id}: {name}'
      );
    });

    it('should provide generateSqlQuery dependency that calls dbQueryGenerator', async () => {
      const mockSchema = {
        tables: [],
        discoveredAt: '2024-01-01T00:00:00Z',
      };
      const mockQuery = 'SELECT * FROM users LIMIT 100';
      vi.mocked(dbQueryGenerator.generateSqlQuery).mockResolvedValue(mockQuery);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        const query = await deps.generateSqlQuery(
          'Show me users',
          mockSchema,
          'openai',
          'gpt-4'
        );
        return { query, rows: [], executionTime: 50 };
      });

      const result = await executeDbBlock(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        undefined,
        'openai',
        'gpt-4'
      );

      expect(dbQueryGenerator.generateSqlQuery).toHaveBeenCalledWith(
        'Show me users',
        mockSchema,
        'openai',
        'gpt-4'
      );
      expect(result).toEqual({
        query: mockQuery,
        rows: [],
        executionTime: 50,
      });
    });

    it('should handle file-based connection mode', async () => {
      const fileBlock: Block = {
        ...mockBlock,
        properties: {
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: 'file-123',
        },
      };

      const mockConnection = { type: 'sqlite' } as any;
      vi.mocked(dbConnectionService.getDbConnection).mockResolvedValue(mockConnection);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        await deps.getDbConnection({
          connectionMode: 'file',
          dbType: 'sqlite',
          fileId: 'file-123',
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
        });
        return { rows: [], executionTime: 50 };
      });

      await executeDbBlock(fileBlock, mockUserMessage, mockSessionData);

      expect(dbConnectionService.getDbConnection).toHaveBeenCalledWith({
        connectionMode: 'file',
        dbType: 'sqlite',
        connectionString: undefined,
        host: undefined,
        port: undefined,
        database: undefined,
        username: undefined,
        password: undefined,
        ssl: undefined,
        fileId: 'file-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
      });
    });

    it('should handle connection string mode', async () => {
      const connectionStringBlock: Block = {
        ...mockBlock,
        properties: {
          connectionMode: 'server',
          dbType: 'postgresql',
          connectionString: 'postgresql://user:pass@localhost:5432/db',
        },
      };

      const mockConnection = { type: 'postgresql' } as any;
      vi.mocked(dbConnectionService.getDbConnection).mockResolvedValue(mockConnection);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        await deps.getDbConnection({
          connectionMode: 'server',
          dbType: 'postgresql',
          connectionString: 'postgresql://user:pass@localhost:5432/db',
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
        });
        return { rows: [], executionTime: 50 };
      });

      await executeDbBlock(connectionStringBlock, mockUserMessage, mockSessionData);

      expect(dbConnectionService.getDbConnection).toHaveBeenCalledWith({
        connectionMode: 'server',
        dbType: 'postgresql',
        connectionString: 'postgresql://user:pass@localhost:5432/db',
        host: undefined,
        port: undefined,
        database: undefined,
        username: undefined,
        password: undefined,
        ssl: undefined,
        fileId: undefined,
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
      });
    });

    it('should propagate errors from shared service', async () => {
      const error = new Error('Shared service error');
      mockSharedExecuteDbBlock.mockRejectedValue(error);

      await expect(
        executeDbBlock(mockBlock, mockUserMessage, mockSessionData)
      ).rejects.toThrow('Shared service error');
    });

    it('should propagate errors from getDbConnection', async () => {
      const error = new Error('Connection error');
      vi.mocked(dbConnectionService.getDbConnection).mockRejectedValue(error);

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        await deps.getDbConnection({
          connectionMode: 'server',
          dbType: 'postgresql',
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
        });
        return { rows: [], executionTime: 50 };
      });

      await expect(
        executeDbBlock(mockBlock, mockUserMessage, mockSessionData)
      ).rejects.toThrow('Connection error');
    });

    it('should propagate errors from executeSelectQuery', async () => {
      const error = new Error('Query execution error');
      vi.mocked(dbConnectionService.executeSelectQuery).mockRejectedValue(error);

      const mockConnection = { type: 'postgresql' } as any;

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        await deps.executeSelectQuery(mockConnection, 'SELECT * FROM users', {}, 5000);
        return { rows: [], executionTime: 50 };
      });

      await expect(
        executeDbBlock(mockBlock, mockUserMessage, mockSessionData)
      ).rejects.toThrow('Query execution error');
    });

    it('should propagate errors from generateSqlQuery', async () => {
      const error = new Error('Query generation error');
      vi.mocked(dbQueryGenerator.generateSqlQuery).mockRejectedValue(error);

      const mockSchema = {
        tables: [],
        discoveredAt: '2024-01-01T00:00:00Z',
      };

      mockSharedExecuteDbBlock.mockImplementation(async (block, message, session, deps) => {
        await deps.generateSqlQuery('Show me users', mockSchema, 'gemini', undefined);
        return { rows: [], executionTime: 50 };
      });

      await expect(
        executeDbBlock(mockBlock, mockUserMessage, mockSessionData)
      ).rejects.toThrow('Query generation error');
    });

    it('should handle all LLM providers', async () => {
      const providers: Array<'gemini' | 'openai' | 'anthropic' | 'mistral'> = [
        'gemini',
        'openai',
        'anthropic',
        'mistral',
      ];

      for (const provider of providers) {
        vi.clearAllMocks();
        const mockResult = { rows: [], executionTime: 50 };
        mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

        await executeDbBlock(mockBlock, mockUserMessage, mockSessionData, undefined, provider);

        expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
          mockBlock,
          mockUserMessage,
          mockSessionData,
          expect.any(Object),
          undefined,
          provider,
          undefined
        );
      }
    });

    it('should handle empty session data', async () => {
      const mockResult = { rows: [], executionTime: 50 };
      mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

      await executeDbBlock(mockBlock, mockUserMessage, {});

      expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
        mockBlock,
        mockUserMessage,
        {},
        expect.any(Object),
        undefined,
        'gemini',
        undefined
      );
    });

    it('should handle complex session data', async () => {
      const complexSessionData = {
        userId: 'user-123',
        sessionId: 'session-123',
        previousMessages: ['msg1', 'msg2'],
        metadata: { key: 'value' },
      };

      const mockResult = { rows: [], executionTime: 50 };
      mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

      await executeDbBlock(mockBlock, mockUserMessage, complexSessionData);

      expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
        mockBlock,
        mockUserMessage,
        complexSessionData,
        expect.any(Object),
        undefined,
        'gemini',
        undefined
      );
    });

    it('should pass llmService parameter to shared service', async () => {
      const mockLLMService = { generateResponse: vi.fn() };
      const mockResult = { rows: [], executionTime: 50 };
      mockSharedExecuteDbBlock.mockResolvedValue(mockResult);

      await executeDbBlock(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        mockLLMService,
        'openai',
        'gpt-4'
      );

      expect(mockSharedExecuteDbBlock).toHaveBeenCalledWith(
        mockBlock,
        mockUserMessage,
        mockSessionData,
        expect.any(Object),
        mockLLMService,
        'openai',
        'gpt-4'
      );
    });
  });
});
