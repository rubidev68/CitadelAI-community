import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import resourceTemplatesRouter from '../../routes/resourceTemplates';

// Mock Prisma
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    instanceResourceTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dedicatedInstance: {
      findMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('@prisma/client', () => ({
  Prisma: {
    InputJsonValue: {},
  },
}));

vi.mock('../../lib/prisma', () => ({
  default: mockPrisma,
}));

// Mock adminAuthMiddleware
const { mockAdminAuthMiddleware } = vi.hoisted(() => {
  const mockAdminAuthMiddleware = vi.fn((req: any, res: any, next: any) => {
    req.adminUserId = 'admin-123';
    next();
  });
  return { mockAdminAuthMiddleware };
});

vi.mock('../../middleware/adminAuth', () => ({
  adminAuthMiddleware: mockAdminAuthMiddleware,
  AdminAuthRequest: {},
}));

const app = express();
app.use(express.json());
app.use('/api/admin/resource-templates', resourceTemplatesRouter);

describe('Resource Templates Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/resource-templates', () => {
    it('should return all resource templates', async () => {
      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Small',
          cpuCores: 2,
          memoryGB: 4,
          storageGB: 20,
        },
        {
          id: 'template-2',
          name: 'Medium',
          cpuCores: 4,
          memoryGB: 8,
          storageGB: 40,
        },
      ];

      mockPrisma.instanceResourceTemplate.findMany.mockResolvedValue(mockTemplates);

      const response = await request(app)
        .get('/api/admin/resource-templates')
        .expect(200);

      expect(response.body).toEqual(mockTemplates);
      expect(mockPrisma.instanceResourceTemplate.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/admin/resource-templates')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch resource templates');
    });
  });

  describe('GET /api/admin/resource-templates/:id', () => {
    it('should return a specific template', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Small',
        cpuCores: 2,
        memoryGB: 4,
        storageGB: 20,
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .get('/api/admin/resource-templates/template-1')
        .expect(200);

      expect(response.body).toEqual(mockTemplate);
      expect(mockPrisma.instanceResourceTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should return 404 if template not found', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/resource-templates/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Template not found');
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/admin/resource-templates/template-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch template');
    });
  });

  describe('POST /api/admin/resource-templates', () => {
    it('should create a new template', async () => {
      const newTemplate = {
        name: 'Large',
        cpuCores: 8,
        memoryGB: 16,
        storageGB: 80,
      };

      const createdTemplate = {
        id: 'template-3',
        ...newTemplate,
        createdAt: new Date(),
      };

      mockPrisma.instanceResourceTemplate.create.mockResolvedValue(createdTemplate);

      const response = await request(app)
        .post('/api/admin/resource-templates')
        .send(newTemplate)
        .expect(201);

      expect(response.body).toMatchObject(newTemplate);
      expect(response.body.id).toBe('template-3');
      expect(mockPrisma.instanceResourceTemplate.create).toHaveBeenCalledWith({
        data: newTemplate,
      });
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.create.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/admin/resource-templates')
        .send({ name: 'Test' })
        .expect(500);

      expect(response.body.error).toBe('Failed to create template');
    });
  });

  describe('PUT /api/admin/resource-templates/:id', () => {
    it('should update an existing template', async () => {
      const updateData = {
        name: 'Updated Template',
        cpuCores: 4,
      };

      const updatedTemplate = {
        id: 'template-1',
        name: 'Updated Template',
        cpuCores: 4,
        memoryGB: 4,
        storageGB: 20,
      };

      mockPrisma.instanceResourceTemplate.update.mockResolvedValue(updatedTemplate);

      const response = await request(app)
        .put('/api/admin/resource-templates/template-1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(updatedTemplate);
      expect(mockPrisma.instanceResourceTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: updateData,
      });
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.update.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .put('/api/admin/resource-templates/template-1')
        .send({ name: 'Updated' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update template');
    });
  });

  describe('DELETE /api/admin/resource-templates/:id', () => {
    it('should delete a template that is not in use', async () => {
      const mockTemplate = {
        id: 'template-1',
        cpuCores: 2,
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.dedicatedInstance.findMany.mockResolvedValue([]);
      mockPrisma.instanceResourceTemplate.delete.mockResolvedValue(mockTemplate);

      const response = await request(app)
        .delete('/api/admin/resource-templates/template-1')
        .expect(200);

      expect(response.body.message).toBe('Template deleted successfully');
      expect(mockPrisma.instanceResourceTemplate.delete).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should return 400 if template is being used by instances', async () => {
      const mockTemplate = {
        id: 'template-1',
        cpuCores: 2,
      };

      const mockInstances = [
        { id: 'instance-1', name: 'Instance 1' },
        { id: 'instance-2', name: 'Instance 2' },
      ];

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(mockTemplate);
      mockPrisma.dedicatedInstance.findMany.mockResolvedValue(mockInstances);

      const response = await request(app)
        .delete('/api/admin/resource-templates/template-1')
        .expect(400);

      expect(response.body.error).toBe('Cannot delete template that is being used by instances');
      expect(response.body.instancesCount).toBe(2);
      expect(mockPrisma.instanceResourceTemplate.delete).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .delete('/api/admin/resource-templates/template-1')
        .expect(500);

      expect(response.body.error).toBe('Failed to delete template');
    });
  });

  describe('POST /api/admin/resource-templates/:id/duplicate', () => {
    it('should duplicate a template with a new name', async () => {
      const originalTemplate = {
        id: 'template-1',
        name: 'Original',
        description: 'Original description',
        cpuCores: 2,
        memoryGB: 4,
        storageGB: 20,
        maxConcurrentUsers: 10,
        maxChatbots: 5,
        databaseSizeGB: 10,
        databaseConnections: 20,
        weaviateMemoryGB: 2,
        weaviateStorageGB: 5,
        features: { feature1: true },
        isActive: true,
      };

      const duplicatedTemplate = {
        id: 'template-2',
        name: 'Duplicated',
        description: 'Original description (Copy)',
        cpuCores: 2,
        memoryGB: 4,
        storageGB: 20,
        maxConcurrentUsers: 10,
        maxChatbots: 5,
        databaseSizeGB: 10,
        databaseConnections: 20,
        weaviateMemoryGB: 2,
        weaviateStorageGB: 5,
        features: { feature1: true },
        isActive: true,
      };

      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(originalTemplate);
      mockPrisma.instanceResourceTemplate.create.mockResolvedValue(duplicatedTemplate);

      const response = await request(app)
        .post('/api/admin/resource-templates/template-1/duplicate')
        .send({ name: 'Duplicated' })
        .expect(201);

      expect(response.body).toEqual(duplicatedTemplate);
      expect(mockPrisma.instanceResourceTemplate.create).toHaveBeenCalledWith({
        data: {
          name: 'Duplicated',
          description: 'Original description (Copy)',
          cpuCores: 2,
          memoryGB: 4,
          storageGB: 20,
          maxConcurrentUsers: 10,
          maxChatbots: 5,
          databaseSizeGB: 10,
          databaseConnections: 20,
          weaviateMemoryGB: 2,
          weaviateStorageGB: 5,
          features: { feature1: true },
          isActive: true,
        },
      });
    });

    it('should return 400 if name is not provided', async () => {
      const response = await request(app)
        .post('/api/admin/resource-templates/template-1/duplicate')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('New template name is required');
    });

    it('should return 404 if template not found', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/resource-templates/non-existent/duplicate')
        .send({ name: 'Duplicated' })
        .expect(404);

      expect(response.body.error).toBe('Template not found');
    });

    it('should return 500 on database error', async () => {
      mockPrisma.instanceResourceTemplate.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .post('/api/admin/resource-templates/template-1/duplicate')
        .send({ name: 'Duplicated' })
        .expect(500);

      expect(response.body.error).toBe('Failed to duplicate template');
    });
  });
});
