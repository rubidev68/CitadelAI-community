import { Request, Response } from 'express';
import { ChatMessage } from '@prisma/client';
import { AuthRequest } from '../../../middleware/auth';
import { ApiAuthRequest } from '../../../middleware/apiAuth';
import { generateChatAnswer } from '../../../services/chatAnsweringService';
import prisma from '../../../lib/prisma';
import { logger, sanitizeString } from '@shared/utils';
import { config } from '../../../config';
import { widgetSessionsByChatbot, apiSessions } from '../utils/sessionStore';
import { extractUserTimezone } from '../utils/requestUtils';
import { handleChatError } from '../utils/errorHandler';

/**
 * Widget-specific streaming endpoint (no auth required, validates chatbotId)
 */
export async function respondStreamingWidget(req: Request, res: Response): Promise<void> {
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, chatbotId, history: historyMessages, sessionId } = req.body;
  const message = sanitizeString(rawMessage);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
    return;
  }

  if (!message || !chatbotId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
    res.status(400).json({ error: 'message and chatbotId are required' });
    return;
  }

  try {
    // Validate chatbot exists and is active
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: chatbotId },
    });

    if (!chatbot) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
      res.status(404).json({ error: 'Chatbot not found' });
      return;
    }

    if (chatbot.status !== 'ACTIVE') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
      res.status(403).json({ error: 'Chatbot is not active', status: chatbot.status });
      return;
    }

    // Track session
    if (sessionId) {
      const sessionsForChatbot = widgetSessionsByChatbot.get(chatbotId) || new Set<string>();
      if (!sessionsForChatbot.has(sessionId)) {
        sessionsForChatbot.add(sessionId);
        widgetSessionsByChatbot.set(chatbotId, sessionsForChatbot);
      }
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Timezone');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send metadata event
    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      chatbotId: chatbotId
    })}\n\n`);

    // Convert widget history to ChatMessage format
    interface WidgetMessage {
      role: string;
      content: string;
      timestamp?: string | number;
    }
    const history: ChatMessage[] = (historyMessages || []).map((msg: WidgetMessage, index: number) => ({
      id: `widget-${index}`,
      chatSessionId: sessionId || '',
      role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
      content: msg.content,
      createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      updatedAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    }));

    const userTimezone = extractUserTimezone(req);

    // Use unified service with streaming - exclude Mermaid diagrams for widget/bubble
    await generateChatAnswer({
      message,
      chatbotId,
      sessionId,
      history,
      useInMemorySession: true,
      additionalSystemInstructions: 'IMPORTANT: Keep your responses concise and to the point. Users expect brief, direct answers in widget conversations.',
      includeMermaidDiagrams: false, // Widget/bubble doesn't support Mermaid diagrams
      userTimezone,
    }, {
      enabled: true,
      response: res,
      sessionId,
    });

  } catch (error: unknown) {
    logger.error('Widget streaming error', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Timezone',
        'Access-Control-Max-Age': '86400',
      });
    }
    
    if (!res.writableEnded) {
      interface ErrorWithCode {
        code?: string;
        message?: string;
      }
      const errorWithCode = error as ErrorWithCode;
      const errorMsg = errorWithCode.code === 'MESSAGE_LIMIT_REACHED' ? errorWithCode.message : 'Something went wrong';
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMsg
      })}\n\n`);
      res.end();
    }
  }
}

/**
 * Streaming chat endpoint for authenticated users
 */
export async function respondStreaming(req: AuthRequest, res: Response): Promise<void> {
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, chatSessionId } = req.body;
  const message = sanitizeString(rawMessage);
  const userId = req.user?.id;

  if (!userId) {
    if (!res.headersSent) {
      res.status(401).json({ error: 'Unauthorized' });
    }
    return;
  }

  try {
    const userTimezone = extractUserTimezone(req);

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Use unified service with streaming
    await generateChatAnswer({
      message,
      chatbotId: '', // Will be determined from session
      sessionId: chatSessionId,
      userId,
      userTimezone,
    }, {
      enabled: true,
      response: res,
      sessionId: chatSessionId,
    });

  } catch (error: unknown) {
    handleChatError(error, res, true);
  }
}

/**
 * API token-based streaming chat endpoint
 * POST /api/chat/:chatbotId/stream
 */
export async function respondStreamingApiToken(req: ApiAuthRequest, res: Response): Promise<void> {
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, sessionId } = req.body;
  const message = sanitizeString(rawMessage);
  const chatbotId = req.chatbotId;

  if (!chatbotId) {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Bad Request', message: 'chatbotId is required' });
    }
    return;
  }

  if (!message || typeof message !== 'string') {
    if (!res.headersSent) {
      res.status(400).json({ error: 'Bad Request', message: 'message is required' });
    }
    return;
  }

  // Set up SSE headers (CORS headers are set by middleware)
  const origin = req.headers.origin;
  const headers: { [key: string]: string } = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
  
  // Add CORS headers if origin is present (middleware already validated)
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-User-Timezone';
  }
  
  res.writeHead(200, headers);

  try {
    // Get or create session
    let session = sessionId ? apiSessions.get(sessionId) : null;
    let currentSessionId = sessionId;
    
    if (!session) {
      currentSessionId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      session = { chatbotId, messages: [] };
      apiSessions.set(currentSessionId, session);
    }

    // Add user message to session
    session.messages.push({ role: 'USER', content: message });

    // Convert session messages to ChatMessage format
    const history: ChatMessage[] = session.messages.slice(0, -1).map((msg, idx) => ({
      id: `api-${Date.now()}-${idx}`,
      chatSessionId: currentSessionId || '',
      role: msg.role as 'USER' | 'ASSISTANT',
      content: msg.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Send metadata event
    res.write(`data: ${JSON.stringify({ type: 'metadata', chatSessionId: currentSessionId || undefined })}\n\n`);

    const userTimezone = extractUserTimezone(req);

    // Use unified service with streaming - exclude Mermaid diagrams for API integration
    await generateChatAnswer({
      message,
      chatbotId,
      sessionId: currentSessionId,
      history,
      useInMemorySession: true,
      includeMermaidDiagrams: false, // API doesn't support Mermaid diagrams
      userTimezone,
    }, {
      enabled: true,
      response: res,
      sessionId: currentSessionId,
    });

  } catch (error: unknown) {
    logger.error('Error processing streaming API chat request', error instanceof Error ? error : undefined, {
      service: 'chat-controller',
    });
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process request' });
    } else if (!res.writableEnded) {
      interface ErrorWithCode {
        code?: string;
        message?: string;
      }
      const errorWithCode = error as ErrorWithCode;
      const errorMsg = errorWithCode.code === 'MESSAGE_LIMIT_REACHED' ? errorWithCode.message : 'Failed to process request';
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMsg
      })}\n\n`);
      res.end();
    }
  }
}

/**
 * Slack-specific streaming endpoint (for internal service calls)
 * POST /api/chat/slack-streaming
 * Validates internal service token locally (no admin-backend call)
 * Token validation happens entirely in user-backend using INTERNAL_SERVICE_TOKEN env var
 */
export async function respondStreamingSlack(req: Request, res: Response): Promise<void> {
  logger.debug('Slack streaming request received', {
    method: req.method,
    path: req.path,
    url: req.url,
    hasInternalService: !!req.headers['x-internal-service'],
    hasToken: !!req.headers['x-internal-service-token'],
    hasMessage: !!req.body?.message,
    hasChatbotId: !!req.body?.chatbotId,
    hasSessionId: !!req.body?.sessionId,
    historyLength: req.body?.history?.length || 0,
    service: 'chat-controller',
  });
  
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, chatbotId, sessionId, history: historyMessages, slackUserId } = req.body;
  const message = sanitizeString(rawMessage);
  const internalService = req.headers['x-internal-service'];
  const internalServiceToken = config.INTERNAL_SERVICE_TOKEN;

  logger.debug('Slack streaming validation', {
    hasInternalService: !!internalService,
    hasToken: internalServiceToken !== '',
    tokenMatch: req.headers['x-internal-service-token'] === internalServiceToken,
    service: 'chat-controller',
  });

  // Validate internal service call - validation happens entirely in user-backend
  if (!internalService || internalServiceToken === '' || req.headers['x-internal-service-token'] !== internalServiceToken) {
    logger.warn('Slack streaming validation failed - returning 401', {
      service: 'chat-controller',
    });
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid internal service credentials' });
    return;
  }

  if (!message || !chatbotId) {
    logger.warn('Slack streaming missing message or chatbotId - returning 400', {
      service: 'chat-controller',
    });
    res.status(400).json({ error: 'message and chatbotId are required' });
    return;
  }
  
  logger.debug('Slack streaming validation passed, proceeding', {
    service: 'chat-controller',
  });

  try {
    // Validate chatbot exists and is active
    logger.debug('Looking up chatbot for Slack streaming', {
      chatbotId,
      service: 'chat-controller',
    });
    let chatbot;
    try {
      chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId },
      });
      logger.debug('Chatbot lookup result', {
        found: !!chatbot,
        id: chatbot?.id,
        status: chatbot?.status,
        service: 'chat-controller',
      });
    } catch (dbError: unknown) {
      logger.error('Database error during chatbot lookup', dbError instanceof Error ? dbError : undefined, {
        service: 'chat-controller',
      });
      throw dbError;
    }

    if (!chatbot) {
      logger.warn('Chatbot not found for Slack streaming', {
        chatbotId,
        service: 'chat-controller',
      });
      if (!res.headersSent) {
        res.status(404).json({ error: 'Chatbot not found' });
        return;
      }
      // Headers already sent, try to send error event
      try {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Chatbot not found'
        })}\n\n`);
        res.end();
      } catch (e) {
        // Ignore
      }
      return;
    }

    // Check if chatbot is active
    if (chatbot.status !== 'ACTIVE') {
      logger.warn('Chatbot not active for Slack streaming', {
        chatbotId,
        status: chatbot.status,
        service: 'chat-controller',
      });
      if (!res.headersSent) {
        res.status(403).json({ error: 'Chatbot is not active', status: chatbot.status });
        return;
      }
      // Headers already sent, try to send error event
      try {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: `Chatbot is not active (status: ${chatbot.status})`
        })}\n\n`);
        res.end();
      } catch (e) {
        // Ignore
      }
      return;
    }

    // Set up SSE headers
    logger.debug('Setting SSE headers for Slack streaming', {
      service: 'chat-controller',
    });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    logger.debug('SSE headers set for Slack streaming', {
      service: 'chat-controller',
    });

    // Send metadata event
    logger.debug('Sending metadata event for Slack streaming', {
      service: 'chat-controller',
    });
    try {
      res.write(`data: ${JSON.stringify({
        type: 'metadata',
        chatbotId: chatbotId,
        chatSessionId: sessionId
      })}\n\n`);
      logger.debug('Metadata event sent for Slack streaming', {
        service: 'chat-controller',
      });
    } catch (writeError) {
      logger.error('Error writing metadata event', writeError instanceof Error ? writeError : undefined, {
        service: 'chat-controller',
      });
      throw writeError;
    }

    // Convert history to ChatMessage format
    interface SlackMessage {
      role: string;
      content: string;
      timestamp?: string | number;
    }
    const history: ChatMessage[] = (historyMessages || []).map((msg: SlackMessage, index: number) => ({
      id: `slack-${index}`,
      chatSessionId: sessionId || '',
      role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
      content: msg.content,
      createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      updatedAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    }));

    // Use unified service with streaming
    logger.debug('Calling generateChatAnswer for Slack streaming', {
      messageLength: message.length,
      chatbotId,
      sessionId,
      historyLength: history.length,
      hasResponse: !!res,
      responseWritable: !res.writableEnded && !res.destroyed,
      service: 'chat-controller',
    });
    
    try {
      const userTimezone = extractUserTimezone(req);

      await generateChatAnswer({
        message,
        chatbotId,
        sessionId,
        history,
        useInMemorySession: true,
        slackUserId: slackUserId, // Pass Slack user ID for OAuth connections
        userTimezone,
      }, {
        enabled: true,
        response: res,
        sessionId,
      });
      
      logger.debug('generateChatAnswer completed successfully for Slack streaming', {
        service: 'chat-controller',
      });
    } catch (generateError: unknown) {
      logger.error('Error in generateChatAnswer for Slack streaming', generateError instanceof Error ? generateError : undefined, {
        service: 'chat-controller',
      });
      throw generateError; // Re-throw to be caught by outer catch
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    interface ErrorWithCode {
      code?: string | number;
    }
    const errorWithCode = error as ErrorWithCode;
    logger.error('Error caught in Slack streaming', error instanceof Error ? error : undefined, {
      code: errorWithCode.code,
      headersSent: res.headersSent,
      writableEnded: res.writableEnded,
      destroyed: res.destroyed,
      service: 'chat-controller',
    });
    
    if (!res.headersSent) {
      logger.debug('Headers not sent, setting error headers for Slack streaming', {
        service: 'chat-controller',
      });
      res.writeHead(500, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
    }
    
    if (!res.writableEnded && !res.destroyed) {
      try {
        interface ErrorWithCode {
          code?: string;
          message?: string;
        }
        const errorWithCode = error as ErrorWithCode;
        const errorMsg = errorWithCode.code === 'MESSAGE_LIMIT_REACHED' 
          ? errorWithCode.message 
          : (error instanceof Error ? error.message : 'Something went wrong');
        
        logger.debug('Writing error event for Slack streaming', {
          error: errorMsg,
          service: 'chat-controller',
        });
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: errorMsg
        })}\n\n`);
        res.end();
      } catch (writeError) {
        logger.error('Error writing error event for Slack streaming', writeError instanceof Error ? writeError : undefined, {
          service: 'chat-controller',
        });
      }
    } else {
      logger.warn('Cannot write error event - stream already ended or destroyed', {
        service: 'chat-controller',
      });
    }
  }
}
