/**
 * File Upload Quota Service
 * Manages plan-based file upload quotas (50MB Starter, 500MB Pro)
 */

import prisma from '../lib/prisma';
import { logger } from '@shared/utils';

export interface UploadQuotaCheck {
  allowed: boolean;
  remainingBytes: number;
  usedBytes: number;
  limitBytes: number;
  warning?: string;
  error?: string;
}

const PLAN_LIMITS = {
  STARTER: 50 * 1024 * 1024, // 50MB
  PRO: 500 * 1024 * 1024, // 500MB
} as const;

const WARNING_THRESHOLD = 0.8; // Warn at 80% of limit

/**
 * Check if user can upload a file of the given size
 * Returns quota information and warnings/errors
 */
export async function checkUploadQuota(
  userId: string,
  fileSize: number
): Promise<UploadQuotaCheck> {
  // Get user's subscription plan
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Determine plan limit
  const planName = user.subscription?.plan?.name?.toUpperCase() || 'STARTER';
  const limitBytes = PLAN_LIMITS[planName as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.STARTER;

  // Get or create quota record
  let quota = await prisma.userUploadQuota.findUnique({
    where: { userId },
  });

  if (!quota) {
    quota = await prisma.userUploadQuota.create({
      data: {
        userId,
        totalUploadedBytes: 0,
      },
    });
  }

  const usedBytes = Number(quota.totalUploadedBytes);
  const newTotal = usedBytes + fileSize;
  const remainingBytes = Math.max(0, limitBytes - newTotal);
  const usagePercent = newTotal / limitBytes;

  // Check if upload would exceed limit
  if (newTotal > limitBytes) {
    logger.warn('File upload quota exceeded', {
      service: 'file-upload-quota',
      userId,
      usedBytes,
      limitBytes,
      requestedSize: fileSize,
    });

    return {
      allowed: false,
      remainingBytes: 0,
      usedBytes,
      limitBytes,
      error: `Upload quota exceeded. You have used ${formatBytes(usedBytes)} of ${formatBytes(limitBytes)}. Please upgrade to Pro plan for 500MB limit.`,
    };
  }

  // Check if approaching limit (warning threshold)
  let warning: string | undefined;
  if (usagePercent >= WARNING_THRESHOLD) {
    warning = `You have used ${Math.round(usagePercent * 100)}% of your upload quota (${formatBytes(usedBytes)}/${formatBytes(limitBytes)}). Consider upgrading to Pro plan for 500MB limit.`;
    
    logger.warn('File upload quota warning', {
      service: 'file-upload-quota',
      userId,
      usagePercent,
      usedBytes,
      limitBytes,
    });
  }

  return {
    allowed: true,
    remainingBytes,
    usedBytes,
    limitBytes,
    warning,
  };
}

/**
 * Update upload quota after successful file upload
 */
export async function updateUploadQuota(
  userId: string,
  fileSize: number
): Promise<void> {
  await prisma.userUploadQuota.upsert({
    where: { userId },
    create: {
      userId,
      totalUploadedBytes: fileSize,
    },
    update: {
      totalUploadedBytes: {
        increment: fileSize,
      },
    },
  });
}

/**
 * Get current quota information for a user
 */
export async function getUploadQuota(userId: string): Promise<{
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  usagePercent: number;
}> {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const planName = user.subscription?.plan?.name?.toUpperCase() || 'STARTER';
  const limitBytes = PLAN_LIMITS[planName as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.STARTER;

  const quota = await prisma.userUploadQuota.findUnique({
    where: { userId },
  });

  const usedBytes = quota ? Number(quota.totalUploadedBytes) : 0;
  const remainingBytes = Math.max(0, limitBytes - usedBytes);
  const usagePercent = usedBytes / limitBytes;

  return {
    usedBytes,
    limitBytes,
    remainingBytes,
    usagePercent,
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
