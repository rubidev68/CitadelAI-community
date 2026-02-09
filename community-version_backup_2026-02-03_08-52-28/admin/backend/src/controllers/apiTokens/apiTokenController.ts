import { Response } from 'express';
import { ApiTokenType } from '@prisma/client';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import {
  createApiToken,
  revokeToken,
  updateToken,
} from '../../services/apiTokenService';
import {
  getRealTimeUsage,
  getAggregatedUsage,
} from '../../services/tokenUsageService';
import prisma from '../../lib/prisma';

const apiTokensLogger = logger.child({ service: 'admin-backend', component: 'apiTokens' });

/**
 * Create a new API token
 */
export async function handleCreateApiToken(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    const { name, tokenType, expiresAt, maxUsage, blockId } = req.body;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate required fields
    if (!name || !tokenType) {
      res.status(400).json({ error: 'Missing required fields: name, tokenType' });
      return;
    }

    // Validate token type
    if (!['DURATION', 'USAGE', 'PERMANENT'].includes(tokenType)) {
      res.status(400).json({ error: 'Invalid tokenType. Must be DURATION, USAGE, or PERMANENT' });
      return;
    }

    // Validate chatbot ownership
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, ownerId: userId },
    });

    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    // Validate block if provided
    if (blockId) {
      const block = await prisma.block.findFirst({
        where: { id: blockId, chatbotId },
      });

      if (!block) {
        res.status(404).json({ error: 'Block not found' });
        return;
      }
    }

    // Validate token type specific fields
    let expiresAtDate: Date | undefined;
    let maxUsageValue: number | undefined;

    if (tokenType === 'DURATION') {
      if (!expiresAt) {
        res.status(400).json({ error: 'expiresAt is required for DURATION tokens' });
        return;
      }
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        res.status(400).json({ error: 'Invalid expiresAt date format' });
        return;
      }
      if (expiresAtDate <= new Date()) {
        res.status(400).json({ error: 'expiresAt must be in the future' });
        return;
      }
    } else if (tokenType === 'USAGE') {
      if (!maxUsage || typeof maxUsage !== 'number' || maxUsage < 1) {
        res.status(400).json({ error: 'maxUsage must be a positive number for USAGE tokens' });
        return;
      }
      maxUsageValue = maxUsage;
    }

    // Create token
    const { token, rawToken } = await createApiToken({
      chatbotId,
      blockId: blockId || undefined,
      name,
      tokenType: tokenType as ApiTokenType,
      expiresAt: expiresAtDate,
      maxUsage: maxUsageValue,
      createdBy: userId,
    });

    // Return token with raw token (only shown once)
    res.status(201).json({
      id: token.id,
      name: token.name,
      token: rawToken, // Full token shown only once
      tokenPrefix: token.tokenPrefix,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      maxUsage: token.maxUsage,
      currentUsage: token.currentUsage,
      isActive: token.isActive,
      createdAt: token.createdAt,
    });
  } catch (error: unknown) {
    apiTokensLogger.error('Error creating API token', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to create API token' });
  }
}

/**
 * List all API tokens for a chatbot
 */
export async function handleListApiTokens(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { chatbotId } = req.params;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate chatbot ownership
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, ownerId: userId },
    });

    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    // Get all tokens for this chatbot
    const tokens = await prisma.apiToken.findMany({
      where: { chatbotId },
      orderBy: { createdAt: 'desc' },
    });

    // Return tokens without the hashed token value (security)
    const safeTokens = tokens.map(token => ({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      maxUsage: token.maxUsage,
      currentUsage: token.currentUsage,
      isActive: token.isActive,
      lastUsedAt: token.lastUsedAt,
      rateLimitPerMinute: token.rateLimitPerMinute,
      revokedAt: token.revokedAt,
      revokedBy: token.revokedBy,
      revocationReason: token.revocationReason,
      scheduledRevocationAt: token.scheduledRevocationAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      blockId: token.blockId,
    }));

    res.json(safeTokens);
  } catch (error: unknown) {
    apiTokensLogger.error('Error fetching API tokens', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch API tokens' });
  }
}

/**
 * Get a specific API token
 */
export async function handleGetApiToken(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { tokenId } = req.params;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = await prisma.apiToken.findUnique({
      where: { id: tokenId },
      include: { chatbot: true },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    // Check ownership
    if (token.chatbot.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Return token without the hashed token value
    res.json({
      id: token.id,
      name: token.name,
      tokenPrefix: token.tokenPrefix,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      maxUsage: token.maxUsage,
      currentUsage: token.currentUsage,
      isActive: token.isActive,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
      blockId: token.blockId,
      chatbotId: token.chatbotId,
    });
  } catch (error: unknown) {
    apiTokensLogger.error('Error fetching API token', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch API token' });
  }
}

/**
 * Update an API token
 */
export async function handleUpdateApiToken(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { tokenId } = req.params;
    const { name, expiresAt, maxUsage } = req.body;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get token and check ownership
    const token = await prisma.apiToken.findUnique({
      where: { id: tokenId },
      include: { chatbot: true },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (token.chatbot.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Prepare updates
    const updates: {
      name?: string;
      expiresAt?: Date | null;
      maxUsage?: number | null;
    } = {};

    if (name !== undefined) {
      updates.name = name;
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        updates.expiresAt = null;
      } else {
        const expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          res.status(400).json({ error: 'Invalid expiresAt date format' });
          return;
        }
        if (expiresAtDate <= new Date()) {
          res.status(400).json({ error: 'expiresAt must be in the future' });
          return;
        }
        updates.expiresAt = expiresAtDate;
      }
    }

    if (maxUsage !== undefined) {
      if (maxUsage === null) {
        updates.maxUsage = null;
      } else if (typeof maxUsage !== 'number' || maxUsage < 1) {
        res.status(400).json({ error: 'maxUsage must be a positive number' });
        return;
      }
      updates.maxUsage = maxUsage;
    }

    // Update token
    const updatedToken = await updateToken(tokenId, updates);

    // Return updated token without the hashed token value
    res.json({
      id: updatedToken.id,
      name: updatedToken.name,
      tokenPrefix: updatedToken.tokenPrefix,
      tokenType: updatedToken.tokenType,
      expiresAt: updatedToken.expiresAt,
      maxUsage: updatedToken.maxUsage,
      currentUsage: updatedToken.currentUsage,
      isActive: updatedToken.isActive,
      lastUsedAt: updatedToken.lastUsedAt,
      createdAt: updatedToken.createdAt,
      updatedAt: updatedToken.updatedAt,
    });
  } catch (error: unknown) {
    apiTokensLogger.error('Error updating API token', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to update API token' });
  }
}

/**
 * Revoke an API token
 */
export async function handleRevokeApiToken(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { tokenId } = req.params;
    const { revocationReason, scheduledRevocationAt } = req.body;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get token and check ownership
    const token = await prisma.apiToken.findUnique({
      where: { id: tokenId },
      include: { chatbot: true },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    if (token.chatbot.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Validate scheduled revocation time if provided
    let scheduledDate: Date | undefined;
    if (scheduledRevocationAt) {
      scheduledDate = new Date(scheduledRevocationAt);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'Invalid scheduledRevocationAt date format' });
        return;
      }
      if (scheduledDate <= new Date()) {
        res.status(400).json({ error: 'scheduledRevocationAt must be in the future' });
        return;
      }
    }

    // Revoke token (immediate or scheduled)
    await revokeToken(tokenId, {
      revokedBy: userId,
      revocationReason: revocationReason || undefined,
      scheduledRevocationAt: scheduledDate,
    });

    apiTokensLogger.info('API token revoked', {
      tokenId,
      chatbotId: token.chatbotId,
      userId,
      immediate: !scheduledDate,
      scheduledFor: scheduledDate?.toISOString(),
    });

    const message = scheduledDate
      ? `Token scheduled for revocation at ${scheduledDate.toISOString()}`
      : 'Token revoked successfully';

    res.json({ message });
  } catch (error: unknown) {
    apiTokensLogger.error('Error revoking API token', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to revoke API token' });
  }
}

/**
 * Get usage statistics for an API token
 * GET /api/admin/chatbots/:chatbotId/api-tokens/:tokenId/usage
 */
export async function handleGetTokenUsage(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { chatbotId, tokenId } = req.params;
    const { startDate, endDate } = req.query;
    const userId = req.adminUser?.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Validate chatbot ownership
    const chatbot = await prisma.chatbot.findFirst({
      where: { id: chatbotId, ownerId: userId },
    });

    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    // Validate token belongs to chatbot
    const token = await prisma.apiToken.findFirst({
      where: { id: tokenId, chatbotId },
    });

    if (!token) {
      res.status(404).json({ error: 'Token not found' });
      return;
    }

    // Parse date range if provided
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    if (start && isNaN(start.getTime())) {
      res.status(400).json({ error: 'Invalid startDate format' });
      return;
    }

    if (end && isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid endDate format' });
      return;
    }

    // Get both real-time and aggregated usage
    const [realTime, aggregated] = await Promise.all([
      getRealTimeUsage(tokenId),
      getAggregatedUsage(tokenId, {
        startDate: start,
        endDate: end,
      }),
    ]);

    res.json({
      tokenId,
      tokenPrefix: token.tokenPrefix,
      realTime: {
        requestCount: realTime.requestCount,
        recentRequests: realTime.recentRequests,
        requestsPerEndpoint: realTime.requestsPerEndpoint,
      },
      aggregated: {
        totalRequests: aggregated.totalRequests,
        requestsPerHour: aggregated.requestsPerHour,
        requestsPerDay: aggregated.requestsPerDay,
        topIpAddresses: aggregated.topIpAddresses,
        averageResponseTime: aggregated.averageResponseTime,
        errorRate: aggregated.errorRate,
      },
    });
  } catch (error: unknown) {
    apiTokensLogger.error('Error fetching token usage', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
}
