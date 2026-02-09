import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import axios from 'axios';
import * as slackOAuthService from '../../services/slackOAuthService';
import { SlackIntegration } from '@prisma/client';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    slackIntegration: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock axios
vi.mock('axios');
const mockAxios = axios as any;

// Mock logger
vi.mock('@shared/utils', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

describe('Slack OAuth Service', () => {
  const chatbotId = 'chatbot-123';
  const blockId = 'block-123';
  const integrationId = 'integration-123';
  const teamId = 'T123456';
  const teamName = 'Test Team';
  const botUserId = 'U123456';
  const botUserName = 'TestBot';
  const accessToken = 'xoxb-test-token';
  const clientId = '123456789.123456789';
  const clientSecret = 'secret-123';
  const signingSecret = 'signing-secret-123';
  const code = 'oauth-code-123';

  // Helper to encrypt a token (mimics the internal encryptToken function)
  // Must match exactly the logic in slackOAuthService.ts
  function encryptTestToken(token: string): string {
    const crypto = require('crypto');
    const SLACK_ENCRYPTION_KEY = process.env.SLACK_ENCRYPTION_KEY || 'default-key-change-in-production-32-bytes!!';
    const key = Buffer.from(SLACK_ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  const mockIntegration: SlackIntegration = {
    id: integrationId,
    chatbotId,
    blockId,
    clientId,
    clientSecret: encryptTestToken(clientSecret),
    signingSecret: encryptTestToken(signingSecret),
    teamId: null,
    teamName: null,
    accessToken: null,
    botUserId: null,
    botUserName: null,
    isActive: false,
    respondToMentions: true,
    respondInThreads: true,
    respondInDMs: true,
    respondInChannels: true,
    installedBy: null,
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Reset config cache to allow env var changes
    const { resetConfig } = await import('../../config');
    resetConfig();
    vi.clearAllMocks();
    process.env.API_URL = 'https://api.citadelai.app';
    // Use the same default as the service if not set
    process.env.SLACK_ENCRYPTION_KEY = process.env.SLACK_ENCRYPTION_KEY || 'default-key-change-in-production-32-bytes!!';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateOAuthState', () => {
    it('should generate base64 encoded state with chatbotId and blockId', () => {
      const state = slackOAuthService.generateOAuthState(chatbotId, blockId);
      
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      
      // Decode and verify
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      expect(decoded.chatbotId).toBe(chatbotId);
      expect(decoded.blockId).toBe(blockId);
      expect(decoded.timestamp).toBeGreaterThan(0);
    });

    it('should generate different states for different inputs', () => {
      const state1 = slackOAuthService.generateOAuthState(chatbotId, blockId);
      const state2 = slackOAuthService.generateOAuthState('chatbot-456', 'block-456');
      
      expect(state1).not.toBe(state2);
    });

    it('should include timestamp in state', () => {
      const before = Date.now();
      const state = slackOAuthService.generateOAuthState(chatbotId, blockId);
      const after = Date.now();
      
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      expect(decoded.timestamp).toBeGreaterThanOrEqual(before);
      expect(decoded.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('parseOAuthState', () => {
    it('should parse valid state and return chatbotId and blockId', () => {
      const state = slackOAuthService.generateOAuthState(chatbotId, blockId);
      const parsed = slackOAuthService.parseOAuthState(state);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.chatbotId).toBe(chatbotId);
      expect(parsed?.blockId).toBe(blockId);
    });

    it('should return null for invalid base64', () => {
      const parsed = slackOAuthService.parseOAuthState('invalid-base64!!!');
      expect(parsed).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const invalidState = Buffer.from('not-json').toString('base64');
      const parsed = slackOAuthService.parseOAuthState(invalidState);
      expect(parsed).toBeNull();
    });

    it('should return null for expired state (older than 5 minutes)', () => {
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const state = Buffer.from(JSON.stringify({
        chatbotId,
        blockId,
        timestamp: oldTimestamp,
      })).toString('base64');
      
      const parsed = slackOAuthService.parseOAuthState(state);
      expect(parsed).toBeNull();
    });

    it('should accept state within 5 minutes', () => {
      const recentTimestamp = Date.now() - 4 * 60 * 1000; // 4 minutes ago
      const state = Buffer.from(JSON.stringify({
        chatbotId,
        blockId,
        timestamp: recentTimestamp,
      })).toString('base64');
      
      const parsed = slackOAuthService.parseOAuthState(state);
      expect(parsed).not.toBeNull();
      expect(parsed?.chatbotId).toBe(chatbotId);
      expect(parsed?.blockId).toBe(blockId);
    });
  });

  describe('generateOAuthUrl', () => {
    it('should generate OAuth URL with correct parameters', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);

      const url = await slackOAuthService.generateOAuthUrl(chatbotId, blockId);

      expect(url).toContain('https://slack.com/oauth/v2/authorize');
      expect(url).toContain(`client_id=${clientId}`);
      expect(url).toContain('scope=');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=');
      
      const urlObj = new URL(url);
      expect(urlObj.searchParams.get('client_id')).toBe(clientId);
      expect(urlObj.searchParams.get('redirect_uri')).toBe('https://api.citadelai.app/api/admin/slack/oauth/callback');
    });

    it('should include all required scopes', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);

      const url = await slackOAuthService.generateOAuthUrl(chatbotId, blockId);
      const urlObj = new URL(url);
      const scopes = urlObj.searchParams.get('scope')?.split(',') || [];

      expect(scopes).toContain('app_mentions:read');
      expect(scopes).toContain('chat:write');
      expect(scopes).toContain('channels:history');
      expect(scopes).toContain('im:history');
      expect(scopes).toContain('users:read');
    });

    it('should throw error if integration not found', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);

      await expect(
        slackOAuthService.generateOAuthUrl(chatbotId, blockId)
      ).rejects.toThrow('Slack integration not found');
    });

    it('should throw error if clientId not configured', async () => {
      const integrationWithoutClientId = {
        ...mockIntegration,
        clientId: null,
      };
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(integrationWithoutClientId);

      await expect(
        slackOAuthService.generateOAuthUrl(chatbotId, blockId)
      ).rejects.toThrow('Slack Client ID is not configured');
    });

    it('should use custom API_URL from environment', async () => {
      // Reset config cache before setting env var
      const { resetConfig } = await import('../../config');
      process.env.API_URL = 'https://custom-api.example.com';
      resetConfig();
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);

      const url = await slackOAuthService.generateOAuthUrl(chatbotId, blockId);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('redirect_uri')).toBe('https://custom-api.example.com/api/admin/slack/oauth/callback');
    });

    it('should use default API_URL if not set', async () => {
      // Reset config cache before deleting env var
      const { resetConfig } = await import('../../config');
      delete process.env.API_URL;
      resetConfig();
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);

      const url = await slackOAuthService.generateOAuthUrl(chatbotId, blockId);
      const urlObj = new URL(url);

      expect(urlObj.searchParams.get('redirect_uri')).toBe('https://api.citadelai.app/api/admin/slack/oauth/callback');
    });
  });

  describe('exchangeCodeForToken', () => {
    const mockOAuthResponse = {
      ok: true,
      access_token: accessToken,
      team: {
        id: teamId,
        name: teamName,
      },
      bot_user_id: botUserId,
      authed_user: {
        id: 'U789012',
      },
    };

    it('should exchange code for token successfully', async () => {
      mockAxios.post.mockResolvedValue({
        data: mockOAuthResponse,
      });

      // mockIntegration already has encrypted clientSecret from beforeEach
      const result = await slackOAuthService.exchangeCodeForToken(code, mockIntegration);

      expect(result.access_token).toBe(accessToken);
      expect(result.team).toEqual({ id: teamId, name: teamName });
      expect(result.bot_user_id).toBe(botUserId);
      expect(result.authed_user).toEqual({ id: 'U789012' });
      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://slack.com/api/oauth.v2.access',
        expect.stringContaining('client_id='),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
      
      // Verify client_secret was included in the request (decrypted)
      const callArgs = mockAxios.post.mock.calls[0];
      const params = new URLSearchParams(callArgs[1]);
      expect(params.get('client_secret')).toBe(clientSecret);
    });

    it('should include correct parameters in request', async () => {
      mockAxios.post.mockResolvedValue({
        data: mockOAuthResponse,
      });

      await slackOAuthService.exchangeCodeForToken(code, mockIntegration);

      const callArgs = mockAxios.post.mock.calls[0];
      const params = new URLSearchParams(callArgs[1]);

      expect(params.get('client_id')).toBe(clientId);
      expect(params.get('code')).toBe(code);
      expect(params.get('redirect_uri')).toBe('https://api.citadelai.app/api/admin/slack/oauth/callback');
    });

    it('should throw error if Slack API returns error', async () => {
      mockAxios.post.mockResolvedValue({
        data: {
          ok: false,
          error: 'invalid_code',
        },
      });

      await expect(
        slackOAuthService.exchangeCodeForToken(code, mockIntegration)
      ).rejects.toThrow('invalid_code');
    });

    it('should throw generic error if no error message', async () => {
      mockAxios.post.mockResolvedValue({
        data: {
          ok: false,
        },
      });

      await expect(
        slackOAuthService.exchangeCodeForToken(code, mockIntegration)
      ).rejects.toThrow('Failed to exchange code for token');
    });

    it('should use custom API_URL from environment', async () => {
      // Reset config cache before setting env var
      const { resetConfig } = await import('../../config');
      process.env.API_URL = 'https://custom-api.example.com';
      resetConfig();
      mockAxios.post.mockResolvedValue({
        data: mockOAuthResponse,
      });

      await slackOAuthService.exchangeCodeForToken(code, mockIntegration);

      const callArgs = mockAxios.post.mock.calls[0];
      const params = new URLSearchParams(callArgs[1]);
      expect(params.get('redirect_uri')).toBe('https://custom-api.example.com/api/admin/slack/oauth/callback');
    });
  });

  describe('getBotUserInfo', () => {
    const mockUserResponse = {
      ok: true,
      user: {
        id: botUserId,
        name: botUserName,
      },
    };

    it('should get bot user info successfully', async () => {
      mockAxios.get.mockResolvedValue({
        data: mockUserResponse,
      });

      const result = await slackOAuthService.getBotUserInfo(accessToken, botUserId);

      expect(result).toEqual({
        id: botUserId,
        name: botUserName,
      });
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://slack.com/api/users.info',
        expect.objectContaining({
          params: { user: botUserId },
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      );
    });

    it('should throw error if Slack API returns error', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          ok: false,
          error: 'user_not_found',
        },
      });

      await expect(
        slackOAuthService.getBotUserInfo(accessToken, botUserId)
      ).rejects.toThrow('user_not_found');
    });

    it('should throw generic error if no error message', async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          ok: false,
        },
      });

      await expect(
        slackOAuthService.getBotUserInfo(accessToken, botUserId)
      ).rejects.toThrow('Failed to get bot user info');
    });
  });

  describe('completeSlackInstallation', () => {
    const oauthData = {
      access_token: accessToken,
      team: { id: teamId, name: teamName },
      bot_user_id: botUserId,
    };

    it('should complete installation and update integration', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockAxios.get.mockResolvedValue({
        data: {
          ok: true,
          user: {
            id: botUserId,
            name: botUserName,
          },
        },
      });
      const encryptedToken = encryptTestToken(accessToken);
      const updatedIntegration = {
        ...mockIntegration,
        teamId,
        teamName,
        accessToken: encryptedToken,
        botUserId,
        botUserName,
        isActive: true,
        lastUsedAt: new Date(),
      };
      mockPrisma.slackIntegration.update.mockResolvedValue(updatedIntegration);

      const result = await slackOAuthService.completeSlackInstallation(blockId, oauthData);

      expect(result).toEqual(updatedIntegration);
      expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: expect.objectContaining({
          teamId,
          teamName,
          accessToken: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/), // Encrypted token format
          botUserId,
          botUserName,
          isActive: true,
          lastUsedAt: expect.any(Date),
        }),
      });
      
      // Verify the token was encrypted (not plain text)
      const updateCall = mockPrisma.slackIntegration.update.mock.calls[0][0];
      expect(updateCall.data.accessToken).not.toBe(accessToken);
      expect(updateCall.data.accessToken).toContain(':');
    });

    it('should throw error if integration not found', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);

      await expect(
        slackOAuthService.completeSlackInstallation(blockId, oauthData)
      ).rejects.toThrow('Slack integration not found');
    });

    it('should get bot user info before updating', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockAxios.get.mockResolvedValue({
        data: {
          ok: true,
          user: {
            id: botUserId,
            name: botUserName,
          },
        },
      });
      mockPrisma.slackIntegration.update.mockResolvedValue(mockIntegration);

      await slackOAuthService.completeSlackInstallation(blockId, oauthData);

      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://slack.com/api/users.info',
        expect.objectContaining({
          params: { user: botUserId },
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      );
    });
  });

  describe('getSlackIntegrationByBlockId', () => {
    it('should return integration if found', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(mockIntegration);

      const result = await slackOAuthService.getSlackIntegrationByBlockId(blockId);

      expect(result).toEqual(mockIntegration);
      expect(mockPrisma.slackIntegration.findUnique).toHaveBeenCalledWith({
        where: { blockId },
      });
    });

    it('should return null if not found', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);

      const result = await slackOAuthService.getSlackIntegrationByBlockId(blockId);

      expect(result).toBeNull();
    });
  });

  describe('getSlackIntegrationByTeamId', () => {
    it('should return integration if found', async () => {
      const integrationWithTeam = {
        ...mockIntegration,
        teamId,
      };
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(integrationWithTeam);

      const result = await slackOAuthService.getSlackIntegrationByTeamId(teamId);

      expect(result).toEqual(integrationWithTeam);
      expect(mockPrisma.slackIntegration.findUnique).toHaveBeenCalledWith({
        where: { teamId },
      });
    });

    it('should return null if not found', async () => {
      mockPrisma.slackIntegration.findUnique.mockResolvedValue(null);

      const result = await slackOAuthService.getSlackIntegrationByTeamId(teamId);

      expect(result).toBeNull();
    });
  });

  describe('getDecryptedAccessToken', () => {
    it('should return decrypted access token', () => {
      // Create an integration with encrypted token
      const encryptedToken = encryptTestToken(accessToken);
      const integrationWithToken = {
        ...mockIntegration,
        accessToken: encryptedToken,
      };

      const result = slackOAuthService.getDecryptedAccessToken(integrationWithToken);
      expect(result).toBe(accessToken);
    });

    it('should throw error if access token not available', () => {
      const integrationWithoutToken = {
        ...mockIntegration,
        accessToken: null,
      };

      expect(() => {
        slackOAuthService.getDecryptedAccessToken(integrationWithoutToken);
      }).toThrow('Access token not available');
    });
  });

  describe('getDecryptedSigningSecret', () => {
    it('should return decrypted signing secret', () => {
      const encryptedSecret = encryptTestToken(signingSecret);
      const integrationWithSecret = {
        ...mockIntegration,
        signingSecret: encryptedSecret,
      };

      const result = slackOAuthService.getDecryptedSigningSecret(integrationWithSecret);
      expect(result).toBe(signingSecret);
    });
  });

  describe('createOrUpdateSlackIntegration', () => {
    const credentials = {
      clientId,
      clientSecret,
      signingSecret,
    };

    it('should create new integration if not exists', async () => {
      mockPrisma.slackIntegration.upsert.mockResolvedValue(mockIntegration);

      const result = await slackOAuthService.createOrUpdateSlackIntegration(
        chatbotId,
        blockId,
        credentials,
        'user-123'
      );

      expect(result).toEqual(mockIntegration);
      expect(mockPrisma.slackIntegration.upsert).toHaveBeenCalledWith({
        where: { blockId },
        update: expect.objectContaining({
          clientId,
          clientSecret: expect.any(String), // Encrypted
          signingSecret: expect.any(String), // Encrypted
          installedBy: 'user-123',
        }),
        create: expect.objectContaining({
          chatbotId,
          blockId,
          clientId,
          clientSecret: expect.any(String), // Encrypted
          signingSecret: expect.any(String), // Encrypted
          installedBy: 'user-123',
        }),
      });
    });

    it('should update existing integration', async () => {
      const existingIntegration = {
        ...mockIntegration,
        teamId,
        accessToken: 'existing-token',
      };
      mockPrisma.slackIntegration.upsert.mockResolvedValue(existingIntegration);

      const result = await slackOAuthService.createOrUpdateSlackIntegration(
        chatbotId,
        blockId,
        credentials,
        'user-123'
      );

      expect(result).toEqual(existingIntegration);
      expect(mockPrisma.slackIntegration.upsert).toHaveBeenCalled();
    });

    it('should encrypt clientSecret and signingSecret', async () => {
      mockPrisma.slackIntegration.upsert.mockResolvedValue(mockIntegration);

      await slackOAuthService.createOrUpdateSlackIntegration(
        chatbotId,
        blockId,
        credentials,
        'user-123'
      );

      const upsertCall = mockPrisma.slackIntegration.upsert.mock.calls[0][0];
      
      // Verify secrets are encrypted (not plain text)
      expect(upsertCall.update.clientSecret).not.toBe(clientSecret);
      expect(upsertCall.update.signingSecret).not.toBe(signingSecret);
      expect(upsertCall.create.clientSecret).not.toBe(clientSecret);
      expect(upsertCall.create.signingSecret).not.toBe(signingSecret);
    });
  });

  describe('revokeSlackIntegration', () => {
    it('should set isActive to false', async () => {
      mockPrisma.slackIntegration.update.mockResolvedValue({
        ...mockIntegration,
        isActive: false,
      });

      await slackOAuthService.revokeSlackIntegration(integrationId);

      expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: {
          isActive: false,
        },
      });
    });
  });

  describe('updateSlackIntegration', () => {
    it('should update integration configuration', async () => {
      const updates = {
        respondToMentions: false,
        respondInThreads: false,
        respondInDMs: true,
        respondInChannels: true,
      };
      const updatedIntegration = {
        ...mockIntegration,
        ...updates,
      };
      mockPrisma.slackIntegration.update.mockResolvedValue(updatedIntegration);

      const result = await slackOAuthService.updateSlackIntegration(integrationId, updates);

      expect(result).toEqual(updatedIntegration);
      expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: updates,
      });
    });

    it('should update partial configuration', async () => {
      const updates = {
        respondToMentions: false,
      };
      const updatedIntegration = {
        ...mockIntegration,
        respondToMentions: false,
      };
      mockPrisma.slackIntegration.update.mockResolvedValue(updatedIntegration);

      const result = await slackOAuthService.updateSlackIntegration(integrationId, updates);

      expect(result).toEqual(updatedIntegration);
      expect(mockPrisma.slackIntegration.update).toHaveBeenCalledWith({
        where: { id: integrationId },
        data: updates,
      });
    });
  });
});
