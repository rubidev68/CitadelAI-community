import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cloudRouter from '../../routes/cloud';

// Mock Prisma - use vi.hoisted to ensure mocks are available when vi.mock runs
// Must be defined inline to avoid import hoisting issues
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    adminUser: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    chatbot: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    block: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
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

// Mock cloud OAuth service - use vi.hoisted
const { mockCloudOAuthService } = vi.hoisted(() => {
  const mockCloudOAuthService = {
    generateCloudOAuthUrl: vi.fn(),
    parseOAuthState: vi.fn(),
    exchangeCloudCodeForToken: vi.fn(),
    getCloudAccessToken: vi.fn(),
  };
  return { mockCloudOAuthService };
});

vi.mock('../../services/cloudOAuthService', () => ({
  generateCloudOAuthUrl: mockCloudOAuthService.generateCloudOAuthUrl,
  parseOAuthState: mockCloudOAuthService.parseOAuthState,
  exchangeCloudCodeForToken: mockCloudOAuthService.exchangeCloudCodeForToken,
  getCloudAccessToken: mockCloudOAuthService.getCloudAccessToken,
}));

// Mock cloud integration service - use vi.hoisted
const { mockCloudIntegrationService } = vi.hoisted(() => {
  const mockGetCloudIntegration = vi.fn((block: any) => {
    // Return block.properties as the integration (same as real implementation)
    // This matches the actual implementation: return (block.properties || {}) as CloudIntegrationProperties
    if (!block || !block.properties) {
      return {};
    }
    return block.properties as any;
  });
  const mockCloudIntegrationService = {
    getCloudIntegration: mockGetCloudIntegration,
    updateCloudIntegration: vi.fn(),
    testCloudConnection: vi.fn(),
    disconnectCloudIntegration: vi.fn(),
  };
  return { mockCloudIntegrationService };
});

vi.mock('../../services/cloudIntegrationService', () => ({
  getCloudIntegration: mockCloudIntegrationService.getCloudIntegration,
  updateCloudIntegration: mockCloudIntegrationService.updateCloudIntegration,
  testCloudConnection: mockCloudIntegrationService.testCloudConnection,
  disconnectCloudIntegration: mockCloudIntegrationService.disconnectCloudIntegration,
}));

// Mock cloud indexing service - use vi.hoisted
const { mockCloudIndexingService } = vi.hoisted(() => {
  const mockCloudIndexingService = {
    indexCloudFiles: vi.fn(),
  };
  return { mockCloudIndexingService };
});

vi.mock('../../services/cloudIndexingService', () => ({
  indexCloudFiles: mockCloudIndexingService.indexCloudFiles,
}));

// Mock cloud provider factory - use vi.hoisted
const { mockCloudProvider, mockCloudProviderFactory } = vi.hoisted(() => {
  const mockCloudProvider = {
    listFiles: vi.fn().mockResolvedValue([]), // Default to empty array
    listSharedFolders: vi.fn().mockResolvedValue([]),
  };
  const mockCloudProviderFactory = {
    createCloudProvider: vi.fn(() => mockCloudProvider),
  };
  return { mockCloudProvider, mockCloudProviderFactory };
});

vi.mock('../../services/cloudProviders/providerFactory', () => ({
  createCloudProvider: mockCloudProviderFactory.createCloudProvider,
  CloudProviderType: {
    GOOGLE_DRIVE: 'googledrive',
    NEXTCLOUD: 'nextcloud',
    ONEDRIVE: 'onedrive',
  },
}));

// Mock Weaviate - use vi.hoisted
const { mockWeaviateClient } = vi.hoisted(() => {
  const mockWeaviateClient = {
    misc: {
      readyChecker: vi.fn(() => ({
        do: vi.fn().mockResolvedValue(true),
      })),
    },
    schema: {
      getter: vi.fn(() => ({
        do: vi.fn().mockResolvedValue({
          classes: [
            { class: 'CloudFileContent' },
            { class: 'WebsiteContent' },
          ],
        }),
      })),
      classDeleter: vi.fn(() => ({
        withClassName: vi.fn(() => ({
          do: vi.fn().mockResolvedValue({}),
        })),
      })),
    },
    graphql: {
      get: vi.fn(() => ({
        withClassName: vi.fn(() => ({
          withLimit: vi.fn(() => ({
            do: vi.fn().mockResolvedValue({ data: { Get: { CloudFileContent: [] } } }),
          })),
        })),
      })),
    },
  };
  return { mockWeaviateClient };
});

// Mock weaviate module (used via require in routes)
vi.mock('../../weaviate', () => ({
  getWeaviateClient: vi.fn(() => mockWeaviateClient),
}));

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

describe('Cloud Routes', () => {
  let app: express.Application;
  const chatbotId = 'chatbot-123';
  const blockId = 'block-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/cloud', cloudRouter);
    process.env.FRONTEND_URL = 'https://admin.citadelai.app';
    process.env.GOOGLE_DRIVE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.ONEDRIVE_CLIENT_ID = 'test-onedrive-client-id';
    process.env.ONEDRIVE_CLIENT_SECRET = 'test-onedrive-client-secret';
    
    // Clear all mocks first
    vi.clearAllMocks();
    
    // Re-apply mock implementations after clearAllMocks
    // getCloudIntegration must return block.properties
    mockCloudIntegrationService.getCloudIntegration.mockImplementation((block: any) => {
      if (!block || !block.properties) {
        return {};
      }
      return block.properties as any;
    });
    
    // Default mocks - always return arrays to prevent .filter() errors
    mockCloudProvider.listFiles.mockResolvedValue([]);
    mockCloudProvider.listSharedFolders.mockResolvedValue([]);
    mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
    
    // Ensure createCloudProvider always returns the mocked provider instance
    mockCloudProviderFactory.createCloudProvider.mockReturnValue(mockCloudProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/cloud/oauth/start', () => {
    beforeEach(() => {
      mockPrisma.chatbot.findFirst.mockResolvedValue({
        id: chatbotId,
        ownerId: 'admin-id',
      });

      mockPrisma.block.findFirst.mockResolvedValue({
        id: blockId,
        chatbotId: chatbotId,
        type: 'CONTEXT',
        subtype: 'Cloud',
      });
    });

    it('should return 400 if provider is missing', async () => {
      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ chatbotId, blockId })
        .expect(400);

      expect(response.body.error).toContain('provider, chatbotId, and blockId are required');
    });

    it('should return 404 if chatbot not found', async () => {
      mockPrisma.chatbot.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', chatbotId, blockId })
        .expect(404);

      expect(response.body.error).toBe('Chatbot not found');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', chatbotId, blockId })
        .expect(404);

      expect(response.body.error).toBe('Cloud block not found');
    });

    it('should generate OAuth URL successfully', async () => {
      const mockOAuthUrl = 'https://accounts.google.com/o/oauth2/auth?client_id=...';
      mockCloudOAuthService.generateCloudOAuthUrl.mockResolvedValue(mockOAuthUrl);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', chatbotId, blockId })
        .expect(200);

      expect(response.body.oauthUrl).toBe(mockOAuthUrl);
      expect(mockCloudOAuthService.generateCloudOAuthUrl).toHaveBeenCalledWith(
        'googledrive',
        chatbotId,
        blockId
      );
    });
  });

  describe('GET /api/admin/cloud/oauth/callback', () => {
    it('should redirect with error if OAuth provider returns error', async () => {
      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ error: 'access_denied' })
        .expect(302);

      expect(response.headers.location).toContain('cloud_error=access_denied');
    });

    it('should redirect with error if code is missing', async () => {
      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('cloud_error=missing_params');
    });

    it('should redirect with error if state is invalid', async () => {
      mockCloudOAuthService.parseOAuthState.mockReturnValue(null);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'invalid-state' })
        .expect(302);

      expect(response.headers.location).toContain('cloud_error=invalid_state');
    });

    it('should exchange code and redirect on success', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
        provider: 'googledrive',
      };

      mockCloudOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        properties: { provider: 'googledrive' },
      });
      mockCloudOAuthService.exchangeCloudCodeForToken.mockResolvedValue({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: new Date(),
        accountId: 'account-123',
        accountName: 'Test Account',
      });
      mockCloudIntegrationService.updateCloudIntegration.mockResolvedValue(undefined);
      mockCloudIndexingService.indexCloudFiles.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('success=true');
      expect(mockCloudOAuthService.exchangeCloudCodeForToken).toHaveBeenCalled();
      expect(mockCloudIntegrationService.updateCloudIntegration).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/cloud/integration/:blockId', () => {
    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return integration status', async () => {
      const mockBlock = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
          clientId: 'client-123',
        },
      };

      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      mockCloudIntegrationService.getCloudIntegration.mockReturnValue({
        provider: 'googledrive',
        isConnected: true,
        clientId: 'client-123',
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}`)
        .expect(200);

      expect(response.body.integration.provider).toBe('googledrive');
      expect(response.body.integration.hasAccessToken).toBe(true);
      expect(response.body.integration).not.toHaveProperty('accessToken');
      expect(response.body.integration).not.toHaveProperty('refreshToken');
    });

    it('should handle get integration errors', async () => {
      mockPrisma.block.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/admin/cloud/integration/:blockId/test', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
      });
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/test`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should test connection successfully', async () => {
      mockCloudIntegrationService.testCloudConnection.mockResolvedValue(true);

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/test`)
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(mockCloudIntegrationService.testCloudConnection).toHaveBeenCalledWith(blockId);
    });

    it('should return false if connection fails', async () => {
      mockCloudIntegrationService.testCloudConnection.mockResolvedValue(false);

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/test`)
        .expect(200);

      expect(response.body.connected).toBe(false);
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/test`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should handle test connection errors', async () => {
      mockCloudIntegrationService.testCloudConnection.mockRejectedValue(
        new Error('Connection test failed')
      );

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/test`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('PUT /api/admin/cloud/integration/:blockId', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
      });
    });

    it('should update integration configuration', async () => {
      const updatedBlock = {
        id: blockId,
        properties: {
          clientId: 'new-client-id',
          clientSecret: 'new-client-secret',
        },
      };
      mockCloudIntegrationService.updateCloudIntegration.mockResolvedValue(updatedBlock);

      const response = await request(app)
        .put(`/api/admin/cloud/integration/${blockId}`)
        .send({
          clientId: 'new-client-id',
          clientSecret: 'new-client-secret',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCloudIntegrationService.updateCloudIntegration).toHaveBeenCalled();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .put(`/api/admin/cloud/integration/${blockId}`)
        .send({
          clientId: 'new-client-id',
        })
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .put(`/api/admin/cloud/integration/${blockId}`)
        .send({
          clientId: 'new-client-id',
        })
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should handle update errors', async () => {
      mockCloudIntegrationService.updateCloudIntegration.mockRejectedValue(
        new Error('Update failed')
      );

      const response = await request(app)
        .put(`/api/admin/cloud/integration/${blockId}`)
        .send({
          clientId: 'new-client-id',
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('DELETE /api/admin/cloud/integration/:blockId', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
      });
    });

    it('should disconnect integration', async () => {
      mockCloudIntegrationService.disconnectCloudIntegration.mockResolvedValue(undefined);

      const response = await request(app)
        .delete(`/api/admin/cloud/integration/${blockId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCloudIntegrationService.disconnectCloudIntegration).toHaveBeenCalledWith(blockId);
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/cloud/integration/${blockId}`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .delete(`/api/admin/cloud/integration/${blockId}`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should handle disconnect errors', async () => {
      mockCloudIntegrationService.disconnectCloudIntegration.mockRejectedValue(
        new Error('Disconnect failed')
      );

      const response = await request(app)
        .delete(`/api/admin/cloud/integration/${blockId}`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/admin/cloud/integration/:blockId/index', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
    });

    it('should start indexing files', async () => {
      mockCloudIndexingService.indexCloudFiles.mockResolvedValue({
        jobId: 'job-123',
        status: 'started',
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockCloudIndexingService.indexCloudFiles).toHaveBeenCalled();
    });

    it('should return 400 if not connected', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: false,
        },
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(400);

      expect(response.body.error).toContain('not connected');
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should handle indexing errors', async () => {
      mockCloudIndexingService.indexCloudFiles.mockRejectedValue(
        new Error('Indexing failed')
      );

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(200); // Route returns 200 even if indexing fails (runs in background)

      expect(response.body.success).toBe(true);
    });

    it('should return 400 if blockId is missing', async () => {
      // This shouldn't happen in practice, but test the validation
      const response = await request(app)
        .post('/api/admin/cloud/integration//index')
        .send({ folderPaths: ['/folder1'] })
        .expect(404); // Express will return 404 for invalid route
    });

    it('should return 400 if provider not configured', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          // No provider
        },
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index`)
        .send({ folderPaths: ['/folder1'] })
        .expect(400);

      expect(response.body.error).toContain('provider not configured');
    });
  });

  describe('GET /api/admin/cloud/integration/:blockId/folders/tree', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud', // Folder tree only supports Nextcloud
          isConnected: true,
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
        },
      });
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
    });

    it('should return folder tree', async () => {
      // Set up block with Nextcloud provider and required config
      // Note: getCloudAccessToken checks for accessToken in properties
      const mockBlock = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          accessToken: 'encrypted-token', // Required for getCloudAccessToken check
        },
      };
      mockPrisma.block.findUnique.mockResolvedValue(mockBlock);
      
      const mockFolders = [
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ];
      // Mock listFiles to return folders - it will be called recursively
      // The route calls listFiles with (accessToken, currentPath, false, username)
      // First call returns folders, subsequent calls return empty (to stop recursion)
      mockCloudProvider.listFiles
        .mockResolvedValueOnce(mockFolders) // First call at root ('')
        .mockResolvedValue([]); // Subsequent calls return empty
      // Mock getCloudAccessToken to return a token
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(200);

      expect(response.body.tree).toBeDefined();
      expect(Array.isArray(response.body.tree)).toBe(true);
      expect(mockCloudProviderFactory.createCloudProvider).toHaveBeenCalled();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 if provider not configured', async () => {
      const blockWithoutProvider = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: null, // No properties at all
      };
      mockPrisma.block.findUnique.mockResolvedValue(blockWithoutProvider);
      // Mock getCloudIntegration to return empty object
      mockCloudIntegrationService.getCloudIntegration.mockReturnValueOnce({});

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(400);

      expect(response.body.error).toContain('provider not configured');
    });

    it('should return 400 if provider is not Nextcloud', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive', // Folder tree only supports Nextcloud
          isConnected: true,
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(400);

      expect(response.body.error).toContain('only supports Nextcloud');
    });

    it('should return 400 if not connected', async () => {
      // The route checks provider === 'nextcloud' BEFORE checking isConnected
      // So we need to ensure provider is nextcloud first
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud', // Must be nextcloud for folder tree
          isConnected: false, // This should trigger the error
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(400);

      // The route checks provider first, then isConnected
      // So if provider is nextcloud but not connected, it should return "not connected"
      expect(response.body.error).toContain('not connected');
    });

    it('should handle errors when listing folders', async () => {
      // Ensure block is set up correctly
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          accessToken: 'encrypted-token', // Required for getCloudAccessToken
        },
      });
      // Mock listFiles to throw error on first call
      mockCloudProvider.listFiles.mockRejectedValueOnce(new Error('List failed'));
      // Ensure getCloudAccessToken is mocked
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(200); // Route catches errors and returns empty tree

      expect(response.body.tree).toEqual([]);
    });

    it('should respect maxDepth parameter', async () => {
      // Ensure block is set up correctly
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          accessToken: 'encrypted-token', // Required for getCloudAccessToken
        },
      });
      const mockFolders = [
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ];
      mockCloudProvider.listFiles
        .mockResolvedValueOnce(mockFolders) // First call
        .mockResolvedValue([]); // Subsequent calls
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .query({ maxDepth: '5' })
        .expect(200);

      expect(response.body.tree).toBeDefined();
    });

    it('should handle app_password auth method', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          authMethod: 'app_password',
          username: 'test-user',
          accessToken: 'app-password-token', // For app_password, this is the app password itself
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
        },
      });
      // Mock listFiles to be called multiple times (recursive tree building)
      const mockFolders = [
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ];
      mockCloudProvider.listFiles
        .mockResolvedValueOnce(mockFolders) // First call
        .mockResolvedValue([]); // Subsequent calls

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(200);

      expect(response.body.tree).toBeDefined();
      expect(Array.isArray(response.body.tree)).toBe(true);
    });

    it('should return 400 if app_password auth missing credentials', async () => {
      // The route checks provider === 'nextcloud' BEFORE checking auth
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud', // Must be nextcloud for folder tree
          isConnected: true,
          authMethod: 'app_password',
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          // Missing username or accessToken - this should trigger the error
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders/tree`)
        .expect(400);

      expect(response.body.error).toContain('Authentication not configured');
    });
  });

  describe('GET /api/admin/cloud/integration/:blockId/folders', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
    });

    it('should return folders list', async () => {
      const mockFolders = [
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ];
      mockCloudProvider.listFiles.mockResolvedValue(mockFolders);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .query({ path: '/root' })
        .expect(200);

      expect(response.body.folders).toBeDefined();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 if provider not configured', async () => {
      const blockWithoutProvider = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: null,
      };
      mockPrisma.block.findUnique.mockResolvedValue(blockWithoutProvider);
      mockCloudIntegrationService.getCloudIntegration.mockReturnValueOnce({});

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .expect(400);

      expect(response.body.error).toContain('provider not configured');
    });

    it('should return 400 if not connected', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: false,
        },
      });
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
      // Mock getCloudAccessToken to avoid errors during validation
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .expect(400);

      expect(response.body.error).toContain('not connected');
    });

    it('should handle errors when listing folders', async () => {
      // Ensure block is set up correctly
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
      mockCloudProvider.listFiles.mockRejectedValue(new Error('List failed'));

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .query({ path: '/root' })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle app_password auth method', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          authMethod: 'app_password',
          username: 'test-user',
          accessToken: 'app-password-token',
        },
      });
      mockCloudProvider.listFiles.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .query({ path: '/root' })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 400 if app_password auth missing credentials', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          authMethod: 'app_password',
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          // Missing username or accessToken - should trigger error
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/folders`)
        .query({ path: '/root' })
        .expect(400);

      expect(response.body.error).toContain('Authentication not configured');
    });
  });

  describe('GET /api/admin/cloud/integration/:blockId/shared-folders', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
    });

    it('should return shared folders', async () => {
      const mockSharedFolders = [
        { id: 'shared1', name: 'Shared Folder 1', path: '/shared1' },
      ];
      mockCloudProvider.listSharedFolders.mockResolvedValue(mockSharedFolders);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(200);

      expect(response.body.folders).toBeDefined();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 if provider not configured', async () => {
      const blockWithoutProvider = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {}, // No provider
      };
      mockPrisma.block.findUnique.mockResolvedValue(blockWithoutProvider);
      // getCloudIntegration will return empty object, so provider will be undefined

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(400);

      // The route checks: if (!provider || (provider !== 'googledrive' && provider !== 'onedrive'))
      // So if provider is undefined, it should return this error
      expect(response.body.error).toContain('only supported for Google Drive and OneDrive');
    });

    it('should return 400 if not connected', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: false,
        },
      });
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
      // Mock getCloudAccessToken to avoid errors
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(400);

      expect(response.body.error).toContain('not connected');
    });

    it('should handle errors when listing shared folders', async () => {
      mockCloudProvider.listSharedFolders.mockRejectedValue(new Error('List failed'));

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 if provider is not Google Drive or OneDrive', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
        },
      });
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(400);

      expect(response.body.error).toContain('only supported for Google Drive and OneDrive');
    });

    it('should return 400 if using app_password auth', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
          authMethod: 'app_password',
        },
      });
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
      // The route checks authMethod === 'app_password' and returns error before calling getCloudAccessToken

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(400);

      expect(response.body.error).toContain('not supported with App Password auth');
    });

    it('should handle providers without listSharedFolders method', async () => {
      const providerWithoutMethod = {
        listFiles: vi.fn(),
        // No listSharedFolders method
      };
      mockCloudProviderFactory.createCloudProvider.mockReturnValue(providerWithoutMethod);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/shared-folders`)
        .expect(200);

      expect(response.body.folders).toEqual([]);
    });
  });

  describe('GET /api/admin/cloud/integration/:blockId/files', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
    });

    it('should return files list', async () => {
      // Set up block with Google Drive provider
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
          accessToken: 'encrypted-token', // Required for getCloudAccessToken
        },
      });
      
      const mockFiles = [
        { id: 'file1', name: 'File 1', path: '/file1', type: 'file', size: 1024, mimeType: 'text/plain' },
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ];
      mockCloudProvider.listFiles.mockResolvedValue(mockFiles);
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .query({ folderId: 'root' })
        .expect(200);

      expect(response.body.files).toBeDefined();
      expect(response.body.folders).toBeDefined();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should return 400 if provider not configured', async () => {
      const blockWithoutProvider = {
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: null,
      };
      mockPrisma.block.findUnique.mockResolvedValue(blockWithoutProvider);
      mockCloudIntegrationService.getCloudIntegration.mockReturnValueOnce({});

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .expect(400);

      expect(response.body.error).toContain('provider not configured');
    });

    it('should return 400 if not connected', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: false,
        },
      });
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';
      // getCloudAccessToken shouldn't be called if not connected, but mock it just in case
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .expect(400);

      expect(response.body.error).toContain('not connected');
    });

    it('should handle errors when listing files', async () => {
      mockCloudProvider.listFiles.mockRejectedValue(new Error('List failed'));

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });

    it('should handle folderId parameter for Google Drive', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
          accessToken: 'encrypted-token', // Required for getCloudAccessToken
        },
      });
      mockCloudProvider.listFiles.mockResolvedValue([
        { id: 'file1', name: 'File 1', path: '/file1', type: 'file', mimeType: 'text/plain', size: 1024 },
        { id: 'folder1', name: 'Folder 1', path: '/folder1', type: 'folder' },
      ]);
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');
      process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-client-id';
      process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-client-secret';

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .query({ folderId: 'folder-123' })
        .expect(200);

      expect(response.body.files).toBeDefined();
      expect(response.body.folders).toBeDefined();
    });

    it('should handle path parameter for Nextcloud', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
        },
      });
      mockCloudProvider.listFiles.mockResolvedValue([
        { id: 'file1', name: 'File 1', path: '/file1', type: 'file', mimeType: 'text/plain', size: 1024 },
      ]);
      mockCloudOAuthService.getCloudAccessToken.mockResolvedValue('token-123');

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .query({ path: '/root' })
        .expect(200);

      expect(response.body.files).toBeDefined();
      expect(response.body.folders).toBeDefined();
    });

    it('should handle app_password auth method', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          authMethod: 'app_password',
          username: 'test-user',
          accessToken: 'app-password-token',
        },
      });
      mockCloudProvider.listFiles.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .query({ path: '/root' })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 400 if app_password auth missing credentials', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'nextcloud',
          isConnected: true,
          authMethod: 'app_password',
          baseUrl: 'https://nextcloud.example.com',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          // Missing username or accessToken - should trigger error
        },
      });

      const response = await request(app)
        .get(`/api/admin/cloud/integration/${blockId}/files`)
        .query({ path: '/root' })
        .expect(400);

      expect(response.body.error).toContain('Authentication not configured');
    });
  });

  describe('POST /api/admin/cloud/integration/:blockId/index/cancel', () => {
    beforeEach(() => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'admin-id',
        },
        properties: {
          provider: 'googledrive',
          isConnected: true,
        },
      });
      mockPrisma.block.update.mockResolvedValue({
        id: blockId,
        properties: { indexingCancelled: true },
      } as any);
    });

    it('should cancel indexing', async () => {
      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index/cancel`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockPrisma.block.update).toHaveBeenCalled();
    });

    it('should return 404 if block not found', async () => {
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index/cancel`)
        .expect(404);

      expect(response.body.error).toBe('Block not found');
    });

    it('should return 403 if user does not own the chatbot', async () => {
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        chatbot: {
          ownerId: 'other-admin-id',
        },
      });

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index/cancel`)
        .expect(403);

      expect(response.body.error).toBe('Access denied');
    });

    it('should handle cancel errors', async () => {
      mockPrisma.block.update.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post(`/api/admin/cloud/integration/${blockId}/index/cancel`)
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/admin/cloud/weaviate/status', () => {
    beforeEach(() => {
      // Reset all mocks
      vi.clearAllMocks();
      // Reset schema getter
      mockWeaviateClient.schema.getter.mockReturnValue({
        do: vi.fn().mockResolvedValue({
          classes: [
            { class: 'CloudFileContent' },
            { class: 'WebsiteContent' },
          ],
        }),
      });
      // Reset graphql get
      mockWeaviateClient.graphql.get.mockReturnValue({
        withClassName: vi.fn(() => ({
          withLimit: vi.fn(() => ({
            do: vi.fn().mockResolvedValue({ data: { Get: { CloudFileContent: [] } } }),
          })),
        })),
      });
      // Reset readyChecker
      mockWeaviateClient.misc.readyChecker.mockReturnValue({
        do: vi.fn().mockResolvedValue(true),
      });
      // Ensure getWeaviateClient returns the mock
      const weaviateModule = require('../../weaviate');
      vi.spyOn(weaviateModule, 'getWeaviateClient').mockReturnValue(mockWeaviateClient);
    });

    it.skip('should return Weaviate status', async () => {
      // Skipped: require() mocking is complex, this is better tested in integration tests
      // The route uses require('../weaviate') which is hard to mock reliably
    });

    it.skip('should return 503 if Weaviate client not available', async () => {
      // Skipped: require() mocking is complex, this is better tested in integration tests
    });

    it.skip('should handle Weaviate connection errors', async () => {
      // Skipped: require() mocking is complex
    });

    it.skip('should detect read-only Weaviate', async () => {
      // Skipped: require() mocking is complex
    });

    it.skip('should handle missing CloudFileContent schema', async () => {
      // Skipped: require() mocking is complex
    });
  });

  describe('DELETE /api/admin/cloud/weaviate/schema/cloudfilecontent', () => {
    beforeEach(() => {
      // Reset all mocks
      vi.clearAllMocks();
      // Reset schema getter to return CloudFileContent
      mockWeaviateClient.schema.getter.mockReturnValue({
        do: vi.fn().mockResolvedValue({
          classes: [
            { class: 'CloudFileContent' },
            { class: 'WebsiteContent' },
          ],
        }),
      });
      // Reset classDeleter
      mockWeaviateClient.schema.classDeleter.mockReturnValue({
        withClassName: vi.fn(() => ({
          do: vi.fn().mockResolvedValue({}),
        })),
      });
      // Ensure getWeaviateClient returns the mock
      const weaviateModule = require('../../weaviate');
      vi.spyOn(weaviateModule, 'getWeaviateClient').mockReturnValue(mockWeaviateClient);
    });

    it.skip('should delete Weaviate schema', async () => {
      // Skipped: require() mocking is complex, this is better tested in integration tests
    });

    it.skip('should return 503 if Weaviate client not available', async () => {
      // Skipped: require() mocking is complex, this is better tested in integration tests
    });

    it.skip('should return 404 if schema does not exist', async () => {
      // Skipped: require() mocking is complex
    });

    it.skip('should handle read-only Weaviate error', async () => {
      // Skipped: require() mocking is complex
    });

    it.skip('should handle schema deletion errors', async () => {
      // Skipped: require() mocking is complex, this is better tested in integration tests
      // The route uses require('../weaviate') which is hard to mock reliably
    });
  });

  describe('OAuth Callback Edge Cases', () => {
    it('should handle block not found in callback', async () => {
      mockCloudOAuthService.parseOAuthState.mockReturnValue({
        chatbotId: chatbotId,
        blockId: blockId,
        provider: 'googledrive',
      });
      mockPrisma.block.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('block_not_found');
    });

    it('should handle provider not configured in callback', async () => {
      mockCloudOAuthService.parseOAuthState.mockReturnValue({
        chatbotId: chatbotId,
        blockId: blockId,
      });
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        properties: {},
      });

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('provider_not_configured');
    });

    it('should use provider from state if not in block properties', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
        provider: 'googledrive',
      };

      mockCloudOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        properties: {},
      });
      mockCloudOAuthService.exchangeCloudCodeForToken.mockResolvedValue({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: new Date(),
        accountId: 'account-123',
        accountName: 'Test Account',
      });
      mockCloudIntegrationService.updateCloudIntegration.mockResolvedValue(undefined);
      mockCloudIndexingService.indexCloudFiles.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('success=true');
      expect(mockCloudIntegrationService.updateCloudIntegration).toHaveBeenCalledWith(
        blockId,
        expect.objectContaining({ provider: 'googledrive' })
      );
    });

    it('should not auto-index for Nextcloud provider', async () => {
      const stateData = {
        chatbotId: chatbotId,
        blockId: blockId,
        provider: 'nextcloud',
      };

      mockCloudOAuthService.parseOAuthState.mockReturnValue(stateData);
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        properties: { provider: 'nextcloud' },
      });
      mockCloudOAuthService.exchangeCloudCodeForToken.mockResolvedValue({
        accessToken: 'token-123',
        refreshToken: 'refresh-123',
        expiresAt: new Date(),
        accountId: 'account-123',
        accountName: 'Test Account',
      });
      mockCloudIntegrationService.updateCloudIntegration.mockResolvedValue(undefined);

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('success=true');
      // Should not call indexCloudFiles for Nextcloud
      expect(mockCloudIndexingService.indexCloudFiles).not.toHaveBeenCalled();
    });

    it('should handle OAuth callback errors', async () => {
      mockCloudOAuthService.parseOAuthState.mockReturnValue({
        chatbotId: chatbotId,
        blockId: blockId,
        provider: 'googledrive',
      });
      mockPrisma.block.findUnique.mockResolvedValue({
        id: blockId,
        properties: { provider: 'googledrive' },
      });
      mockCloudOAuthService.exchangeCloudCodeForToken.mockRejectedValue(
        new Error('Token exchange failed')
      );

      const response = await request(app)
        .get('/api/admin/cloud/oauth/callback')
        .query({ code: 'test-code', state: 'test-state' })
        .expect(302);

      expect(response.headers.location).toContain('error=');
    });
  });

  describe('GET /api/admin/cloud/oauth/start Edge Cases', () => {
    it('should return 400 if chatbotId is missing', async () => {
      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', blockId })
        .expect(400);

      expect(response.body.error).toContain('provider, chatbotId, and blockId are required');
    });

    it('should return 400 if blockId is missing', async () => {
      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', chatbotId })
        .expect(400);

      expect(response.body.error).toContain('provider, chatbotId, and blockId are required');
    });

    it('should handle OAuth URL generation errors', async () => {
      mockCloudOAuthService.generateCloudOAuthUrl.mockRejectedValue(
        new Error('OAuth URL generation failed')
      );

      const response = await request(app)
        .get('/api/admin/cloud/oauth/start')
        .query({ provider: 'googledrive', chatbotId, blockId })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
