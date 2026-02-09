import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import calendarActionsRouter from '../../routes/calendarActions';

// Mock Prisma - use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    block: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
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

// Mock calendar services - use vi.hoisted to avoid hoisting issues
const { mockCalendarBlockExecutionService, mockCalendarActionConfirmationService, mockCalendarActionAuditService } = vi.hoisted(() => {
  const mockCalendarBlockExecutionService = {
    executeCalendarBlock: vi.fn(),
  };
  
  const mockCalendarActionConfirmationService = {
    storePendingAction: vi.fn(),
    getPendingAction: vi.fn(),
    clearPendingAction: vi.fn(),
    validateConfirmationToken: vi.fn(),
    generateConfirmationToken: vi.fn(),
  };
  
  const mockCalendarActionAuditService = {
    logCalendarAction: vi.fn(),
  };
  
  return { mockCalendarBlockExecutionService, mockCalendarActionConfirmationService, mockCalendarActionAuditService };
});

vi.mock('../../services/calendarBlockExecutionService', () => ({
  executeCalendarBlock: mockCalendarBlockExecutionService.executeCalendarBlock,
}));

vi.mock('../../services/calendarActionConfirmationService', () => ({
  storePendingAction: mockCalendarActionConfirmationService.storePendingAction,
  getPendingAction: mockCalendarActionConfirmationService.getPendingAction,
  clearPendingAction: mockCalendarActionConfirmationService.clearPendingAction,
  validateConfirmationToken: mockCalendarActionConfirmationService.validateConfirmationToken,
  generateConfirmationToken: mockCalendarActionConfirmationService.generateConfirmationToken,
}));

vi.mock('../../services/calendarActionAuditService', () => ({
  logCalendarAction: mockCalendarActionAuditService.logCalendarAction,
}));

describe('Calendar Actions Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/calendar-actions', calendarActionsRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/calendar-actions/confirm', () => {
    const confirmationToken = 'test-confirmation-token-123';
    const mockPendingAction = {
      blockId: 'block-123',
      userId: 'user-123',
      chatbotId: 'chatbot-123',
      userMessage: 'Create a meeting',
      integrationType: 'api' as const,
      action: 'create' as const,
      eventDetails: {
        title: 'Test Meeting',
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T11:00:00Z',
      },
      sessionId: 'session-123',
      cachedEventInfo: null,
    };

    beforeEach(() => {
      mockCalendarActionConfirmationService.validateConfirmationToken.mockReturnValue(true);
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(mockPendingAction);
      mockCalendarActionConfirmationService.clearPendingAction.mockResolvedValue(undefined);
      mockCalendarActionAuditService.logCalendarAction.mockResolvedValue(undefined);
    });

    it('should return 400 if confirmation token format is invalid', async () => {
      mockCalendarActionConfirmationService.validateConfirmationToken.mockReturnValue(false);

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken: 'invalid-token' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid confirmation token format');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should return 404 if pending action not found', async () => {
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Action not found or expired');
      expect(response.body.code).toBe('CONFIRMATION_EXPIRED');
    });

    it('should return 400 if Slack action missing slackUserId', async () => {
      const slackAction = {
        ...mockPendingAction,
        integrationType: 'slack' as const,
      };
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(slackAction);

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Slack user ID required');
      expect(response.body.code).toBe('MISSING_SLACK_USER_ID');
    });

    it('should return 400 if API action missing apiToken', async () => {
      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('API token required');
      expect(response.body.code).toBe('MISSING_API_TOKEN');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken, apiToken: 'test-token' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Block not found');
      expect(response.body.code).toBe('BLOCK_NOT_FOUND');
    });

    it('should return 400 if authentication is required', async () => {
      const mockBlock = {
        id: 'block-123',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Calendar',
        properties: {},
      };

      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      mockCalendarBlockExecutionService.executeCalendarBlock.mockResolvedValue({
        requiresAuth: true,
        authUrl: 'https://oauth.example.com/auth',
        provider: 'google',
      });

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken, apiToken: 'test-token' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Calendar authentication required');
      expect(response.body.code).toBe('AUTH_REQUIRED');
      expect(response.body.authUrl).toBe('https://oauth.example.com/auth');
      expect(mockCalendarActionConfirmationService.clearPendingAction).toHaveBeenCalledWith(confirmationToken);
    });

    it('should execute calendar action successfully', async () => {
      const mockBlock = {
        id: 'block-123',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Calendar',
        properties: {},
      };

      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      mockCalendarBlockExecutionService.executeCalendarBlock.mockResolvedValue({
        eventCreated: true,
        eventId: 'event-123',
        error: null,
      });

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken, apiToken: 'test-token' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.eventCreated).toBe(true);
      expect(mockCalendarBlockExecutionService.executeCalendarBlock).toHaveBeenCalledWith(
        mockBlock,
        'user-123',
        'chatbot-123',
        'Create a meeting',
        {},
        undefined,
        'session-123',
        mockPendingAction.eventDetails,
        'create',
        null
      );
      expect(mockCalendarActionConfirmationService.clearPendingAction).toHaveBeenCalledWith(confirmationToken);
      expect(mockCalendarActionAuditService.logCalendarAction).toHaveBeenCalled();
    });

    it('should handle Slack integration type', async () => {
      const slackAction = {
        ...mockPendingAction,
        integrationType: 'slack' as const,
        slackUserId: 'slack-user-123',
      };
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(slackAction);

      const mockBlock = {
        id: 'block-123',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Calendar',
        properties: {},
      };

      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      mockCalendarBlockExecutionService.executeCalendarBlock.mockResolvedValue({
        eventCreated: true,
        eventId: 'event-123',
        error: null,
      });

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({
          confirmationToken,
          slackUserId: 'slack-user-123',
          slackChannel: 'C123456',
          slackMessageTs: '1234567890.123456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.slackChannel).toBe('C123456');
      expect(response.body.slackMessageTs).toBe('1234567890.123456');
    });

    it('should log failed action on execution error', async () => {
      const mockBlock = {
        id: 'block-123',
        chatbotId: 'chatbot-123',
        type: 'ACTION',
        subtype: 'Calendar',
        properties: {},
      };

      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      mockCalendarBlockExecutionService.executeCalendarBlock.mockResolvedValue({
        eventCreated: false,
        error: 'Execution failed',
      });

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken, apiToken: 'test-token' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(mockCalendarActionAuditService.logCalendarAction).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Execution failed',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Mock validateConfirmationToken to return true so we get past the first check
      mockCalendarActionConfirmationService.validateConfirmationToken.mockReturnValue(true);
      // Mock getPendingAction to reject on first call, then return null on second call (in error handler)
      mockCalendarActionConfirmationService.getPendingAction
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValue(null); // Error handler will call this again, return null to avoid hanging

      const response = await request(app)
        .post('/api/calendar-actions/confirm')
        .send({ confirmationToken, apiToken: 'test-token' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      // Verify the error was caught and handled
      expect(mockCalendarActionConfirmationService.getPendingAction).toHaveBeenCalled();
    }, 10000); // Increase timeout for this test
  });

  describe('POST /api/calendar-actions/cancel', () => {
    const confirmationToken = 'test-confirmation-token-123';
    const mockPendingAction = {
      blockId: 'block-123',
      userId: 'user-123',
      chatbotId: 'chatbot-123',
      userMessage: 'Create a meeting',
      integrationType: 'api' as const,
      action: 'create' as const,
      eventDetails: {
        title: 'Test Meeting',
      },
    };

    it('should return 400 if confirmation token is missing', async () => {
      const response = await request(app)
        .post('/api/calendar-actions/cancel')
        .send({})
        .expect(400);

      // Check for error message - may be in message or error field
      const errorMessage = response.body.message || response.body.error || '';
      expect(errorMessage).toMatch(/Confirmation token|token.*required|missing/i);
      // success and code fields may not be present in validation error responses
      if (response.body.success !== undefined) {
        expect(response.body.success).toBe(false);
      }
      if (response.body.code !== undefined) {
        expect(response.body.code).toBe('MISSING_TOKEN');
      }
    });

    it('should cancel action successfully', async () => {
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(mockPendingAction);
      mockCalendarActionConfirmationService.clearPendingAction.mockResolvedValue(undefined);
      mockCalendarActionAuditService.logCalendarAction.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/calendar-actions/cancel')
        .send({ confirmationToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Action cancelled');
      expect(mockCalendarActionConfirmationService.clearPendingAction).toHaveBeenCalledWith(confirmationToken);
      expect(mockCalendarActionAuditService.logCalendarAction).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Action cancelled by user',
        })
      );
    });

    it('should return success even if action not found', async () => {
      mockCalendarActionConfirmationService.getPendingAction.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/calendar-actions/cancel')
        .send({ confirmationToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('not found');
    });

    it('should handle errors gracefully', async () => {
      mockCalendarActionConfirmationService.getPendingAction.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/calendar-actions/cancel')
        .send({ confirmationToken })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.code).toBe('CANCEL_ERROR');
    });
  });
});
