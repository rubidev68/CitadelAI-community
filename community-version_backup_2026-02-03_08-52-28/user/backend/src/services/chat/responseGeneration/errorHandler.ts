import { Response } from 'express';
import { logger } from '@shared/utils';

/**
 * Handle errors in chat response generation
 */
export function handleStreamError(
  error: unknown,
  isStreaming: boolean,
  streamResponse: Response | undefined
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : undefined;
  interface ErrorWithCode {
    code?: string | number;
  }
  const errorWithCode = error as ErrorWithCode;

  logger.error('Error in generateChatAnswer', error instanceof Error ? error : undefined, {
    name: errorName,
    code: errorWithCode.code,
    isStreaming,
    hasStreamResponse: !!streamResponse,
    streamWritable: streamResponse ? (!streamResponse.writableEnded && !streamResponse.destroyed) : false,
    service: 'errorHandler',
  });

  // If streaming and error occurred, try to send error event
  if (isStreaming && streamResponse && !streamResponse.writableEnded && !streamResponse.destroyed) {
    try {
      const streamErrorMessage = error instanceof Error ? error.message : 'An error occurred while processing your request';
      logger.debug('Writing error event to stream', {
        error: errorMessage,
        service: 'errorHandler',
      });
      streamResponse.write(`data: ${JSON.stringify({
        type: 'error',
        error: streamErrorMessage
      })}\n\n`);
      streamResponse.end();
    } catch (writeError) {
      logger.error('Error writing error event to stream', writeError instanceof Error ? writeError : undefined, {
        service: 'errorHandler',
      });
    }
  }
}

/**
 * Check if error is a limit error and handle it
 */
export function handleLimitError(error: unknown): unknown {
  interface ErrorWithMessage {
    message?: string;
    error?: string;
  }
  const errorWithMessage = error as ErrorWithMessage;
  const limitErrorMessage = errorWithMessage?.message || errorWithMessage?.error || '';
  
  if (limitErrorMessage && limitErrorMessage.includes('Message limit reached')) {
    try {
      const errorData = typeof limitErrorMessage === 'string' ? JSON.parse(limitErrorMessage) : limitErrorMessage;
      throw errorData;
    } catch {
      throw error;
    }
  }
  
  return error;
}
