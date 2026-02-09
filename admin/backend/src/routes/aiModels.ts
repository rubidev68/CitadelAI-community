import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const router = express.Router();

// Get all available AI models
router.get('/ai-models', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Only return active models
    const models = await prisma.globalAIModel.findMany({
      where: {
        isVisible: true,
      },
      select: {
        id: true,
        modelId: true,
        name: true,
        provider: true,
        icon: true,
        description: true,
        // Include cost info if needed for display, but maybe not sensitive secrets like apiKey
        inputCostPer1M: true,
        outputCostPer1M: true,
      },
      orderBy: [
        { provider: 'asc' },
        { name: 'asc' },
      ],
    });

    res.json(models);
  } catch (error) {
    logger.error('Error fetching AI models', error as Error);
    res.status(500).json({ error: 'Failed to fetch AI models' });
  }
});

export default router;
