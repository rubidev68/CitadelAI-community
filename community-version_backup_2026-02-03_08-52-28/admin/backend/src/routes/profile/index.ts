import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { authenticateToken, AuthRequest, PrismaError } from '../../middleware/auth';
import { adminLogger } from '../../app';

const router = Router();

// User Profile Management Endpoints
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, email, company } = req.body;
  const adminUserId = req.user.id;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    // Check if email is already taken by another user
    const existingUser = await prisma.adminUser.findFirst({
      where: {
        email,
        id: { not: adminUserId }
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email is already taken by another account' });
    }

    // Get current user data to detect changes
    const currentUser = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { email: true, name: true, company: true }
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData: {
      email?: string;
      name?: string;
      company?: string;
      [key: string]: unknown;
    } = {
      email,
    };
    
    if (name) updateData.name = name;
    if (company !== undefined) updateData.company = company;

    const updatedUser = await prisma.adminUser.update({
      where: { id: adminUserId },
      data: updateData,
    });

    // Detect what changed for email notification
    const changes: { name?: string; email?: string; company?: string } = {};
    if (name && name !== currentUser.name) changes.name = name;
    if (email && email !== currentUser.email) changes.email = email;
    if (company !== undefined && company !== currentUser.company) changes.company = company;

    // Send profile update email if anything changed
    if (Object.keys(changes).length > 0) {
      try {
        const { getEmailService } = await import('../../services/zoho-email');
        const emailService = getEmailService();
        // Send to old email if email changed, otherwise to new email
        const emailToSendTo = changes.email ? currentUser.email : updatedUser.email;
        await emailService.sendProfileUpdateEmail(
          emailToSendTo,
          changes,
          updatedUser.name || undefined
        );
        adminLogger.info('Profile update email sent', { email: emailToSendTo });
      } catch (emailError: unknown) {
        adminLogger.error('Failed to send profile update email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
        // Don't fail the request if email fails
      }
    }

    const { password: _password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error: unknown) {
    adminLogger.error('Profile update error', { error: error instanceof Error ? error : new Error(String(error)) });
    const prismaError = error as PrismaError;
    if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('email')) {
      return res.status(409).json({ error: 'Email is already taken' });
    }
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Tutorial completion endpoint
router.put('/tutorial-completion', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tutorialCompleted } = req.body;
  const adminUserId = req.user.id;

  if (typeof tutorialCompleted !== 'boolean') {
    return res.status(400).json({ error: 'tutorialCompleted must be a boolean' });
  }

  try {
    const updatedUser = await prisma.adminUser.update({
      where: { id: adminUserId },
      data: { tutorialCompleted },
    });

    const { password: _password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);
  } catch (error: unknown) {
    adminLogger.error('Tutorial completion update error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error updating tutorial completion status' });
  }
});

router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;
  const adminUserId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    const user = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.adminUser.update({
      where: { id: adminUserId },
      data: { password: hashedNewPassword },
    });

    // Send password change email
    try {
      const { getEmailService } = await import('../../services/zoho-email');
      const emailService = getEmailService();
      await emailService.sendPasswordChangeEmail(
        user.email,
        user.name || undefined
      );
      adminLogger.info('Password change email sent', { email: user.email });
    } catch (emailError: unknown) {
      adminLogger.error('Failed to send password change email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
      // Don't fail the request if email fails
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error: unknown) {
    adminLogger.error('Password change error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error changing password' });
  }
});

router.delete('/delete-account', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const adminUserId = req.user.id;

  try {
    await prisma.$transaction(async (prisma) => {
      // Get all chatbots owned by this user
      const chatbots = await prisma.chatbot.findMany({
        where: { ownerId: adminUserId },
        include: {
          blocks: {
            include: {
              fromConnections: true,
              toConnections: true
            }
          },
          accesses: true,
          websiteContexts: true,
        }
      });

      // Step 1: Delete all connections (they reference blocks)
      for (const chatbot of chatbots) {
        for (const block of chatbot.blocks) {
          // Delete connections where this block is the source
          await prisma.connection.deleteMany({
            where: { fromBlockId: block.id }
          });
          // Delete connections where this block is the target
          await prisma.connection.deleteMany({
            where: { toBlockId: block.id }
          });
        }
      }

      // Step 2: Delete all blocks (they reference chatbots)
      for (const chatbot of chatbots) {
        await prisma.block.deleteMany({
          where: { chatbotId: chatbot.id }
        });
      }

      // Step 3: Delete all website contexts (they reference chatbots)
      for (const chatbot of chatbots) {
        await prisma.websiteContext.deleteMany({
          where: { chatbotId: chatbot.id }
        });
      }

      // Step 4: Delete all chatbot access records
      for (const chatbot of chatbots) {
        await prisma.chatbotAccess.deleteMany({
          where: { chatbotId: chatbot.id }
        });
      }

      // Step 5: Delete all chatbots
      await prisma.chatbot.deleteMany({
        where: { ownerId: adminUserId }
      });

      // Step 6: Delete dedicated instances and their related data
      // First, get all dedicated instances created by this admin
      const dedicatedInstances = await prisma.dedicatedInstance.findMany({
        where: { createdByAdminId: adminUserId },
        select: { id: true }
      });
      
      const instanceIds = dedicatedInstances.map(inst => inst.id);
      if (instanceIds.length > 0) {
        // Delete instance users first (they reference instances)
        await prisma.instanceUser.deleteMany({
          where: { instanceId: { in: instanceIds } }
        });
        
        // Then delete the dedicated instances
        await prisma.dedicatedInstance.deleteMany({
          where: { id: { in: instanceIds } }
        });
      }

      // Step 7: Delete or update proposals
      // Delete proposals created by this admin
      await prisma.proposal.deleteMany({
        where: { createdByAdminId: adminUserId }
      });
      
      // Update proposals assigned to this admin (set assignment to null)
      await prisma.proposal.updateMany({
        where: { assignedToAdminId: adminUserId },
        data: { assignedToAdminId: null }
      });
      // Step 8: Skipped (Community Edition)

      // Step 9: Get user info before deletion for email
      const adminUserForEmail = await prisma.adminUser.findUnique({
        where: { id: adminUserId },
        select: { email: true, name: true, testUserId: true }
      });

      // Step 10: Delete the test user
      if (adminUserForEmail?.testUserId) {
        // Clean up test user's dependent data before deleting the user
        const testUserId = adminUserForEmail.testUserId;

        // Delete chat messages and sessions belonging to the test user
        const sessions = await prisma.chatSession.findMany({
          where: { userId: testUserId },
          select: { id: true },
        });
        const sessionIds = sessions.map(s => s.id);
        if (sessionIds.length > 0) {
          await prisma.chatMessage.deleteMany({ where: { chatSessionId: { in: sessionIds } } });
          await prisma.chatSession.deleteMany({ where: { id: { in: sessionIds } } });
        }

        // Remove any chatbot access rows tied to the test user (defensive)
        await prisma.chatbotAccess.deleteMany({ where: { userId: testUserId } });

        // Finally, delete the test user
        await prisma.user.delete({ where: { id: testUserId } });
      }

      // Step 11: Finally, delete the admin user
      await prisma.adminUser.delete({
        where: { id: adminUserId }
      });

      // Send account deletion email (after deletion to avoid transaction rollback if email fails)
      if (adminUserForEmail) {
        try {
          const { getEmailService } = await import('../../services/zoho-email');
          const emailService = getEmailService();
          await emailService.sendAccountDeletionEmail(
            adminUserForEmail.email,
            adminUserForEmail.name || undefined
          );
          adminLogger.info('Account deletion email sent', { email: adminUserForEmail.email });
        } catch (emailError: unknown) {
          adminLogger.error('Failed to send account deletion email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
          // Don't fail account deletion if email fails
        }
      }
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error: unknown) {
    adminLogger.error('Account deletion error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error deleting account' });
  }
});


export default router;
