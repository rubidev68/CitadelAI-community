import { Router, Request, Response, NextFunction } from 'express';
import { ChatSession, ChatMessage } from '@prisma/client';
import prisma from '../lib/prisma';
import { adminLogger } from '../app';
import { config } from '../config';
import { validateRequest } from '@shared/utils';
import { exportUserDataSchema } from '../validation/internalSchemas';

const router = Router();

/**
 * Internal service authentication middleware
 */
export const authenticateInternalService = (req: Request, res: Response, next: NextFunction) => {
  const serviceToken = req.headers['x-service-token'];
  const expectedToken = config.INTERNAL_SERVICE_TOKEN;
  
  if (!expectedToken) {
    return res.status(500).json({ error: 'Internal service token not configured' });
  }
  
  if (serviceToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid service token' });
  }
  
  next();
};

/**
 * Export user data endpoint (for migration to dedicated instances)
 * This endpoint is placed before logging middleware to avoid logging sensitive data
 * Note: Path is /api/admin/internal/... to match Caddyfile routing (/api/admin/* -> admin-backend)
 */
router.post('/api/admin/internal/export-user-data', authenticateInternalService, validateRequest(exportUserDataSchema) as any, async (req: Request, res: Response) => {
  try {
    const { adminEmail } = req.body;
    
    adminLogger.info('Exporting data for admin user', { adminEmail });
    
    // Fetch admin user with all related data
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: adminEmail },
      include: {
        chatbots: {
          include: {
            blocks: true,
            connections: {
              include: {
                fromBlock: true,
                toBlock: true,
              },
            },
            websiteContexts: true,
            accesses: true,
          },
        },
        testDatasets: true,
      },
    });
    
    if (!adminUser) {
      return res.status(404).json({ error: `Admin user with email ${adminEmail} not found` });
    }
    
    adminLogger.debug('Found admin user', { 
      adminId: adminUser.id, 
      name: adminUser.name || adminUser.email,
      chatbotCount: adminUser.chatbots.length 
    });
    
    // Fetch test user if exists
    let testUser = null;
    let testUserChatSessions: ChatSession[] = [];
    let testUserChatMessages: ChatMessage[] = [];
    
    if (adminUser.testUserId) {
      testUser = await prisma.user.findUnique({
        where: { id: adminUser.testUserId },
        include: {
          chatSessions: {
            include: {
              chatMessages: true,
            },
          },
        },
      });
      
      if (testUser) {
        testUserChatSessions = testUser.chatSessions || [];
        testUserChatSessions.forEach((session) => {
          const sessionWithMessages = session as { chatMessages?: ChatMessage[] };
          testUserChatMessages.push(...(sessionWithMessages.chatMessages || []));
        });
        adminLogger.debug('Found test user', { 
          testUserChatSessions: testUserChatSessions.length 
        });
      }
    }
    
    // Collect all related data
    const blocks = adminUser.chatbots.flatMap(c => c.blocks || []);
    const connections = adminUser.chatbots.flatMap(c => c.connections || []);
    const websiteContexts = adminUser.chatbots.flatMap(c => c.websiteContexts || []);
    const chatbotAccesses = adminUser.chatbots.flatMap(c => c.accesses || []);
    
    const data = {
      adminUser,
      chatbots: adminUser.chatbots,
      blocks,
      connections,
      websiteContexts,
      chatbotAccesses,
      testDatasets: adminUser.testDatasets || [],
      testUser,
      testUserChatSessions,
      testUserChatMessages,
    };
    
    adminLogger.info('Export completed successfully', {
      chatbots: data.chatbots.length,
      blocks: data.blocks.length,
      connections: data.connections.length,
      websiteContexts: data.websiteContexts.length,
      chatbotAccesses: data.chatbotAccesses.length,
      testDatasets: data.testDatasets.length,
      testUser: data.testUser ? {
        sessions: data.testUserChatSessions.length,
        messages: data.testUserChatMessages.length
      } : null
    });
    
    res.json(data);
  } catch (error: unknown) {
    adminLogger.error('Export failed', { error: error instanceof Error ? error : new Error(String(error)) });
    const errorMessage = error instanceof Error ? error.message : 'Failed to export user data';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
