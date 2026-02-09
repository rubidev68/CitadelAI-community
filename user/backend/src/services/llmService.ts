// Re-export from new modular structure for backward compatibility
export { LLMService, createLLMService, getAvailableModels, getDefaultModel, generateResponse, generateStreamingResponse } from './llm/llmService';
export type { LLMProvider, LLMConfig, LLMResponse, LLMStreamChunk, CustomProviderConfig } from './llm/types';
