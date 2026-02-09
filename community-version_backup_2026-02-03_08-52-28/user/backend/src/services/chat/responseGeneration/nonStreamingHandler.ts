import { createLLMService, LLMProvider, CustomProviderConfig } from '../../llmService';
import { logger } from '@shared/utils';
import type { ChatMessage } from '@prisma/client';

/**
 * Generate non-streaming LLM response
 */
export async function generateNonStreamingResponse(
  chatbotId: string,
  systemPrompt: string,
  history: ChatMessage[],
  message: string,
  combinedContext: string,
  llmProvider: LLMProvider,
  llmModel: string,
  customProviderConfig?: CustomProviderConfig
): Promise<string> {
  logger.debug('Starting non-streaming response generation', {
    service: 'nonStreamingHandler',
  });

  const llmService = createLLMService(llmProvider, llmModel, customProviderConfig);
  const assistantResponse = await llmService.generateResponse(
    chatbotId,
    systemPrompt,
    history,
    message,
    combinedContext
  );

  logger.debug('Non-streaming response completed', {
    length: assistantResponse.length,
    service: 'nonStreamingHandler',
  });

  return assistantResponse;
}
