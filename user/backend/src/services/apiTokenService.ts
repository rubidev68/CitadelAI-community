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
      return { valid: false, reason: 'Token usage limit reached' };
    }
  }

  return { valid: true };
}

/**
 * Find a token by its value (hashed comparison)
 */
export async function findTokenByValue(tokenValue: string): Promise<ApiToken | null> {
  // Get all active tokens (we need to compare hashes)
  const tokens = await prisma.apiToken.findMany({
    where: { isActive: true },
  });

  // Compare the provided token against all hashed tokens
  for (const token of tokens) {
    const isValid = await verifyToken(token.token, tokenValue);
    if (isValid) {
      return token;
    }
  }

  return null;
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
 * Update last used timestamp
 */
export async function updateLastUsed(tokenId: string): Promise<void> {
  await prisma.apiToken.update({
    where: { id: tokenId },
    data: {
      lastUsedAt: new Date(),
    },
  });
}
