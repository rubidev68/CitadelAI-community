import { Router, Request, Response } from 'express';
import { widgetScriptRateLimit, widgetConfigRateLimit } from '../../middleware/widgetRateLimiter';
import { handleBubbleScript, handleWidgetConfig, handleEmbedCode } from '../../controllers/widgetController';

const router = Router();

// CORS middleware for widget routes - MUST be first to handle preflight
router.use((req: Request, res: Response, next: Function) => {
  // Set CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  
  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
});

// Alternative route without .js extension (in case reverse proxy interferes)
router.get('/:chatbotId/bubble', widgetScriptRateLimit, async (req: Request, res: Response) => {
  return handleBubbleScript(req, res);
});

// GET /api/widget/:chatbotId/bubble.js - Widget script endpoint
router.get('/:chatbotId/bubble.js', widgetScriptRateLimit, async (req: Request, res: Response) => {
  return handleBubbleScript(req, res);
});

// GET /api/widget/:chatbotId/config - Widget configuration endpoint
router.get('/:chatbotId/config', widgetConfigRateLimit, async (req: Request, res: Response) => {
  return handleWidgetConfig(req, res);
});

// GET /api/admin/chatbot/:chatbotId/bubble/embed-code - Embed code generation  
// Note: This should be registered under /api/admin path in main router
router.get('/chatbot/:chatbotId/bubble/embed-code', async (req: Request, res: Response) => {
  return handleEmbedCode(req, res);
});

export default router;
