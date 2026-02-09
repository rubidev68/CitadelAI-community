import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import VectorStoreService from '../vectorStore';
import { logger } from '@shared/utils';
import { LLMProvider, LLMConfig, getLLMConfig, PROVIDER_CONFIGS, CustomProviderConfig } from './types';
import { createProvider } from './providers';
import { LLMProviderInterface } from './types';

// Type for MemoryVectorStore
type MemoryVectorStoreType = {
  similaritySearch: (query: string, k: number) => Promise<Array<{ pageContent: string }>>;
};

// Main LLM Service class
export class LLMService {
  private provider: LLMProvider;
  private model: string;
  private providerInstance: LLMProviderInterface;

  constructor(provider: LLMProvider, model?: string, customConfig?: CustomProviderConfig) {
    this.provider = provider;
    const config = getLLMConfig(provider, customConfig);
    this.model = model || config.model;
    this.providerInstance = createProvider(provider, config);
  }

  async generateResponse(
    chatbotId: string,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    weaviateContext?: string
  ): Promise<string> {
    let augmentedUserMessage = userMessage;

    // Use Weaviate context if provided, otherwise fall back to VectorStore
    if (weaviateContext && weaviateContext.trim()) {
      augmentedUserMessage = `Context: ${weaviateContext}\n\nQuestion: ${userMessage}`;
    } else {
      const vectorStore: MemoryVectorStoreType | undefined = await VectorStoreService.getVectorStore(chatbotId);
      if (vectorStore) {
        const similarDocs = await vectorStore.similaritySearch(userMessage, 1);
        if (similarDocs.length > 0) {
          augmentedUserMessage = `Context: ${similarDocs[0].pageContent}\n\nQuestion: ${userMessage}`;
        }
      }
    }

    // Fallback order: current provider -> gemini -> openai -> anthropic -> mistral
    const fallbackProviders: LLMProvider[] = [
      this.provider,
      'gemini',
      'openai',
      'anthropic',
      'mistral'
    ].filter((p, i, arr) => arr.indexOf(p) === i) as LLMProvider[]; // Remove duplicates

    let lastError: Error | null = null;

    // Try providers in fallback order
    for (let i = 0; i < fallbackProviders.length; i++) {
      const provider = fallbackProviders[i];
      const isLastProvider = i === fallbackProviders.length - 1;

      try {
        // Create a new service instance for fallback providers
        const service = provider === this.provider 
          ? this 
          : createLLMService(provider);
        
        // Call provider directly without fallback recursion
        const response = await service._generateResponseDirect(
          systemPrompt,
          history,
          augmentedUserMessage
        );

        if (provider !== this.provider) {
          logger.info('Successfully used fallback provider', {
          provider,
          originalProvider: this.provider,
          service: 'llmService',
        });
        }
        
        return response;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error('Provider failed in generateResponse', error instanceof Error ? error : undefined, {
          provider,
          service: 'llmService',
        });

        // If this was the last provider, throw the error
        if (isLastProvider) {
          throw lastError;
        }

        // Otherwise, continue to next provider
        logger.debug('Trying fallback provider for generateResponse', {
          attempt: i + 1,
          totalProviders: fallbackProviders.length,
          service: 'llmService',
        });
        continue;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new Error('All providers failed');
  }

  // Private method to call provider's generateResponse directly (without fallback)
  private async _generateResponseDirect(
    systemPrompt: string,
    history: ChatMessage[],
    augmentedUserMessage: string
  ): Promise<string> {
    const response = await this.providerInstance.generateResponse(
      systemPrompt,
      history,
      augmentedUserMessage,
      this.model
    );
    return response.content;
  }

  async generateStreamingResponse(
    chatbotId: string,
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    res: Response,
    chatSessionId?: string,
    weaviateContext?: string
  ): Promise<string> {
    let augmentedUserMessage = userMessage;

    // Use Weaviate context if provided, otherwise fall back to VectorStore
    if (weaviateContext && weaviateContext.trim()) {
      augmentedUserMessage = `Context: ${weaviateContext}\n\nQuestion: ${userMessage}`;
    } else {
      const vectorStore: MemoryVectorStoreType | undefined = await VectorStoreService.getVectorStore(chatbotId);
      if (vectorStore) {
        const similarDocs = await vectorStore.similaritySearch(userMessage, 1);
        if (similarDocs.length > 0) {
          augmentedUserMessage = `Context: ${similarDocs[0].pageContent}\n\nQuestion: ${userMessage}`;
        }
      }
    }

    // Check if response is still writable
    if (res.writableEnded || res.destroyed) {
      logger.error('Response stream already ended or destroyed before starting', undefined, {
        service: 'llmService',
      });
      throw new Error('Response stream is not writable');
    }

    // Set up Server-Sent Events headers (only if not already set)
    if (!res.headersSent) {
      logger.debug('Setting SSE headers', {
        service: 'llmService',
      });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });
    } else {
      logger.debug('Headers already sent, skipping header setup', {
        service: 'llmService',
      });
    }

    // Send initial metadata
    if (chatSessionId) {
      logger.debug('Sending metadata event', {
        chatSessionId,
        service: 'llmService',
      });
      try {
        res.write(`data: ${JSON.stringify({
          type: 'metadata',
          chatSessionId: chatSessionId
        })}\n\n`);
      } catch (writeError) {
        logger.error('Error writing metadata event', writeError instanceof Error ? writeError : undefined, {
          service: 'llmService',
        });
        throw new Error('Failed to write metadata event');
      }
    }

    // Fallback order: current provider -> gemini -> openai -> anthropic -> mistral
    const fallbackProviders: LLMProvider[] = [
      this.provider,
      'gemini',
      'openai',
      'anthropic',
      'mistral'
    ].filter((p, i, arr) => arr.indexOf(p) === i) as LLMProvider[]; // Remove duplicates

    let lastError: Error | null = null;

    // Try providers in fallback order
    for (let i = 0; i < fallbackProviders.length; i++) {
      const provider = fallbackProviders[i];
      const isLastProvider = i === fallbackProviders.length - 1;

      try {
        // Create a new service instance for fallback providers
        const service = provider === this.provider 
          ? this 
          : createLLMService(provider);

        logger.debug('Calling provider generateStreamingResponse', {
          provider: provider,
          model: service.modelName,
          historyLength: history.length,
          messageLength: augmentedUserMessage.length,
          systemPromptLength: systemPrompt.length,
          attempt: i + 1,
          totalAttempts: fallbackProviders.length,
          service: 'llmService',
        });
        
        // Call provider directly without fallback recursion
        const fullResponse = await service._generateStreamingResponseDirect(
          systemPrompt,
          history,
          augmentedUserMessage,
          res
        );
        
        if (provider !== this.provider) {
          logger.info('Successfully used fallback provider', {
          provider,
          originalProvider: this.provider,
          service: 'llmService',
        });
        }
        
        logger.debug('Provider streaming completed', {
          responseLength: fullResponse.length,
          service: 'llmService',
        });
        return fullResponse;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        interface ErrorWithEventWritten {
          errorEventWritten?: boolean;
          message?: string;
          stack?: string;
          name?: string;
        }
        const errorWithEvent = error as ErrorWithEventWritten;
        
        // Check if error event was already written to the stream
        // If so, we can't fallback (data was already written to the client)
        if (errorWithEvent?.errorEventWritten) {
          logger.error('Provider failed AFTER writing error event, cannot fallback', error instanceof Error ? error : undefined, {
            provider,
            service: 'llmService',
          });
          // Re-throw immediately since error was already written to stream
          throw lastError;
        }

        // Check if stream is no longer writable (might have been closed/ended)
        if (res.writableEnded || res.destroyed) {
          logger.error('Provider failed and stream is closed, cannot fallback', error instanceof Error ? error : undefined, {
            provider,
            service: 'llmService',
          });
          throw lastError;
        }

        logger.error('Provider failed in generateStreamingResponse (before data written)', error instanceof Error ? error : undefined, {
          provider,
          service: 'llmService',
        });

        // If this was the last provider, write error and throw
        if (isLastProvider) {
          // Write error to stream before throwing
          if (!res.writableEnded && !res.destroyed) {
            try {
              res.write(`data: ${JSON.stringify({
                type: 'error',
                error: (error instanceof Error ? error.message : String(error)) || "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later."
              })}\n\n`);
              res.end();
            } catch (writeError) {
              logger.error('Error writing error event', writeError instanceof Error ? writeError : undefined, {
                service: 'llmService',
              });
            }
          }
          throw lastError;
        }

        // Otherwise, continue to next provider
        logger.debug('Trying fallback provider for generateStreamingResponse', {
          attempt: i + 1,
          totalProviders: fallbackProviders.length,
          service: 'llmService',
        });
        continue;
      }
    }

    // Should never reach here, but just in case
    if (lastError) {
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: lastError?.message || "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later."
          })}\n\n`);
          res.end();
        } catch (writeError) {
          logger.error('Error writing final error event', writeError instanceof Error ? writeError : undefined, {
            service: 'llmService',
          });
        }
      }
      throw lastError;
    }
    throw new Error('All providers failed');
  }

  // Private method to call provider's generateStreamingResponse directly (without fallback)
  private async _generateStreamingResponseDirect(
    systemPrompt: string,
    history: ChatMessage[],
    augmentedUserMessage: string,
    res: Response
  ): Promise<string> {
    return await this.providerInstance.generateStreamingResponse(
      systemPrompt,
      history,
      augmentedUserMessage,
      this.model,
      res
    );
  }

  // Expose model for logging
  get modelName(): string {
    return this.model;
  }
}

// Factory function to create LLM service
export const createLLMService = (provider: LLMProvider, model?: string, customConfig?: CustomProviderConfig): LLMService => {
  return new LLMService(provider, model, customConfig);
};

// Get available models for a provider
export const getAvailableModels = (provider: LLMProvider): string[] => {
  if (provider === 'custom') {
    return []; // Custom providers don't have predefined models
  }
  return PROVIDER_CONFIGS[provider].models;
};

// Get default model for a provider
export const getDefaultModel = (provider: LLMProvider): string => {
  if (provider === 'custom') {
    return ''; // Custom providers don't have a default model
  }
  return PROVIDER_CONFIGS[provider].defaultModel;
};

// Legacy functions for backward compatibility
export const generateResponse = async (chatbotId: string, systemPrompt: string, history: ChatMessage[], userMessage: string) => {
  const service = createLLMService('gemini', 'gemini-2.5-flash');
  return service.generateResponse(chatbotId, systemPrompt, history, userMessage);
};

export const generateStreamingResponse = async (
  chatbotId: string, 
  systemPrompt: string, 
  history: ChatMessage[], 
  userMessage: string,
  res: Response,
  chatSessionId?: string
): Promise<string> => {
  const service = createLLMService('gemini', 'gemini-2.5-flash');
  return service.generateStreamingResponse(chatbotId, systemPrompt, history, userMessage, res, chatSessionId);
};
