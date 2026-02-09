import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeDbBlocksForChatbot } from '../../services/dbBlockHelper';
import { Block, BlockType } from '@prisma/client';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    block: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock @prisma/client to include BlockType
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
  BlockType: {
    ACTION: 'ACTION',
    CONTEXT: 'CONTEXT',
    LOGIC: 'LOGIC',
  },
}));

// Mock dbBlockExecutionService - use vi.hoisted
const { mockShouldExecuteDbBlock, mockExecuteDbBlock } = vi.hoisted(() => {
  const mockShouldExecuteDbBlock = vi.fn();
  const mockExecuteDbBlock = vi.fn();
  return { mockShouldExecuteDbBlock, mockExecuteDbBlock };
});

vi.mock('../../services/dbBlockExecutionService', () => ({
  shouldExecuteDbBlock: mockShouldExecuteDbBlock,
  executeDbBlock: mockExecuteDbBlock,
}));

// Mock logger
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  return { mockLogger };
});

vi.mock('@shared/utils', () => ({
  logger: mockLogger,
}));

describe('DB Block Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeDbBlocksForChatbot', () => {
    it('should execute all DB blocks that should be executed', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get all users';
      const sessionData = { sessionId: 'session-123' };

      const systemPromptBlock = {
        id: 'system-prompt-123',
        chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          llmProvider: 'openai',
          llmModel: 'gpt-4',
        },
      };

      const dbBlock1: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dbBlock2: Block = {
        id: 'block-2',
        chatbotId,
        type: BlockType.CONTEXT,
        subtype: 'Database',
        properties: {},
        name: 'DB Block 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(systemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock1, dbBlock2]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock
        .mockResolvedValueOnce({
          data: 'Result 1',
          metadata: { rowCount: 5 },
        })
        .mockResolvedValueOnce({
          data: 'Result 2',
          metadata: { rowCount: 10 },
        });

      const results = await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockPrisma.block.findFirst).toHaveBeenCalledWith({
        where: {
          chatbotId,
          type: BlockType.LOGIC,
          subtype: 'System Prompt',
        },
      });

      expect(mockPrisma.block.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId,
          OR: [
            { type: BlockType.ACTION, subtype: 'DB' },
            { type: BlockType.CONTEXT, subtype: 'Database' },
          ],
        },
      });

      expect(mockShouldExecuteDbBlock).toHaveBeenCalledTimes(2);
      expect(mockShouldExecuteDbBlock).toHaveBeenCalledWith(dbBlock1, userMessage, sessionData);
      expect(mockShouldExecuteDbBlock).toHaveBeenCalledWith(dbBlock2, userMessage, sessionData);

      expect(mockExecuteDbBlock).toHaveBeenCalledTimes(2);
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock1,
        userMessage,
        sessionData,
        undefined,
        'openai',
        'gpt-4'
      );
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock2,
        userMessage,
        sessionData,
        undefined,
        'openai',
        'gpt-4'
      );

      expect(results).toEqual([
        { blockId: 'block-1', data: 'Result 1', metadata: { rowCount: 5 } },
        { blockId: 'block-2', data: 'Result 2', metadata: { rowCount: 10 } },
      ]);
    });

    it('should skip blocks that should not be executed', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Hello';
      const sessionData = {};

      const dbBlock1: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dbBlock2: Block = {
        id: 'block-2',
        chatbotId,
        type: BlockType.CONTEXT,
        subtype: 'Database',
        properties: {},
        name: 'DB Block 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock1, dbBlock2]);
      mockShouldExecuteDbBlock
        .mockReturnValueOnce(false) // First block should not execute
        .mockReturnValueOnce(true); // Second block should execute

      mockExecuteDbBlock.mockResolvedValueOnce({
        data: 'Result 2',
        metadata: {},
      });

      const results = await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockShouldExecuteDbBlock).toHaveBeenCalledTimes(2);
      expect(mockExecuteDbBlock).toHaveBeenCalledTimes(1); // Only called for block 2
      expect(results).toEqual([
        { blockId: 'block-2', data: 'Result 2', metadata: {} },
      ]);
    });

    it('should use default provider when system prompt block not found', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData, 'anthropic');

      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'anthropic',
        undefined
      );
    });

    it('should use default gemini provider when no provider specified', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'gemini',
        undefined
      );
    });

    it('should use llmModel from system prompt when both are provided', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const systemPromptBlock = {
        id: 'system-prompt-123',
        chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          llmProvider: 'openai',
          llmModel: 'gpt-3.5-turbo',
        },
      };

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(systemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData, 'openai', 'gpt-4');

      // System prompt llmModel takes precedence: blockProperties?.llmModel || llmModel
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'openai',
        'gpt-3.5-turbo' // System prompt model takes precedence
      );
    });

    it('should use llmModel from function parameter when system prompt has no model', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const systemPromptBlock = {
        id: 'system-prompt-123',
        chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          llmProvider: 'openai',
          // No llmModel
        },
      };

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(systemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData, 'openai', 'gpt-4');

      // Function parameter used when system prompt has no model: blockProperties?.llmModel || llmModel
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'openai',
        'gpt-4' // Function parameter used
      );
    });

    it('should use llmModel from system prompt when function parameter not provided', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const systemPromptBlock = {
        id: 'system-prompt-123',
        chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          llmProvider: 'openai',
          llmModel: 'gpt-3.5-turbo',
        },
      };

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(systemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'openai',
        'gpt-3.5-turbo' // From system prompt block
      );
    });

    it('should handle execution errors gracefully and continue with other blocks', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const dbBlock1: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dbBlock2: Block = {
        id: 'block-2',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock1, dbBlock2]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValueOnce({
          data: 'Result 2',
          metadata: {},
        });

      const results = await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'DB Block execution failed',
        expect.any(Error),
        {
          blockId: 'block-1',
          service: 'dbBlockHelper',
        }
      );

      // Should continue with block 2
      expect(mockExecuteDbBlock).toHaveBeenCalledTimes(2);
      expect(results).toEqual([
        { blockId: 'block-2', data: 'Result 2', metadata: {} },
      ]);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockRejectedValue({ message: 'Something went wrong' });

      const results = await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'DB Block execution failed',
        undefined, // Not an Error instance
        {
          blockId: 'block-1',
          service: 'dbBlockHelper',
        }
      );

      expect(results).toEqual([]);
    });

    it('should handle empty sessionData', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage);

      expect(mockShouldExecuteDbBlock).toHaveBeenCalledWith(dbBlock, userMessage, {});
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        {},
        undefined,
        'gemini',
        undefined
      );
    });

    it('should return empty array when no DB blocks found', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      mockPrisma.block.findFirst.mockResolvedValue(null);
      mockPrisma.block.findMany.mockResolvedValue([]);

      const results = await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData);

      expect(mockShouldExecuteDbBlock).not.toHaveBeenCalled();
      expect(mockExecuteDbBlock).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('should handle system prompt block with no llmProvider in properties', async () => {
      const chatbotId = 'chatbot-123';
      const userMessage = 'Get users';
      const sessionData = {};

      const systemPromptBlock = {
        id: 'system-prompt-123',
        chatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
        properties: {
          // No llmProvider
        },
      };

      const dbBlock: Block = {
        id: 'block-1',
        chatbotId,
        type: BlockType.ACTION,
        subtype: 'DB',
        properties: {},
        name: 'DB Block 1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.block.findFirst.mockResolvedValue(systemPromptBlock);
      mockPrisma.block.findMany.mockResolvedValue([dbBlock]);
      mockShouldExecuteDbBlock.mockReturnValue(true);
      mockExecuteDbBlock.mockResolvedValue({
        data: 'Result',
        metadata: {},
      });

      await executeDbBlocksForChatbot(chatbotId, userMessage, sessionData, 'mistral');

      // When system prompt has no llmProvider, it falls back to function parameter
      // The logic is: blockProperties?.llmProvider || llmProvider || 'gemini'
      expect(mockExecuteDbBlock).toHaveBeenCalledWith(
        dbBlock,
        userMessage,
        sessionData,
        undefined,
        'mistral', // Function parameter used when system prompt has no provider
        undefined
      );
    });
  });
});
