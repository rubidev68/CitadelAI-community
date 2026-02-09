import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCloudIntegration,
  updateCloudIntegration,
  testCloudConnection,
  disconnectCloudIntegration,
  CloudIntegrationProperties,
} from '../../services/cloudIntegrationService';
import { Block } from '@prisma/client';
import prisma from '../../lib/prisma';
import { getCloudAccessToken } from '../../services/cloudOAuthService';
import { createCloudProvider } from '../../services/cloudProviders/providerFactory';

// Mock dependencies
vi.mock('../../lib/prisma', () => ({
  default: {
    block: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../services/cloudOAuthService', () => ({
  getCloudAccessToken: vi.fn(),
}));

vi.mock('../../services/cloudProviders/providerFactory', () => ({
  createCloudProvider: vi.fn(),
}));

describe('Cloud Integration Service', () => {
  const mockBlock: Block = {
    id: 'block-1',
    chatbotId: 'chatbot-1',
    type: 'CLOUD',
    properties: {
      provider: 'googledrive',
      authMethod: 'oauth',
      accessToken: 'encrypted:token',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Block;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCloudIntegration', () => {
    it('should extract cloud integration properties from block', () => {
      const properties = getCloudIntegration(mockBlock);

      expect(properties.provider).toBe('googledrive');
      expect(properties.authMethod).toBe('oauth');
      expect(properties.accessToken).toBe('encrypted:token');
    });

    it('should return empty object for block without properties', () => {
      const blockWithoutProperties = {
        ...mockBlock,
        properties: null,
      } as Block;

      const properties = getCloudIntegration(blockWithoutProperties);

      expect(properties).toEqual({});
    });

    it('should handle block with partial properties', () => {
      const blockWithPartialProperties = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
        },
      } as Block;

      const properties = getCloudIntegration(blockWithPartialProperties);

      expect(properties.provider).toBe('nextcloud');
      expect(properties.authMethod).toBeUndefined();
    });
  });

  describe('updateCloudIntegration', () => {
    it('should update cloud integration properties', async () => {
      const updates: Partial<CloudIntegrationProperties> = {
        provider: 'onedrive',
        authMethod: 'oauth',
      };
      const updatedBlock = {
        ...mockBlock,
        properties: {
          ...mockBlock.properties,
          ...updates,
        },
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(prisma.block.update).mockResolvedValue(updatedBlock as Block);

      const result = await updateCloudIntegration('block-1', updates);

      expect(prisma.block.findUnique).toHaveBeenCalledWith({
        where: { id: 'block-1' },
      });
      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          properties: {
            ...mockBlock.properties,
            ...updates,
          },
        },
      });
      expect(result.properties).toMatchObject(updates);
    });

    it('should merge updates with existing properties', async () => {
      const updates: Partial<CloudIntegrationProperties> = {
        selectedPaths: ['/folder1', '/folder2'],
      };
      const updatedBlock = {
        ...mockBlock,
        properties: {
          ...mockBlock.properties,
          ...updates,
        },
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(prisma.block.update).mockResolvedValue(updatedBlock as Block);

      const result = await updateCloudIntegration('block-1', updates);

      expect(result.properties).toMatchObject({
        provider: 'googledrive',
        authMethod: 'oauth',
        selectedPaths: ['/folder1', '/folder2'],
      });
    });

    it('should throw error if block not found', async () => {
      vi.mocked(prisma.block.findUnique).mockResolvedValue(null);

      await expect(
        updateCloudIntegration('nonexistent', { provider: 'googledrive' })
      ).rejects.toThrow('Block not found');
    });
  });

  describe('testCloudConnection', () => {
    it('should return true for successful connection test', async () => {
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(getCloudAccessToken).mockResolvedValue('access-token');
      vi.mocked(createCloudProvider).mockReturnValue(mockProvider as any);
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'client-secret';

      const result = await testCloudConnection('block-1');

      expect(getCloudAccessToken).toHaveBeenCalledWith(mockBlock);
      expect(createCloudProvider).toHaveBeenCalledWith('googledrive', expect.objectContaining({
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }));
      expect(mockProvider.testConnection).toHaveBeenCalledWith('access-token');
      expect(result).toBe(true);
    });

    it('should return false for failed connection test', async () => {
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(false),
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(getCloudAccessToken).mockResolvedValue('access-token');
      vi.mocked(createCloudProvider).mockReturnValue(mockProvider as any);

      const result = await testCloudConnection('block-1');

      expect(result).toBe(false);
    });

    it('should throw error if block not found', async () => {
      vi.mocked(prisma.block.findUnique).mockResolvedValue(null);

      await expect(testCloudConnection('nonexistent')).rejects.toThrow('Block not found');
    });

    it('should throw error if provider not configured', async () => {
      const blockWithoutProvider = {
        ...mockBlock,
        properties: {},
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithoutProvider);

      await expect(testCloudConnection('block-1')).rejects.toThrow('Cloud provider not configured');
    });

    it('should pass username for app_password auth method', async () => {
      const blockWithAppPassword = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
          authMethod: 'app_password',
          username: 'testuser',
          accessToken: 'app-password', // App password stored as accessToken
          baseUrl: 'https://nextcloud.example.com',
        },
      } as Block;
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithAppPassword);
      vi.mocked(createCloudProvider).mockReturnValue(mockProvider as any);

      await testCloudConnection('block-1');

      expect(createCloudProvider).toHaveBeenCalledWith('nextcloud', {
        baseUrl: 'https://nextcloud.example.com',
      });
      expect(mockProvider.testConnection).toHaveBeenCalledWith('app-password', 'testuser');
    });

    it('should throw error if username missing for app_password auth', async () => {
      const blockWithAppPassword = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
          authMethod: 'app_password',
          // Missing username
          accessToken: 'app-password',
          baseUrl: 'https://nextcloud.example.com',
        },
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithAppPassword);

      await expect(testCloudConnection('block-1')).rejects.toThrow(
        'Username and App Password are required for App Password authentication'
      );
    });

    it('should throw error if app password missing for app_password auth', async () => {
      const blockWithAppPassword = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
          authMethod: 'app_password',
          username: 'testuser',
          // Missing accessToken (app password)
          baseUrl: 'https://nextcloud.example.com',
        },
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithAppPassword);

      await expect(testCloudConnection('block-1')).rejects.toThrow(
        'Username and App Password are required for App Password authentication'
      );
    });

    it('should use Nextcloud config for OAuth (non-Google Drive)', async () => {
      const blockWithNextcloudOAuth = {
        ...mockBlock,
        properties: {
          provider: 'nextcloud',
          authMethod: 'oauth',
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'nextcloud-client-id',
          clientSecret: 'nextcloud-client-secret',
        },
      } as Block;
      const mockProvider = {
        testConnection: vi.fn().mockResolvedValue(true),
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithNextcloudOAuth);
      vi.mocked(getCloudAccessToken).mockResolvedValue('nextcloud-token');
      vi.mocked(createCloudProvider).mockReturnValue(mockProvider as any);

      await testCloudConnection('block-1');

      expect(createCloudProvider).toHaveBeenCalledWith('nextcloud', {
        baseUrl: 'https://nextcloud.example.com',
        clientId: 'nextcloud-client-id',
        clientSecret: 'nextcloud-client-secret',
      });
      expect(mockProvider.testConnection).toHaveBeenCalledWith('nextcloud-token');
    });

    it('should handle testConnection errors and re-throw', async () => {
      const mockProvider = {
        testConnection: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(getCloudAccessToken).mockResolvedValue('access-token');
      vi.mocked(createCloudProvider).mockReturnValue(mockProvider as any);
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'client-secret';

      await expect(testCloudConnection('block-1')).rejects.toThrow('Connection failed');
    });

    it('should handle getCloudAccessToken errors and re-throw', async () => {
      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(getCloudAccessToken).mockRejectedValue(new Error('Token retrieval failed'));
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'client-secret';

      await expect(testCloudConnection('block-1')).rejects.toThrow('Token retrieval failed');
    });
  });

  describe('disconnectCloudIntegration', () => {
    it('should disconnect cloud integration by clearing tokens', async () => {
      const disconnectedBlock = {
        ...mockBlock,
        properties: {
          ...mockBlock.properties,
          isConnected: false,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          accountId: undefined,
          accountName: undefined,
        },
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(mockBlock);
      vi.mocked(prisma.block.update).mockResolvedValue(disconnectedBlock as Block);

      const result = await disconnectCloudIntegration('block-1');

      expect(prisma.block.update).toHaveBeenCalledWith({
        where: { id: 'block-1' },
        data: {
          properties: expect.objectContaining({
            isConnected: false,
          }),
        },
      });
      expect(result.properties).toMatchObject({
        isConnected: false,
      });
    });

    it('should preserve other properties when disconnecting', async () => {
      const blockWithExtraProps = {
        ...mockBlock,
        properties: {
          ...mockBlock.properties,
          selectedPaths: ['/folder1'],
          fileTypeFilters: ['pdf'],
        },
      } as Block;
      const disconnectedBlock = {
        ...blockWithExtraProps,
        properties: {
          ...blockWithExtraProps.properties,
          isConnected: false,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          accountId: undefined,
          accountName: undefined,
        },
      } as Block;

      vi.mocked(prisma.block.findUnique).mockResolvedValue(blockWithExtraProps);
      vi.mocked(prisma.block.update).mockResolvedValue(disconnectedBlock as Block);

      const result = await disconnectCloudIntegration('block-1');

      expect(result.properties).toMatchObject({
        isConnected: false,
        selectedPaths: ['/folder1'],
        fileTypeFilters: ['pdf'],
      });
    });
  });
});
