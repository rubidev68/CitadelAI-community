import express, { Request, Response } from 'express';
import { mermaidToImage } from '../services/mermaidImageService';
import { logger, validateRequest } from '@shared/utils';
import { config } from '../config';
import { mermaidToImageSchema } from '../validation/mermaidSchemas';

const router = express.Router();

/**
 * Middleware to validate internal service token
 */
function validateInternalServiceToken(req: Request, res: Response, next: express.NextFunction) {
  const callerService = req.headers['x-internal-service'];
  const token = req.headers['x-internal-service-token'];
  const expectedToken = config.INTERNAL_SERVICE_TOKEN;

  // Only allow calls from admin-backend
  if (callerService !== 'admin-backend' || token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

/**
 * POST /api/mermaid/to-image
 * Convert Mermaid diagram code to base64 PNG image
 * Internal service endpoint (requires internal service token)
 */
router.post('/to-image', validateInternalServiceToken, validateRequest(mermaidToImageSchema) as any, async (req: Request, res: Response) => {
  try {
    const { mermaidCode } = req.body;

    if (!mermaidCode || typeof mermaidCode !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'mermaidCode is required' });
    }

    const imageBase64 = await mermaidToImage(mermaidCode);

    res.json({ imageBase64 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to convert mermaid diagram to image';
    logger.error('Error converting mermaid to image', error instanceof Error ? error : undefined, {
      service: 'mermaid-routes',
    });
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: errorMessage
    });
  }
});

export default router;
