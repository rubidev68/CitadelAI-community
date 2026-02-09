import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import {
  handleCreateApiToken,
  handleListApiTokens,
  handleGetApiToken,
  handleUpdateApiToken,
  handleRevokeApiToken,
  handleGetTokenUsage,
} from '../controllers/apiTokens/apiTokenController';
import { validateRequest } from '@shared/utils';
import {
  createApiTokenSchema,
  listApiTokensSchema,
  getApiTokenSchema,
  updateApiTokenSchema,
  revokeApiTokenSchema,
} from '../validation/apiTokensSchemas';

const router = Router();

/**
 * Create a new API token
 * POST /api/admin/chatbots/:chatbotId/api-tokens
 */
router.post('/chatbots/:chatbotId/api-tokens', adminAuthMiddleware, validateRequest(createApiTokenSchema) as any, handleCreateApiToken);

/**
 * List all API tokens for a chatbot
 * GET /api/admin/chatbots/:chatbotId/api-tokens
 */
router.get('/chatbots/:chatbotId/api-tokens', adminAuthMiddleware, validateRequest(listApiTokensSchema) as any, handleListApiTokens);

/**
 * Get a specific API token
 * GET /api/admin/api-tokens/:tokenId
 */
router.get('/api-tokens/:tokenId', adminAuthMiddleware, validateRequest(getApiTokenSchema) as any, handleGetApiToken);

/**
 * Update an API token
 * PATCH /api/admin/api-tokens/:tokenId
 */
router.patch('/api-tokens/:tokenId', adminAuthMiddleware, validateRequest(updateApiTokenSchema) as any, handleUpdateApiToken);

/**
 * Revoke an API token
 * DELETE /api/admin/api-tokens/:tokenId
 */
router.delete('/api-tokens/:tokenId', adminAuthMiddleware, validateRequest(revokeApiTokenSchema) as any, handleRevokeApiToken);

/**
 * Get usage statistics for an API token
 * GET /api/admin/chatbots/:chatbotId/api-tokens/:tokenId/usage
 */
router.get('/chatbots/:chatbotId/api-tokens/:tokenId/usage', adminAuthMiddleware, handleGetTokenUsage);

export default router;
