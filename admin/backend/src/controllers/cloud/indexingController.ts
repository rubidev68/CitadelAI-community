import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import { getCloudIntegration } from '../../services/cloudIntegrationService';
import { indexCloudFiles } from '../../services/cloudIndexingService';
import { getCloudFiles } from '../../weaviate';
import prisma from '../../lib/prisma';
import { config } from '../../config';

const cloudLogger = logger.child({ service: 'admin-backend', component: 'cloud-controller' });

/**
 * Cancel cloud file indexing
 */
export async function handleCancelIndexing(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Set cancellation flag
    const properties = getCloudIntegration(block);
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...properties,
          indexingCancelled: true,
        },
      },
    });

    res.json({ success: true, message: 'Indexing cancellation requested' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error cancelling indexing', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * Trigger cloud file indexing
 */
export async function handleStartIndexing(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;

    if (!blockId) {
      res.status(400).json({ error: 'Block ID is required' });
      return;
    }

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Validate block has cloud integration configured
    const properties = block.properties as Record<string, unknown>;
    if (!properties.provider) {
      res.status(400).json({ error: 'Cloud provider not configured' });
      return;
    }

    if (!properties.isConnected) {
      res.status(400).json({ error: 'Cloud storage not connected' });
      return;
    }

    // Start indexing in background (don't wait for completion)
    indexCloudFiles(blockId).catch((error) => {
      cloudLogger.error('Background indexing error', {
        blockId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    // Return success immediately
    res.json({ success: true, message: 'Indexing started' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorMsg = error instanceof Error ? error.message : 'Failed to start indexing';
    cloudLogger.error('Error starting cloud indexing', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ 
      error: errorMsg,
      details: config.NODE_ENV === 'development' ? errorStack : undefined,
    });
  }
}

/**
 * Get indexed cloud files
 */
export async function handleGetIndexedFiles(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;
    const { chatbotId } = req.query;

    if (!blockId) {
      res.status(400).json({ error: 'Block ID is required' });
      return;
    }

    if (!chatbotId || typeof chatbotId !== 'string') {
      res.status(400).json({ error: 'Chatbot ID is required' });
      return;
    }

    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Block not found' });
      return;
    }

    // Verify ownership
    if (block.chatbot.ownerId !== req.adminUser?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const files = await getCloudFiles(chatbotId, blockId);
    res.json(files);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error fetching indexed files', {
      blockId: req.params.blockId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    res.status(500).json({ error: errorMessage });
  }
}
