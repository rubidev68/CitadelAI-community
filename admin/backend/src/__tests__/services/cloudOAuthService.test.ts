import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateOAuthState,
  parseOAuthState,
  generateCloudOAuthUrl,
  exchangeCloudCodeForToken,
  refreshCloudAccessToken,
  getCloudAccessToken,
  encryptToken,
  decryptToken,
} from '../../services/cloudOAuthService';
import { Block } from '@prisma/client';
import prisma from '../../lib/prisma';
import { createCloudProvider } from '../../services/cloudProviders/providerFactory';
import { CloudProviderType } from '../../services/cloudProviders/types';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    block: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../services/cloudProviders/providerFactory', () => ({
  createCloudProvider: vi.fn(),
}));

describe('Cloud OAuth Service', () => {
  const mockBlock: Block = {
    id: 'block-1',
    chatbotId: 'chatbot-1',
    type: 'CLOUD',
    properties: {
      provider: 'googledrive',
      baseUrl: 'https://nextcloud.example.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Block;

  const mockProviderInstance = {
    generateOAuthUrl: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    refreshAccessToken: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset config cache and override with test values (must override prod.env values)
    const { resetConfig } = await import('../../config');
    // Explicitly override any prod.env values with test values
    process.env.CLOUD_ENCRYPTION_KEY = 'test-key-32-bytes-long-123456';
    process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
    process.env.API_URL = 'https://api.example.com';
    // Reset config cache AFTER setting env vars so it reloads with test values
    resetConfig();
    vi.mocked(createCloudProvider).mockReturnValue(mockProviderInstance as any);
  });

  describe('generateOAuthState', () => {
    it('should generate base64 encoded state', () => {
      const state = generateOAuthState('chatbot-1', 'block-1', 'googledrive');

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      
      // Decode and verify
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      expect(decoded.chatbotId).toBe('chatbot-1');
      expect(decoded.blockId).toBe('block-1');
      expect(decoded.provider).toBe('googledrive');
      expect(decoded.timestamp).toBeDefined();
    });

    it('should generate state without provider', () => {
      const state = generateOAuthState('chatbot-1', 'block-1');

      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      expect(decoded.chatbotId).toBe('chatbot-1');
      expect(decoded.blockId).toBe('block-1');
      expect(decoded.provider).toBeUndefined();
    });
  });

  describe('parseOAuthState', () => {
    it('should parse valid state', () => {
      const state = generateOAuthState('chatbot-1', 'block-1', 'googledrive');
      const parsed = parseOAuthState(state);

      expect(parsed).not.toBeNull();
      expect(parsed?.chatbotId).toBe('chatbot-1');
      expect(parsed?.blockId).toBe('block-1');
      expect(parsed?.provider).toBe('googledrive');
    });

    it('should return null for invalid base64', () => {
      const parsed = parseOAuthState('invalid-base64!!!');

      expect(parsed).toBeNull();
    });

    it('should return null for expired state', () => {
      const oldState = Buffer.from(JSON.stringify({
        chatbotId: 'chatbot-1',
        blockId: 'block-1',
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      })).toString('base64');

      const parsed = parseOAuthState(oldState);

      expect(parsed).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const invalidState = Buffer.from('not-json').toString('base64');

      const parsed = parseOAuthState(invalidState);

      expect(parsed).toBeNull();
    });
  });

  describe('encryptToken and decryptToken', () => {
    it('should encrypt and decrypt token', () => {
      const token = 'my-access-token-123';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);

      expect(encrypted).not.toBe(token);
      expect(encrypted).toContain(':');
      expect(decrypted).toBe(token);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => {
        decryptToken('invalid-format');
      }).toThrow('Invalid encrypted token format');
    });

    it('should produce different encrypted values for same token', () => {
      const token = 'same-token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('generateCloudOAuthUrl', () => {
    it('should generate OAuth URL for Google Drive', async () => {
      // Reset config cache to ensure test env vars are used
      const { resetConfig } = await import('../../config');
      resetConfig();
      
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;
      const expectedUrl = 'https://accounts.google.com/o/oauth2/auth?state=xyz';

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.generateOAuthUrl.mockReturnValue(expectedUrl);

      const url = await generateCloudOAuthUrl('googledrive', 'chatbot-1', 'block-1');

      expect(prisma.block.findUnique).toHaveBeenCalledWith({
        where: { id: 'block-1' },
      });
      expect(createCloudProvider).toHaveBeenCalledWith('googledrive', {
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
      });
      expect(mockProviderInstance.generateOAuthUrl).toHaveBeenCalled();
      expect(url).toBe(expectedUrl);
    });

    it('should generate OAuth URL for Nextcloud', async () => {
      const block = {
        ...mockBlock,
        properties: {
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'nextcloud-client-id',
          clientSecret: 'nextcloud-secret',
        },
      } as Block;
      const expectedUrl = 'https://nextcloud.example.com/index.php/apps/oauth2/authorize?state=xyz';

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.generateOAuthUrl.mockReturnValue(expectedUrl);

      const url = await generateCloudOAuthUrl('nextcloud', 'chatbot-1', 'block-1');

      expect(createCloudProvider).toHaveBeenCalledWith('nextcloud', {
        baseUrl: 'https://nextcloud.example.com',
        clientId: 'nextcloud-client-id',
        clientSecret: 'nextcloud-secret',
      });
      expect(url).toBe(expectedUrl);
    });

    it('should throw error for OneDrive', async () => {
      await expect(
        generateCloudOAuthUrl('onedrive', 'chatbot-1', 'block-1')
      ).rejects.toThrow('OneDrive integration is currently disabled');
    });

    it('should throw error if block not found', async () => {
      vi.mocked(prisma.block.findUnique).mockResolvedValue(null);

      await expect(
        generateCloudOAuthUrl('googledrive', 'chatbot-1', 'block-1')
      ).rejects.toThrow('Block not found');
    });

    it('should throw error if Google Drive credentials not configured', async () => {
      // Reset config cache before deleting env var
      const { resetConfig } = await import('../../config');
      // Set to empty strings to ensure they're treated as missing
      process.env.GOOGLE_DRIVE_CLIENT_ID = '';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = '';
      resetConfig();
      
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);

      await expect(
        generateCloudOAuthUrl('googledrive', 'chatbot-1', 'block-1')
      ).rejects.toThrow('Google Drive OAuth credentials not configured');
    });

    it('should throw error if Nextcloud baseUrl not configured', async () => {
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);

      await expect(
        generateCloudOAuthUrl('nextcloud', 'chatbot-1', 'block-1')
      ).rejects.toThrow('nextcloud baseUrl is required');
    });

    it('should throw error if Nextcloud OAuth credentials not configured', async () => {
      const block = {
        ...mockBlock,
        properties: {
          baseUrl: 'https://nextcloud.example.com',
        },
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);

      await expect(
        generateCloudOAuthUrl('nextcloud', 'chatbot-1', 'block-1')
      ).rejects.toThrow('Nextcloud clientId and clientSecret are required');
    });

    it('should use default API_URL if not set', async () => {
      delete process.env.API_URL;
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;
      const expectedUrl = 'https://accounts.google.com/o/oauth2/auth';

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.generateOAuthUrl.mockReturnValue(expectedUrl);

      await generateCloudOAuthUrl('googledrive', 'chatbot-1', 'block-1');

      expect(mockProviderInstance.generateOAuthUrl).toHaveBeenCalledWith(
        expect.any(Object),
        'https://api.citadelai.app/api/admin/cloud/oauth/callback',
        expect.any(String)
      );
    });
  });

  describe('exchangeCloudCodeForToken', () => {
    it('should exchange code for token for Google Drive', async () => {
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;
      const mockTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        accountId: 'account-123',
        accountName: 'Test Account',
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.exchangeCodeForToken.mockResolvedValue(mockTokenData);

      const result = await exchangeCloudCodeForToken('googledrive', 'auth-code', 'block-1');

      expect(mockProviderInstance.exchangeCodeForToken).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).not.toBe('access-token'); // Should be encrypted
      expect(result.refreshToken).toBeDefined();
      expect(result.accountId).toBe('account-123');
      expect(result.accountName).toBe('Test Account');
    });

    it('should exchange code for token for Nextcloud', async () => {
      const block = {
        ...mockBlock,
        properties: {
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'nextcloud-client-id',
          clientSecret: 'nextcloud-secret',
        },
      } as Block;
      const mockTokenData = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
        accountId: 'account-123',
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.exchangeCodeForToken.mockResolvedValue(mockTokenData);

      const result = await exchangeCloudCodeForToken('nextcloud', 'auth-code', 'block-1');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should handle token without refresh token', async () => {
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;
      const mockTokenData = {
        accessToken: 'access-token',
        expiresAt: new Date(),
        accountId: 'account-123',
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(block);
      mockProviderInstance.exchangeCodeForToken.mockResolvedValue(mockTokenData);

      const result = await exchangeCloudCodeForToken('googledrive', 'auth-code', 'block-1');

      expect(result.refreshToken).toBeUndefined();
    });

    it('should throw error for OneDrive', async () => {
      await expect(
        exchangeCloudCodeForToken('onedrive', 'code', 'block-1')
      ).rejects.toThrow('OneDrive integration is currently disabled');
    });

    it('should throw error if block not found', async () => {
      vi.mocked(prisma.block.findUnique).mockResolvedValue(null);

      await expect(
        exchangeCloudCodeForToken('googledrive', 'code', 'block-1')
      ).rejects.toThrow('Block not found');
    });
  });

  describe('refreshCloudAccessToken', () => {
    it('should refresh token for Google Drive', async () => {
      const block = {
        ...mockBlock,
        properties: {
          provider: 'googledrive',
          refreshToken: encryptToken('old-refresh-token'),
        },
      } as Block;
      const mockTokenData = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(),
      };

      mockProviderInstance.refreshAccessToken.mockResolvedValue(mockTokenData);

      // Reset config cache to ensure test env vars are used
      const { resetConfig } = await import('../../config');
      resetConfig();

      const result = await refreshCloudAccessToken(block);

      expect(mockProviderInstance.refreshAccessToken).toHaveBeenCalledWith(
        'old-refresh-token',
        expect.objectContaining({
          clientId: 'google-client-id',
          clientSecret: 'google-client-secret',
        })
      );
      expect(result.accessToken).toBeDefined();
      expect(result.accessToken).not.toBe('new-access-token'); // Should be encrypted
      expect(result.refreshToken).toBeDefined();
    });

    it('should refresh token for Nextcloud', async () => {
      const block = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'nextcloud-client-id',
          clientSecret: 'nextcloud-secret',
          refreshToken: encryptToken('old-refresh-token'),
        },
      } as Block;
      const mockTokenData = {
        accessToken: 'new-access-token',
        expiresAt: new Date(),
      };

      mockProviderInstance.refreshAccessToken.mockResolvedValue(mockTokenData);

      const result = await refreshCloudAccessToken(block);

      expect(result.accessToken).toBeDefined();
    });

    it('should throw error if provider not configured', async () => {
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;

      await expect(
        refreshCloudAccessToken(block)
      ).rejects.toThrow('Provider not configured');
    });

    it('should throw error for OneDrive', async () => {
      const block = {
        ...mockBlock,
        properties: {
          provider: 'onedrive',
          refreshToken: encryptToken('refresh-token'),
        },
      } as Block;

      await expect(
        refreshCloudAccessToken(block)
      ).rejects.toThrow('OneDrive integration is currently disabled');
    });

    it('should throw error if refresh token not available', async () => {
      const block = {
        ...mockBlock,
        properties: {
          provider: 'googledrive',
        },
      } as Block;

      await expect(
        refreshCloudAccessToken(block)
      ).rejects.toThrow('Refresh token not available');
    });
  });

  describe('getCloudAccessToken', () => {
    it('should return decrypted access token if not expired', async () => {
      const block = {
        ...mockBlock,
        properties: {
          accessToken: encryptToken('valid-access-token'),
          tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        },
      } as Block;

      const token = await getCloudAccessToken(block);

      expect(token).toBe('valid-access-token');
    });

    it('should refresh token if expired', async () => {
      const block = {
        ...mockBlock,
        id: 'block-1',
        properties: {
          provider: 'googledrive',
          accessToken: encryptToken('expired-token'),
          refreshToken: encryptToken('refresh-token'),
          tokenExpiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        },
      } as Block;
      const mockRefreshedToken = {
        accessToken: encryptToken('new-access-token'),
        refreshToken: encryptToken('new-refresh-token'),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockProviderInstance.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      });
      vi.mocked(prisma.block.update).mockResolvedValue(block);

      const token = await getCloudAccessToken(block);

      expect(mockProviderInstance.refreshAccessToken).toHaveBeenCalled();
      expect(prisma.block.update).toHaveBeenCalled();
      expect(token).toBe('new-access-token');
    });

    it('should throw error if access token not available', async () => {
      const block = {
        ...mockBlock,
        properties: {},
      } as Block;

      await expect(
        getCloudAccessToken(block)
      ).rejects.toThrow('Access token not available');
    });

    it('should throw error if refresh fails', async () => {
      const block = {
        ...mockBlock,
        properties: {
          provider: 'googledrive',
          accessToken: encryptToken('expired-token'),
          refreshToken: encryptToken('refresh-token'),
          tokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      } as Block;

      mockProviderInstance.refreshAccessToken.mockRejectedValue(new Error('Refresh failed'));

      await expect(
        getCloudAccessToken(block)
      ).rejects.toThrow('Token expired and refresh failed');
    });

    it('should return token if expiresAt not set', async () => {
      const block = {
        ...mockBlock,
        properties: {
          accessToken: encryptToken('valid-token'),
        },
      } as Block;

      const token = await getCloudAccessToken(block);

      expect(token).toBe('valid-token');
    });
  });
});
