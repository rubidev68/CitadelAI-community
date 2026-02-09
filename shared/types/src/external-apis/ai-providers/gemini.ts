/**
 * Google Gemini API Type Definitions
 */

import { AIProviderResponse, AIProviderStreamChunk } from './index';

/**
 * Gemini content part
 */
export interface GeminiContentPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
  file_data?: {
    mime_type: string;
    file_uri: string;
  };
}

/**
 * Gemini content
 */
export interface GeminiContent {
  role: 'user' | 'model' | 'function' | 'system';
  parts: GeminiContentPart[];
}

/**
 * Gemini generation config
 */
export interface GeminiGenerationConfig {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_output_tokens?: number;
  candidate_count?: number;
  stop_sequences?: string[];
}

/**
 * Gemini safety settings
 */
export interface GeminiSafetySetting {
  category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

/**
 * Gemini generate content request
 */
export interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
  tools?: Array<{
    function_declarations?: Array<{
      name: string;
      description?: string;
      parameters?: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
      };
    }>;
  }>;
}

/**
 * Gemini candidate
 */
export interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  safetyRatings?: Array<{
    category: string;
    probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  tokenCount?: number;
  index?: number;
}

/**
 * Gemini generate content response
 */
export interface GeminiGenerateContentResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: 'SAFETY' | 'RECITATION' | 'OTHER';
    safetyRatings?: Array<{
      category: string;
      probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  // AIProviderResponse compatibility
  content: string | Array<{ type: string; text: string }>;
  finishReason?: string;
}

/**
 * Gemini stream chunk
 */
export interface GeminiStreamChunk extends AIProviderStreamChunk {
  candidates?: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
}

/**
 * Gemini error response
 */
export interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      [key: string]: unknown;
    }>;
  };
}
