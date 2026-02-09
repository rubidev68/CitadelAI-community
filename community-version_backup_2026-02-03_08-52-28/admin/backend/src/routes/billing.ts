import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { adminLogger } from '../app';
import { trackAICall, canSendMessage, canCreateConcurrentSession } from '../utils/subscriptionLimits';

const router = Router();

// AI call tracking endpoint (for user service)
router.post('/ai-calls/track', async (req: Request, res: Response) => {
  try {
    const { chatbotId, callType = 'MESSAGE' } = req.body;
    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' });
    }
    
    // Get chatbot owner
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { ownerId: true }
    });
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    // Check limit before tracking (only if subscription table exists)
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: chatbot.ownerId },
        include: { plan: true }
      });
      
      if (subscription) {
        const checkResult = await canSendMessage(chatbot.ownerId, subscription.plan);
        if (!checkResult.allowed && callType === 'MESSAGE') {
          return res.status(403).json({
            error: 'Message limit reached',
            code: 'MESSAGE_LIMIT_REACHED',
            message: `Message limit reached (${checkResult.currentCount}/${checkResult.maxAllowed}). Please upgrade.`,
            currentCount: checkResult.currentCount,
            maxAllowed: checkResult.maxAllowed,
            remaining: checkResult.remaining
          });
        }
      }
    } catch (error: unknown) {
      // If Subscription table doesn't exist (custom instances), skip limit checking
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        adminLogger.debug('Subscription table does not exist - skipping limit check (custom instance)');
      } else {
        throw error;
      }
    }
    
    // Track the call (will handle missing AICall table gracefully)
    await trackAICall(chatbotId, chatbot.ownerId, callType as 'MESSAGE' | 'TESTLLM' | 'FOLLOWUP');
    
    res.json({ success: true });
  } catch (error: unknown) {
    adminLogger.error('Error tracking AI call', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to track AI call' });
  }
});

// Widget session limit check endpoint
router.post('/widget-sessions/check', async (req: Request, res: Response) => {
  try {
    const { chatbotId, currentSessionCount } = req.body;
    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' });
    }
    
    // Get chatbot owner
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: { ownerId: true }
    });
    
    if (!chatbot) {
      return res.status(404).json({ error: 'Chatbot not found' });
    }
    
    // Get subscription and plan (only if subscription table exists)
    let subscription = null;
    try {
      subscription = await prisma.subscription.findUnique({
        where: { adminUserId: chatbot.ownerId },
        include: { plan: true }
      });
    } catch (error: unknown) {
      // If Subscription table doesn't exist (custom instances), allow unlimited sessions
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        adminLogger.debug('Subscription table does not exist - allowing unlimited sessions (custom instance)');
        return res.json({ allowed: true, currentCount: currentSessionCount || 0, maxAllowed: null, remaining: null });
      }
      throw error;
    }
    
    if (!subscription || !subscription.plan) {
      return res.json({ allowed: true, currentCount: currentSessionCount || 0, maxAllowed: null, remaining: null });
    }
    
    const checkResult = await canCreateConcurrentSession(chatbotId, chatbot.ownerId, subscription.plan);
    
    // Override currentCount with the actual count passed from widget service
    const result = {
      ...checkResult,
      currentCount: currentSessionCount || 0
    };
    
    // Recalculate remaining based on actual count
    if (result.maxAllowed !== null) {
      result.remaining = Math.max(0, result.maxAllowed - result.currentCount);
      result.allowed = result.currentCount < result.maxAllowed;
    }
    
    res.json(result);
  } catch (error: unknown) {
    adminLogger.error('Error checking widget session limit', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to check session limit' });
  }
});

export default router;
