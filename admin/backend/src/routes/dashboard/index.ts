import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest } from '../../middleware/auth';
import { adminLogger } from '../../app';

const router = Router();

router.get('/dashboard/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const ownerId = req.user.id || req.user.userId;
    const period = req.query.period as string || 'global'; // week, month, year, global

    try {
        // Get all chatbots owned by this user
        const chatbots = await prisma.chatbot.findMany({
            where: { ownerId },
            select: { id: true },
        });
        const chatbotIds = chatbots.map(c => c.id);

        // Calculate date filter based on period
        let dateFilter: Date | undefined;
        const now = new Date();
        switch (period) {
            case 'week':
                dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                break;
            case 'global':
            default:
                dateFilter = undefined;
                break;
        }

        // Build conversation filter
        const conversationFilter: any = { chatbotId: { in: chatbotIds } };
        if (dateFilter) {
            conversationFilter.createdAt = { gte: dateFilter };
        }

        // Count total conversations across all user's chatbots (filtered by period)
        const totalConversations = chatbotIds.length > 0
            ? await prisma.chatSession.count({
                where: conversationFilter,
            })
            : 0;

        // Count total messages across all user's chatbots (filtered by period)
        // Get all chat sessions for user's chatbots, then count messages in those sessions
        const totalMessages = chatbotIds.length > 0
            ? await prisma.chatSession.findMany({
                where: conversationFilter,
                select: { id: true },
            }).then(async (sessions) => {
                const sessionIds = sessions.map(s => s.id);
                if (sessionIds.length === 0) return 0;
                
                // Build message filter
                const messageFilter: any = { chatSessionId: { in: sessionIds } };
                if (dateFilter) {
                    messageFilter.createdAt = { gte: dateFilter };
                }
                
                return await prisma.chatMessage.count({
                    where: messageFilter,
                });
            })
            : 0;

        res.json({
            totalChatbots: chatbots.length,
            totalConversations,
            totalMessages,
            period,
        });
    } catch (error) {
        adminLogger.error('Error fetching dashboard stats', { error: error instanceof Error ? error : new Error(String(error)) });
        res.status(500).json({ error: 'Error fetching dashboard stats' });
    }
});

export default router;
