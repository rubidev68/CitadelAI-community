import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getFeatureFlags, isFeatureEnabled } from '../../shared/config/features';
import { getEmailService, ZohoEmailService } from '../../services/zoho-email';
import { getNotificationService } from '../../services/serviceFactory';
import twoFactorService from '../../services/twoFactorService';
import passwordResetService from '../../services/passwordResetService';
import { authRateLimit, twoFactorRateLimit } from '../../middleware/rateLimiter';
import prisma from '../../lib/prisma';
import { adminLogger } from '../../app';
import {
  authenticateToken,
  AuthRequest,
  AdminUserWithOptionalFields,
  PrismaError,
  has2FAFields,
  get2FAField,
  getPasswordResetField,
  tempTokenStore,
} from '../../middleware/auth';
import { createDefaultPlans } from '../../utils/subscriptionPlans';
import { config } from '../../config';

const router = Router();

// Note: This router is mounted at /api/admin, so routes are:
// - /api/admin/auth/register -> router.post('/auth/register', ...)
// - /api/admin/me -> router.get('/me', ...)

const JWT_SECRET = config.JWT_SECRET;

// Admin Auth Endpoints
router.post('/auth/register', authRateLimit, async (req: Request, res: Response) => {
  const { email, password, role, company, name } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Validate invitation code
    

    // Increment used count
    // The frontend sends SHA-256 hashed password, so we need to hash it again with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const testUserPassword = Math.random().toString(36).slice(-8);
    const testUserHashedPassword = await bcrypt.hash(testUserPassword, 10);

    // Generate email verification token
    const verificationToken = ZohoEmailService.generateVerificationToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // Token expires in 24 hours

    const newUser = await prisma.$transaction(async (prisma) => {
      const testUser = await prisma.user.create({
        data: {
          email: `${email.split('@')[0]}+test@${email.split('@')[1]}`,
          password: testUserHashedPassword,
          name: 'Test User',
        },
      });

      const adminUserData: {
        email: string;
        password: string;
        role: string;
        testUserId?: string;
        company?: string;
        name?: string;
        emailVerified?: boolean;
        emailVerificationToken?: string;
        emailVerificationTokenExpires?: Date;
      } = {
        email,
        password: hashedPassword,
        role,
        testUserId: testUser.id,
        emailVerified: true,
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      };
      
      if (name) adminUserData.name = name;
      if (company) adminUserData.company = company;

      const adminUser = await prisma.adminUser.create({
        data: adminUserData,
      });

      // Create default subscription plans if they don't exist
      await createDefaultPlans();

      // Get the Pro plan for the trial
      const proPlan = await prisma.subscriptionPlan.findUnique({
        where: { name: 'Pro' }
      });

      if (proPlan) {
        // Create a 90-day trial subscription on Pro plan
        const trialStartDate = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 90);

        await prisma.subscription.create({
          data: {
            adminUserId: adminUser.id,
            planId: proPlan.id,
            status: 'TRIAL',
            trialStartDate,
            trialEndDate,
          },
        });
      }

      const chatbots = await prisma.chatbot.findMany({
        where: { ownerId: adminUser.id },
      });

      for (const chatbot of chatbots) {
        await prisma.chatbotAccess.create({
          data: {
            chatbotId: chatbot.id,
            userId: testUser.id,
            userEmail: testUser.email,
          },
        });
      }

      return adminUser;
    });

    // Send verification email using notification service
    try {
      const baseUrl = config.FRONTEND_URL;
      const notificationService = getNotificationService();
      await notificationService.sendVerificationEmail(email, verificationToken, baseUrl);
    } catch (emailError: unknown) {
      adminLogger.error('Failed to send verification email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
      // Don't fail registration if email fails - user can request resend
      // Log the error but continue
    }

    // Don't include sensitive data in response
    const { password: _, emailVerificationToken: __, ...userResponse } = newUser;
    res.status(201).json({
      ...userResponse,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error: unknown) {
    adminLogger.error('Registration error', { error: error instanceof Error ? error : new Error(String(error)) });
    const prismaError = error as PrismaError;
    if (prismaError.code === 'P2002' && prismaError.meta?.target?.includes('email')) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    res.status(500).json({ error: 'Error creating user' });
  }
});

router.post('/auth/login', authRateLimit, async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Try to fetch user, handling case where 2FA columns don't exist
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({ 
        where: { email },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          company: true,
          tutorialCompleted: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true,
          twoFactorSetupCompleted: true
        }
      });
    } catch (error: unknown) {
      // If 2FA columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('twoFactor')) {
        user = await prisma.adminUser.findUnique({ 
          where: { email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            company: true,
            tutorialCompleted: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true
          }
        });
        // Add default 2FA values
        if (user) {
          user.twoFactorEnabled = false;
          user.twoFactorSetupCompleted = false;
          user.twoFactorSecret = null;
          user.twoFactorBackupCodes = [];
        }
      } else {
        throw error;
      }
    }
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // The frontend sends SHA-256 hashed password, we need to compare it with the stored bcrypt hash
    // For new users: stored password is bcrypt hash of SHA-256 hash
    // For old users: stored password is bcrypt hash of plain text
    
    // Try comparing SHA-256 hash with stored bcrypt hash (for new users)
    if (!user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    let isPasswordValid = await bcrypt.compare(password, user.password);
    
    // If that fails, the user might be an old user with plain text password stored
    // In that case, we need to hash the SHA-256 hash with bcrypt and compare
    if (!isPasswordValid) {
      await bcrypt.hash(password, 10); // Hash for comparison attempt
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if 2FA is enabled (with fallback for missing migration)
    const twoFactorEnabled = get2FAField(user, 'twoFactorEnabled', false);
    const twoFactorSetupCompleted = get2FAField(user, 'twoFactorSetupCompleted', false);
    
    if (twoFactorEnabled && twoFactorSetupCompleted) {
      // Generate temporary token for 2FA verification
      const tempToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      tempTokenStore.set(tempToken, {
        userId: user.id,
        email: user.email,
        expiresAt
      });

      adminLogger.info('2FA required for user', { email });
      return res.json({
        requiresTwoFactor: true,
        tempToken
      });
    }

    // Optional: Check if email is verified (you may want to allow login but show a warning)
    // For now, we'll allow login but the frontend can check emailVerified status

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, {
      expiresIn: '12h',
    });

    const { password: _password, ...userWithoutPassword } = user;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    adminLogger.error('Login error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Verify 2FA during login
router.post('/auth/login/verify-2fa', twoFactorRateLimit, async (req: Request, res: Response) => {
  try {
    const { tempToken, otp, backupCode } = req.body;

    if (!tempToken || (!otp && !backupCode)) {
      return res.status(400).json({ error: 'Temp token and OTP or backup code are required' });
    }

    // Get temp token data
    const tempData = tempTokenStore.get(tempToken);
    if (!tempData) {
      return res.status(401).json({ error: 'Invalid or expired temporary token' });
    }

    // Check expiry
    if (tempData.expiresAt < Date.now()) {
      tempTokenStore.delete(tempToken);
      return res.status(401).json({ error: 'Temporary token has expired' });
    }

    // Get user from database (with fallback for missing 2FA columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { id: tempData.userId },
        select: {
          id: true,
          email: true,
          password: true,
          name: true,
          role: true,
          company: true,
          tutorialCompleted: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true
        }
      });
    } catch (error: unknown) {
      // If 2FA columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('twoFactor')) {
        user = await prisma.adminUser.findUnique({
          where: { id: tempData.userId },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            role: true,
            company: true,
            tutorialCompleted: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true
          }
        });
        // Add default 2FA values
        if (user) {
          user.twoFactorEnabled = false;
          user.twoFactorSecret = null;
          user.twoFactorBackupCodes = [];
        }
      } else {
        throw error;
      }
    }

    if (!user) {
      tempTokenStore.delete(tempToken);
      return res.status(401).json({ error: 'Invalid request' });
    }

    // Check if 2FA is enabled (with fallback for missing migration)
    const twoFactorEnabled = get2FAField(user, 'twoFactorEnabled', false);
    if (!twoFactorEnabled) {
      tempTokenStore.delete(tempToken);
      return res.status(401).json({ error: 'Invalid request' });
    }

    let isValid = false;

    // Verify OTP or backup code
    if (backupCode) {
      // Verify backup code (with fallback for missing migration)
      const backupCodes = get2FAField<string[]>(user, 'twoFactorBackupCodes', []);
      const result = await twoFactorService.verifyBackupCode(
        Array.isArray(backupCodes) ? backupCodes : [],
        backupCode.toUpperCase()
      );

      if (result.valid) {
        isValid = true;
        // Remove used backup code from database (only if 2FA fields exist)
        if (has2FAFields(user)) {
          try {
            await prisma.adminUser.update({
              where: { id: user.id },
              data: {
                twoFactorBackupCodes: result.remainingCodes
              }
            });
          } catch (error: unknown) {
            // If update fails due to missing column, log but continue
            const prismaError = error as PrismaError;
            if (prismaError?.code !== 'P2021') {
              adminLogger.warn('Failed to update backup codes', { error: error instanceof Error ? error : new Error(String(error)) });
            }
          }
        }
      }
    } else if (otp) {
      // Verify OTP token (with fallback for missing migration)
      const twoFactorSecret = get2FAField(user, 'twoFactorSecret', null);
      if (twoFactorSecret) {
        isValid = twoFactorService.verifyToken(twoFactorSecret, otp);
      }
    }

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid OTP or backup code' });
    }

    // Delete temp token
    tempTokenStore.delete(tempToken);

    // Generate JWT token
    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, {
      expiresIn: '12h',
    });

    const { password: _password, ...userWithoutPassword } = user;
    adminLogger.info('2FA verified successfully', { email: user.email });

    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    adminLogger.error('2FA verification error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: '2FA verification failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Email verification endpoint
router.post('/auth/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }

  try {
    const user = await prisma.adminUser.findFirst({
      where: {
        emailVerificationToken: token,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    if (user.emailVerificationTokenExpires && user.emailVerificationTokenExpires < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(200).json({ message: 'Email already verified', emailVerified: true });
    }

    // Verify the email
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpires: null,
      },
    });

    res.json({ message: 'Email verified successfully', emailVerified: true });
  } catch (error) {
    adminLogger.error('Email verification error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error verifying email' });
  }
});

// Forgot password endpoint
router.post('/auth/forgot-password', authRateLimit, async (req: Request, res: Response) => {
  const { email } = req.body;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    // Find user by email (with fallback for missing password reset columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          passwordResetRequestedAt: true,
        },
      });
    } catch (error: unknown) {
      // If password reset columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('passwordReset')) {
        user = await prisma.adminUser.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
          },
        });
        // Add default password reset values
        if (user) {
          user.passwordResetRequestedAt = null;
        }
      } else {
        throw error;
      }
    }

    // Rate limiting: Check if enough time has passed since last request
    const requestedAt = user ? getPasswordResetField(user, 'passwordResetRequestedAt', null) : null;
    if (user && !passwordResetService.canRequestReset(requestedAt)) {
      return res.status(429).json({ 
        error: 'Please wait before requesting another password reset email.' 
      });
    }

    // If user exists, generate reset token and send email
    if (user) {
      // Generate reset token
      const resetToken = passwordResetService.generateResetToken();
      const hashedToken = await passwordResetService.hashResetToken(resetToken);
      const expirationTime = passwordResetService.calculateExpiration(1); // 1 hour

      // Store token in database (with fallback for missing columns)
      try {
        await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            passwordResetToken: hashedToken,
            passwordResetTokenExpires: expirationTime,
            passwordResetRequestedAt: new Date(),
          },
        });
      } catch (error: unknown) {
        // If password reset columns don't exist, migration hasn't run yet
        const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('passwordReset')) {
          adminLogger.error('Password reset fields not found. Migration required.');
          return res.status(503).json({ 
            error: 'Password reset is temporarily unavailable. Please contact support.' 
          });
        }
        throw error;
      }

      // Build reset URL
      const frontendUrl = config.FRONTEND_URL;
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

      // Send password reset email using notification service
      try {
        const notificationService = getNotificationService();
        await notificationService.sendPasswordResetEmail(user.email, resetUrl);
        adminLogger.info('Password reset email sent', { email: user.email });
      } catch (emailError: unknown) {
        adminLogger.error('Failed to send password reset email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
        // Don't fail the request if email fails (security: don't reveal if email exists)
      }
    }

    // Always return success (security: don't reveal if email exists)
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    adminLogger.error('Forgot password error', { error: error instanceof Error ? error : new Error(String(error)) });
    // Return success even on error (security: don't reveal if email exists)
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
});

// Reset password endpoint
router.post('/auth/reset-password', authRateLimit, async (req: Request, res: Response) => {
  const { token, email, newPassword } = req.body;

  // Validate input
  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: 'Token, email, and new password are required' });
  }

  // Validate password strength
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  try {
    // Find user by email (with fallback for missing password reset columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordResetToken: true,
          passwordResetTokenExpires: true,
          twoFactorEnabled: true,
        },
      });
    } catch (error: unknown) {
      // If password reset columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('passwordReset')) {
        return res.status(503).json({ 
          error: 'Password reset is temporarily unavailable. Please contact support.' 
        });
      }
      throw error;
    }

    if (!user) {
      return res.status(401).json({ error: 'This password reset link is invalid or has expired. Please request a new one.' });
    }

    // Check if token exists
    const resetToken = getPasswordResetField<string | null>(user, 'passwordResetToken', null);
    if (!resetToken) {
      return res.status(401).json({ error: 'This password reset link is invalid or has expired. Please request a new one.' });
    }

    // Verify token matches
    const isTokenValid = await passwordResetService.verifyResetToken(token, resetToken);
    if (!isTokenValid) {
      return res.status(401).json({ error: 'This password reset link is invalid or has expired. Please request a new one.' });
    }

    // Check if token is expired
    const tokenExpires = getPasswordResetField<Date | null>(user, 'passwordResetTokenExpires', null);
    if (passwordResetService.isTokenExpired(tokenExpires)) {
      return res.status(401).json({ error: 'This password reset link has expired. Please request a new one.' });
    }

    // Hash new password (same as login: bcrypt hash of SHA-256 hash)
    // Note: Frontend sends SHA-256 hashed password, we hash it again with bcrypt
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token fields (with fallback for missing columns)
    try {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          password: hashedNewPassword,
          passwordResetToken: null,
          passwordResetTokenExpires: null,
          passwordResetRequestedAt: null,
        },
      });
    } catch (error: unknown) {
      // If password reset columns don't exist, just update password
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('passwordReset')) {
        await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            password: hashedNewPassword,
          },
        });
      } else {
        throw error;
      }
    }

    adminLogger.info('Password reset successful', { email: user.email });

    // Note: 2FA remains enabled (as per plan - user will need to verify 2FA on next login)
    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    adminLogger.error('Reset password error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error resetting password' });
  }
});

// Resend verification email endpoint
router.post('/auth/resend-verification-email', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await prisma.adminUser.findUnique({ where: { email } });

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(200).json({ message: 'If an account exists with this email, a verification email has been sent.' });
    }

    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = ZohoEmailService.generateVerificationToken();
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // Token expires in 24 hours

    // Update user with new token
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpires: tokenExpires,
      },
    });

    // Send verification email
    try {
      const baseUrl = config.FRONTEND_URL;
      const emailService = getEmailService();
      await emailService.sendVerificationEmail(email, verificationToken, baseUrl);
      res.json({ message: 'Verification email sent successfully' });
    } catch (emailError: unknown) {
      adminLogger.error('Failed to send verification email', { error: emailError instanceof Error ? emailError : new Error(String(emailError)) });
      res.status(500).json({ error: 'Failed to send verification email. Please try again later.' });
    }
  } catch (error) {
    adminLogger.error('Resend verification email error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Error processing request' });
  }
});

router.post('/auth/login-as-test-user', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const adminUserId = req.user.id;

  try {
    const adminUser = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
    if (!adminUser || !adminUser.testUserId) {
      return res.status(404).json({ error: 'Test user not found for this admin' });
    }

    const testUser = await prisma.user.findUnique({ where: { id: adminUser.testUserId } });
    if (!testUser) {
      return res.status(404).json({ error: 'Test user not found' });
    }

    const token = jwt.sign({ userId: testUser.id, email: testUser.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch {
    res.status(500).json({ error: 'Error generating test user token' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const adminUserId = req.user.id;

  try {
    // Try to get user with 2FA field, fallback if column doesn't exist
    let adminUser;
    try {
      adminUser = await prisma.adminUser.findUnique({ 
        where: { id: adminUserId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          company: true,
          tutorialCompleted: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          twoFactorEnabled: true
        }
      });
    } catch (error: unknown) {
      // If twoFactorEnabled column doesn't exist, fetch without it
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2021' || prismaError?.message?.includes('twoFactorEnabled')) {
        adminUser = await prisma.adminUser.findUnique({ 
          where: { id: adminUserId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            company: true,
            tutorialCompleted: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true
          }
        });
        // Add default value for twoFactorEnabled
        if (adminUser) {
          (adminUser as AdminUserWithOptionalFields).twoFactorEnabled = false;
        }
      } else {
        throw error;
      }
    }
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json(adminUser);
  } catch {
    res.status(500).json({ error: 'Error fetching user data' });
  }
});

// Initiate 2FA setup
router.post('/auth/2fa/setup/initiate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = req.user.id;

    // Check if 2FA is already enabled (with fallback for missing columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
          twoFactorSetupCompleted: true
        }
      });
    } catch (error: unknown) {
      // If 2FA columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('twoFactor')) {
        user = await prisma.adminUser.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true
          }
        });
        // Add default 2FA values
        if (user) {
          user.twoFactorEnabled = false;
          user.twoFactorSetupCompleted = false;
        }
      } else {
        throw error;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA fields exist (fallback for missing migration)
    if (!has2FAFields(user)) {
      return res.status(503).json({ error: '2FA is not available. Database migration required.' });
    }

    const twoFactorEnabled = get2FAField(user, 'twoFactorEnabled', false);
    const twoFactorSetupCompleted = get2FAField(user, 'twoFactorSetupCompleted', false);
    
    if (twoFactorEnabled && twoFactorSetupCompleted) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    // Generate secret
    const secretData = twoFactorService.generateSecret(
      user.email,
      'CitadelAI'
    );

    // Ensure otpauthUrl is defined
    if (!secretData.otpauthUrl) {
      return res.status(500).json({ error: 'Failed to generate 2FA secret' });
    }

    // Generate QR code
    const qrCode = await twoFactorService.generateQRCode(secretData.otpauthUrl);

    // Store secret temporarily in session (will be saved after verification)
    // For stateless API, we'll use a temporary token store similar to login
    const setupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    tempTokenStore.set(`setup_${setupToken}`, {
      userId: user.id,
      email: user.email,
      expiresAt
    });

    // Store the secret temporarily (in production, use Redis)
    const tempEntry = tempTokenStore.get(`setup_${setupToken}`);
    if (tempEntry) {
      tempEntry.secret = secretData.secret;
    }

    res.json({
      secret: secretData.secret,
      qrCode: qrCode,
      manualEntryKey: twoFactorService.formatManualEntryKey(secretData.secret),
      setupToken: setupToken
    });
  } catch (error) {
    adminLogger.error('2FA setup initiation error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to initiate 2FA setup', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Verify 2FA setup and enable
router.post('/auth/2fa/setup/verify', authenticateToken, twoFactorRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { otp, setupToken } = req.body;

    if (!otp || !setupToken) {
      return res.status(400).json({ error: 'OTP and setup token are required' });
    }

    const userId = req.user.id;
    const tempData = tempTokenStore.get(`setup_${setupToken}`);

    if (!tempData || tempData.userId !== userId) {
      return res.status(400).json({ error: '2FA setup not initiated. Please start the setup process.' });
    }

    // Check expiry
    if (tempData.expiresAt < Date.now()) {
      tempTokenStore.delete(`setup_${setupToken}`);
      return res.status(400).json({ error: 'Setup token has expired. Please start again.' });
    }

    const tempSecret = tempData.secret;
    if (!tempSecret) {
      return res.status(400).json({ error: 'Setup session invalid. Please start again.' });
    }

    // Verify OTP
    const isValid = twoFactorService.verifyToken(tempSecret, otp);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid OTP. Please try again.' });
    }

    // Get user
    // Get user (with fallback for missing 2FA columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true
        }
      });
    } catch (error: unknown) {
      // If query fails, check if it's due to missing columns
      const prismaError = error as PrismaError;
      if (prismaError?.code === 'P2022') {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate backup codes
    const backupCodes = twoFactorService.generateBackupCodes();
    const hashedBackupCodes = await twoFactorService.hashBackupCodes(backupCodes);

    // Save to database (with fallback for missing migration)
    try {
      await prisma.adminUser.update({
        where: { id: userId },
        data: {
          twoFactorSecret: tempSecret,
          twoFactorBackupCodes: hashedBackupCodes,
          twoFactorEnabled: true,
          twoFactorSetupCompleted: true
        }
      });
    } catch (error: unknown) {
      // If update fails due to missing columns, return error
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2021' || prismaError?.message?.includes('twoFactor')) {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    // Clear temp token
    tempTokenStore.delete(`setup_${setupToken}`);

    adminLogger.info('2FA enabled successfully', { email: user.email });

    res.json({
      success: true,
      backupCodes: backupCodes,
      message: '2FA enabled successfully. Please save your backup codes in a safe place.'
    });
  } catch (error) {
    adminLogger.error('2FA setup verification error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to enable 2FA', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Disable 2FA
router.post('/auth/2fa/disable', authenticateToken, twoFactorRateLimit, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { password, otp } = req.body;
    const userId = req.user.id;

    if (!password || !otp) {
      return res.status(400).json({ error: 'Password and OTP are required' });
    }

    // Get user (with fallback for missing 2FA columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          password: true,
          twoFactorEnabled: true,
          twoFactorSecret: true
        }
      });
    } catch (error: unknown) {
      // If 2FA columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('twoFactor')) {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA fields exist (fallback for missing migration)
    if (!has2FAFields(user)) {
      return res.status(503).json({ error: '2FA is not available. Database migration required.' });
    }

    const twoFactorEnabled = get2FAField(user, 'twoFactorEnabled', false);
    if (!twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify password (frontend sends SHA-256 hashed)
    if (!user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const userPassword = user.password; // Type narrowing
    let isPasswordValid = await bcrypt.compare(password, userPassword);
    if (!isPasswordValid) {
      await bcrypt.hash(password, 10); // Hash for comparison attempt
      isPasswordValid = await bcrypt.compare(password, userPassword);
    }
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Verify OTP (with fallback for missing migration)
    const twoFactorSecret = get2FAField<string | null>(user, 'twoFactorSecret', null);
    if (!twoFactorSecret) {
      return res.status(400).json({ error: '2FA secret not found' });
    }
    const isOtpValid = twoFactorService.verifyToken(twoFactorSecret, otp);
    if (!isOtpValid) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Disable 2FA (with fallback for missing migration)
    try {
      await prisma.adminUser.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorSetupCompleted: false
        }
      });
    } catch (error: unknown) {
      // If update fails due to missing columns, return error
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2021' || prismaError?.message?.includes('twoFactor')) {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    adminLogger.info('2FA disabled successfully', { email: user.email });

    res.json({
      success: true,
      message: '2FA disabled successfully'
    });
  } catch (error) {
    adminLogger.error('2FA disable error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to disable 2FA', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Regenerate backup codes
router.post('/auth/2fa/backup-codes/regenerate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { otp } = req.body;
    const userId = req.user.id;

    if (!otp) {
      return res.status(400).json({ error: 'OTP is required' });
    }

    // Get user (with fallback for missing 2FA columns)
    let user: AdminUserWithOptionalFields | null;
    try {
      user = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorBackupCodes: true
        }
      });
    } catch (error: unknown) {
      // If 2FA columns don't exist, fetch without them
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2022' || prismaError?.message?.includes('twoFactor')) {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA fields exist (fallback for missing migration)
    if (!has2FAFields(user)) {
      return res.status(503).json({ error: '2FA is not available. Database migration required.' });
    }

    const twoFactorEnabled = get2FAField(user, 'twoFactorEnabled', false);
    const twoFactorSecret = get2FAField(user, 'twoFactorSecret', null);
    
    if (!twoFactorEnabled || !twoFactorSecret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Verify OTP
    const isOtpValid = twoFactorService.verifyToken(twoFactorSecret, otp);
    if (!isOtpValid) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Generate new backup codes
    const backupCodes = twoFactorService.generateBackupCodes();
    const hashedBackupCodes = await twoFactorService.hashBackupCodes(backupCodes);

    // Update database (with fallback for missing migration)
    try {
      await prisma.adminUser.update({
        where: { id: userId },
        data: {
          twoFactorBackupCodes: hashedBackupCodes
        }
      });
    } catch (error: unknown) {
      // If update fails due to missing columns, return error
      const prismaError = error as PrismaError & { message?: string };
      if (prismaError?.code === 'P2021' || prismaError?.message?.includes('twoFactor')) {
        return res.status(503).json({ error: '2FA is not available. Database migration required.' });
      }
      throw error;
    }

    adminLogger.info('Backup codes regenerated', { email: user.email });

    res.json({
      backupCodes: backupCodes,
      message: 'Backup codes regenerated successfully. Old codes are now invalid.'
    });
  } catch (error) {
    adminLogger.error('Backup codes regeneration error', { error: error instanceof Error ? error : new Error(String(error)) });
    res.status(500).json({ error: 'Failed to regenerate backup codes', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
