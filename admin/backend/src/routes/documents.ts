import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import {
  handleProcessDocument,
  handleMulterError,
  upload,
} from '../controllers/documents/documentController';
import { validateRequest } from '@shared/utils';
import { processDocumentSchema } from '../validation/documentsSchemas';

const router = Router();

/**
 * Process document endpoint
 * POST /api/admin/process-document
 */
router.post('/process-document', adminAuthMiddleware, upload.single('file'), handleMulterError, validateRequest(processDocumentSchema) as any, handleProcessDocument);

export default router;
