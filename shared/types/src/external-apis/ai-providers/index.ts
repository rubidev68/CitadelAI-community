/**
 * AI Provider API Type Definitions
 * 
 * Common types for all AI providers (OpenAI, Anthropic, Gemini, Mistral)
 */

/**
 * Supported AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'mistral';

/**
 * AI provider configuration
 */
export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

/**
 * AI provider response
 * 
 * Base interface for AI provider responses. Provider-specific responses
 * may extend this with additional fields or different structures.
 */
export interface AIProviderResponse {
  content: string | Array<{ type: string; text: string }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    // Also support snake_case for API responses
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  model?: string;
  finishReason?: string;
  stopReason?: string;
}

/**
 * AI provider stream chunk
 */
export interface AIProviderStreamChunk {
  content: string;
  done: boolean;
  finishReason?: string;
}

/**
 * AI provider error response
 */
export interface AIProviderError {
  error: {
    message: string;
    type?: string;
    code?: string | number;
    param?: string;
  };
}
