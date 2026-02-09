import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import instancesRouter from '../../routes/instances';

// Mock Prisma - use vi.hoisted
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    dedicatedInstance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    instanceResourceTemplate: {
      findUnique: vi.fn(),
    },
    instanceUser: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    proposal: {
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock axios
const { mockAxios } = vi.hoisted(() => {
  const mockAxios = {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  };
  return { mockAxios };
});

vi.mock('axios', () => ({
  default: mockAxios,
}));

// Mock bcrypt (used in instance user creation via require())
// Note: The route uses require('bcrypt'), which returns the module object
const { mockBcrypt } = vi.hoisted(() => {
  const mockBcrypt = {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  };
  return { mockBcrypt };
});

// Mock as CommonJS module (require returns the module object)
vi.mock('bcrypt', () => mockBcrypt);

// Mock service registry - use vi.hoisted
const { mockGetServiceBaseUrl } = vi.hoisted(() => {
  const mockGetServiceBaseUrl = vi.fn(() => 'http://instance-service:3004');
  return { mockGetServiceBaseUrl };
});

vi.mock('@shared/utils', () => ({
  getServiceBaseUrl: mockGetServiceBaseUrl,
  logger: {
    child: vi.fn(() => ({
      error: vi.fn(),
    })),
  },
}));

// Mock adminAuth middleware
vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: (req: any, res: any, next: any) => {
    req.adminUser = { id: 'admin-id', email: 'admin@example.com', name: 'Admin User' };
    next();
  },
  AdminAuthRequest: {},
}));

const app = express();
app.use(express.json());
app.use('/api/admin/instances', instancesRouter);

describe('Instances Routes', () => {
  const instanceId = 'instance-123';
  const templateId = 'template-123';
  const proposalId = 'proposal-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/instances', () => {
    it('should return all instances', async () => {
      const mockInstances = [
        {
          id: instanceId,
          name: 'instance-1',
          displayName: 'Instance 1',
          instanceUsers: [],
          createdByAdmin: { id: 'admin-id', email: 'admin@example.com', name: 'Admin' },
          proposal: null,
          subscription: null,
        },
      ];

      mockPrisma.dedicatedInstance.findMany.mockResolvedValue(mockInstances);

      const response = await request(app)
        .get('/api/admin/instances')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(instanceId);
      expect(mockPrisma.dedicatedInstance.findMany).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.dedicatedInstance.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/instances')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch instances');
    });
  });

  describe('GET /api/admin/instances/:id', () => {
    it('should return instance by id', async () => {
      const mockInstance = {
        id: instanceId,
        name: 'instance-1',
        displayName: 'Instance 1',
        instanceUsers: [],
        createdByAdmin: { id: 'admin-id', email: 'admin@example.com', name: 'Admin' },
        proposal: null,
        subscription: null,
      };

      mockPrisma.dedicatedInstance.findUnique.mockResolvedValue(mockInstance);

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}`)
        .expect(200);

      expect(response.body.id).toBe(instanceId);
      expect(mockPrisma.dedicatedInstance.findUnique).toHaveBeenCalledWith({
        where: { id: instanceId },
        include: expect.any(Object),
      });
    });

    it('should return 404 if instance not found', async () => {
      mockPrisma.dedicatedInstance.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}`)
        .expect(404);

      expect(response.body.error).toBe('Instance not found');
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.dedicatedInstance.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch instance');
    });
  });

  describe('POST /api/admin/instances', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/admin/instances')
        .send({
          name: 'instance-1',
        })
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 404 if resource template not found', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/instances')
        .send({
          name: 'instance-1',
          displayName: 'Instance 1',
          resourceTemplateId: templateId,
        })
        .expect(404);

      expect(response.body.error).toBe('Resource template not found');
    });

    it('should create instance successfully', async () => {
      const mockTemplate = {
        id: templateId,
        cpuCores: 4,
        memoryGB: 8,
        storageGB: 100,
        maxConcurrentUsers: 10,
        maxChatbots: 5,
        databaseSizeGB: 50,
        databaseConnections: 20,
        weaviateMemoryGB: 4,
        weaviateStorageGB: 50,
        features: {},
      };

      const mockInstance = {
        id: instanceId,
        name: 'instance-1',
        displayName: 'Instance 1',
        resourceSpec: {
          cpuCores: 4,
          memoryGB: 8,
        },
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockAxios.post.mockResolvedValue({ data: mockInstance });

      const response = await request(app)
        .post('/api/admin/instances')
        .send({
          name: 'instance-1',
          displayName: 'Instance 1',
          resourceTemplateId: templateId,
        })
        .expect(201);

      expect(response.body.id).toBe(instanceId);
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/instances'),
        expect.objectContaining({
          name: 'instance-1',
          displayName: 'Instance 1',
          resourceSpec: expect.any(Object),
          createdByAdminId: 'admin-id',
        })
      );
    });

    it('should update proposal status when proposalId is provided', async () => {
      const mockTemplate = {
        id: templateId,
        cpuCores: 4,
        memoryGB: 8,
        storageGB: 100,
        maxConcurrentUsers: 10,
        maxChatbots: 5,
        databaseSizeGB: 50,
        databaseConnections: 20,
        weaviateMemoryGB: 4,
        weaviateStorageGB: 50,
        features: {},
      };

      const mockInstance = {
        id: instanceId,
        name: 'instance-1',
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockAxios.post.mockResolvedValue({ data: mockInstance });

      const response = await request(app)
        .post('/api/admin/instances')
        .send({
          name: 'instance-1',
          displayName: 'Instance 1',
          resourceTemplateId: templateId,
          proposalId,
        })
        .expect(201);

      expect(response.body.id).toBe(instanceId);
      expect(mockPrisma.proposal.update).toHaveBeenCalledWith({
        where: { id: proposalId },
        data: {
          status: 'APPROVED',
          approvedAt: expect.any(Date),
        },
      });
    });

    it('should handle instance creation errors', async () => {
      const mockTemplate = {
        id: templateId,
        cpuCores: 4,
        memoryGB: 8,
        storageGB: 100,
        maxConcurrentUsers: 10,
        maxChatbots: 5,
        databaseSizeGB: 50,
        databaseConnections: 20,
        weaviateMemoryGB: 4,
        weaviateStorageGB: 50,
        features: {},
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockAxios.post.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/admin/instances')
        .send({
          name: 'instance-1',
          displayName: 'Instance 1',
          resourceTemplateId: templateId,
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to create instance');
    });
  });

  describe('PUT /api/admin/instances/:id', () => {
    it('should update instance successfully', async () => {
      const updatedInstance = {
        id: instanceId,
        name: 'updated-instance',
        displayName: 'Updated Instance',
        instanceUsers: [],
        createdByAdmin: { id: 'admin-id', email: 'admin@example.com', name: 'Admin' },
      };

      mockPrisma.dedicatedInstance.update.mockResolvedValue(updatedInstance);

      const response = await request(app)
        .put(`/api/admin/instances/${instanceId}`)
        .send({
          displayName: 'Updated Instance',
        })
        .expect(200);

      expect(response.body.displayName).toBe('Updated Instance');
      expect(mockPrisma.dedicatedInstance.update).toHaveBeenCalledWith({
        where: { id: instanceId },
        data: { displayName: 'Updated Instance' },
        include: expect.any(Object),
      });
    });

    it('should handle update errors', async () => {
      mockPrisma.dedicatedInstance.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put(`/api/admin/instances/${instanceId}`)
        .send({
          displayName: 'Updated Instance',
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to update instance');
    });
  });

  describe('DELETE /api/admin/instances/:id', () => {
    it('should delete instance successfully', async () => {
      mockAxios.delete.mockResolvedValue({ data: { success: true } });

      const response = await request(app)
        .delete(`/api/admin/instances/${instanceId}`)
        .expect(200);

      expect(response.body.message).toBe('Instance deleted successfully');
      expect(mockAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining(`/api/instances/${instanceId}`)
      );
    });

    it('should handle delete errors', async () => {
      mockAxios.delete.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .delete(`/api/admin/instances/${instanceId}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to delete instance');
    });
  });

  describe('POST /api/admin/instances/:id/suspend', () => {
    it('should suspend instance successfully', async () => {
      mockAxios.post.mockResolvedValue({ data: { success: true } });

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/suspend`)
        .expect(200);

      expect(response.body.message).toBe('Instance suspended successfully');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/api/instances/${instanceId}/suspend`)
      );
    });

    it('should handle suspend errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/suspend`)
        .expect(500);

      expect(response.body.error).toBe('Failed to suspend instance');
    });
  });

  describe('POST /api/admin/instances/:id/resume', () => {
    it('should resume instance successfully', async () => {
      mockAxios.post.mockResolvedValue({ data: { success: true } });

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/resume`)
        .expect(200);

      expect(response.body.message).toBe('Instance resumed successfully');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/api/instances/${instanceId}/resume`)
      );
    });

    it('should handle resume errors', async () => {
      mockAxios.post.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/resume`)
        .expect(500);

      expect(response.body.error).toBe('Failed to resume instance');
    });
  });

  describe('GET /api/admin/instances/:id/health', () => {
    it('should return instance health', async () => {
      const mockHealth = {
        status: 'healthy',
        services: ['api', 'database', 'weaviate'],
      };

      mockAxios.get.mockResolvedValue({ data: mockHealth });

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}/health`)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/api/health/instance/${instanceId}`)
      );
    });

    it('should handle health check errors', async () => {
      mockAxios.get.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}/health`)
        .expect(500);

      expect(response.body.error).toBe('Failed to check instance health');
    });
  });

  describe('POST /api/admin/instances/:id/users', () => {
    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/users`)
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Email and password are required');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/users`)
        .send({
          email: 'user@example.com',
        })
        .expect(400);

      expect(response.body.error).toBe('Email and password are required');
    });

    it('should create instance user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        instanceId,
        email: 'user@example.com',
        name: 'Test User',
        role: 'USER',
        createdAt: new Date(),
      };

      mockPrisma.instanceUser.create.mockResolvedValue(mockUser);

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/users`)
        .send({
          email: 'user@example.com',
          name: 'Test User',
          password: 'password123',
          role: 'USER',
        })
        .expect(201);

      expect(response.body.id).toBe('user-123');
      expect(response.body.email).toBe('user@example.com');
      expect(mockPrisma.instanceUser.create).toHaveBeenCalled();
      // Verify password was hashed (bcrypt.hash should be called)
      const createCall = mockPrisma.instanceUser.create.mock.calls[0];
      expect(createCall[0].data.password).toBeDefined();
      expect(createCall[0].data.password).not.toBe('password123'); // Should be hashed
    });

    it('should handle user creation errors', async () => {
      mockPrisma.instanceUser.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/admin/instances/${instanceId}/users`)
        .send({
          email: 'user@example.com',
          password: 'password123',
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to create instance user');
    });
  });

  describe('GET /api/admin/instances/:id/users', () => {
    it('should return instance users', async () => {
      const mockUsers = [
        {
          id: 'user-123',
          instanceId,
          email: 'user1@example.com',
          name: 'User 1',
          role: 'USER',
          createdAt: new Date(),
        },
        {
          id: 'user-456',
          instanceId,
          email: 'user2@example.com',
          name: 'User 2',
          role: 'ADMIN',
          createdAt: new Date(),
        },
      ];

      mockPrisma.instanceUser.findMany.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}/users`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].email).toBe('user1@example.com');
      expect(mockPrisma.instanceUser.findMany).toHaveBeenCalledWith({
        where: { instanceId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPrisma.instanceUser.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/admin/instances/${instanceId}/users`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch instance users');
    });
  });
});
