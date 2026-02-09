import { LLMConfig, LLMProvider } from '../types';
import { GeminiProvider } from './geminiProvider';
import { OpenAIProvider } from './openaiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { MistralProvider } from './mistralProvider';
import { CustomProvider } from './customProvider';
import { LLMProviderInterface } from '../types';

// Factory function to create provider instances
export function createProvider(provider: LLMProvider, config: LLMConfig): LLMProviderInterface {
  switch (provider) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'mistral':
      return new MistralProvider(config);
    case 'custom':
      return new CustomProvider(config);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
