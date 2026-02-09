import { BlockType } from '@prisma/client';
import prisma from '../../../lib/prisma';
import { Source } from '../../contextRetrievalService';
import { logger } from '@shared/utils';
import type { CalendarEvent } from '../../calendarProviders/types';
import type { executeCalendarBlock, formatEventForContext, CalendarBlockProperties } from '../../calendarBlockExecutionService';
import type { AuthRequirement } from '../types';

/**
 * Retrieve context from calendar blocks
 */
export interface CalendarContextResult {
  context: string;
  sources: Source[];
  authRequirements: AuthRequirement[];
  availableEvents: CalendarEvent[];
}

export async function retrieveCalendarContext(
  message: string,
  chatbotId: string,
  userId: string | undefined,
  slackUserId: string | undefined,
  sessionId: string,
  userTimezone?: string
): Promise<CalendarContextResult> {
  let calendarContext = '';
  const calendarSources: Source[] = [];
  const availableCalendarEvents: CalendarEvent[] = [];
  const authRequirements: AuthRequirement[] = [];

  try {
    logger.debug('Checking for calendar blocks', {
      chatbotId,
      userId: userId || 'none (Slack/API)',
      service: 'calendarContext',
    });

    const calendarContextBlocks = await prisma.block.findMany({
      where: {
        chatbotId,
        type: BlockType.CONTEXT,
        subtype: 'Calendar',
      },
    });

    logger.debug('Found calendar blocks', {
      count: calendarContextBlocks.length,
      service: 'calendarContext',
    });

    // Execute calendar context blocks
    for (const block of calendarContextBlocks) {
      try {
        const blockProperties = block.properties as unknown as CalendarBlockProperties | null;
        logger.debug('Executing calendar block', {
          blockId: block.id,
          provider: blockProperties?.provider || 'google_calendar',
          userId: userId || 'none',
          service: 'calendarContext',
        });

        let executeCalendarBlockFn: typeof executeCalendarBlock;
        let formatEventForContextFn: typeof formatEventForContext;

        try {
          const calendarModule = await import('../../calendarBlockExecutionService');
          executeCalendarBlockFn = calendarModule.executeCalendarBlock;
          formatEventForContextFn = calendarModule.formatEventForContext;
        } catch (importError: unknown) {
          const errorMessage = importError instanceof Error ? importError.message : String(importError);
          logger.error('Failed to import calendarBlockExecutionService', importError instanceof Error ? importError : undefined, {
            blockId: block.id,
            service: 'calendarContext',
          });
          throw new Error(`Failed to load calendar block execution service: ${errorMessage}`);
        }

        const result = await executeCalendarBlockFn(
          block,
          userId || null, // Pass null for Slack/API requests (will use slackUserId if available)
          chatbotId,
          message,
          {},
          slackUserId, // Pass Slack user ID for OAuth connection storage
          sessionId // Pass session ID for caching calendar results
        );

        logger.debug('Calendar block result', {
          blockId: block.id,
          requiresAuth: result.requiresAuth,
          hasEvents: !!(result.events && result.events.length > 0),
          error: result.error,
          hasProvider: !!result.provider,
          hasAuthUrl: !!result.authUrl,
          service: 'calendarContext',
        });

        if (result.requiresAuth) {
          // Collect auth requirement to send in response
          logger.debug('Adding auth requirement', {
            provider: result.provider,
            blockId: result.blockId,
            hasAuthUrl: !!result.authUrl,
            service: 'calendarContext',
          });

          const blockProperties = block.properties as unknown as CalendarBlockProperties;
          authRequirements.push({
            provider: result.provider || 'google_calendar',
            authUrl: result.authUrl,
            blockId: result.blockId || block.id,
            serverUrl: blockProperties?.caldavConfig?.serverUrl,
            retryCount: result.retryCount || 0,
          });
        } else if (result.error && result.retryCount !== undefined && result.retryCount >= 1) {
          // Max retries reached - don't hold response, but log error
          logger.error('Calendar block failed after max retries', undefined, {
            blockId: block.id,
            error: result.error,
            service: 'calendarContext',
          });
        } else if (result.events && result.events.length > 0) {
          // Store events for action detection
          availableCalendarEvents.push(...result.events);

          // Add calendar context (use timezone from request if available)
          const eventsText = result.events.map((e: CalendarEvent) => formatEventForContextFn(e, userTimezone)).join('\n\n');
          calendarContext += `\n\nUpcoming Calendar Events:\n${eventsText}`;

          // Add source
          calendarSources.push({
            type: 'calendar',
            title: block.title || 'Calendar',
            blockId: block.id,
          });
        }
      } catch (error: unknown) {
        logger.error('Calendar context block error', error instanceof Error ? error : undefined, {
          blockId: block.id,
          service: 'calendarContext',
        });
        // Continue without blocking the chat response - don't add to authRequirements
        // This allows the chat to continue even if calendar block fails
      }
    }

    logger.debug('Calendar blocks execution complete', {
      authRequirementsCount: authRequirements.length,
      calendarContextLength: calendarContext.length,
      service: 'calendarContext',
    });
  } catch (error: unknown) {
    logger.error('Calendar Block execution failed', error instanceof Error ? error : undefined, {
      service: 'calendarContext',
    });
  }

  return {
    context: calendarContext,
    sources: calendarSources,
    authRequirements,
    availableEvents: availableCalendarEvents,
  };
}
