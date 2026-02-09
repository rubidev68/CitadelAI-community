/**
 * Automatic SQL Query Generation Service
 * Uses LLM to generate SQL queries based on user message and database schema
 */

import { generateSqlQuery as sharedGenerateSqlQuery, DatabaseSchema, GenerateResponseFn } from '@shared/services';
import { createLLMService, LLMProvider } from './llmService';

/**
 * Generate SQL SELECT query automatically based on user message and database schema
 */
export async function generateSqlQuery(
  userMessage: string,
  schema: DatabaseSchema,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<string> {
  
  const generateResponseAdapter: GenerateResponseFn = async (systemPrompt, history, prompt, provider, model) => {
    const llmService = createLLMService(provider as LLMProvider, model);
    return llmService.generateResponse(
      'db-query-generator',
      systemPrompt,
      history,
      prompt
    );
  };

  return sharedGenerateSqlQuery(
    userMessage,
    schema,
    generateResponseAdapter,
    llmProvider,
    llmModel
  );
}
