/**
 * Cloud Storage Integration Routes
 * Handles OAuth flows and cloud integration management
 */

import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import {
  handleOAuthStart,
  handleOAuthCallback,
} from '../controllers/cloud/oauthController';
import {
  handleGetIntegration,
  handleTestConnection,
  handleUpdateIntegration,
  handleDisconnectIntegration,
} from '../controllers/cloud/integrationController';
import {
  handleListFolderTree,
  handleListFolders,
  handleListSharedFolders,
  handleListFiles,
} from '../controllers/cloud/folderController';
import {
  handleCancelIndexing,
  handleStartIndexing,
  handleGetIndexedFiles,
} from '../controllers/cloud/indexingController';
import {
  handleWeaviateStatus,
  handleDeleteCloudFileContentSchema,
} from '../controllers/cloud/weaviateController';

const router = Router();

/**
 * Start OAuth flow
 * GET /api/admin/cloud/oauth/start?provider=nextcloud&chatbotId=xxx&blockId=yyy
 */
router.get('/oauth/start', adminAuthMiddleware, handleOAuthStart);

/**
 * OAuth callback handler
 * GET /api/admin/cloud/oauth/callback?code=xxx&state=yyy
 */
router.get('/oauth/callback', handleOAuthCallback);

/**
 * Get cloud integration status
 * GET /api/admin/cloud/integration/:blockId
 */
router.get('/integration/:blockId', adminAuthMiddleware, handleGetIntegration);

/**
 * Test cloud connection
 * POST /api/admin/cloud/integration/:blockId/test
 */
router.post('/integration/:blockId/test', adminAuthMiddleware, handleTestConnection);

/**
 * Update cloud integration configuration
 * PUT /api/admin/cloud/integration/:blockId
 */
router.put('/integration/:blockId', adminAuthMiddleware, handleUpdateIntegration);

/**
 * Disconnect cloud integration
 * DELETE /api/admin/cloud/integration/:blockId
 */
router.delete('/integration/:blockId', adminAuthMiddleware, handleDisconnectIntegration);

/**
 * List folders from cloud storage up to 3 levels deep (for Nextcloud folder selection)
 * GET /api/admin/cloud/integration/:blockId/folders/tree?maxDepth=3
 */
router.get('/integration/:blockId/folders/tree', adminAuthMiddleware, handleListFolderTree);

/**
 * List folders from cloud storage
 * GET /api/admin/cloud/integration/:blockId/folders
 */
router.get('/integration/:blockId/folders', adminAuthMiddleware, handleListFolders);

/**
 * List shared folders from Google Drive
 * GET /api/admin/cloud/integration/:blockId/shared-folders
 */
router.get('/integration/:blockId/shared-folders', adminAuthMiddleware, handleListSharedFolders);

/**
 * List files and folders from cloud storage (for picker)
 * GET /api/admin/cloud/integration/:blockId/files?folderId=xxx (Google Drive) or ?path=xxx (Nextcloud)
 */
router.get('/integration/:blockId/files', adminAuthMiddleware, handleListFiles);

/**
 * Cancel cloud file indexing
 * POST /api/admin/cloud/integration/:blockId/index/cancel
 */
router.post('/integration/:blockId/index/cancel', adminAuthMiddleware, handleCancelIndexing);

/**
 * Trigger cloud file indexing
 * POST /api/admin/cloud/integration/:blockId/index
 */
router.post('/integration/:blockId/index', adminAuthMiddleware, handleStartIndexing);

/**
 * Get indexed cloud files
 * GET /api/admin/cloud/integration/:blockId/indexed-files?chatbotId=xxx
 */
router.get('/integration/:blockId/indexed-files', adminAuthMiddleware, handleGetIndexedFiles);

/**
 * Check Weaviate status and diagnose read-only issues
 * GET /api/admin/cloud/weaviate/status
 */
router.get('/weaviate/status', adminAuthMiddleware, handleWeaviateStatus);

/**
 * Delete CloudFileContent schema (requires re-indexing)
 * DELETE /api/admin/cloud/weaviate/schema/cloudfilecontent
 */
router.delete('/weaviate/schema/cloudfilecontent', adminAuthMiddleware, handleDeleteCloudFileContentSchema);

export default router;
