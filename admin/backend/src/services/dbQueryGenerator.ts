/**
 * Automatic SQL Query Generation Service
 * Uses LLM to generate SQL queries based on user message and database schema
 */

import { generateSqlQuery as sharedGenerateSqlQuery, DatabaseSchema } from '@shared/services';
import { generateResponse } from './llmHelper';

export async function generateSqlQuery(
  userMessage: string,
  schema: DatabaseSchema,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' = 'gemini',
  llmModel?: string
): Promise<string> {
  return sharedGenerateSqlQuery(
    userMessage,
    schema,
    generateResponse,
    llmProvider,
    llmModel
  );
}
