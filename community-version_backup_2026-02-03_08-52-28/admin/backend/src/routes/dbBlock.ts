import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { adminAuthMiddleware, AdminAuthRequest } from '../middleware/adminAuth';
import {
  handleTestConnection,
} from '../controllers/dbBlock/connectionController';
import {
  handleTestQuery,
} from '../controllers/dbBlock/queryController';
import {
  handleDiscoverSchema,
} from '../controllers/dbBlock/schemaController';
import {
  handleUploadDbFile,
  handleTestFileConnection,
  handleGetDbFile,
  handleDeleteDbFile,
} from '../controllers/dbBlock/fileController';
import {
  handleExecuteDbBlocks,
} from '../controllers/dbBlock/internalController';
import { validateRequest } from '@shared/utils';
import {
  dbBlockTestConnectionSchema,
  dbBlockQuerySchema,
  dbBlockSchemaSchema,
  dbBlockUploadFileSchema,
  dbBlockTestFileConnectionSchema,
  dbBlockGetFileSchema,
  dbBlockDeleteFileSchema,
} from '../validation/dbBlockSchemas';

import { config } from '../config';

// Internal service auth - check token from environment variable
const authenticateInternalService = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-internal-service-token'];
  const expectedToken = config.INTERNAL_SERVICE_TOKEN;
  
  if (!expectedToken) {
    return res.status(500).json({ error: 'Internal service token not configured' });
  }
  
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
};

const router = Router();

// Configure multer for database file uploads
const dbFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.db', '.sqlite', '.sqlite3'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only SQLite database files (.db, .sqlite, .sqlite3) are allowed'));
    }
  },
});

/**
 * Test database connection
 * POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-connection
 */
router.post('/chatbots/:chatbotId/blocks/:blockId/test-connection', adminAuthMiddleware, validateRequest(dbBlockTestConnectionSchema) as any, handleTestConnection);

/**
 * Test SELECT query execution
 * POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-query
 */
router.post('/chatbots/:chatbotId/blocks/:blockId/test-query', adminAuthMiddleware, validateRequest(dbBlockQuerySchema) as any, handleTestQuery);

/**
 * Discover database schema
 * POST /api/admin/chatbots/:chatbotId/blocks/:blockId/discover-schema
 */
router.post('/chatbots/:chatbotId/blocks/:blockId/discover-schema', adminAuthMiddleware, validateRequest(dbBlockSchemaSchema) as any, handleDiscoverSchema);

/**
 * Execute DB blocks for chatbot (internal API for user backend)
 * POST /api/admin/internal/chatbots/:chatbotId/execute-db-blocks
 */
router.post('/internal/chatbots/:chatbotId/execute-db-blocks', authenticateInternalService, handleExecuteDbBlocks);

/**
 * Upload database file
 * POST /api/admin/chatbots/:chatbotId/blocks/:blockId/upload-db-file
 */
router.post(
  '/chatbots/:chatbotId/blocks/:blockId/upload-db-file',
  adminAuthMiddleware,
  dbFileUpload.single('file'),
  validateRequest(dbBlockUploadFileSchema) as any,
  handleUploadDbFile
);

/**
 * Test file-based database connection
 * POST /api/admin/chatbots/:chatbotId/blocks/:blockId/test-file-connection
 */
router.post(
  '/chatbots/:chatbotId/blocks/:blockId/test-file-connection',
  adminAuthMiddleware,
  validateRequest(dbBlockTestFileConnectionSchema) as any,
  handleTestFileConnection
);

/**
 * Get database file info
 * GET /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file
 */
router.get(
  '/chatbots/:chatbotId/blocks/:blockId/db-file',
  adminAuthMiddleware,
  validateRequest(dbBlockGetFileSchema) as any,
  handleGetDbFile
);

/**
 * Delete database file
 * DELETE /api/admin/chatbots/:chatbotId/blocks/:blockId/db-file
 */
router.delete(
  '/chatbots/:chatbotId/blocks/:blockId/db-file',
  adminAuthMiddleware,
  validateRequest(dbBlockDeleteFileSchema) as any,
  handleDeleteDbFile
);

export default router;
