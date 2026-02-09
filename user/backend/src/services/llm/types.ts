import { config } from '../../config';

// LLM Provider Types
export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

// Provider-specific configurations
export const PROVIDER_CONFIGS: Record<Exclude<LLMProvider, 'custom'>, { models: string[]; defaultModel: string }> = {
  gemini: {
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-2.5-flash'
  },
  openai: {
    models: ['gpt-5-mini', 'gpt-5'],
    defaultModel: 'gpt-5-mini'
  },
  anthropic: {
    models: ['claude-4.5-sonnet'],
    defaultModel: 'claude-4.5-sonnet'
  },
  mistral: {
    models: ['mistral-medium'],
    defaultModel: 'mistral-medium'
  }
};

// Custom provider configuration (from database)
export interface CustomProviderConfig {
  baseUrl: string;
  apiToken: string;
  modelName: string;
}

// Get LLM configuration from environment variables or custom provider config
export const getLLMConfig = (provider: LLMProvider, customConfig?: CustomProviderConfig): LLMConfig => {
  if (provider === 'custom') {
    if (!customConfig) {
      throw new Error('Custom provider requires customConfig parameter');
    }
    return {
      provider: 'custom',
      model: customConfig.modelName,
      apiKey: customConfig.apiToken,
      baseUrl: customConfig.baseUrl,
    };
  }

  const configs: Record<Exclude<LLMProvider, 'custom'>, () => LLMConfig> = {
    gemini: () => ({
      provider: 'gemini',
      model: config.GEMINI_MODEL,
      apiKey: config.GEMINI_API_KEY,
    }),
    openai: () => ({
      provider: 'openai',
      model: config.OPENAI_MODEL,
      apiKey: config.OPENAI_API_KEY,
      baseUrl: config.OPENAI_BASE_URL || undefined,
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
      baseUrl: config.MISTRAL_BASE_URL || undefined,
    }),
  };

  return configs[provider]();
};

import { Response } from 'express';
import { ChatMessage } from '@prisma/client';

// Provider interface that all providers must implement
export interface LLMProviderInterface {
  generateResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string
  ): Promise<LLMResponse>;
  
  generateStreamingResponse(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    model: string,
    res: Response
  ): Promise<{ content: string; usage?: LLMResponse['usage'] }>;
}
