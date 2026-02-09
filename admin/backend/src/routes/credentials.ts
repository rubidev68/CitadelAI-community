import express, { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { adminLogger } from '../app';

const router = express.Router();

// Middleware to authenticate all routes
router.use(authenticateToken);

// List credentials
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const where: any = { ownerId: userId };
    if (type) {
      where.type = String(type);
    }

    const credentials = await prisma.integrationCredential.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(credentials);
  } catch (error) {
    adminLogger.error('Failed to list credentials', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to list credentials' });
  }
});

// Create credential
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, type, data } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name || !type || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const credential = await prisma.integrationCredential.create({
      data: {
        name,
        type,
        data,
        ownerId: userId,
      },
    });

    res.status(201).json(credential);
  } catch (error) {
    adminLogger.error('Failed to create credential', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to create credential' });
  }
});

// Update credential
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, data } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ensure user owns the credential
    const existing = await prisma.integrationCredential.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    if (existing.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.integrationCredential.update({
      where: { id },
      data: {
        name: name || undefined,
        data: data || undefined,
      },
    });

    res.json(updated);
  } catch (error) {
    adminLogger.error('Failed to update credential', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to update credential' });
  }
});

// Delete credential
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ensure user owns the credential
    const credential = await prisma.integrationCredential.findUnique({
      where: { id },
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    if (credential.ownerId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.integrationCredential.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    adminLogger.error('Failed to delete credential', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

export default router;
