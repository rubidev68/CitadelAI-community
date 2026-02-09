import { Router } from 'express';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const resourceTemplatesLogger = logger.child({ service: 'admin-backend', component: 'resourceTemplates' });

const router = Router();

// Get all resource templates
router.get('/', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const templates = await prisma.instanceResourceTemplate.findMany({
      orderBy: { createdAt: 'asc' }
    });

    res.json(templates);
  } catch (error) {
    resourceTemplatesLogger.error('Error fetching resource templates', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch resource templates' });
  }
});

// Get specific template
router.get('/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.instanceResourceTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    resourceTemplatesLogger.error('Error fetching template', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Create new template
router.post('/', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const template = await prisma.instanceResourceTemplate.create({
      data: req.body
    });

    res.status(201).json(template);
  } catch (error) {
    resourceTemplatesLogger.error('Error creating template', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update template
router.put('/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.instanceResourceTemplate.update({
      where: { id },
      data: req.body
    });

    res.json(template);
  } catch (error) {
    resourceTemplatesLogger.error('Error updating template', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if template is being used by any instances
    const instancesUsingTemplate = await prisma.dedicatedInstance.findMany({
      where: {
        resourceSpec: {
          path: ['cpuCores'],
          equals: (await prisma.instanceResourceTemplate.findUnique({
            where: { id }
          }))?.cpuCores
        }
      }
    });

    if (instancesUsingTemplate.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete template that is being used by instances',
        instancesCount: instancesUsingTemplate.length
      });
    }

    await prisma.instanceResourceTemplate.delete({
      where: { id }
    });

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    resourceTemplatesLogger.error('Error deleting template', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Duplicate template
router.post('/:id/duplicate', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'New template name is required' });
    }

    const originalTemplate = await prisma.instanceResourceTemplate.findUnique({
      where: { id }
    });

    if (!originalTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const duplicatedTemplate = await prisma.instanceResourceTemplate.create({
      data: {
        name,
        description: `${originalTemplate.description} (Copy)`,
        cpuCores: originalTemplate.cpuCores,
        memoryGB: originalTemplate.memoryGB,
        storageGB: originalTemplate.storageGB,
        maxConcurrentUsers: originalTemplate.maxConcurrentUsers,
        maxChatbots: originalTemplate.maxChatbots,
        databaseSizeGB: originalTemplate.databaseSizeGB,
        databaseConnections: originalTemplate.databaseConnections,
        weaviateMemoryGB: originalTemplate.weaviateMemoryGB,
        weaviateStorageGB: originalTemplate.weaviateStorageGB,
        features: originalTemplate.features as Prisma.InputJsonValue,
        isActive: true
      }
    });

    res.status(201).json(duplicatedTemplate);
  } catch (error) {
    resourceTemplatesLogger.error('Error duplicating template', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to duplicate template' });
  }
});

export default router;