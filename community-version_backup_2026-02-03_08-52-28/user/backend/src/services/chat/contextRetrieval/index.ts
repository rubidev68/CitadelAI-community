import { retrieveWeaviateContext } from './weaviateContext';
import { retrieveCloudContext } from './cloudContext';
import { retrieveDbContext } from './dbContext';
import { retrieveCalendarContext } from './calendarContext';
import type { ContextResult } from '../types';
import { logger } from '@shared/utils';

/**
 * Retrieve all context types and aggregate them
 */
export async function retrieveAllContexts(
  message: string,
  chatbotId: string,
  userId: string | undefined,
  slackUserId: string | undefined,
  sessionId: string,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'custom',
  llmModel: string,
  userTimezone?: string
): Promise<ContextResult> {
  // For custom provider, use gemini as fallback for context retrieval
  const effectiveProvider = llmProvider === 'custom' ? 'gemini' : llmProvider;
  logger.debug('Starting context retrieval', {
    chatbotId,
    service: 'contextRetrieval',
  });

  // Retrieve all context types in parallel
  const [weaviateData, cloudData, dbData, calendarData] = await Promise.all([
    retrieveWeaviateContext(message, chatbotId),
    retrieveCloudContext(message, chatbotId),
    retrieveDbContext(message, chatbotId, effectiveProvider, llmModel),
    retrieveCalendarContext(message, chatbotId, userId, slackUserId, sessionId, userTimezone),
  ]);

  // Combine all sources
  const sources = [
    ...weaviateData.sources,
    ...cloudData.sources,
    ...dbData.sources,
    ...calendarData.sources,
  ];

  logger.debug('Context retrieval complete', {
    weaviateLength: weaviateData.context.length,
    cloudLength: cloudData.context.length,
    dbLength: dbData.context.length,
    calendarLength: calendarData.context.length,
    totalSources: sources.length,
    authRequirements: calendarData.authRequirements.length,
    service: 'contextRetrieval',
  });

  return {
    weaviateContext: weaviateData.context,
    cloudContext: cloudData.context,
    dbContext: dbData.context,
    calendarContext: calendarData.context,
    sources,
    authRequirements: calendarData.authRequirements,
    availableCalendarEvents: calendarData.availableEvents,
  };
}
