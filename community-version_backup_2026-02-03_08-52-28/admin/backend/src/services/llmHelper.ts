import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { ChatMessage } from '@prisma/client';
import { Response } from 'express';
import { logger } from '@shared/utils';
import { config } from '../config';

const llmHelperLogger = logger.child({ service: 'admin-backend', component: 'llmHelper' });

type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'mistral';

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

const getLLMConfig = (provider: LLMProvider): LLMConfig => {
  const configs: Record<LLMProvider, () => LLMConfig> = {
    gemini: () => ({
      provider: 'gemini',
      model: config.GEMINI_MODEL,
      apiKey: config.GEMINI_API_KEY,
    }),
    openai: () => ({
      provider: 'openai',
      model: config.OPENAI_MODEL,
      apiKey: config.OPENAI_API_KEY,
    }),
    anthropic: () => ({
      provider: 'anthropic',
      model: config.ANTHROPIC_MODEL,
      apiKey: config.ANTHROPIC_API_KEY,
    }),
    mistral: () => ({
      provider: 'mistral',
      model: config.MISTRAL_MODEL,
      apiKey: config.MISTRAL_API_KEY,
    }),
  };

  return configs[provider]();
};

const mapRoleToGemini = (role: string): 'user' | 'model' => {
  return role === 'USER' ? 'user' : 'model';
};

/**
 * Generate a non-streaming response using Gemini
 */
export async function generateResponse(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  provider: LLMProvider = 'gemini',
  model?: string
): Promise<string> {
  const config = getLLMConfig(provider);
  const modelToUse = model || config.model;

  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map((msg) => ({
      role: mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    return response.text();
  }

  // For other providers, you would implement similar logic
  // For now, fallback to Gemini
  throw new Error(`Provider ${provider} not yet implemented in admin backend`);
}

/**
 * Generate a streaming response using Gemini (Server-Sent Events)
 */
export async function generateStreamingResponse(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  res: Response,
  provider: LLMProvider = 'gemini',
  model?: string
): Promise<string> {
  const config = getLLMConfig(provider);
  const modelToUse = model || config.model;

  if (provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model: modelToUse,
      systemInstruction: systemPrompt,
    });

    const chatHistory: Content[] = history.map((msg) => ({
      role: mapRoleToGemini(msg.role),
      parts: [{ text: msg.content }],
    }));

    const chat = geminiModel.startChat({
      history: chatHistory,
    });

    let fullResponse = '';

    try {
      const result = await chat.sendMessageStream(userMessage);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullResponse += chunkText;
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunkText })}\n\n`);
        }
      }

      // Send completion event
      res.write(`data: ${JSON.stringify({ type: 'complete', fullResponse })}\n\n`);
    } catch (error) {
      llmHelperLogger.error('Error in streaming response', { error: error instanceof Error ? error : new Error(String(error)) });
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Streaming error occurred' })}\n\n`);
    }

    return fullResponse;
  }

  // For other providers, implement similar logic
  throw new Error(`Provider ${provider} not yet implemented in admin backend`);
}
