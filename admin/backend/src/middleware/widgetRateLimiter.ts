import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../utils/widgetUtils';

// Rate limiting middleware for widget script requests
export const widgetScriptRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `widget:script:${ip}`;
  
  if (!checkRateLimit(key, 100, 60 * 1000)) { // 100 requests per minute
    return res.status(429).json({ error: 'Too many widget script requests' });
  }
  
  next();
};

// Rate limiting middleware for widget config requests
export const widgetConfigRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `widget:config:${ip}`;
  
  if (!checkRateLimit(key, 50, 60 * 1000)) { // 50 requests per minute
    return res.status(429).json({ error: 'Too many widget config requests' });
  }
  
  next();
};

// Rate limiting middleware for widget message requests
export const widgetMessageRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `widget:message:ip:${ip}`;
  
  if (!checkRateLimit(key, 30, 60 * 1000)) { // 30 messages per minute per IP
    return res.status(429).json({ error: 'Too many messages, please slow down' });
  }
  
  next();
};

// Rate limiting middleware for widget session requests
export const widgetSessionRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return next(); // Skip if no session ID
  }
  
  const key = `widget:message:session:${sessionId}`;
  
  if (!checkRateLimit(key, 100, 60 * 60 * 1000)) { // 100 messages per hour per session
    return res.status(429).json({ error: 'Too many messages in this session' });
  }
  
  next();
};
