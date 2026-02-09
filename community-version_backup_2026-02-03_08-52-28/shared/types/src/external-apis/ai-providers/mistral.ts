/**
 * Mistral AI API Type Definitions
 */

import { AIProviderResponse, AIProviderStreamChunk } from './index';

/**
 * Mistral message role
 */
export type MistralMessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Mistral message
 */
export interface MistralMessage {
  role: MistralMessageRole;
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * Mistral chat completion request
 */
export interface MistralChatCompletionRequest {
  model: string;
  messages: MistralMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  safe_prompt?: boolean;
  random_seed?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Mistral chat completion response
 */
export interface MistralChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: MistralMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'error' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  // AIProviderResponse compatibility
  content: string;
  finishReason?: string;
}

/**
 * Mistral stream chunk
 */
export interface MistralStreamChunk extends AIProviderStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: MistralMessageRole;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
}

/**
 * Mistral error response
 */
export interface MistralError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}
