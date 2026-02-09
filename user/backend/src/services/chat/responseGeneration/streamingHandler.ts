import { Response } from 'express';
import { createLLMService, LLMProvider, CustomProviderConfig } from '../../llmService';
import { logger } from '@shared/utils';
import type { ChatMessage } from '@prisma/client';

/**
 * Generate streaming LLM response
 */
export async function generateStreamingResponse(
  chatbotId: string,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  streamResponse: Response,
  sessionId: string,
  combinedContext: string,
  llmProvider: LLMProvider,
  llmModel: string,
  customProviderConfig?: CustomProviderConfig,
  userId?: string
): Promise<string> {
  logger.debug('Starting streaming response generation', {
    service: 'streamingHandler',
  });

  try {
    const llmService = createLLMService(llmProvider, llmModel, customProviderConfig);
    const assistantResponse = await llmService.generateStreamingResponse(
      chatbotId,
      systemPrompt,
      history,
      message,
      streamResponse,
      sessionId,
      combinedContext,
      userId
    );

    logger.debug('Streaming response completed', {
      length: assistantResponse.length,
      service: 'streamingHandler',
    });

    return assistantResponse;
  } catch (streamError: unknown) {
    const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
    interface StreamErrorWithEvent {
      errorEventWritten?: boolean;
    }
    const streamErrorWithEvent = streamError as StreamErrorWithEvent;
    
    logger.error('Error in streaming response', streamError instanceof Error ? streamError : undefined, {
      errorEventWritten: streamErrorWithEvent?.errorEventWritten,
      service: 'streamingHandler',
    });

    // Only write error if it wasn't already written by LLM service
    if (!streamErrorWithEvent?.errorEventWritten && !streamResponse.writableEnded && !streamResponse.destroyed) {
      try {
        streamResponse.write(`data: ${JSON.stringify({
          type: 'error',
          error: errorMessage || 'An error occurred while generating the response'
        })}\n\n`);
        streamResponse.end();
      } catch (writeError) {
        logger.error('Error writing error event', writeError instanceof Error ? writeError : undefined, {
          service: 'streamingHandler',
        });
      }
    } else {
      logger.debug('Error event already written or stream closed, skipping', {
        service: 'streamingHandler',
      });
    }

    // Re-throw to be caught by outer try-catch
    throw streamError;
  }
}
