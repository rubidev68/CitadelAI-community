import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { LLMConfig, LLMResponse, LLMProviderInterface } from '../types';

// Gemini implementation
export class GeminiProvider implements LLMProviderInterface {
  private genAI: GoogleGenerativeAI;

  constructor(config: LLMConfig) {
    logger.debug('Initializing Gemini Provider', {
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: config.model,
      service: 'llmService',
    });
    
    if (!config.apiKey) {
      logger.warn('No API key provided for Gemini Provider', {
        service: 'llmService',
      });
    }
    
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  private mapRoleToGemini = (role: string): 'user' | 'model' => {
    return role === 'USER' ? 'user' : 'model';
  };

  async generateResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string
  ): Promise<LLMResponse> {
    const geminiModel = this.genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map(msg => ({
      role: this.mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    return {
      content: response.text(),
      usage: {
        promptTokens: 0, // Gemini doesn't provide token usage in this API
        completionTokens: 0,
        totalTokens: 0,
      }
    };
  }

  async generateStreamingResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string,
    res: Response
  ): Promise<string> {
    const geminiModel = this.genAI.getGenerativeModel({
      model,
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map(msg => ({
      role: this.mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    let chat;
    try {
      logger.debug('Starting Gemini chat', {
        historyLength: chatHistory.length,
        service: 'llmService',
      });
      chat = geminiModel.startChat({
        history: chatHistory,
      });
      logger.debug('Gemini chat started successfully', {
        service: 'llmService',
      });
    } catch (chatError: unknown) {
      const errorMessage = chatError instanceof Error ? chatError.message : String(chatError);
      logger.error('Error starting Gemini chat', chatError instanceof Error ? chatError : undefined, {
        service: 'llmService',
      });
      throw new Error(`Failed to start Gemini chat: ${errorMessage}`);
    }

    let fullResponse = '';
    let chunkCount = 0;

    try {
      logger.debug('Starting Gemini stream', {
        model,
        userMessageLength: userMessage.length,
        historyLength: history.length,
        systemPromptLength: systemPrompt.length,
        service: 'llmService',
      });
      
      let result;
      try {
        result = await chat.sendMessageStream(userMessage);
        logger.debug('sendMessageStream call completed, getting stream', {
          service: 'llmService',
        });
      } catch (apiError: unknown) {
        interface ErrorWithCode {
          code?: string | number;
        }
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        const errorWithCode = apiError as ErrorWithCode;
        logger.error('Error calling sendMessageStream', apiError instanceof Error ? apiError : undefined, {
          code: errorWithCode.code,
          service: 'llmService',
        });
        throw new Error(`Gemini API error: ${errorMessage}`);
      }
      
      logger.debug('Stream started, iterating chunks', {
        service: 'llmService',
      });
      
      for await (const chunk of result.stream) {
        chunkCount++;
        const chunkText = chunk.text();
        if (chunkText) {
          fullResponse += chunkText;
          
          // Check if response is still writable before writing
          if (res.writableEnded || res.destroyed) {
            logger.error('Response stream ended unexpectedly', undefined, {
              chunkCount,
              service: 'llmService',
            });
            throw new Error('Response stream ended unexpectedly');
          }
          
          try {
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunkText
            })}\n\n`);
          } catch (writeError) {
            logger.error('Error writing chunk', writeError instanceof Error ? writeError : undefined, {
              service: 'llmService',
            });
            throw writeError;
          }
        }
      }

      logger.debug('Stream completed', {
        chunkCount,
        responseLength: fullResponse.length,
        service: 'llmService',
      });

      // Check if response is still writable before writing complete event
      if (!res.writableEnded && !res.destroyed) {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          fullResponse: fullResponse
        })}\n\n`);
        logger.debug('Complete event sent', {
          service: 'llmService',
        });
      } else {
        logger.warn('Stream ended before complete event could be sent', {
          service: 'llmService',
        });
      }

    } catch (streamError: unknown) {
      const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
      logger.error('Error in streaming response', streamError instanceof Error ? streamError : undefined, {
        service: 'llmService',
      });
      
      // Only write error if stream is still writable
      let errorWritten = false;
      if (!res.writableEnded && !res.destroyed) {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: errorMessage || 'Streaming error occurred'
          })}\n\n`);
          errorWritten = true;
          // Close the stream after writing error
          res.end();
        } catch (writeError) {
          logger.error('Error writing error event', writeError instanceof Error ? writeError : undefined, {
            service: 'llmService',
          });
        }
      }
      
      // Re-throw the error so calling code knows something went wrong
      // But mark it so upper layers know error was already written
      const enhancedError = streamError as Error & { errorEventWritten?: boolean };
      enhancedError.errorEventWritten = errorWritten;
      throw enhancedError;
    }

    return fullResponse;
  }
}
