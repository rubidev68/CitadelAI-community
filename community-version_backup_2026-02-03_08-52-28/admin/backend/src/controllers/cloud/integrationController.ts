import { Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import {
  getCloudIntegration,
  updateCloudIntegration,
  testCloudConnection,
  disconnectCloudIntegration,
} from '../../services/cloudIntegrationService';
import prisma from '../../lib/prisma';

const cloudLogger = logger.child({ service: 'admin-backend', component: 'cloud-controller' });

/**
 * Get cloud integration status
 */
export async function handleGetIntegration(req: AdminAuthRequest, res: Response): Promise<void> {
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

    const integration = getCloudIntegration(block);
    
    // Don't expose encrypted tokens or client secret
    const { accessToken, refreshToken, clientSecret, ...safeIntegration } = integration;

    res.json({
      integration: {
        ...safeIntegration,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        // Include clientId for display (needed for OAuth setup)
        clientId: integration.clientId,
        hasClientSecret: !!clientSecret, // Indicate if secret is set without exposing it
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get cloud integration';
    cloudLogger.error('Error getting cloud integration', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * Test cloud connection
 */
export async function handleTestConnection(req: AdminAuthRequest, res: Response): Promise<void> {
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

    const isConnected = await testCloudConnection(blockId);

    res.json({ connected: isConnected });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const currentBlockId = req.params.blockId;
    cloudLogger.error('Error testing cloud connection', {
      blockId: currentBlockId,
      error: error instanceof Error ? error : new Error(String(error)),
      stack: errorStack,
    });
    res.status(500).json({ 
      error: errorMessage || 'Failed to test connection',
      details: errorMessage,
    });
  }
}

/**
 * Update cloud integration configuration
 */
export async function handleUpdateIntegration(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { blockId } = req.params;
    const updates = req.body;

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

    const updatedBlock = await updateCloudIntegration(blockId, updates);

    res.json({
      success: true,
      block: {
        id: updatedBlock.id,
        properties: updatedBlock.properties,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update cloud integration';
    cloudLogger.error('Error updating cloud integration', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * Disconnect cloud integration
 */
export async function handleDisconnectIntegration(req: AdminAuthRequest, res: Response): Promise<void> {
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

    await disconnectCloudIntegration(blockId);

    res.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to disconnect cloud integration';
    cloudLogger.error('Error disconnecting cloud integration', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}
