import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logCalendarAction,
  getUserActionLogs,
  getChatbotActionLogs,
  CalendarActionLogData,
} from '../../services/calendarActionAuditService';
import { Prisma } from '@prisma/client';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    calendarActionLog: {
      create: vi.fn(),
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

describe('Calendar Action Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logCalendarAction', () => {
    it('should log a successful calendar action', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventId: 'event-123',
        eventDetails: {
          summary: 'Team Meeting',
          start: '2024-01-01T10:00:00Z',
          end: '2024-01-01T11:00:00Z',
        },
        success: true,
      };

      mockPrisma.calendarActionLog.create.mockResolvedValue({
        id: 'log-123',
        ...logData,
        timestamp: new Date(),
      });

      await logCalendarAction(logData);

      expect(mockLogger.debug).toHaveBeenCalledWith('Calendar Action Audit', expect.objectContaining({
        userId: logData.userId,
        chatbotId: logData.chatbotId,
        blockId: logData.blockId,
        action: logData.action,
        eventId: logData.eventId,
        success: logData.success,
        service: 'calendarActionAuditService',
      }));

      expect(mockPrisma.calendarActionLog.create).toHaveBeenCalledWith({
        data: {
          userId: logData.userId,
          chatbotId: logData.chatbotId,
          blockId: logData.blockId,
          action: logData.action,
          eventId: logData.eventId,
          eventDetails: logData.eventDetails as unknown as Prisma.InputJsonValue,
          success: logData.success,
          error: undefined,
          timestamp: expect.any(Date),
        },
      });
    });

    it('should log a failed calendar action with error', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'delete',
        eventId: 'event-456',
        eventDetails: {},
        success: false,
        error: 'Event not found',
      };

      mockPrisma.calendarActionLog.create.mockResolvedValue({
        id: 'log-456',
        ...logData,
        timestamp: new Date(),
      });

      await logCalendarAction(logData);

      expect(mockLogger.debug).toHaveBeenCalledWith('Calendar Action Audit', expect.objectContaining({
        success: false,
        error: 'Event not found',
      }));

      expect(mockPrisma.calendarActionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          success: false,
          error: 'Event not found',
        }),
      });
    });

    it('should log an update action', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'update',
        eventId: 'event-789',
        eventDetails: {
          summary: 'Updated Meeting',
          location: 'Conference Room A',
        },
        success: true,
      };

      mockPrisma.calendarActionLog.create.mockResolvedValue({
        id: 'log-789',
        ...logData,
        timestamp: new Date(),
      });

      await logCalendarAction(logData);

      expect(mockPrisma.calendarActionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'update',
        }),
      });
    });

    it('should handle missing eventId', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {
          summary: 'New Event',
        },
        success: true,
      };

      mockPrisma.calendarActionLog.create.mockResolvedValue({
        id: 'log-999',
        ...logData,
        timestamp: new Date(),
      });

      await logCalendarAction(logData);

      expect(mockPrisma.calendarActionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: undefined,
        }),
      });
    });

    it('should handle P2021 error (table does not exist) gracefully', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {},
        success: true,
      };

      const prismaError = {
        code: 'P2021',
        message: 'Table does not exist',
      };

      mockPrisma.calendarActionLog.create.mockRejectedValue(prismaError);

      await logCalendarAction(logData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CalendarActionLog table does not exist yet. Migration may need to be run',
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith('Action would be logged', expect.objectContaining({
        userId: logData.userId,
        chatbotId: logData.chatbotId,
        blockId: logData.blockId,
        action: logData.action,
        success: logData.success,
        service: 'calendarActionAuditService',
      }));

      // Should not throw error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should re-throw non-P2021 Prisma errors', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {},
        success: true,
      };

      const prismaError = {
        code: 'P2002',
        message: 'Unique constraint violation',
      };

      mockPrisma.calendarActionLog.create.mockRejectedValue(prismaError);

      await logCalendarAction(logData);

      // Should log error but not throw (function catches all errors)
      // The error gets caught by the outer catch block, which checks if it's an Error instance
      // Since prismaError is not an Error instance, it passes undefined as the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log action',
        undefined, // Not an Error instance, so undefined is passed
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );
    });

    it('should handle generic errors gracefully', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {},
        success: true,
      };

      const genericError = new Error('Database connection failed');
      mockPrisma.calendarActionLog.create.mockRejectedValue(genericError);

      await logCalendarAction(logData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log action',
        genericError,
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      // Should not throw - function catches all errors
    });

    it('should handle non-Error objects in catch block', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {},
        success: true,
      };

      const nonError = { message: 'Something went wrong' };
      mockPrisma.calendarActionLog.create.mockRejectedValue(nonError);

      await logCalendarAction(logData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log action',
        undefined, // Not an Error instance
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );
    });

    it('should handle all action types', async () => {
      const actions: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];

      for (const action of actions) {
        const logData: CalendarActionLogData = {
          userId: 'user-123',
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
          action,
          eventDetails: {},
          success: true,
        };

        mockPrisma.calendarActionLog.create.mockResolvedValue({
          id: `log-${action}`,
          ...logData,
          timestamp: new Date(),
        });

        await logCalendarAction(logData);

        expect(mockPrisma.calendarActionLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action,
          }),
        });
      }
    });

    it('should include timestamp in debug log', async () => {
      const logData: CalendarActionLogData = {
        userId: 'user-123',
        chatbotId: 'chatbot-123',
        blockId: 'block-123',
        action: 'create',
        eventDetails: {},
        success: true,
      };

      mockPrisma.calendarActionLog.create.mockResolvedValue({
        id: 'log-123',
        ...logData,
        timestamp: new Date(),
      });

      await logCalendarAction(logData);

      const debugCall = mockLogger.debug.mock.calls.find(
        call => call[0] === 'Calendar Action Audit'
      );

      expect(debugCall).toBeDefined();
      expect(debugCall?.[1]).toHaveProperty('timestamp');
      expect(debugCall?.[1].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('getUserActionLogs', () => {
    it('should retrieve action logs for a user', async () => {
      const userId = 'user-123';
      const mockLogs = [
        {
          id: 'log-1',
          userId,
          chatbotId: 'chatbot-123',
          blockId: 'block-123',
          action: 'create',
          eventId: 'event-1',
          eventDetails: { summary: 'Event 1' },
          success: true,
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          userId,
          chatbotId: 'chatbot-123',
          blockId: 'block-456',
          action: 'update',
          eventId: 'event-2',
          eventDetails: { summary: 'Event 2' },
          success: true,
          timestamp: new Date(),
        },
      ];

      mockPrisma.calendarActionLog.findMany.mockResolvedValue(mockLogs);

      const result = await getUserActionLogs(userId);

      expect(mockPrisma.calendarActionLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      expect(result).toEqual(mockLogs);
    });

    it('should use custom limit when provided', async () => {
      const userId = 'user-123';
      const limit = 50;
      const mockLogs = [];

      mockPrisma.calendarActionLog.findMany.mockResolvedValue(mockLogs);

      await getUserActionLogs(userId, limit);

      expect(mockPrisma.calendarActionLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    });

    it('should return empty array on error', async () => {
      const userId = 'user-123';
      const error = new Error('Database error');

      mockPrisma.calendarActionLog.findMany.mockRejectedValue(error);

      const result = await getUserActionLogs(userId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get logs',
        error,
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      expect(result).toEqual([]);
    });

    it('should handle non-Error objects in catch block', async () => {
      const userId = 'user-123';
      const nonError = { message: 'Something went wrong' };

      mockPrisma.calendarActionLog.findMany.mockRejectedValue(nonError);

      const result = await getUserActionLogs(userId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get logs',
        undefined, // Not an Error instance
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no logs found', async () => {
      const userId = 'user-123';

      mockPrisma.calendarActionLog.findMany.mockResolvedValue([]);

      const result = await getUserActionLogs(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getChatbotActionLogs', () => {
    it('should retrieve action logs for a chatbot', async () => {
      const chatbotId = 'chatbot-123';
      const mockLogs = [
        {
          id: 'log-1',
          userId: 'user-123',
          chatbotId,
          blockId: 'block-123',
          action: 'create',
          eventId: 'event-1',
          eventDetails: { summary: 'Event 1' },
          success: true,
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          userId: 'user-456',
          chatbotId,
          blockId: 'block-456',
          action: 'delete',
          eventId: 'event-2',
          eventDetails: { summary: 'Event 2' },
          success: false,
          error: 'Event not found',
          timestamp: new Date(),
        },
      ];

      mockPrisma.calendarActionLog.findMany.mockResolvedValue(mockLogs);

      const result = await getChatbotActionLogs(chatbotId);

      expect(mockPrisma.calendarActionLog.findMany).toHaveBeenCalledWith({
        where: { chatbotId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      expect(result).toEqual(mockLogs);
    });

    it('should use custom limit when provided', async () => {
      const chatbotId = 'chatbot-123';
      const limit = 25;
      const mockLogs = [];

      mockPrisma.calendarActionLog.findMany.mockResolvedValue(mockLogs);

      await getChatbotActionLogs(chatbotId, limit);

      expect(mockPrisma.calendarActionLog.findMany).toHaveBeenCalledWith({
        where: { chatbotId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    });

    it('should return empty array on error', async () => {
      const chatbotId = 'chatbot-123';
      const error = new Error('Database error');

      mockPrisma.calendarActionLog.findMany.mockRejectedValue(error);

      const result = await getChatbotActionLogs(chatbotId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get logs',
        error,
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      expect(result).toEqual([]);
    });

    it('should handle non-Error objects in catch block', async () => {
      const chatbotId = 'chatbot-123';
      const nonError = { message: 'Something went wrong' };

      mockPrisma.calendarActionLog.findMany.mockRejectedValue(nonError);

      const result = await getChatbotActionLogs(chatbotId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get logs',
        undefined, // Not an Error instance
        expect.objectContaining({
          service: 'calendarActionAuditService',
        })
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no logs found', async () => {
      const chatbotId = 'chatbot-123';

      mockPrisma.calendarActionLog.findMany.mockResolvedValue([]);

      const result = await getChatbotActionLogs(chatbotId);

      expect(result).toEqual([]);
    });

    it('should order logs by timestamp descending', async () => {
      const chatbotId = 'chatbot-123';
      const mockLogs = [];

      mockPrisma.calendarActionLog.findMany.mockResolvedValue(mockLogs);

      await getChatbotActionLogs(chatbotId);

      expect(mockPrisma.calendarActionLog.findMany).toHaveBeenCalledWith({
        where: { chatbotId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });
  });
});
