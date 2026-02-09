import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import slackRouter from '../../routes/slack';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    slackIntegration: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Mock Prisma lib
vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
  getPrismaClient: () => mockPrisma,
}));

// Mock Slack OAuth service - use vi.hoisted
const { mockSlackOAuthService } = vi.hoisted(() => {
  const mockSlackOAuthService = {
    generateOAuthUrl: vi.fn(),
    parseOAuthState: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    completeSlackInstallation: vi.fn(),
    createOrUpdateSlackIntegration: vi.fn(),
    getSlackIntegrationByBlockId: vi.fn(),
    getSlackIntegrationByTeamId: vi.fn(),
    revokeSlackIntegration: vi.fn(),
    updateSlackIntegration: vi.fn(),
    getDecryptedSigningSecret: vi.fn(),
    getDecryptedAccessToken: vi.fn(),
  };
  return { mockSlackOAuthService };
});

vi.mock('../../services/slackOAuthService', () => ({
  generateOAuthUrl: mockSlackOAuthService.generateOAuthUrl,
  parseOAuthState: mockSlackOAuthService.parseOAuthState,
  exchangeCodeForToken: mockSlackOAuthService.exchangeCodeForToken,
  completeSlackInstallation: mockSlackOAuthService.completeSlackInstallation,
  createOrUpdateSlackIntegration: mockSlackOAuthService.createOrUpdateSlackIntegration,
  getSlackIntegrationByBlockId: mockSlackOAuthService.getSlackIntegrationByBlockId,
  getSlackIntegrationByTeamId: mockSlackOAuthService.getSlackIntegrationByTeamId,
  revokeSlackIntegration: mockSlackOAuthService.revokeSlackIntegration,
  updateSlackIntegration: mockSlackOAuthService.updateSlackIntegration,
  getDecryptedSigningSecret: mockSlackOAuthService.getDecryptedSigningSecret,
  getDecryptedAccessToken: mockSlackOAuthService.getDecryptedAccessToken,
}));

// Mock Slack webhook service - use vi.hoisted
const { mockSlackWebhookService } = vi.hoisted(() => {
  const mockSlackWebhookService = {
    verifyWebhookSignature: vi.fn(),
    handleUrlVerification: vi.fn(),
  };
  return { mockSlackWebhookService };
});

vi.mock('../../services/slackWebhookService', () => ({
  verifyWebhookSignature: mockSlackWebhookService.verifyWebhookSignature,
  handleUrlVerification: mockSlackWebhookService.handleUrlVerification,
  SlackEvent: {},
}));

// Mock Slack message processor - use vi.hoisted
const { mockSlackMessageProcessor } = vi.hoisted(() => {
  const mockSlackMessageProcessor = {
    processSlackMessage: vi.fn(),
    sendSlackResponse: vi.fn(),
  };
  return { mockSlackMessageProcessor };
});

vi.mock('../../services/slackMessageProcessor', () => ({
  processSlackMessage: mockSlackMessageProcessor.processSlackMessage,
  sendSlackResponse: mockSlackMessageProcessor.sendSlackResponse,
}));

// Mock Slack API client - use vi.hoisted
const { mockSlackApiClient, MockSlackApiClient } = vi.hoisted(() => {
  const mockPostMessage = vi.fn();
  const mockUpdateMessage = vi.fn();
  const mockSlackApiClientInstance = {
    postMessage: mockPostMessage,
    updateMessage: mockUpdateMessage,
  };
  const MockSlackApiClient = vi.fn(() => mockSlackApiClientInstance);
  return { mockSlackApiClient: mockSlackApiClientInstance, MockSlackApiClient };
});

vi.mock('../../services/slackApiClient', () => ({
  SlackApiClient: MockSlackApiClient,
}));

// Mock service registry - use vi.hoisted
const { mockServiceRegistry } = vi.hoisted(() => {
  const mockServiceRegistry = {
    getServiceBaseUrl: vi.fn(() => 'http://localhost:3003'),
  };
  return { mockServiceRegistry };
});

vi.mock('@shared/utils', async () => {
  const actual = await vi.importActual('@shared/utils');
  return {
    ...actual as any,
    getServiceBaseUrl: mockServiceRegistry.getServiceBaseUrl,
    logger: {
      child: vi.fn(() => ({
        error: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
      })),
    },
  };
});

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = {
      id: 'admin-id',
      email: 'admin@example.com',
      name: 'Admin User',
    };
    next();
  },
  AdminAuthRequest: {},
}));

describe('Slack Routes', () => {
  let app: express.Application;
  const chatbotId = 'chatbot-123';
  const blockId = 'block-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/slack', slackRouter);
    process.env.FRONTEND_URL = 'https://admin.citadelai.app';
    vi.clearAllMocks();
    
    // Reset SlackApiClient mocks
    mockSlackApiClient.postMessage.mockReset();
    mockSlackApiClient.updateMessage.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/slack/oauth/start', () => {
    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: 'FRONTEND',
        subtype: 'Slack',
      });
    });

    it('should return 400 if chatbotId is missing', async () => {
      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ blockId })
        .expect(400);

      expect(response.body.error).toContain('chatbotId and blockId are required');
    });

    it('should return 400 if blockId is missing', async () => {
      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ chatbotId })
        .expect(400);

      expect(response.body.error).toContain('chatbotId and blockId are required');
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ chatbotId, blockId })
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ chatbotId, blockId })
        .expect(404);

      expect(response.body.error).toBe('Slack block not found');
    });

    it('should generate OAuth URL successfully', async () => {
      const mockOAuthUrl = 'https://slack.com/oauth/v2/authorize?client_id=...';
      mockSlackOAuthService.generateOAuthUrl.mockResolvedValue(mockOAuthUrl);

      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ chatbotId, blockId })
        .expect(200);

      expect(response.body.oauthUrl).toBe(mockOAuthUrl);
      expect(mockSlackOAuthService.generateOAuthUrl).toHaveBeenCalledWith(chatbotId, blockId);
    });

    it('should return 500 if generateOAuthUrl fails', async () => {
      mockSlackOAuthService.generateOAuthUrl.mockRejectedValue(new Error('OAuth URL generation failed'));

      const response = await request(app)
        .get('/api/admin/slack/oauth/start')
        .query({ chatbotId, blockId })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/slack/oauth/callback', () => {
    it('should redirect with error if OAuth provider returns error', async () => {
      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ error: 'access_denied' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=access_denied');
    });

    it('should redirect with error if code is missing', async () => {
      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=missing_params');
    });

    it('should redirect with error if state is invalid', async () => {
      mockSlackOAuthService.parseOAuthState.mockReturnValue(null);

      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=invalid_state');
    });

    it('should exchange code and redirect on success', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
      };

      mockSlackOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockSlackOAuthService.getSlackIntegrationByBlockId.mockResolvedValue({
        id: 'integration-id',
        blockId: blockId,
      });
      mockSlackOAuthService.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'token-123',
        teamId: 'team-123',
        teamName: 'Test Team',
      });
      mockSlackOAuthService.completeSlackInstallation.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_success=true');
      expect(mockSlackOAuthService.exchangeCodeForToken).toHaveBeenCalled();
      expect(mockSlackOAuthService.completeSlackInstallation).toHaveBeenCalled();
    });

    it('should redirect with error if integration not found', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
      };

      mockSlackOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockSlackOAuthService.getSlackIntegrationByBlockId.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=integration_not_found');
    });

    it('should redirect with error if exchangeCodeForToken fails', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
      };

      mockSlackOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockSlackOAuthService.getSlackIntegrationByBlockId.mockResolvedValue({
        id: 'integration-id',
        blockId: blockId,
      });
      mockSlackOAuthService.exchangeCodeForToken.mockRejectedValue(new Error('Token exchange failed'));

      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=');
    });

    it('should redirect with error if completeSlackInstallation fails', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
      };

      mockSlackOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockSlackOAuthService.getSlackIntegrationByBlockId.mockResolvedValue({
        id: 'integration-id',
        blockId: blockId,
      });
      mockSlackOAuthService.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'token-123',
        teamId: 'team-123',
        teamName: 'Test Team',
      });
      mockSlackOAuthService.completeSlackInstallation.mockRejectedValue(new Error('Installation failed'));

      const response = await request(app)
        .get('/api/admin/slack/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('slack_error=');
    });
  });

  describe('POST /api/admin/slack/events', () => {
    it('should return 400 if signature is missing', async () => {
      const response = await request(app)
        .post('/api/admin/slack/events')
        .send({ type: 'event_callback' })
        .expect(400);

      expect(response.body.error).toContain('Missing signature or timestamp');
    });

    it('should return 400 if timestamp is missing', async () => {
      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .send({ type: 'event_callback' })
        .expect(400);

      expect(response.body.error).toContain('Missing signature or timestamp');
    });

    it('should handle URL verification challenge', async () => {
      const challenge = 'challenge-token';
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(challenge);

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ type: 'url_verification', challenge })
        .expect(200);

      // Route returns res.json(challenge) which sends the string directly
      expect(response.body).toBe(challenge);
    });

    it('should process event callback', async () => {
      // Ensure handleUrlVerification returns null/undefined for event_callback
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      // Mock integration lookup - must have response settings enabled
      // The integration object must have all properties that the route accesses
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: true, // Enable channel responses so message is processed
        respondInDMs: false,
        respondToMentions: false,
        respondInThreads: false,
        // Ensure all properties are explicitly set (not undefined)
        accessToken: null,
        teamName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any; // Use 'as any' to ensure all properties are accessible
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Test response',
        sources: [],
        followUps: [],
      });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).toHaveBeenCalled();
    });

    it('should return 400 if team_id is missing', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          event: {
            type: 'message',
            text: 'Hello',
          },
        })
        .expect(400);

      expect(response.body.error).toBe('Missing team_id');
    });

    it('should return 404 if integration not found', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
          },
        })
        .expect(404);

      expect(response.body.error).toBe('Integration not found');
    });

    it('should return 401 if signature verification fails', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(false);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
          },
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid signature');
    });

    it('should skip retry events', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          retry_reason: 'http_timeout',
          event: {
            type: 'message',
            text: 'Hello',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should ignore bot messages', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: true,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            bot_id: 'B123456',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should ignore messages with subtypes other than file_share', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: true,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            subtype: 'message_changed',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should not process events when integration is inactive', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: false, // Inactive
        signingSecret: 'encrypted-secret',
        respondInChannels: true,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should process file_share subtype messages', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: true,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Test response',
        sources: [],
        followUps: [],
      });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            subtype: 'file_share',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).toHaveBeenCalled();
    });

    it('should handle app_mention events when respondToMentions is enabled', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondToMentions: true,
        respondInChannels: false,
        respondInDMs: false,
        respondInThreads: false,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Test response',
        sources: [],
        followUps: [],
      });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'app_mention',
            text: '<@U123456> Hello',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).toHaveBeenCalled();
    });

    it('should handle DM messages when respondInDMs is enabled', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInDMs: true,
        respondInChannels: false,
        respondToMentions: false,
        respondInThreads: false,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Test response',
        sources: [],
        followUps: [],
      });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'D123456', // DM channel ID starts with 'D'
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).toHaveBeenCalled();
    });

    it('should handle thread messages when respondInThreads is enabled', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInThreads: true,
        respondInChannels: false,
        respondInDMs: false,
        respondToMentions: false,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Test response',
        sources: [],
        followUps: [],
      });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'C123456',
            user: 'U123456',
            thread_ts: '1234567890.123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).toHaveBeenCalled();
    });

    it('should not process messages when no response settings are enabled', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: false,
        respondInDMs: false,
        respondToMentions: false,
        respondInThreads: false,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should handle events without event property', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'some_other_type',
          team_id: 'team-123',
        })
        .expect(200);

      expect(response.body).toEqual({});
      expect(mockSlackMessageProcessor.processSlackMessage).not.toHaveBeenCalled();
    });

    it('should handle errors when processing events', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        respondInChannels: true,
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      mockSlackMessageProcessor.processSlackMessage.mockRejectedValue(new Error('Processing failed'));

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'message',
            text: 'Hello',
            channel: 'C123456',
            user: 'U123456',
          },
        })
        .expect(200);

      // Route responds immediately, errors are logged but don't affect response
      expect(response.body).toEqual({});
    });

    it('should handle assistant_thread_started event', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        accessToken: 'encrypted-token',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      mockSlackOAuthService.getDecryptedAccessToken.mockReturnValue('decrypted-token');

      // Mock SlackApiClient
      mockSlackApiClient.postMessage.mockResolvedValue({ ok: true });

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'assistant_thread_started',
            user: 'U123456',
            thread_id: 'thread-123',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
      // Note: assistant thread handling is async, so we can't easily verify it was called
      // But the test ensures the route doesn't crash
    });

    it('should handle assistant_thread_context_changed event', async () => {
      mockSlackWebhookService.handleUrlVerification.mockReturnValue(null);
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
      
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');

      const response = await request(app)
        .post('/api/admin/slack/events')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({
          type: 'event_callback',
          team_id: 'team-123',
          event: {
            type: 'assistant_thread_context_changed',
            user: 'U123456',
            thread_id: 'thread-123',
            channel_id: 'C123456',
          },
        })
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('POST /api/admin/slack/interactive', () => {
    beforeEach(() => {
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        chatbotId: chatbotId,
        isActive: true,
        signingSecret: 'encrypted-secret',
        accessToken: 'encrypted-token',
      } as any;
      
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(mockIntegration);
      mockSlackOAuthService.getDecryptedSigningSecret.mockReturnValue('decrypted-signing-secret');
      mockSlackOAuthService.getDecryptedAccessToken.mockReturnValue('decrypted-token');
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(true);
    });

    it('should return 400 if signature is missing', async () => {
      const response = await request(app)
        .post('/api/admin/slack/interactive')
        .send({ payload: JSON.stringify({ team: { id: 'team-123' } }) })
        .expect(400);

      expect(response.body.error).toContain('Missing signature or timestamp');
    });

    it('should return 400 if timestamp is missing', async () => {
      const response = await request(app)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .send({ payload: JSON.stringify({ team: { id: 'team-123' } }) })
        .expect(400);

      expect(response.body.error).toContain('Missing signature or timestamp');
    });

    it('should return 400 if team_id is missing', async () => {
      const response = await request(app)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ payload: JSON.stringify({}) })
        .expect(400);

      expect(response.body.error).toBe('Missing team_id');
    });

    it('should return 404 if integration not found', async () => {
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockResolvedValue(null);

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use((req: any, res: any, next: any) => {
        const payloadObj = { team: { id: 'team-123' } };
        req.rawBody = 'payload=' + encodeURIComponent(JSON.stringify(payloadObj));
        req.body = payloadObj; // Route expects parsed object
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ team: { id: 'team-123' } })
        .expect(404);

      expect(response.body.error).toBe('Integration not found');
    });

    it('should return 400 if raw body is missing', async () => {
      // Create app without rawBody middleware to simulate missing rawBody
      const appWithoutRawBody = express();
      appWithoutRawBody.use(express.json());
      appWithoutRawBody.use((req: any, res: any, next: any) => {
        // Set body but not rawBody
        req.body = { team: { id: 'team-123' } };
        next();
      });
      appWithoutRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithoutRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .send({ team: { id: 'team-123' } })
        .expect(400);

      expect(response.body.error).toBe('Missing raw body');
    });

    it('should return 401 if signature verification fails', async () => {
      mockSlackWebhookService.verifyWebhookSignature.mockReturnValue(false);

      // Create a request with rawBody (simulated)
      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use(express.urlencoded({ extended: true }));
      appWithRawBody.use((req: any, res: any, next: any) => {
        const payload = { team: { id: 'team-123' } };
        const rawBodyStr = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.rawBody = rawBodyStr;
        // Parse the payload from the raw body
        if (req.body && req.body.payload) {
          req.body = JSON.parse(req.body.payload);
        } else {
          req.body = payload;
        }
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify({ team: { id: 'team-123' } })))
        .expect(401);

      expect(response.body.error).toBe('Invalid signature');
    });

    it('should acknowledge requests without actions', async () => {
      // Create a request with rawBody
      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use(express.urlencoded({ extended: true }));
      appWithRawBody.use((req: any, res: any, next: any) => {
        const payload = { team: { id: 'team-123' } };
        const rawBodyStr = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.rawBody = rawBodyStr;
        // Parse the payload from the raw body
        if (req.body && req.body.payload) {
          req.body = JSON.parse(req.body.payload);
        } else {
          req.body = payload;
        }
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify({ team: { id: 'team-123' } })))
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle show_sources action', async () => {
      mockSlackApiClient.postMessage.mockResolvedValue({ ok: true });

      const payload = {
        team: { id: 'team-123' },
        actions: [{
          action_id: 'show_sources',
          value: JSON.stringify({
            sources: [
              { type: 'website', url: 'https://example.com', title: 'Example' },
              { type: 'document', fileName: 'test.pdf' },
            ],
            threadTs: '1234567890.123456',
          }),
        }],
        channel: { id: 'C123456' },
        message: { thread_ts: '1234567890.123456' },
      };

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use((req: any, res: any, next: any) => {
        req.rawBody = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.body = payload; // Route expects parsed object directly
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify(payload)))
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      // Note: postMessage is called asynchronously, so we can't easily verify it here
    });

    it('should handle follow_up actions', async () => {
      mockSlackMessageProcessor.processSlackMessage.mockResolvedValue({
        response: 'Follow-up response',
        sources: [],
        followUps: [],
      });

      const payload = {
        team: { id: 'team-123' },
        actions: [{
          action_id: 'follow_up_0',
          value: 'What is the weather?',
        }],
        channel: { id: 'C123456' },
        user: { id: 'U123456' },
        message: { thread_ts: '1234567890.123456' },
      };

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use((req: any, res: any, next: any) => {
        req.rawBody = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.body = payload; // Route expects parsed object directly
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify(payload)))
        .expect(200);

      expect(response.body).toEqual({ ok: true });
      // Note: processSlackMessage is called asynchronously
    });

    it('should handle calendar_action_confirm', async () => {
      mockSlackApiClient.updateMessage.mockResolvedValue({ ok: true });

      // Mock fetch for calendar action confirmation
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      } as Response);

      const payload = {
        team: { id: 'team-123' },
        actions: [{
          action_id: 'calendar_action_confirm',
          value: JSON.stringify({
            token: 'confirmation-token',
            action: 'create',
          }),
        }],
        channel: { id: 'C123456' },
        user: { id: 'U123456' },
        message: { ts: '1234567890.123456' },
      };

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use((req: any, res: any, next: any) => {
        req.rawBody = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.body = payload; // Route expects parsed object directly
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);
      process.env.INTERNAL_SERVICE_TOKEN = 'test-token';

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify(payload)))
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle calendar_action_cancel', async () => {
      mockSlackApiClient.updateMessage.mockResolvedValue({ ok: true });

      // Mock fetch for calendar action cancellation
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({ success: true }),
      } as Response);

      const payload = {
        team: { id: 'team-123' },
        actions: [{
          action_id: 'calendar_action_cancel',
          value: 'cancellation-token',
        }],
        channel: { id: 'C123456' },
        message: { ts: '1234567890.123456' },
      };

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use((req: any, res: any, next: any) => {
        req.rawBody = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.body = payload; // Route expects parsed object directly
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);
      process.env.INTERNAL_SERVICE_TOKEN = 'test-token';
      process.env.USER_BACKEND_URL = 'http://user-backend:3003';

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify(payload)))
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });

    it('should handle errors in interactive handler', async () => {
      mockSlackOAuthService.getSlackIntegrationByTeamId.mockRejectedValue(new Error('Database error'));

      const appWithRawBody = express();
      appWithRawBody.use(express.json());
      appWithRawBody.use(express.urlencoded({ extended: true }));
      appWithRawBody.use((req: any, res: any, next: any) => {
        const payload = { team: { id: 'team-123' } };
        const rawBodyStr = 'payload=' + encodeURIComponent(JSON.stringify(payload));
        req.rawBody = rawBodyStr;
        if (req.body && req.body.payload) {
          req.body = JSON.parse(req.body.payload);
        } else {
          req.body = payload;
        }
        next();
      });
      appWithRawBody.use('/api/admin/slack', slackRouter);

      const response = await request(appWithRawBody)
        .post('/api/admin/slack/interactive')
        .set('x-slack-signature', 'signature-123')
        .set('x-slack-request-timestamp', '1234567890')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('payload=' + encodeURIComponent(JSON.stringify({ team: { id: 'team-123' } })))
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/slack/chatbots/:chatbotId/slack/integration', () => {
    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return null integration if no Slack block found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [],
      });

      const response = await request(app)
        .get(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(200);

      expect(response.body.integration).toBeNull();
    });

    it('should return null integration if Slack block has no integration', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: null,
          },
        ],
      });

      const response = await request(app)
        .get(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(200);

      expect(response.body.integration).toBeNull();
    });

    it('should return integration details', async () => {
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        teamName: 'Test Team',
        isActive: true,
      };

      // Mock chatbot with blocks array including Slack block and integration
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: mockIntegration,
          },
        ],
      });

      const response = await request(app)
        .get(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(200);

      expect(response.body.integration).toEqual(mockIntegration);
    });
  });

  describe('POST /api/admin/slack/chatbots/:chatbotId/slack/integration/credentials', () => {
    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });
    });

    it('should return 400 if clientId is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/slack/chatbots/${chatbotId}/slack/integration/credentials`)
        .send({ clientSecret: 'secret-123' })
        .expect(400);

      expect(response.body.error).toContain('blockId, clientId, clientSecret, and signingSecret are required');
    });

    it('should create or update integration credentials', async () => {
      const mockIntegration = {
        id: 'integration-id',
        chatbotId: chatbotId,
        blockId: blockId,
        teamId: 'team-123',
        teamName: 'Test Team',
        isActive: true,
      };
      
      mockSlackOAuthService.createOrUpdateSlackIntegration.mockResolvedValue(mockIntegration);

      const response = await request(app)
        .post(`/api/admin/slack/chatbots/${chatbotId}/slack/integration/credentials`)
        .send({
          blockId: blockId,
          clientId: 'client-123',
          clientSecret: 'secret-123',
          signingSecret: 'signing-secret-123',
        })
        .expect(200);

      // Route returns { integration: safeIntegration }, not { success: true }
      expect(response.body.integration).toBeDefined();
      expect(response.body.integration.id).toBe('integration-id');
      expect(mockSlackOAuthService.createOrUpdateSlackIntegration).toHaveBeenCalled();
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/slack/chatbots/${chatbotId}/slack/integration/credentials`)
        .send({
          blockId: blockId,
          clientId: 'client-123',
          clientSecret: 'secret-123',
          signingSecret: 'signing-secret-123',
        })
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 500 if createOrUpdateSlackIntegration fails', async () => {
      mockSlackOAuthService.createOrUpdateSlackIntegration.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/admin/slack/chatbots/${chatbotId}/slack/integration/credentials`)
        .send({
          blockId: blockId,
          clientId: 'client-123',
          clientSecret: 'secret-123',
          signingSecret: 'signing-secret-123',
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PATCH /api/admin/slack/chatbots/:chatbotId/slack/integration', () => {
    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });
    });

    it('should update integration', async () => {
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        teamName: 'Test Team',
        isActive: true,
      };

      // Mock chatbot with blocks array including Slack block and integration
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: mockIntegration,
          },
        ],
      });

      const updatedIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        teamName: 'Test Team',
        isActive: true,
        enabled: true,
      };

      mockSlackOAuthService.updateSlackIntegration.mockResolvedValue(updatedIntegration);

      const response = await request(app)
        .patch(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .send({
          enabled: true,
        })
        .expect(200);

      // Route returns { integration: safeIntegration }, not { success: true }
      expect(response.body.integration).toBeDefined();
      expect(response.body.integration.id).toBe('integration-id');
      expect(mockSlackOAuthService.updateSlackIntegration).toHaveBeenCalled();
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .patch(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .send({ enabled: true })
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if no Slack block found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [],
      });

      const response = await request(app)
        .patch(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .send({ enabled: true })
        .expect(404);

      expect(response.body.error).toBe('Slack integration not found');
    });

    it('should return 500 if updateSlackIntegration fails', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: { id: 'integration-id' },
          },
        ],
      });

      mockSlackOAuthService.updateSlackIntegration.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .patch(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .send({ enabled: true })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/admin/slack/chatbots/:chatbotId/slack/integration', () => {
    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });
    });

    it('should revoke integration', async () => {
      const mockIntegration = {
        id: 'integration-id',
        teamId: 'team-123',
        teamName: 'Test Team',
        isActive: true,
      };

      // Mock chatbot with blocks array including Slack block and integration
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: mockIntegration,
          },
        ],
      });

      mockSlackOAuthService.revokeSlackIntegration.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockSlackOAuthService.revokeSlackIntegration).toHaveBeenCalled();
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if no Slack block found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [],
      });

      const response = await request(app)
        .delete(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(404);

      expect(response.body.error).toBe('Slack integration not found');
    });

    it('should return 500 if revokeSlackIntegration fails', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
        blocks: [
          {
            id: blockId,
            subtype: 'Slack',
            slackIntegration: { id: 'integration-id' },
          },
        ],
      });

      mockSlackOAuthService.revokeSlackIntegration.mockRejectedValue(new Error('Revoke failed'));

      const response = await request(app)
        .delete(`/api/admin/slack/chatbots/${chatbotId}/slack/integration`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
