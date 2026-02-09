import { Response } from 'express';
import { BlockType, ChatMessage } from '@prisma/client';
import { logger } from '@shared/utils';
import { ApiAuthRequest } from '../../middleware/apiAuth';
import { generateResponse, generateStreamingResponse } from '../../services/llmHelper';
import { getContextFromWeaviate } from './utils/weaviateUtils';
import { generateSystemPrompt } from './utils/promptUtils';
import { getOrCreateSession, getSessionId } from './utils/sessionUtils';
import prisma from '../../lib/prisma';

const publicApiLogger = logger.child({ service: 'admin-backend', component: 'publicApi' });

/**
 * Send message to chatbot (non-streaming)
 */
export async function handleChat(req: ApiAuthRequest, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    // CRITICAL: This check must be first to prevent controller execution when validation fails
    if (res.headersSent || res.writableEnded) {
      return;
    }
    
    // Body and params are already validated by validation middleware
    // If we reach here, validation passed, so message should be present
    // Safely access req.body - it should exist after express.json() middleware
    const body = req.body || {};
    const { message, sessionId } = body;
    // chatbotId comes from params (validated by middleware) or from auth middleware
    const chatbotId = req.chatbotId || req.params?.chatbotId;
    
    // Defensive check - validation middleware should have validated params
    // But auth middleware might not set req.chatbotId if token is invalid
    if (!chatbotId) {
      if (!res.headersSent && !res.writableEnded) {
        res.status(400).json({ error: 'Bad Request', message: 'chatbotId is required' });
      }
      return;
    }

    // Additional safety check - if message is missing, validation middleware should have caught it
    // This is a defensive check in case validation middleware didn't run
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      // Check if response already sent (validation middleware should have handled this)
      if (!res.headersSent && !res.writableEnded) {
        res.status(400).json({ error: 'Bad Request', message: 'message is required' });
      }
      return;
    }

    // TypeScript now knows chatbotId is string after the check above
    const validChatbotId: string = chatbotId;

    // Get or create session
    const { session, sessionId: currentSessionId } = getOrCreateSession(sessionId, validChatbotId);

    // Add user message to session
    session.messages.push({ role: 'USER', content: message });

    // Get context from Weaviate
    const contextData = await getContextFromWeaviate(message, validChatbotId);

    // Get system prompt block
    const systemPromptBlock = await prisma.block.findFirst({
      where: {
        chatbotId: validChatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
      },
    });

    // Get context blocks
    const contextBlocks = await prisma.block.findMany({
      where: {
        chatbotId: validChatbotId,
        type: BlockType.CONTEXT,
      },
    });

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(systemPromptBlock, contextBlocks, contextData.context);

    // Get LLM configuration
    const blockProperties = systemPromptBlock?.properties as { llmProvider?: string; llmModel?: string } | undefined;
    const llmProvider = blockProperties?.llmProvider || 'gemini';
    const llmModel = blockProperties?.llmModel || 'gemini-2.5-flash';

    // Generate response using LLM helper
    const history: ChatMessage[] = session.messages.slice(0, -1).map((msg) => ({
      id: `session-${msg.role}-${session.messages.indexOf(msg)}`,
      chatSessionId: currentSessionId,
      role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
      content: msg.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Augment user message with context
    const augmentedMessage = contextData.context
      ? `Context: ${contextData.context}\n\nQuestion: ${message}`
      : message;

    type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'mistral';
    const response = await generateResponse(
      systemPrompt,
      history,
      augmentedMessage,
      llmProvider as LLMProvider,
      llmModel
    );

    // Add assistant response to session
    session.messages.push({ role: 'ASSISTANT', content: response });

    // Format sources
    const sources = contextData.sources.map((source) => ({
      url: source.url,
      title: source.title,
      type: source.type,
      fileName: source.fileName,
    }));

    // Get usage info for USAGE type tokens
    const usage = req.apiToken?.tokenType === 'USAGE' && req.apiToken.maxUsage
      ? {
          token: req.apiToken.tokenPrefix,
          remaining: Math.max(0, req.apiToken.maxUsage - (req.apiToken.currentUsage + 1)),
        }
      : undefined;

    res.json({
      response,
      sessionId: currentSessionId || undefined,
      sources,
      usage,
    });
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    if (!res.headersSent && !res.writableEnded) {
      publicApiLogger.error('Error processing API chat request', { error: error instanceof Error ? error : new Error(String(error)) });
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process request' });
    }
  }
}

/**
 * Stream message to chatbot (Server-Sent Events)
 */
export async function handleChatStream(req: ApiAuthRequest, res: Response): Promise<void> {
  try {
    // Early return if response already sent (validation middleware should have handled it)
    // CRITICAL: This check must be first to prevent controller execution when validation fails
    if (res.headersSent || res.writableEnded) {
      return;
    }
    
    // Safely access req.body - it should exist after express.json() middleware
    const body = req.body || {};
    const { message, sessionId } = body;
    const chatbotId = req.chatbotId;
    
    // Body and params are already validated by validation middleware
    // Additional safety check - if chatbotId is missing, validation middleware should have caught it
    if (!chatbotId) {
      // Check if response already sent (validation middleware should have handled this)
      if (!res.headersSent && !res.writableEnded) {
        res.status(400).json({ error: 'Bad Request', message: 'chatbotId is required' });
      }
      return;
    }
    
    // Additional safety check for message in streaming handler
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      // Check if response already sent (validation middleware should have handled this)
      if (!res.headersSent && !res.writableEnded) {
        res.status(400).json({ error: 'Bad Request', message: 'message is required' });
      }
      return;
    }

    // TypeScript now knows chatbotId is string after the check above
    const validChatbotId: string = chatbotId;

    // Set up SSE headers
    // CORS headers are already set by middleware, but we need to ensure they're present for SSE
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
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    }
    
    res.writeHead(200, headers);

    // Get or create session
    const { session, sessionId: currentSessionId } = getOrCreateSession(sessionId, validChatbotId);

    // Add user message to session
    session.messages.push({ role: 'USER', content: message });

    // Send metadata event
    res.write(`data: ${JSON.stringify({ type: 'metadata', chatSessionId: currentSessionId || undefined })}\n\n`);

    try {
      // Get context from Weaviate
      const contextData = await getContextFromWeaviate(message, validChatbotId);

      // Get system prompt block
      const systemPromptBlock = await prisma.block.findFirst({
        where: {
          chatbotId: validChatbotId,
          type: BlockType.LOGIC,
          subtype: 'System Prompt',
        },
      });

      // Get context blocks
      const contextBlocks = await prisma.block.findMany({
        where: {
          chatbotId: validChatbotId,
          type: BlockType.CONTEXT,
        },
      });

      // Generate system prompt
      const systemPrompt = generateSystemPrompt(systemPromptBlock, contextBlocks, contextData.context);

      // Get LLM configuration
      const blockProperties = systemPromptBlock?.properties as { llmProvider?: string; llmModel?: string } | undefined;
      const llmProvider = blockProperties?.llmProvider || 'gemini';
      const llmModel = blockProperties?.llmModel || 'gemini-2.5-flash';

      // Prepare history
      const history: ChatMessage[] = session.messages.slice(0, -1).map((msg) => ({
        id: `session-${msg.role}-${session.messages.indexOf(msg)}`,
        chatSessionId: currentSessionId,
        role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
        content: msg.content,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // Augment user message with context
      const augmentedMessage = contextData.context
        ? `Context: ${contextData.context}\n\nQuestion: ${message}`
        : message;

      // Stream response
      type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'mistral';
      await generateStreamingResponse(
        systemPrompt,
        history,
        augmentedMessage,
        res,
        llmProvider as LLMProvider,
        llmModel
      );

      // Format and send sources in completion event
      const sources = contextData.sources.map((source) => ({
        url: source.url,
        title: source.title,
        type: source.type,
        fileName: source.fileName,
      }));
      
      res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);

      // Note: generateStreamingResponse handles sending chunks and completion event
      // We just need to send usage event if applicable
      if (req.apiToken?.tokenType === 'USAGE' && req.apiToken.maxUsage) {
        const remaining = Math.max(0, req.apiToken.maxUsage - (req.apiToken.currentUsage + 1));
        res.write(`data: ${JSON.stringify({ type: 'usage', token: req.apiToken.tokenPrefix, remaining })}\n\n`);
      }
    } catch (error: unknown) {
      publicApiLogger.error('Error in streaming response', { error: error instanceof Error ? error : new Error(String(error)) });
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to generate response' })}\n\n`);
    }

    res.end();
  } catch (error: unknown) {
    // Don't send error response if headers already sent (validation middleware may have sent a response)
    publicApiLogger.error('Error processing streaming API chat request', { error: error instanceof Error ? error : new Error(String(error)) });
    if (!res.headersSent && !res.writableEnded) {
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process request' });
    } else if (res.headersSent && !res.writableEnded) {
      // Headers already sent (SSE stream started), send error event
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Internal server error' })}\n\n`);
      res.end();
    }
    // If response is already fully ended, do nothing
  }
}
