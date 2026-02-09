import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDbBlock, shouldExecuteDbBlock } from '../../services/dbBlockExecutionService';
import { Block } from '@prisma/client';
import * as sharedServices from '@shared/services';
import { getDbConnection, executeSelectQuery } from '../../services/dbConnectionService';
import { formatDbResult } from '@shared/utils';
import { generateSqlQuery } from '../../services/dbQueryGenerator';

// Mock dependencies
vi.mock('@shared/services', () => ({
  executeDbBlock: vi.fn(),
  shouldExecuteDbBlock: vi.fn(),
}));

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
    id: 'block-1',
    chatbotId: 'chatbot-1',
    name: 'Database Block',
    type: 'DATABASE',
    config: {
      connectionMode: 'connection_string',
      connectionString: 'postgresql://user:pass@localhost/db',
    } as any,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldExecuteDbBlock', () => {
    it('should re-export shared shouldExecuteDbBlock', () => {
      expect(shouldExecuteDbBlock).toBe(sharedServices.shouldExecuteDbBlock);
    });
  });

  describe('executeDbBlock', () => {
    it('should call shared executeDbBlock with correct dependencies', async () => {
      const userMessage = 'Show me all users';
      const sessionData = { userId: 'user-1' };
      const expectedResult = { result: 'Query executed successfully' };

      vi.mocked(sharedServices.executeDbBlock).mockResolvedValue(expectedResult as any);

      const result = await executeDbBlock(mockBlock, userMessage, sessionData);

      expect(sharedServices.executeDbBlock).toHaveBeenCalledWith(
        mockBlock,
        userMessage,
        sessionData,
        expect.objectContaining({
          getDbConnection: expect.any(Function),
          executeSelectQuery: expect.any(Function),
          formatDbResult: expect.any(Function),
          generateSqlQuery: expect.any(Function),
        }),
        undefined,
        'gemini',
        undefined
      );
      expect(result).toBe(expectedResult);
    });

    it('should pass getDbConnection dependency correctly', async () => {
      const userMessage = 'Show users';
      const sessionData = {};
      const mockConnection = { type: 'postgresql' } as any;

      vi.mocked(sharedServices.executeDbBlock).mockImplementation(async (block, message, data, deps) => {
        // Test the getDbConnection dependency
        const connection = await deps.getDbConnection({
          connectionMode: 'connection_string',
          connectionString: 'postgresql://localhost/db',
        } as any);
        return { connection };
      });

      vi.mocked(getDbConnection).mockResolvedValue(mockConnection);

      await executeDbBlock(mockBlock, userMessage, sessionData);

      expect(getDbConnection).toHaveBeenCalledWith({
        connectionMode: 'connection_string',
        connectionString: 'postgresql://localhost/db',
      });
    });

    it('should pass executeSelectQuery dependency correctly', async () => {
      const userMessage = 'Show users';
      const sessionData = {};
      const mockConnection = { type: 'postgresql' } as any;
      const mockResult = {
        rows: [{ id: 1, name: 'User 1' }],
        executionTime: 10,
      };

      vi.mocked(sharedServices.executeDbBlock).mockImplementation(async (block, message, data, deps) => {
        const result = await deps.executeSelectQuery(mockConnection, 'SELECT * FROM users', [], 5000);
        return { result };
      });

      vi.mocked(executeSelectQuery).mockResolvedValue(mockResult);

      await executeDbBlock(mockBlock, userMessage, sessionData);

      expect(executeSelectQuery).toHaveBeenCalledWith(mockConnection, 'SELECT * FROM users', [], 5000);
    });

    it('should pass formatDbResult dependency correctly', async () => {
      const userMessage = 'Show users';
      const sessionData = {};
      const mockRows = [{ id: 1, name: 'User 1' }];
      const formattedResult = 'Formatted result';

      vi.mocked(sharedServices.executeDbBlock).mockImplementation(async (block, message, data, deps) => {
        const result = deps.formatDbResult(mockRows, 'table', undefined);
        return { result };
      });

      vi.mocked(formatDbResult).mockReturnValue(formattedResult);

      await executeDbBlock(mockBlock, userMessage, sessionData);

      expect(formatDbResult).toHaveBeenCalledWith(mockRows, 'table', undefined);
    });

    it('should pass generateSqlQuery dependency correctly', async () => {
      const userMessage = 'Show users';
      const sessionData = {};
      const mockSchema = { tables: [] } as any;
      const generatedQuery = 'SELECT * FROM users';

      vi.mocked(sharedServices.executeDbBlock).mockImplementation(async (block, message, data, deps) => {
        const query = await deps.generateSqlQuery(userMessage, mockSchema, 'gemini', undefined);
        return { query };
      });

      vi.mocked(generateSqlQuery).mockResolvedValue(generatedQuery);

      await executeDbBlock(mockBlock, userMessage, sessionData);

      expect(generateSqlQuery).toHaveBeenCalledWith(userMessage, mockSchema, 'gemini', undefined);
    });

    it('should pass custom LLM provider and model', async () => {
      const userMessage = 'Show users';
      const sessionData = {};
      const llmProvider = 'openai';
      const llmModel = 'gpt-4';

      vi.mocked(sharedServices.executeDbBlock).mockResolvedValue({} as any);

      await executeDbBlock(mockBlock, userMessage, sessionData, undefined, llmProvider, llmModel);

      expect(sharedServices.executeDbBlock).toHaveBeenCalledWith(
        mockBlock,
        userMessage,
        sessionData,
        expect.any(Object),
        undefined,
        llmProvider,
        llmModel
      );
    });
  });
});
