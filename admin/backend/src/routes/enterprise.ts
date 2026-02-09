import { Router } from 'express';
import { EnterpriseContactStatus } from '@prisma/client';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import { getEmailService } from '../services/zoho-email';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

const enterpriseRoutesLogger = logger.child({ service: 'admin-backend', component: 'enterprise-routes' });

const router = Router();

// Submit enterprise contact request
router.post('/contact', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { email, phone, name, company, message } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email already has a pending request
    const existingRequest = await prisma.enterpriseContactRequest.findFirst({
      where: {
        email,
        status: EnterpriseContactStatus.PENDING
      }
    });

    if (existingRequest) {
      return res.status(400).json({ 
        error: 'You already have a pending enterprise request. We will contact you soon.' 
      });
    }

    // Fetch admin user details for email
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: req.adminUser!.id },
      select: { name: true, email: true }
    });

    // Create enterprise contact request with adminUserId
    const contactRequest = await prisma.enterpriseContactRequest.create({
      data: {
        email,
        phone,
        name,
        company,
        message,
        status: EnterpriseContactStatus.PENDING,
        adminUserId: req.adminUser!.id
      }
    });

    // Send emails asynchronously (don't block the response)
    const emailService = getEmailService();
    
    // Send recap email to the admin user
    emailService.sendEnterpriseRequestRecapEmail(
      email,
      {
        name,
        company,
        phone,
        message
      },
      adminUser?.name || undefined
    ).catch((error) => {
      enterpriseRoutesLogger.error('Failed to send enterprise request recap email', { error: error instanceof Error ? error : new Error(String(error)) });
    });

    // Send notification email to anatole@citadelai.app
    emailService.sendEnterpriseRequestNotificationEmail(
      'anatole@citadelai.app',
      {
        email,
        name,
        company,
        phone,
        message,
        adminUserName: adminUser?.name || undefined,
        adminUserEmail: adminUser?.email || undefined,
        requestId: contactRequest.id
      }
    ).catch((error) => {
      enterpriseRoutesLogger.error('Failed to send enterprise request notification email', { error: error instanceof Error ? error : new Error(String(error)) });
    });

    res.json({
      success: true,
      message: 'Thank you for your interest in our Enterprise plan. A superadmin will contact you within 24 hours.',
      requestId: contactRequest.id
    });
  } catch (error) {
    enterpriseRoutesLogger.error('Error creating enterprise contact request', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to submit enterprise request' });
  }
});

// Get all enterprise contact requests (superadmin only)
router.get('/requests', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    // Check if user is superadmin (you might want to add role-based access control)
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: req.adminUser!.id }
    });

    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    // For now, allow any admin to view requests
    // You can add role checking here later
    const requests = await prisma.enterpriseContactRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json(requests);
  } catch (error) {
    enterpriseRoutesLogger.error('Error fetching enterprise requests', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to fetch enterprise requests' });
  }
});

// Update enterprise contact request status (superadmin only)
router.put('/requests/:id', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!Object.values(EnterpriseContactStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updatedRequest = await prisma.enterpriseContactRequest.update({
      where: { id },
      data: {
        status,
        notes,
        adminUserId: req.adminUser!.id
      }
    });

    res.json(updatedRequest);
  } catch (error) {
    enterpriseRoutesLogger.error('Error updating enterprise request', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to update enterprise request' });
  }
});

// Convert enterprise request to subscription (superadmin only)
router.post('/requests/:id/convert', adminAuthMiddleware, async (req: AdminAuthRequest, res) => {
  try {
    const { id } = req.params;
    const { adminUserId } = req.body;

    if (!adminUserId) {
      return res.status(400).json({ error: 'Admin user ID is required' });
    }

    // Get the enterprise contact request
    const contactRequest = await prisma.enterpriseContactRequest.findUnique({
      where: { id }
    });

    if (!contactRequest) {
      return res.status(404).json({ error: 'Enterprise request not found' });
    }

    // Get the enterprise plan
    const enterprisePlan = await prisma.subscriptionPlan.findFirst({
      where: { name: 'Enterprise' }
    });

    if (!enterprisePlan) {
      return res.status(404).json({ error: 'Enterprise plan not found' });
    }

    // Check if user already has a subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { adminUserId }
    });

    if (existingSubscription) {
      return res.status(400).json({ error: 'User already has a subscription' });
    }

    // Create enterprise subscription
    const subscription = await prisma.subscription.create({
      data: {
        adminUserId,
        planId: enterprisePlan.id,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
      include: {
        plan: true,
        adminUser: {
          select: {
            id: true,
            email: true,
            name: true,
            company: true
          }
        }
      }
    });

    // Update contact request status
    await prisma.enterpriseContactRequest.update({
      where: { id },
      data: {
        status: EnterpriseContactStatus.CONVERTED,
        adminUserId: req.adminUser!.id
      }
    });

    res.json({
      success: true,
      subscription,
      message: 'Enterprise subscription created successfully'
    });
  } catch (error) {
    enterpriseRoutesLogger.error('Error converting enterprise request', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to convert enterprise request' });
  }
});

export default router;
