import { Response } from 'express';
import { ChatMessage } from '@prisma/client';
import { AuthRequest } from '../../../middleware/auth';
import { ApiAuthRequest } from '../../../middleware/apiAuth';
import { generateChatAnswer } from '../../../services/chatAnsweringService';
import { formatChatResponse } from '../../../services/outputFormatters/chatFormatter';
import { formatApiResponse } from '../../../services/outputFormatters/apiFormatter';
import { getPendingAction, clearPendingAction } from '../../../services/calendarActionConfirmationService';
import { executeCalendarBlock } from '../../../services/calendarBlockExecutionService';
import { logCalendarAction } from '../../../services/calendarActionAuditService';
import prisma from '../../../lib/prisma';
import { logger, sanitizeString } from '@shared/utils';
import { apiSessions } from '../utils/sessionStore';
import { extractUserTimezone } from '../utils/requestUtils';
import { handleChatError } from '../utils/errorHandler';

/**
 * Non-streaming chat endpoint for authenticated users
 */
export async function respond(req: AuthRequest, res: Response): Promise<void> {
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, chatSessionId } = req.body;
  const message = sanitizeString(rawMessage);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const userTimezone = extractUserTimezone(req);
    
    const result = await generateChatAnswer({
      message,
      chatbotId: '', // Will be determined from session
      sessionId: chatSessionId,
      userId,
      userTimezone,
    });

    if (!result) {
      res.status(500).json({ error: 'Failed to generate response' });
      return;
    }

    const formatted = formatChatResponse(result);
    res.json(formatted);
  } catch (error: unknown) {
    handleChatError(error, res, false);
  }
}

/**
 * API token-based chat endpoint (non-streaming)
 * POST /api/chat/:chatbotId
 */
export async function respondApiToken(req: ApiAuthRequest, res: Response): Promise<void> {
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, sessionId } = req.body;
  const message = sanitizeString(rawMessage);
  const chatbotId = req.chatbotId;

  if (!chatbotId) {
    res.status(400).json({ error: 'Bad Request', message: 'chatbotId is required' });
    return;
  }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'message is required' });
    return;
  }

  try {
    // Get or create session
    let session = sessionId ? apiSessions.get(sessionId) : null;
    let currentSessionId = sessionId;
    
    if (!session) {
      currentSessionId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      session = { chatbotId, messages: [] };
      apiSessions.set(currentSessionId, session);
      // Clean up old sessions (keep last 1000)
      if (apiSessions.size > 1000) {
        const firstKey = apiSessions.keys().next().value;
        if (firstKey) {
          apiSessions.delete(firstKey);
        }
      }
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

    // Check if this is a confirmation request
    const { confirmAction, confirmationToken } = req.body;
    
    if (confirmAction && confirmationToken) {
      // Handle calendar action confirmation
      try {
        const pendingAction = await getPendingAction(confirmationToken);
        if (!pendingAction) {
          res.status(404).json({
            error: 'Action not found or expired',
            code: 'CONFIRMATION_EXPIRED'
          });
          return;
        }
        
        // Get block
        const block = await prisma.block.findUnique({
          where: { id: pendingAction.blockId },
        });
        
        if (!block) {
          res.status(404).json({
            error: 'Block not found',
            code: 'BLOCK_NOT_FOUND'
          });
          return;
        }
        
        // Execute the action
        const result = await executeCalendarBlock(
          block,
          pendingAction.userId,
          pendingAction.chatbotId,
          pendingAction.userMessage,
          {},
          undefined // No slackUserId for API
        );
        
        // Log action
        await logCalendarAction({
          userId: pendingAction.userId || 'api-user',
          chatbotId: pendingAction.chatbotId,
          blockId: pendingAction.blockId,
          action: pendingAction.action,
          eventId: result.eventId,
          eventDetails: pendingAction.eventDetails,
          success: !result.error,
          error: result.error,
        });
        
        // Clear pending action
        await clearPendingAction(confirmationToken);
        
        // Determine success message based on action type
        const actionSuccess = !result.error && (result.eventCreated === true || result.eventUpdated === true || result.eventDeleted === true);
        const actionType = pendingAction.action;
        let confirmationMessage = '';
        
        if (actionSuccess) {
          if (actionType === 'create') {
            confirmationMessage = '✅ Calendar event created successfully!';
          } else if (actionType === 'update') {
            confirmationMessage = '✅ Calendar event updated successfully!';
          } else if (actionType === 'delete') {
            confirmationMessage = '✅ Calendar event deleted successfully!';
          }
        } else {
          confirmationMessage = `❌ Failed to ${actionType} calendar event: ${result.error || 'Unknown error'}`;
        }
        
        // Add confirmation message to session
        session.messages.push({ role: 'ASSISTANT', content: confirmationMessage });
        
        // Return confirmation response without triggering another AI call
        res.json({
          response: confirmationMessage,
          sources: [],
          followUps: [],
          chatSessionId: currentSessionId,
          actionExecuted: true,
          actionResult: result,
          success: actionSuccess,
        });
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to confirm calendar action';
        logger.error('Calendar action confirmation error', error instanceof Error ? error : undefined, {
          service: 'chat-controller',
        });
        res.status(500).json({
          error: errorMessage,
          code: 'CONFIRMATION_ERROR',
        });
        return;
      }
    }
    
    const userTimezone = extractUserTimezone(req);

    // Use unified service - exclude Mermaid diagrams for API integration
    const result = await generateChatAnswer({
      message,
      chatbotId,
      sessionId: currentSessionId,
      history,
      useInMemorySession: true,
      includeMermaidDiagrams: false, // API doesn't support Mermaid diagrams
      apiToken: req.apiToken?.token,
      userTimezone,
    });

    if (!result) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate response' });
      return;
    }

    // Add assistant response to session
    session.messages.push({ role: 'ASSISTANT', content: result.response });

    // Format and return response (include confirmation request if present)
    const formatted = formatApiResponse(result);
    res.json({
      ...formatted,
      chatSessionId: currentSessionId,
      // Include confirmation request if present
      ...(result.requiresConfirmation && {
        requiresConfirmation: true,
        confirmationType: result.confirmationType,
        pendingAction: result.pendingAction,
      }),
    });
  } catch (error: unknown) {
    handleChatError(error, res, false);
  }
}

/**
 * Internal endpoint for service-to-service calls (e.g., Slack integration)
 * POST /api/chat/internal/:chatbotId
 * Validates internally in user-backend (no admin-backend call)
 * Requires X-Internal-Service header for basic validation
 */
export async function respondInternal(req: any, res: Response): Promise<void> {
  const { chatbotId } = req.params;
  // Message is already validated and trimmed by validation middleware
  // Apply conservative sanitization (remove control characters only)
  const { message: rawMessage, sessionId } = req.body;
  const message = sanitizeString(rawMessage);
  const internalService = req.headers['x-internal-service'];

  // Basic validation - check for internal service header (validated entirely in user-backend)
  if (!internalService) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing X-Internal-Service header' });
    return;
  }

  // Validate chatbot exists and is active
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
  });

  if (!chatbot) {
    res.status(404).json({ error: 'Not Found', message: 'Chatbot not found' });
    return;
  }

  if (chatbot.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Forbidden', message: 'Chatbot is not active', status: chatbot.status });
    return;
  }

  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Bad Request', message: 'message is required' });
    return;
  }

  try {
    // Use same session management as API token endpoint
    let session = sessionId ? apiSessions.get(sessionId) : null;
    let currentSessionId = sessionId;
    
    if (!session) {
      currentSessionId = `internal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      session = { chatbotId, messages: [] };
      apiSessions.set(currentSessionId, session);
      // Clean up old sessions (keep last 1000)
      if (apiSessions.size > 1000) {
        const firstKey = apiSessions.keys().next().value;
        if (firstKey) {
          apiSessions.delete(firstKey);
        }
      }
    }

    // Add user message to session
    session.messages.push({ role: 'USER', content: message });

    // Convert session messages to ChatMessage format
    const history: ChatMessage[] = session.messages.slice(0, -1).map((msg, idx) => ({
      id: `internal-${Date.now()}-${idx}`,
      chatSessionId: currentSessionId || '',
      role: msg.role as 'USER' | 'ASSISTANT',
      content: msg.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const userTimezone = extractUserTimezone(req);

    // Use unified service - exclude Mermaid diagrams for API integration
    const result = await generateChatAnswer({
      message,
      chatbotId,
      sessionId: currentSessionId,
      history,
      useInMemorySession: true,
      includeMermaidDiagrams: false, // API doesn't support Mermaid diagrams
      userTimezone,
    });

    if (!result) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate response' });
      return;
    }

    // Add assistant response to session
    session.messages.push({ role: 'ASSISTANT', content: result.response });

    // Format and return response
    const formatted = formatApiResponse(result);
    res.json({
      ...formatted,
      followUps: result.followUps,
      chatSessionId: currentSessionId || '',
    });
  } catch (error: unknown) {
    handleChatError(error, res, false);
  }
}
