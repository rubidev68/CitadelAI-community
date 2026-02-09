import { Request, Response, NextFunction } from 'express';
import { SubscriptionStatus, Subscription } from '@prisma/client';
import { canSendMessage, canIndexPages } from '../utils/subscriptionLimits';
import { AdminAuthRequest } from './adminAuth';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { getSubscriptionService } from '../services/serviceFactory';

const subscriptionMiddlewareLogger = logger.child({ service: 'admin-backend', component: 'subscriptionMiddleware' });

interface SubscriptionRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
  subscription?: Subscription;
}

// Middleware to check if user has an active subscription
export const requireActiveSubscription = async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
  try {
    // First check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { adminUserId: req.user.id },
      include: { plan: true }
    });

    if (!subscription) {
      return res.status(403).json({ 
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION',
        message: 'Please subscribe to a plan to access this feature'
      });
    }

    const now = new Date();
    let isActive = false;

    // Check if subscription is canceled
    if (subscription.status === SubscriptionStatus.CANCELED) {
      isActive = false;
    }
    // Check if trial has expired
    else if (subscription.status === SubscriptionStatus.TRIAL && subscription.trialEndDate) {
      isActive = subscription.trialEndDate > now;
    }
    // Check if current period has expired
    else if (subscription.currentPeriodEnd) {
      isActive = subscription.currentPeriodEnd > now;
    }
    else {
      isActive = subscription.status === SubscriptionStatus.ACTIVE;
    }

    if (!isActive) {
      return res.status(403).json({ 
        error: 'Subscription inactive or expired',
        code: 'SUBSCRIPTION_INACTIVE',
        message: 'Your subscription has expired. Please renew to continue using this feature.'
      });
    }

    // Attach subscription info to request for use in other middleware
    req.subscription = subscription;
    next();
  } catch (error) {
    subscriptionMiddlewareLogger.error('Subscription check error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error checking subscription status' });
  }
};

// Middleware to check chatbot limits based on subscription plan
// Works with both SubscriptionRequest (req.user) and AdminAuthRequest (req.adminUser)
// Now uses the ISubscriptionService abstraction for business logic
export const checkChatbotLimit = async (req: SubscriptionRequest & AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    // Support both req.user (from user routes) and req.adminUser (from admin routes)
    const userId = req.adminUser?.id || req.user?.id;
    
    if (!userId) {
      subscriptionMiddlewareLogger.warn('No user ID found in request', { component: 'checkChatbotLimit' });
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const subscriptionService = getSubscriptionService();
      const limitInfo = await subscriptionService.canCreateChatbot(userId);
      
      if (!limitInfo.allowed) {
        return res.status(403).json({
          error: 'Chatbot limit reached',
          code: 'CHATBOT_LIMIT_REACHED',
          message: limitInfo.reason || 'Unable to create chatbot',
          currentCount: limitInfo.current,
          maxAllowed: limitInfo.limit
        });
      }
    } catch (error: unknown) {
      // If Subscription table doesn't exist (custom instances), allow the request
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        subscriptionMiddlewareLogger.debug('Subscription table does not exist - allowing request (custom instance)');
        return next();
      }
      throw error;
    }

    next();
  } catch (error) {
    subscriptionMiddlewareLogger.error('Chatbot limit check error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error checking chatbot limits' });
  }
};

// Middleware to check user access limits based on subscription plan
export const checkUserAccessLimit = async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { adminUserId: req.user.id },
      include: { plan: true }
    });

    if (!subscription) {
      return res.status(403).json({ 
        error: 'No subscription found',
        code: 'NO_SUBSCRIPTION'
      });
    }

    // Check if plan has user access limits
    if (subscription.plan.maxUsers !== null) {
      const currentUserAccessCount = await prisma.chatbotAccess.count({
        where: { 
          chatbot: { ownerId: req.user.id },
          userId: { not: null } // Only count actual users, not email-only accesses
        }
      });

      if (currentUserAccessCount >= subscription.plan.maxUsers) {
        return res.status(403).json({
          error: 'User access limit reached',
          code: 'USER_ACCESS_LIMIT_REACHED',
          message: `You have reached the maximum number of user accesses (${subscription.plan.maxUsers}) for your ${subscription.plan.name} plan. Please upgrade to add more users.`,
          currentCount: currentUserAccessCount,
          maxAllowed: subscription.plan.maxUsers
        });
      }
    }

    next();
  } catch (error) {
    subscriptionMiddlewareLogger.error('User access limit check error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error checking user access limits' });
  }
};

// Middleware to check message limits based on subscription plan (rolling 30 days)
// Now uses the ISubscriptionService abstraction for business logic
export const checkMessageLimit = async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const subscriptionService = getSubscriptionService();
      const limitInfo = await subscriptionService.canSendMessage(req.user.id);
      
      if (!limitInfo.allowed) {
        return res.status(403).json({
          error: 'Message limit reached',
          code: 'MESSAGE_LIMIT_REACHED',
          message: limitInfo.reason || 'Message limit reached',
          currentCount: limitInfo.current,
          maxAllowed: limitInfo.limit,
          remaining: limitInfo.remaining
        });
      }
    } catch (error: unknown) {
      // If Subscription table doesn't exist (custom instances), allow the request
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === 'P2021' || prismaError.message?.includes('does not exist')) {
        subscriptionMiddlewareLogger.debug('Subscription table does not exist - allowing request (custom instance)');
        return next();
      }
      throw error;
    }

    next();
  } catch (error) {
    subscriptionMiddlewareLogger.error('Message limit check error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error checking message limits' });
  }
};

// Middleware to check indexed pages limits based on subscription plan
// Works with both SubscriptionRequest (req.user) and AdminAuthRequest (req.adminUser)
// Now uses the ISubscriptionService abstraction for business logic
export const checkIndexedPagesLimit = async (req: SubscriptionRequest & AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    // Support both req.user (from user routes) and req.adminUser (from admin routes)
    const userId = req.adminUser?.id || req.user?.id;
    
    if (!userId) {
      subscriptionMiddlewareLogger.warn('No user ID found in request', { component: 'checkIndexedPagesLimit' });
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const subscriptionService = getSubscriptionService();
      
      // Get additional pages from request body if provided (for new crawls)
      const additionalPages = req.body?.estimatedPages || 0;
      const limitInfo = await subscriptionService.canIndexPages(userId, additionalPages);
      
      if (!limitInfo.allowed) {
        return res.status(403).json({
          error: 'Indexed pages limit reached',
          code: 'PAGES_LIMIT_REACHED',
          message: limitInfo.reason || 'Indexed pages limit reached',
          currentCount: limitInfo.current,
          maxAllowed: limitInfo.limit,
          remaining: limitInfo.remaining
        });
      }

      next();
    } catch (prismaError: unknown) {
      // Handle Prisma errors (e.g., column doesn't exist)
      const prismaErr = prismaError as { code?: string; message?: string };
      if (prismaErr.code === 'P2022' || prismaErr.message?.includes('does not exist')) {
        subscriptionMiddlewareLogger.warn('Database schema not updated yet, allowing crawl (migration may not have run)', { message: prismaErr.message });
        // Allow the request to proceed if migration hasn't run yet
        return next();
      }
      throw prismaError;
    }
  } catch (error) {
    subscriptionMiddlewareLogger.error('Indexed pages limit check error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error checking indexed pages limits' });
  }
};

// Middleware to add subscription info to all requests (optional)
export const addSubscriptionInfo = async (req: SubscriptionRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      const subscription = await prisma.subscription.findUnique({
        where: { adminUserId: req.user.id },
        include: { plan: true }
      });

      if (subscription) {
        req.subscription = subscription;
      }
    }
    next();
  } catch (error) {
    subscriptionMiddlewareLogger.error('Error adding subscription info', { error: error instanceof Error ? error : new Error(String(error)) });
    next(); // Continue even if this fails
  }
};
