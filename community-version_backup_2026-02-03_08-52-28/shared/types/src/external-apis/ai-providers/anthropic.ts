/**
 * Anthropic (Claude) API Type Definitions
 */

import { AIProviderResponse, AIProviderStreamChunk } from './index';

/**
 * Anthropic message role
 */
export type AnthropicMessageRole = 'user' | 'assistant';

/**
 * Anthropic message
 */
export interface AnthropicMessage {
  role: AnthropicMessageRole;
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

/**
 * Anthropic message request
 */
export interface AnthropicMessageRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  system?: string;
  stream?: boolean;
  stop_sequences?: string[];
}

/**
 * Anthropic message response
 */
export interface AnthropicMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  // AIProviderResponse compatibility
  finishReason?: string;
}

/**
 * Anthropic stream chunk
 */
export interface AnthropicStreamChunk extends AIProviderStreamChunk {
  type: 'message_start' | 'message_delta' | 'message_stop' | 'content_block_start' | 'content_block_delta' | 'content_block_stop';
  message?: {
    id: string;
    type: string;
    role: string;
    content: Array<{ type: string; text: string }>;
    model: string;
    stop_reason?: string;
    stop_sequence?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
    stop_sequence?: string;
  };
  content_block?: {
    type: string;
    text?: string;
    index?: number;
  };
  index?: number;
}

/**
 * Anthropic error response
 */
export interface AnthropicError {
  error: {
    type: string;
    message: string;
  };
}
