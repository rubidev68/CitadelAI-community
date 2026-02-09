import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackAICall, canSendMessage } from '../../utils/aiCallTracking';
import { mockPrisma } from '../setup';
import { logger } from '@shared/utils';

// Mock logger to avoid noisy output and allow assertions
vi.mock('@shared/utils', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('aiCallTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure optional models exist on the prisma mock
    (mockPrisma as any).aICall = {
      create: vi.fn(),
      count: vi.fn(),
    };
  });

  describe('trackAICall', () => {
    it('should log a warning and return when chatbot is not found', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce(null);

      await trackAICall('missing-chatbot');

      expect(mockPrisma.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: 'missing-chatbot' },
        select: { ownerId: true },
      });
      expect((logger.warn as unknown as vi.Mock)).toHaveBeenCalledWith(
        'Chatbot not found for AI call tracking',
        expect.objectContaining({
          chatbotId: 'missing-chatbot',
          service: 'aiCallTracking',
        }),
      );
      expect((mockPrisma as any).aICall.create).not.toHaveBeenCalled();
    });

    it('should create an AICall record when chatbot exists', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      ((mockPrisma as any).aICall.create as vi.Mock).mockResolvedValueOnce({});

      await trackAICall('chatbot-123', 'MESSAGE');

      expect((mockPrisma as any).aICall.create).toHaveBeenCalledWith({
        data: {
          chatbotId: 'chatbot-123',
          adminUserId: 'owner-123',
          callType: 'MESSAGE',
        },
      });
    });

    it('should silently skip tracking when AICall model is not available', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      const error = new Error('Unknown arg `aICall` in data');
      ((mockPrisma as any).aICall.create as vi.Mock).mockRejectedValueOnce(error);

      await trackAICall('chatbot-123', 'MESSAGE');

      expect(logger.debug).toHaveBeenCalledWith(
        'AICall model not available - skipping tracking',
        expect.objectContaining({
          service: 'aiCallTracking',
        }),
      );
    });

    it('should handle missing AICall table errors from outer catch', async () => {
      const prismaError = Object.assign(new Error('Table `AICall` does not exist'), {
        code: 'P2021',
      });
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockRejectedValueOnce(prismaError);

      await trackAICall('chatbot-123');

      expect(logger.debug).toHaveBeenCalledWith(
        'AICall table does not exist - skipping tracking (custom instance)',
        expect.objectContaining({
          service: 'aiCallTracking',
        }),
      );
    });
  });

  describe('canSendMessage', () => {
    it('should allow when chatbot is not found (fail open)', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce(null);

      const result = await canSendMessage('missing-chatbot');

      expect(result).toEqual({
        allowed: true,
        currentCount: 0,
        maxAllowed: null,
        remaining: null,
      });
    });

    it('should allow unlimited when admin user has no subscription', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        subscription: null,
      });

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should allow unlimited when plan has null maxMessages', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        subscription: {
          plan: {
            maxMessages: null,
          },
        },
      });

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should return remaining quota and allow when below limit', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        subscription: {
          plan: {
            maxMessages: 100,
          },
        },
      });
      ((mockPrisma as any).aICall.count as vi.Mock).mockResolvedValueOnce(40);

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(40);
      expect(result.maxAllowed).toBe(100);
      expect(result.remaining).toBe(60);
      expect(result.code).toBeUndefined();
      expect(result.message).toBeUndefined();
    });

    it('should block when limit is reached or exceeded', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        subscription: {
          plan: {
            maxMessages: 50,
          },
        },
      });
      ((mockPrisma as any).aICall.count as vi.Mock).mockResolvedValueOnce(50);

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(50);
      expect(result.maxAllowed).toBe(50);
      expect(result.remaining).toBe(0);
      expect(result.code).toBe('MESSAGE_LIMIT_REACHED');
      expect(result.message).toContain('Message limit reached (50/50)');
    });

    it('should allow when AICall model is missing for count query', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        subscription: {
          plan: {
            maxMessages: 10,
          },
        },
      });
      const error = Object.assign(new Error('Unknown arg `aICall` in where'), {
        code: 'P2021',
      });
      ((mockPrisma as any).aICall.count as vi.Mock).mockRejectedValueOnce(error);

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should allow and log debug when subscription relation is missing', async () => {
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockResolvedValueOnce({
        ownerId: 'owner-123',
      });
      const error = Object.assign(
        new Error('Unknown field subscription for model AdminUser'),
        { name: 'PrismaClientValidationError' },
      );
      (mockPrisma.adminUser.findUnique as unknown as vi.Mock).mockRejectedValueOnce(error);

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Subscription relation not available - allowing (user-backend schema)',
        expect.objectContaining({
          service: 'aiCallTracking',
        }),
      );
    });

    it('should allow and log debug when subscription/AICall tables are missing (outer catch)', async () => {
      const prismaError = Object.assign(
        new Error('Table `Subscription` does not exist'),
        { code: 'P2021', name: 'PrismaClientKnownRequestError' },
      );
      (mockPrisma.chatbot.findUnique as unknown as vi.Mock).mockRejectedValueOnce(prismaError);

      const result = await canSendMessage('chatbot-123');

      expect(result.allowed).toBe(true);
      expect(result.maxAllowed).toBeNull();
      expect(result.remaining).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Subscription/AICall tables/relations do not exist - allowing (user-backend schema)',
        expect.objectContaining({
          service: 'aiCallTracking',
        }),
      );
    });
  });
});

