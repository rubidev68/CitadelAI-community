/**
 * API Token Authentication Middleware Factory
 * Creates Express middleware for API token-based authentication
 */

import { Request, Response, NextFunction } from 'express';
import type { Request as ExpressRequest } from 'express';
import { PrismaClient } from '@prisma/client';

/**
 * API Token structure (matches Prisma ApiToken model)
 * Uses a flexible type that's compatible with Prisma's ApiToken
 * Note: Optional fields can be null but not undefined to match Prisma
 */
export type ApiToken = {
  id: string;
  chatbotId: string;
  blockId: string | null;
  name: string;
  token: string;
  tokenPrefix: string;
  tokenType: 'DURATION' | 'USAGE' | 'PERMANENT';
  expiresAt: Date | null;
  maxUsage: number | null;
  currentUsage: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  rateLimitPerMinute: number | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  scheduledRevocationAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

/**
 * Base type for API auth data (without Request extension)
 * Services should define their own Request-extending types
 */
export interface ApiAuthData {
  apiToken?: ApiToken;
  chatbotId?: string;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Configuration for API token authentication middleware
 */
export interface ApiTokenAuthConfig {
  /**
   * Function to find token by value
   */
  findTokenByValue: (tokenValue: string) => Promise<ApiToken | null>;
  
  /**
   * Function to validate token
   * Accepts any object that matches ApiToken structure (compatible with Prisma's ApiToken)
   * The token parameter is flexible to accept Prisma's ApiToken type which may have slightly different optional field handling
   */
  validateToken: (token: ApiToken | { [key: string]: unknown }) => Promise<TokenValidationResult>;
  
  /**
   * Function to increment token usage (optional)
   */
  incrementUsage?: (tokenId: string) => Promise<void>;
  
  /**
   * Prisma client instance
   */
  prisma: PrismaClient;
  
  /**
   * Logger instance
   */
  logger?: {
    error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  };
  
  /**
   * Function to extract chatbot ID from request (optional)
   * Default: extracts from req.params.chatbotId
   */
  extractChatbotId?: (req: Request) => string | undefined;
}

/**
 * Creates API token authentication middleware
 * 
 * @param config Configuration object
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * const apiAuth = createApiTokenAuthMiddleware({
 *   findTokenByValue: apiTokenService.findTokenByValue,
 *   validateToken: apiTokenService.validateToken,
 *   incrementUsage: apiTokenService.incrementUsage,
 *   prisma,
 *   logger,
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createApiTokenAuthMiddleware<T extends Record<string, any>>(
  config: ApiTokenAuthConfig
): (req: T, res: Response, next: NextFunction) => Promise<void> {
  const {
    findTokenByValue,
    validateToken,
    incrementUsage,
    prisma,
    logger,
    extractChatbotId = (req: Request) => req.params.chatbotId as string | undefined,
  } = config;

  return async (req: T, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = (req.headers as { authorization?: string | string[] })?.authorization;
      const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      if (!authHeaderStr || !authHeaderStr.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
        });
        return;
      }

      const tokenValue = authHeaderStr.substring(7); // Remove "Bearer " prefix

      // Find token in database
      const token = await findTokenByValue(tokenValue);
      if (!token) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid API token',
        });
        return;
      }

      // Validate token (check expiration, usage limits, etc.)
      const validation = await validateToken(token);
      if (!validation.valid) {
        res.status(403).json({
          error: 'Forbidden',
          message: validation.reason || 'Token is not valid',
        });
        return;
      }

      // Get chatbot ID from request
      const chatbotId = extractChatbotId(req as unknown as ExpressRequest);
      if (!chatbotId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'chatbotId is required',
        });
        return;
      }

      // Verify token belongs to this chatbot
      if (token.chatbotId !== chatbotId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Token does not belong to this chatbot',
        });
        return;
      }

      // Verify chatbot exists and is active
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
      });

      if (!chatbot) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Chatbot not found',
        });
        return;
      }

      if (chatbot.status !== 'ACTIVE') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Chatbot is not active',
        });
        return;
      }

      // Attach token and chatbot info to request
      (req as T & { apiToken?: ApiToken; chatbotId?: string }).apiToken = token;
      (req as T & { apiToken?: ApiToken; chatbotId?: string }).chatbotId = chatbotId;

      // Increment usage counter for USAGE type tokens (async, don't wait)
      if (incrementUsage && token.tokenType === 'USAGE') {
        incrementUsage(token.id).catch((error) => {
          logger?.error('Error incrementing token usage', error instanceof Error ? error : new Error(String(error)), {
            service: 'api-token-auth-middleware',
            tokenId: token.id,
          });
          // Don't fail the request if usage tracking fails
        });
      }

      next();
    } catch (error) {
      logger?.error('API authentication error', error instanceof Error ? error : new Error(String(error)), {
        service: 'api-token-auth-middleware',
      });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    }
  };
}
