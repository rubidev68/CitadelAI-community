import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
// Import encryption utilities from admin backend
import { encryptCredentials, decryptCredentials } from '@shared/utils';
import { logger } from '@shared/utils';
import { config } from '../config';

const router = Router();

// Get provider availability (which providers have API keys configured)
router.get('/providers/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const availability = {
      gemini: !!config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 0,
      openai: !!config.OPENAI_API_KEY && config.OPENAI_API_KEY.length > 0,
      anthropic: !!config.ANTHROPIC_API_KEY && config.ANTHROPIC_API_KEY.length > 0,
      mistral: !!config.MISTRAL_API_KEY && config.MISTRAL_API_KEY.length > 0,
      custom: true, // Custom providers are always available (they're user-configured)
    };

    res.json(availability);
  } catch (error) {
    logger.error('Error checking provider availability', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to check provider availability' });
  }
});

// Get provider availability (which providers have API keys configured)
router.get('/providers/availability', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const availability = {
      gemini: !!config.GEMINI_API_KEY && config.GEMINI_API_KEY.length > 0,
      openai: !!config.OPENAI_API_KEY && config.OPENAI_API_KEY.length > 0,
      anthropic: !!config.ANTHROPIC_API_KEY && config.ANTHROPIC_API_KEY.length > 0,
      mistral: !!config.MISTRAL_API_KEY && config.MISTRAL_API_KEY.length > 0,
      custom: true, // Custom providers are always available (they're user-configured)
    };

    res.json(availability);
  } catch (error) {
    logger.error('Error checking provider availability', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to check provider availability' });
  }
});

// Get all custom providers for the authenticated user
router.get('/custom-providers', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';

  try {
    const providers = await prisma.customProvider.findMany({
      where: {
        ownerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        modelName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(providers);
  } catch (error) {
    logger.error('Error fetching custom providers', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to fetch custom providers' });
  }
});

// Get a specific custom provider
router.get('/custom-providers/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';
  const { id } = req.params;

  try {
    const provider = await prisma.customProvider.findFirst({
      where: {
        id,
        ownerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        modelName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Custom provider not found' });
    }

    res.json(provider);
  } catch (error) {
    logger.error('Error fetching custom provider', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to fetch custom provider' });
  }
});

// Create a new custom provider
router.post('/custom-providers', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';
  const { name, baseUrl, apiToken, modelName } = req.body;

  if (!name || !baseUrl || !apiToken || !modelName) {
    return res.status(400).json({ error: 'Missing required fields: name, baseUrl, apiToken, modelName' });
  }

  // Validate baseUrl format
  try {
    new URL(baseUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid baseUrl format' });
  }

  try {
    // Encrypt the API token before storing
    const encryptedToken = encryptCredentials(apiToken);

    const provider = await prisma.customProvider.create({
      data: {
        name,
        baseUrl,
        apiToken: encryptedToken,
        modelName,
        ownerId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        modelName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(provider);
  } catch (error) {
    logger.error('Error creating custom provider', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to create custom provider' });
  }
});

// Update a custom provider
router.put('/custom-providers/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';
  const { id } = req.params;
  const { name, baseUrl, apiToken, modelName } = req.body;

  try {
    // Check if provider exists and belongs to user
    const existingProvider = await prisma.customProvider.findFirst({
      where: {
        id,
        ownerId,
        isActive: true,
      },
    });

    if (!existingProvider) {
      return res.status(404).json({ error: 'Custom provider not found' });
    }

    // Validate baseUrl if provided
    if (baseUrl) {
      try {
        new URL(baseUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid baseUrl format' });
      }
    }

    // Prepare update data
    const updateData: {
      name?: string;
      baseUrl?: string;
      apiToken?: string;
      modelName?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (apiToken !== undefined) updateData.apiToken = encryptCredentials(apiToken);
    if (modelName !== undefined) updateData.modelName = modelName;

    const provider = await prisma.customProvider.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        baseUrl: true,
        modelName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(provider);
  } catch (error) {
    logger.error('Error updating custom provider', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to update custom provider' });
  }
});

// Delete a custom provider (soft delete)
router.delete('/custom-providers/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';
  const { id } = req.params;

  try {
    const provider = await prisma.customProvider.findFirst({
      where: {
        id,
        ownerId,
      },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Custom provider not found' });
    }

    await prisma.customProvider.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting custom provider', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({ error: 'Failed to delete custom provider' });
  }
});

// Test custom provider configuration
router.post('/custom-providers/:id/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const ownerId = req.user.id || req.user.userId || '';
  const { id } = req.params;

  try {
    const provider = await prisma.customProvider.findFirst({
      where: {
        id,
        ownerId,
        isActive: true,
      },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Custom provider not found' });
    }

    // Decrypt the API token
    const apiToken = decryptCredentials(provider.apiToken);

    // Ensure baseUrl ends with /v1 if not already
    const apiBaseUrl = provider.baseUrl.endsWith('/v1') 
      ? provider.baseUrl 
      : provider.baseUrl.endsWith('/') 
        ? `${provider.baseUrl}v1` 
        : `${provider.baseUrl}/v1`;

    // Test the connection with a simple request
    const testResponse = await fetch(`${apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.modelName,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "test" if you can read this.' }
        ],
        max_tokens: 10,
      }),
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text().catch(() => '');
      return res.status(400).json({
        success: false,
        error: `API test failed: ${testResponse.status} ${testResponse.statusText}${errorText ? ` - ${errorText}` : ''}`,
      });
    }

    const data = await testResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!data.choices || !data.choices[0]?.message?.content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid response format from API',
      });
    }

    res.json({
      success: true,
      message: 'Custom provider configuration is working correctly',
      response: data.choices[0].message.content,
    });
  } catch (error) {
    logger.error('Error testing custom provider', error instanceof Error ? error : undefined, {
      service: 'customProviders',
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to test custom provider',
    });
  }
});

export default router;
