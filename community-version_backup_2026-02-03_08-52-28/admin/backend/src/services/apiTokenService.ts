import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ApiToken, ApiTokenType } from '@prisma/client';
import prisma from '../lib/prisma';

/**
 * Generate a secure random token
 * Format: cat_<32 random hex characters>
 */
export function generateToken(): string {
  const randomBytes = crypto.randomBytes(16); // 16 bytes = 32 hex characters
  return `cat_${randomBytes.toString('hex')}`;
}

/**
 * Get token prefix (first 8 characters) for display
 */
export function getTokenPrefix(token: string): string {
  return token.substring(0, 8);
}

/**
 * Hash a token using bcrypt for secure storage
 */
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verify a token against a hashed token
 */
export async function verifyToken(hashedToken: string, providedToken: string): Promise<boolean> {
  return bcrypt.compare(providedToken, hashedToken);
}

/**
 * Validate token and check if it's still valid
 * Returns { valid: boolean, reason?: string }
 */
export async function validateToken(token: ApiToken): Promise<{ valid: boolean; reason?: string }> {
  // Check if token is active
  if (!token.isActive) {
    return { valid: false, reason: 'Token has been revoked' };
  }

  // Check if token was revoked (revokedAt field)
  if (token.revokedAt) {
    const revocationReason = token.revocationReason 
      ? `: ${token.revocationReason}` 
      : '';
    return { valid: false, reason: `Token has been revoked${revocationReason}` };
  }

  // Check scheduled revocation
  if (token.scheduledRevocationAt) {
    const now = new Date();
    if (now >= token.scheduledRevocationAt) {
      // Scheduled revocation time has passed, revoke it now
      await prisma.apiToken.update({
        where: { id: token.id },
        data: {
          isActive: false,
          revokedAt: now,
        },
      });
      return { valid: false, reason: 'Token has been revoked (scheduled revocation)' };
    }
  }

  // Check expiration for DURATION type tokens
  if (token.tokenType === 'DURATION' && token.expiresAt) {
    if (new Date() > token.expiresAt) {
      return { valid: false, reason: 'Token has expired' };
    }
  }

  // Check usage limit for USAGE type tokens
  if (token.tokenType === 'USAGE' && token.maxUsage !== null) {
    if (token.currentUsage >= token.maxUsage) {
      return { valid: false, reason: 'Token usage limit exceeded' };
    }
  }

  return { valid: true };
}

/**
 * Increment usage counter for a token
 */
export async function incrementUsage(tokenId: string): Promise<void> {
  await prisma.apiToken.update({
    where: { id: tokenId },
    data: {
      currentUsage: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

/**
 * Find token by the raw token value (for authentication)
 */
export async function findTokenByValue(tokenValue: string): Promise<ApiToken | null> {
  // Get all active tokens (we need to check each one since tokens are hashed)
  const tokens = await prisma.apiToken.findMany({
    where: { isActive: true },
  });

  // Check each token's hash
  for (const token of tokens) {
    const isValid = await verifyToken(token.token, tokenValue);
    if (isValid) {
      return token;
    }
  }

  return null;
}

/**
 * Create a new API token
 */
export async function createApiToken(data: {
  chatbotId: string;
  blockId?: string;
  name: string;
  tokenType: ApiTokenType;
  expiresAt?: Date;
  maxUsage?: number;
  createdBy: string;
}): Promise<{ token: ApiToken; rawToken: string }> {
  // Generate raw token
  const rawToken = generateToken();
  const tokenPrefix = getTokenPrefix(rawToken);

  // Hash the token
  const hashedToken = await hashToken(rawToken);

  // Create token record
  const token = await prisma.apiToken.create({
    data: {
      chatbotId: data.chatbotId,
      blockId: data.blockId,
      name: data.name,
      token: hashedToken,
      tokenPrefix,
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      maxUsage: data.maxUsage,
      createdBy: data.createdBy,
      isActive: true,
      currentUsage: 0,
    },
  });

  return { token, rawToken };
}

/**
 * Revoke a token (immediate or scheduled)
 * @param tokenId - Token ID to revoke
 * @param options - Revocation options
 * @param options.revokedBy - User ID who is revoking the token
 * @param options.revocationReason - Optional reason for revocation
 * @param options.scheduledRevocationAt - Optional scheduled revocation time (if provided, token will be revoked at this time)
 */
export async function revokeToken(
  tokenId: string,
  options?: {
    revokedBy?: string;
    revocationReason?: string;
    scheduledRevocationAt?: Date;
  }
): Promise<void> {
  const now = new Date();
  const { revokedBy, revocationReason, scheduledRevocationAt } = options || {};

  if (scheduledRevocationAt) {
    // Scheduled revocation - set scheduled time but keep token active until then
    if (scheduledRevocationAt <= now) {
      // If scheduled time is in the past, revoke immediately
      await prisma.apiToken.update({
        where: { id: tokenId },
        data: {
          isActive: false,
          revokedAt: now,
          revokedBy: revokedBy || null,
          revocationReason: revocationReason || null,
          scheduledRevocationAt: null, // Clear scheduled time since we're revoking now
        },
      });
    } else {
      // Schedule for future revocation
      await prisma.apiToken.update({
        where: { id: tokenId },
        data: {
          scheduledRevocationAt,
          revokedBy: revokedBy || null,
          revocationReason: revocationReason || null,
          // Keep isActive true until scheduled time
        },
      });
    }
  } else {
    // Immediate revocation
    await prisma.apiToken.update({
      where: { id: tokenId },
      data: {
        isActive: false,
        revokedAt: now,
        revokedBy: revokedBy || null,
        revocationReason: revocationReason || null,
        scheduledRevocationAt: null, // Clear any scheduled revocation
      },
    });
  }
}

/**
 * Process scheduled revocations
 * Checks all tokens with scheduledRevocationAt <= now and revokes them
 * Should be called periodically (e.g., via cron job or on token validation)
 */
export async function processScheduledRevocations(): Promise<number> {
  const now = new Date();
  
  const tokensToRevoke = await prisma.apiToken.findMany({
    where: {
      scheduledRevocationAt: {
        lte: now,
      },
      revokedAt: null, // Not already revoked
      isActive: true,
    },
  });

  if (tokensToRevoke.length === 0) {
    return 0;
  }

  // Revoke all tokens that have reached their scheduled revocation time
  await prisma.apiToken.updateMany({
    where: {
      id: {
        in: tokensToRevoke.map(t => t.id),
      },
    },
    data: {
      isActive: false,
      revokedAt: now,
      scheduledRevocationAt: null,
    },
  });

  return tokensToRevoke.length;
}

/**
 * Update token properties
 */
export async function updateToken(
  tokenId: string,
  updates: {
    name?: string;
    expiresAt?: Date | null;
    maxUsage?: number | null;
  }
): Promise<ApiToken> {
  return prisma.apiToken.update({
    where: { id: tokenId },
    data: updates,
  });
}
