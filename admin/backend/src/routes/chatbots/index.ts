import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest, PrismaError } from '../../middleware/auth';
import { createRateLimiter } from '../../middleware/rateLimiter';
import { checkChatbotLimit } from '../../middleware/subscriptionMiddleware';
import { adminLogger } from '../../app';
import { deleteWeaviateData } from '../../weaviate';
import { validateRequest } from '@shared/utils';
import { getSubscriptionService } from '../../services/serviceFactory';
import {
  createChatbotSchema,
  getChatbotSchema,
  updateChatbotSchema,
  deleteChatbotSchema,
} from '../../validation/chatbotsSchemas';

const router = Router();

// Permissive rate limit for chatbot updates (autosave frequent updates)
const saveChatbotRateLimit = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per window (approx 1 every 3 seconds avg)
    message: 'Too many updates, please try again later'
});

// Chatbot Management Endpoints
router.post('/chatbots', authenticateToken, checkChatbotLimit, validateRequest(createChatbotSchema) as any, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name, description } = req.body;
    const ownerId = req.user.id || req.user.userId || '';

    if (!name) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const newChatbot = await prisma.$transaction(async (prisma) => {
            const chatbot = await prisma.chatbot.create({
                data: {
                    name,
                    ownerId: ownerId,
                    status: 'ACTIVE',
                },
            });

            // Invalidate subscription usage cache for this user
            const subscriptionService = getSubscriptionService();
            subscriptionService.invalidateCache(ownerId);

            const adminUser = await prisma.adminUser.findUnique({ where: { id: ownerId } });
            if (adminUser && adminUser.testUserId) {
                const testUser = await prisma.user.findUnique({ where: { id: adminUser.testUserId } });
                if (testUser) {
                    await prisma.chatbotAccess.create({
                        data: {
                            chatbotId: chatbot.id,
                            userId: testUser.id,
                            userEmail: testUser.email,
                        },
                    });

                    if (!testUser.defaultChatbotId) {
                        await prisma.user.update({
                            where: { id: testUser.id },
                            data: { defaultChatbotId: chatbot.id },
                        });
                    }
                }
            }

            const systemPromptBlock = await prisma.block.create({
                data: {
                    chatbotId: chatbot.id,
                    type: 'LOGIC',
                    subtype: 'System Prompt',
                    title: 'Global Intelligence',
                    position: { x: 100, y: 100 },
                    properties: {
                        botName: name || 'Assistant',
                        companyName: adminUser?.company || '',
                        behavior: 'helpful',
                        additionalInstructions: '',
                        llmProvider: 'mistral',
                        llmModel: 'mistral-medium',
                        prompt: "You are a helpful AI assistant. Your role is to provide accurate and concise information to users. Don't be afraid to say you don't know."
                    },
                },
            });

            const interfaceBlock = await prisma.block.create({
                data: {
                    chatbotId: chatbot.id,
                    type: 'FRONTEND',
                    subtype: 'Interface',
                    title: 'Interface',
                    position: { x: 400, y: 100 },
                    properties: {
                        title: name || 'My Chatbot',
                        description: description || 'Welcome to my chatbot!',
                        theme: 'light',
                        accentColor: '#2D726D',
                        questionSuggestions: [
                            { id: '1', text: 'Tell me about the platform', icon: 'Building' },
                            { id: '2', text: 'How do I create a new project?', icon: 'Sparkles' },
                            { id: '3', text: 'Explain the workflow', icon: 'MessageSquare' }
                        ]
                    },
                },
            });

            await prisma.connection.create({
                data: {
                    chatbotId: chatbot.id,
                    fromBlockId: systemPromptBlock.id,
                    toBlockId: interfaceBlock.id,
                    fromDirection: 'RIGHT',
                    toDirection: 'LEFT',
                }
            });

            return chatbot;
        });

        res.status(201).json(newChatbot);
    } catch (error) {
        adminLogger.error('Error creating chatbot', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error creating chatbot' });
    }
});

router.get('/chatbots', authenticateToken, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const ownerId = req.user.id || req.user.userId;

    try {
        const chatbots = await prisma.chatbot.findMany({
            where: { ownerId },
        });
        
        // Get conversation counts for each chatbot
        const chatbotsWithCounts = await Promise.all(
            chatbots.map(async (chatbot) => {
                const conversationCount = await prisma.chatSession.count({
                    where: { chatbotId: chatbot.id },
                });
                return {
                    ...chatbot,
                    conversationCount,
                };
            })
        );
        
        res.json(chatbotsWithCounts);
    } catch (error) {
        adminLogger.error('Error fetching chatbots', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error fetching chatbots' });
    }
});

router.get('/chatbots/:id', authenticateToken, validateRequest(getChatbotSchema) as any, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const ownerId = req.user.id || req.user.userId;

    try {
        const chatbot = await prisma.chatbot.findFirst({
            where: { id, ownerId },
            include: {
                blocks: true,
                connections: true,
                websiteContexts: true,
            },
        });

        if (!chatbot) {
            return res.status(404).json({ error: 'Chatbot not found' });
        }

        res.json(chatbot);
    } catch {
        res.status(500).json({ error: 'Error fetching chatbot' });
    }
});

router.put('/chatbots/:id', authenticateToken, saveChatbotRateLimit, validateRequest(updateChatbotSchema) as any, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const { name, status, blocks, connections, websiteContexts } = req.body;
    const ownerId = req.user.id || req.user.userId;

    // Prevent setting status to INACTIVE - chatbots are always deployed
    if (status === 'INACTIVE') {
        return res.status(400).json({ error: 'Cannot set chatbot status to INACTIVE. Chatbots are deployed by default. Delete the chatbot to remove it.' });
    }

    try {
        // Check indexed pages limit before starting transaction (only if subscription table exists)
        // This is done outside the transaction to avoid aborting it if the table doesn't exist
        if (websiteContexts) {
            try {
                const subscription = await prisma.subscription.findUnique({
                    where: { adminUserId: ownerId },
                    include: { plan: true }
                });

                if (subscription && subscription.plan.maxPages !== null) {
                    // Get current total pages
                    const currentTotal = await prisma.websiteContext.aggregate({
                        where: {
                            chatbot: { ownerId: ownerId },
                            crawledPagesCount: { not: null }
                        },
                        _sum: { crawledPagesCount: true }
                    });

                    const currentPages = currentTotal._sum.crawledPagesCount || 0;
                    
                    // Note: We don't check the limit here because we don't know the exact count
                    // until crawl completes. The actual limit check happens in the crawl route
                    adminLogger.debug('Checking indexed pages limit', { currentPages, maxPages: subscription.plan.maxPages });
                }
            } catch (error: unknown) {
                // If Subscription table doesn't exist (custom instances), skip limit checking
                const prismaError = error as { code?: string; message?: string };
                if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
                    adminLogger.debug('Subscription table does not exist - skipping indexed pages limit check (custom instance)');
                } else {
                    // Log but don't throw - we'll allow the update anyway
                    adminLogger.warn('Error checking subscription', { error: error instanceof Error ? error : new Error(String(error)) });
                }
            }
        }

        await prisma.$transaction(async (prisma: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends' | '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | '$use'>) => {
            // 1. Update chatbot metadata if provided
            // Note: status INACTIVE is already rejected above, so we only allow ACTIVE or DRAFT here
            const updateData: { name?: string; status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT' } = {};
            if (name) updateData.name = name;
            if (status && status !== 'INACTIVE') updateData.status = status;

            if (Object.keys(updateData).length > 0) {
                await prisma.chatbot.update({
                    where: { id, ownerId },
                    data: updateData,
                });
            }

            if (blocks && connections) {
                // 2. Get existing blocks to preserve IDs
                const existingBlocks = await prisma.block.findMany({ where: { chatbotId: id } });
                const existingBlockMap = new Map(existingBlocks.map(b => [b.id, b]));

                // 3. Update or create blocks while preserving IDs
                const idMap: { [key: string]: string } = {};
                for (const block of blocks) {
                    const { id: oldId, ...blockData } = block;
                    
                    if (existingBlockMap.has(oldId)) {
                        // Update existing block - merge properties to preserve sensitive data like accessToken
                        const existingBlock = existingBlockMap.get(oldId)!;
                        const existingProperties = (existingBlock.properties || {}) as Record<string, unknown>;
                        const newProperties = (blockData.properties || {}) as Record<string, unknown>;
                        
                        // Merge properties: new properties override, but preserve sensitive fields that might not be sent
                        const mergedProperties = {
                            ...existingProperties,
                            ...newProperties,
                            // Preserve sensitive fields if they exist in existing but not in new
                            ...(existingProperties.accessToken && !newProperties.accessToken ? { accessToken: existingProperties.accessToken } : {}),
                            ...(existingProperties.refreshToken && !newProperties.refreshToken ? { refreshToken: existingProperties.refreshToken } : {}),
                            ...(existingProperties.clientSecret && !newProperties.clientSecret ? { clientSecret: existingProperties.clientSecret } : {}),
                        };
                        
                        await prisma.block.update({
                            where: { id: oldId },
                            data: {
                                ...blockData,
                                properties: mergedProperties,
                                chatbotId: id,
                            },
                        });
                        idMap[oldId] = oldId; // Keep the same ID
                    } else {
                        // Create new block
                        const newBlock = await prisma.block.create({
                            data: {
                                ...blockData,
                                chatbotId: id,
                            },
                        });
                        idMap[oldId] = newBlock.id;
                    }
                }

                // 4. Update connections (delete old, then recreate)
                await prisma.connection.deleteMany({ where: { chatbotId: id } });
                if (connections.length > 0) {
                    const newConnections = connections.map((conn: { fromBlockId: string; toBlockId: string; }) => ({
                        ...conn,
                        chatbotId: id,
                        fromBlockId: idMap[conn.fromBlockId],
                        toBlockId: idMap[conn.toBlockId],
                        id: undefined, // Let prisma generate the id
                    }));
                    await prisma.connection.createMany({
                        data: newConnections,
                    });
                }

                // 5. Delete blocks that are no longer in the payload (after removing connections to avoid FK issues)
                const newBlockIds = blocks.map((b: { id: string }) => idMap[b.id]);
                await prisma.block.deleteMany({
                    where: {
                        chatbotId: id,
                        id: { notIn: newBlockIds }
                    }
                });
            }

            // 5. Update website contexts if provided
            if (websiteContexts) {
                // Note: Indexed pages limit check is done in the crawl route, not here
                // We don't know the exact count until crawl completes, so we allow the update
                // The actual limit check happens when the crawl is triggered

                // Delete existing website contexts
                await prisma.websiteContext.deleteMany({ where: { chatbotId: id } });
                
                // Create new website contexts
                if (websiteContexts.length > 0) {
                    const newWebsiteContexts = websiteContexts.map((wc: Record<string, unknown>) => ({
                        ...wc,
                        chatbotId: id,
                        id: undefined, // Let prisma generate the id
                    }));
                    await prisma.websiteContext.createMany({
                        data: newWebsiteContexts,
                    });
                }
            }
        });

        const updatedChatbot = await prisma.chatbot.findFirst({
            where: { id, ownerId },
            include: { blocks: true, connections: true, websiteContexts: true }
        });

        res.status(200).json(updatedChatbot);
    } catch (error) {
        adminLogger.error('Error updating chatbot', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error updating chatbot' });
    }
});

router.delete('/chatbots/:id', authenticateToken, validateRequest(deleteChatbotSchema) as any, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const ownerId = req.user.id || req.user.userId;

    try {
      // First, stop all active crawling jobs for this chatbot
      const websiteContexts = await prisma.websiteContext.findMany({
        where: { chatbotId: id },
        select: { blockId: true }
      });

      const { getCrawlingServiceClient, getCronSchedulerClient } = await import('../../services/serviceClients');
      const crawlingClient = getCrawlingServiceClient();
      const cronClient = getCronSchedulerClient();
      
      for (const context of websiteContexts) {
        try {
          await crawlingClient.post('/stop', { 
            chatbotId: id, 
            blockId: context.blockId 
          });
          adminLogger.info('Successfully stopped crawl job', { blockId: context.blockId });
        } catch (error) {
          adminLogger.error('Error stopping crawl job', { blockId: context.blockId, error: error instanceof Error ? error : new Error(String(error)) });
          // Continue with deletion even if stopping fails
        }
      }

      // Then, unschedule all cron crawling tasks for website contexts
      for (const context of websiteContexts) {
        try {
          await cronClient.delete(`/cron/unschedule/${context.blockId}`);
          adminLogger.info('Successfully unscheduled crawl task', { blockId: context.blockId });
        } catch (error) {
          adminLogger.error('Error unscheduling crawl task', { blockId: context.blockId, error: error instanceof Error ? error : new Error(String(error)) });
          // Continue with deletion even if unscheduling fails
        }
      }

        // Then, delete associated Weaviate data
        try {
          await deleteWeaviateData(id);
        } catch (error) {
          adminLogger.error('Error deleting Weaviate data for chatbot', { chatbotId: id, error: error instanceof Error ? error : new Error(String(error)) });
          // Continue with deletion even if Weaviate deletion fails
        }

        // Clean up database files for all DB blocks
        try {
          const { dbFileStorageService } = await import('@shared/services');
          await dbFileStorageService.cleanupChatbotFiles(id);
          adminLogger.info('Successfully cleaned up database files for chatbot', { chatbotId: id });
        } catch (error) {
          adminLogger.error('Error cleaning up database files for chatbot', { chatbotId: id, error: error instanceof Error ? error : new Error(String(error)) });
          // Continue with deletion even if cleanup fails
        }

        // Finally, delete all related records from the relational database
        // Order matters: delete child records before parent records
        await prisma.aICall.deleteMany({ where: { chatbotId: id } });
        await prisma.apiToken.deleteMany({ where: { chatbotId: id } });
        await prisma.slackIntegration.deleteMany({ where: { chatbotId: id } });
        await prisma.testDataset.deleteMany({ where: { chatbotId: id } });
        await prisma.chatbotAccess.deleteMany({ where: { chatbotId: id } });
        await prisma.connection.deleteMany({ where: { chatbotId: id } });
        await prisma.block.deleteMany({ where: { chatbotId: id } });
        await prisma.websiteContext.deleteMany({ where: { chatbotId: id } });
        await prisma.chatbot.delete({ where: { id, ownerId } });

        // Invalidate subscription usage cache for this user
        if (ownerId) {
          const subscriptionService = getSubscriptionService();
          subscriptionService.invalidateCache(ownerId);
        }

        res.sendStatus(204);
    } catch (error) {
        adminLogger.error('Error deleting chatbot', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error deleting chatbot' });
    }
});



router.delete('/chatbots/:chatbotId/blocks/:blockId', authenticateToken, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { chatbotId, blockId } = req.params;
    const ownerId = req.user.id || req.user.userId;

    try {
        // First, verify that the user owns the chatbot
        const chatbot = await prisma.chatbot.findFirst({
            where: {
                id: chatbotId,
                ownerId: ownerId,
            }
        });

        if (!chatbot) {
            return res.status(404).json({ error: 'Block not found or you do not have permission to delete it.' });
        }

        // Now, find the block within that chatbot
        const block = await prisma.block.findUnique({
            where: {
                id: blockId,
                chatbotId: chatbotId,
            }
        });

        if (!block) {
            return res.status(404).json({ error: 'Block not found.' });
        }

        // Delete connections associated with the block before deleting the block
        await prisma.connection.deleteMany({
            where: {
                OR: [
                    { fromBlockId: blockId },
                    { toBlockId: blockId },
                ],
            },
        });

        if (block.type === 'CONTEXT') {
          // First, stop any active crawling job for this block
          try {
              const { getCrawlingServiceClient } = await import('../../services/serviceClients');
            const crawlingClient = getCrawlingServiceClient();
            await crawlingClient.post('/stop', { 
              chatbotId: chatbotId, 
              blockId: blockId 
            });
            adminLogger.info('Successfully stopped crawl job', { blockId });
          } catch (error) {
            adminLogger.error('Error stopping crawl job', { blockId, error: error instanceof Error ? error : new Error(String(error)) });
            // Continue with deletion even if stopping fails
          }

          // Then, unschedule any associated cron crawling tasks
          try {
            const { getCronSchedulerClient } = await import('../../services/serviceClients');
            const cronClient = getCronSchedulerClient();
            await cronClient.delete(`/cron/unschedule/${blockId}`);
            adminLogger.info('Successfully unscheduled crawl task', { blockId });
          } catch (error) {
            adminLogger.error('Error unscheduling crawl task', { blockId, error: error instanceof Error ? error : new Error(String(error)) });
            // Continue with deletion even if unscheduling fails
          }

          // Delete associated Weaviate data and the WebsiteContext record
          try {
            await deleteWeaviateData(chatbotId, blockId);
          } catch (error) {
            adminLogger.error('Error deleting Weaviate data for block', { blockId, error: error instanceof Error ? error : new Error(String(error)) });
            // Continue with deletion even if Weaviate deletion fails (e.g., read-only mode, disk space issues)
          }
          await prisma.websiteContext.deleteMany({
            where: { blockId: blockId },
          });
        }

        // Clean up database files if this is a DB block with file-based connection
        if ((block.type === 'ACTION' && block.subtype === 'DB') || (block.type === 'CONTEXT' && block.subtype === 'Database')) {
          const blockProperties = block.properties as Record<string, unknown>;
          if (blockProperties.connectionMode === 'file' && blockProperties.fileId) {
            try {
              const { dbFileStorageService } = await import('@shared/services');
              await dbFileStorageService.cleanupBlockFiles(chatbotId, blockId);
              adminLogger.info('Successfully cleaned up database files for block', { blockId });
            } catch (error) {
              adminLogger.error('Error cleaning up database files for block', { blockId, error: error instanceof Error ? error : new Error(String(error)) });
              // Continue with deletion even if cleanup fails
            }
          }
        }

        // Finally, delete the block itself
        await prisma.block.delete({
            where: {
                id: blockId
            }
        });

        res.sendStatus(204);
    } catch (error) {
        adminLogger.error('Error deleting block', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error deleting block' });
    }
});

// User Access Management Endpoints
router.get('/chatbots/:id/users', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const accesses = await prisma.chatbotAccess.findMany({
            where: { chatbotId: id },
            include: { user: true },
        });
        res.json(accesses);
    } catch {
        res.status(500).json({ error: 'Error fetching users' });
    }
});

router.post('/chatbots/:id/users', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { email } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        const access = await prisma.chatbotAccess.create({
            data: {
                chatbotId: id,
                userId: user?.id,
                userEmail: email,
            },
        });
        res.status(201).json(access);
    } catch (error: unknown) {
        const prismaError = error as PrismaError;
        if (prismaError.code === 'P2002') {
            return res.status(409).json({ error: 'User already has access.' });
        }
        res.status(500).json({ error: 'Error adding user' });
    }
});

router.delete('/chatbots/:id/users/:accessId', authenticateToken, async (req: AuthRequest, res: Response) => {
    const { accessId } = req.params;
    try {
        const access = await prisma.chatbotAccess.findUnique({
            where: { id: accessId },
            include: { chatbot: true },
        });

        if (!access) {
            return res.status(404).json({ error: 'Access record not found.' });
        }

        const adminUser = await prisma.adminUser.findUnique({
            where: { email: access.userEmail },
        });

        if (adminUser && adminUser.id === access.chatbot.ownerId) {
            return res.status(403).json({ error: 'Cannot remove the chatbot owner.' });
        }

        await prisma.chatbotAccess.delete({
            where: { id: accessId },
        });
        res.sendStatus(204);
    } catch {
        res.status(500).json({ error: 'Error removing user' });
    }
});


export default router;
