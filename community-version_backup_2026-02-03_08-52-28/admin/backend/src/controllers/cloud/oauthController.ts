import { Request, Response } from 'express';
import { logger } from '@shared/utils';
import { AdminAuthRequest } from '../../middleware/adminAuth';
import {
  generateCloudOAuthUrl,
  parseOAuthState,
  exchangeCloudCodeForToken,
} from '../../services/cloudOAuthService';
import { updateCloudIntegration } from '../../services/cloudIntegrationService';
import { indexCloudFiles } from '../../services/cloudIndexingService';
import { CloudProviderType } from '../../services/cloudProviders/providerFactory';
import prisma from '../../lib/prisma';
import { config } from '../../config';

const cloudLogger = logger.child({ service: 'admin-backend', component: 'cloud-controller' });

/**
 * Start OAuth flow
 */
export async function handleOAuthStart(req: AdminAuthRequest, res: Response): Promise<void> {
  try {
    const { provider, chatbotId, blockId } = req.query;

    if (!provider || !chatbotId || !blockId) {
      res.status(400).json({ error: 'provider, chatbotId, and blockId are required' });
      return;
    }

    // Verify chatbot ownership
    const chatbot = await prisma.chatbot.findFirst({
      where: {
        id: chatbotId as string,
        ownerId: req.adminUser?.id,
      },
    });

    if (!chatbot) {
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    // Verify block exists and is a Cloud block
    const block = await prisma.block.findFirst({
      where: {
        id: blockId as string,
        chatbotId: chatbotId as string,
        type: 'CONTEXT',
        subtype: 'Cloud',
      },
    });

    if (!block) {
      res.status(404).json({ error: 'Cloud block not found' });
      return;
    }

    const oauthUrl = await generateCloudOAuthUrl(
      provider as CloudProviderType,
      chatbotId as string,
      blockId as string
    );
    
    cloudLogger.debug('Returning OAuth URL to frontend');
    res.json({ oauthUrl });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate OAuth URL';
    cloudLogger.error('Error generating OAuth URL', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: errorMessage });
  }
}

/**
 * OAuth callback handler
 */
export async function handleOAuthCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(
        `${config.FRONTEND_URL}/?cloud_error=${encodeURIComponent(error as string)}`
      );
      return;
    }

    if (!code || !state) {
      res.redirect(
        `${config.FRONTEND_URL}/?cloud_error=missing_params`
      );
      return;
    }

    // Parse and validate state
    const stateData = parseOAuthState(state as string);
    if (!stateData) {
      res.redirect(
        `${config.FRONTEND_URL}/?cloud_error=invalid_state`
      );
      return;
    }

    // Get block to determine provider
    const block = await prisma.block.findUnique({
      where: { id: stateData.blockId },
    });

    if (!block) {
      res.redirect(
        `${config.FRONTEND_URL}/?cloud_error=block_not_found`
      );
      return;
    }

    const properties = block.properties as Record<string, unknown>;
    // Try to get provider from block properties first, fallback to state
    let provider = properties.provider as CloudProviderType | undefined;
    
    if (!provider && stateData.provider) {
      // Provider not saved in block yet, use from state and save it
      provider = stateData.provider;
      await updateCloudIntegration(stateData.blockId, { provider });
    }

    if (!provider) {
      res.redirect(
        `${config.FRONTEND_URL}/?cloud_error=provider_not_configured`
      );
      return;
    }

    // Exchange code for token
    const tokenData = await exchangeCloudCodeForToken(provider, code as string, stateData.blockId);

    // Update block with OAuth data
    await updateCloudIntegration(stateData.blockId, {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresAt?.toISOString(),
      accountId: tokenData.accountId,
      accountName: tokenData.accountName,
      isConnected: true,
      connectedAt: new Date().toISOString(),
    });

    // For Nextcloud, don't start indexing automatically - user needs to select folders first
    // For other providers (like Google Drive), indexing can start automatically
    if (provider !== 'nextcloud') {
      indexCloudFiles(stateData.blockId).catch((error) => {
        cloudLogger.error('Auto-indexing error after OAuth connection', {
          blockId: stateData.blockId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    }

    // Redirect to callback page that will close popup and notify parent
    const frontendUrl = config.FRONTEND_URL;
    res.redirect(
      `${frontendUrl}/cloud-oauth-callback?success=true&chatbotId=${stateData.chatbotId}&blockId=${stateData.blockId}`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudLogger.error('Error handling OAuth callback', { error: error instanceof Error ? error : new Error(String(error)) });
    const frontendUrl = config.FRONTEND_URL;
    res.redirect(
      `${frontendUrl}/cloud-oauth-callback?error=${encodeURIComponent(error instanceof Error ? error.message : 'oauth_failed')}`
    );
  }
}
