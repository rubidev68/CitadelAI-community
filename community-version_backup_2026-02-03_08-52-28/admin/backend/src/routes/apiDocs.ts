import { Router } from 'express';
import { handleGetApiDocs } from '../controllers/apiDocs/apiDocsController';

const router = Router();

/**
 * Generate HTML documentation for a chatbot's API
 * GET /api-docs/:chatbotId
 */
router.get('/api-docs/:chatbotId', handleGetApiDocs);

export default router;
