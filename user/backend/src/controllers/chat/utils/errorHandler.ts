import { Response } from 'express';
import { logger } from '@shared/utils';

interface ErrorWithCode {
  code?: string;
  message?: string;
  currentCount?: number;
  maxAllowed?: number | null;
  remaining?: number | null;
}

export function handleChatError(error: unknown, res: Response, isStreaming: boolean = false): void {
  const errorWithCode = error as ErrorWithCode;
  logger.error('Error in chat handler', error instanceof Error ? error : undefined, {
    service: 'chat-controller',
  });
  
  if (isStreaming) {
    if (!res.headersSent) {
      res.writeHead(500, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, X-User-Timezone',
      });
    }
    
    if (!res.writableEnded) {
      const errorMsg = errorWithCode.code === 'MESSAGE_LIMIT_REACHED' 
        ? errorWithCode.message 
        : (error instanceof Error ? error.message : 'Something went wrong');
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: errorMsg
      })}\n\n`);
      res.end();
    }
  } else {
    if (errorWithCode.code === 'MESSAGE_LIMIT_REACHED') {
      res.status(403).json({
        error: errorWithCode.message || 'Message limit reached',
        code: errorWithCode.code,
        currentCount: errorWithCode.currentCount,
        maxAllowed: errorWithCode.maxAllowed,
        remaining: errorWithCode.remaining
      });
    } else {
      res.status(500).json({ error: 'Something went wrong' });
    }
  }
}
