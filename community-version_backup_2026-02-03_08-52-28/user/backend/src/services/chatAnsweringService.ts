import { BlockType } from '@prisma/client';
import { LLMProvider, CustomProviderConfig } from './llmService';
import { generateFollowUps, FollowUpSuggestion } from './followUpGenerator';
import { Source } from './contextRetrievalService';
import { trackAICall, canSendMessage } from '../utils/aiCallTracking';
import { formatCitations } from '../services/outputFormatters/chatFormatter';
import { Response } from 'express';
import prisma from '../lib/prisma';
import type { CalendarEvent } from './calendarProviders/types';
import type { executeCalendarBlock, formatEventForContext, CalendarBlockProperties } from './calendarBlockExecutionService';
import type { PendingCalendarAction } from './calendarActionConfirmationService';
import { logger } from '@shared/utils';
import { config } from '../config';

// Import extracted modules
import { getOrCreateSession, saveAssistantMessage } from './chat/sessionManager';
import { retrieveAllContexts } from './chat/contextRetrieval';
import { combineContexts } from './chat/promptGeneration/contextCombiner';
import { buildSystemPrompt } from './chat/promptGeneration/systemPromptBuilder';
import { generateStreamingResponse } from './chat/responseGeneration/streamingHandler';
import { generateNonStreamingResponse } from './chat/responseGeneration/nonStreamingHandler';
import { handleStreamError, handleLimitError } from './chat/responseGeneration/errorHandler';

// Import types for use in function
import type {
  ChatAnsweringRequest,
  ChatAnsweringResponse,
  StreamingOptions,
} from './chat/types';

// Re-export types and Source for backward compatibility
export type {
  ChatAnsweringRequest,
  ChatAnsweringResponse,
  StreamingOptions,
} from './chat/types';
export type { Source } from './contextRetrievalService';

/**
 * Unified chat answering service
 * Handles all common logic for generating chat responses across all interfaces
 */
export async function generateChatAnswer(
  request: ChatAnsweringRequest,
  streamingOptions?: StreamingOptions
): Promise<ChatAnsweringResponse | void> {
  const { message, chatbotId, sessionId, userId, slackUserId, history: providedHistory, useInMemorySession, additionalSystemInstructions, userTimezone } = request;
  const isStreaming = streamingOptions?.enabled || false;
  const streamResponse = streamingOptions?.response;

  try {
    // 1. Get or create chat session
    const sessionResult = await getOrCreateSession(
      userId,
      sessionId,
      chatbotId,
      message,
      providedHistory,
      useInMemorySession
    );
    const { sessionId: finalSessionId, chatbotId: actualChatbotId, history: finalHistory, chatSession } = sessionResult;

    // 2. Get system prompt block and blocks for prompt generation
    const systemPromptBlock = await prisma.block.findFirst({
      where: {
        chatbotId: actualChatbotId,
        type: BlockType.LOGIC,
        subtype: 'System Prompt',
      },
    });

    // Get context blocks
    const contextBlocks = await prisma.block.findMany({
      where: {
        chatbotId: actualChatbotId,
        type: BlockType.CONTEXT,
      },
    });

    // Get action blocks (to inform AI about its capabilities)
    const actionBlocks = await prisma.block.findMany({
      where: {
        chatbotId: actualChatbotId,
        type: BlockType.ACTION,
      },
    });

    // 3. Get LLM provider configuration
    const blockProperties = systemPromptBlock?.properties as { 
      llmProvider?: string; 
      llmModel?: string; 
      customProviderId?: string;
    } | undefined;
    const llmProvider = (blockProperties?.llmProvider || 'gemini') as LLMProvider;
    const llmModel = blockProperties?.llmModel || 'gemini-2.5-flash';
    
    // Load custom provider config if provider is 'custom'
    let customProviderConfig: CustomProviderConfig | undefined = undefined;
    if (llmProvider === 'custom' && blockProperties?.customProviderId) {
      try {
        const customProvider = await prisma.customProvider.findUnique({
          where: { id: blockProperties.customProviderId },
        });
        
        if (customProvider && customProvider.isActive) {
          // Decrypt the API token
          const { decryptCredentials } = await import('@shared/utils');
          const apiToken = decryptCredentials(customProvider.apiToken);
          
          customProviderConfig = {
            baseUrl: customProvider.baseUrl,
            apiToken,
            modelName: customProvider.modelName,
          };
          
          // Override model if custom provider has a model name
          if (customProvider.modelName) {
            // llmModel is already set above, but we can use customProvider.modelName if llmModel wasn't specified
            if (!blockProperties.llmModel) {
              // llmModel will use customProvider.modelName
            }
          }
        } else {
          throw new Error('Custom provider not found or inactive');
        }
      } catch (error) {
        logger.error('Error loading custom provider config', error instanceof Error ? error : undefined, {
          customProviderId: blockProperties.customProviderId,
          service: 'chatAnsweringService',
        });
        throw new Error('Failed to load custom provider configuration');
      }
    }

    // 4. Retrieve all contexts (Weaviate, Cloud, DB, Calendar)
    const contextResult = await retrieveAllContexts(
      message,
      actualChatbotId,
      userId,
      slackUserId,
      finalSessionId,
      llmProvider,
      llmModel,
      userTimezone
    );

    // Extract context data
    let {
      weaviateContext,
      cloudContext,
      dbContext,
      calendarContext,
      sources,
      authRequirements,
      availableCalendarEvents,
    } = contextResult;

    // 5. Combine contexts and generate system prompt
    // Include Mermaid diagrams by default, but exclude for bubble/widget and API integrations
    const includeMermaid = request.includeMermaidDiagrams !== false; // Default to true
    
    // Combine all contexts
    let combinedContext = combineContexts(
      weaviateContext,
      dbContext,
      cloudContext,
      calendarContext
    );
    
    // Build system prompt
    let systemPromptWithContext = buildSystemPrompt(
      systemPromptBlock,
      contextBlocks,
      combinedContext,
      includeMermaid,
      actionBlocks,
      additionalSystemInstructions
    );

    // 7. Check if authentication is required
    if (authRequirements.length > 0 && isStreaming && streamResponse) {
      try {
        // Send auth requirement event
        if (!streamResponse.headersSent) {
          streamResponse.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });
        }
        
        // Check if stream is still writable
        if (streamResponse.writableEnded || streamResponse.destroyed) {
          logger.error('Stream already ended or destroyed, cannot send auth message', undefined, {
            service: 'chatAnsweringService',
          });
          // Try to send error event instead
          try {
            if (!streamResponse.destroyed) {
              streamResponse.write(`data: ${JSON.stringify({
                type: 'error',
                error: 'Stream closed unexpectedly. Please try again.'
              })}\n\n`);
              streamResponse.end();
            }
          } catch (e: unknown) {
            // Ignore - stream is already closed
          }
          throw new Error('Stream already closed');
        }
        
        // For Slack/API requests (no userId), send auth link and end response
        if (!userId) {
          logger.info('Auth required for Slack/API request - sending auth link', {
            authRequirementsCount: authRequirements.length,
            authRequirements: authRequirements.map(r => ({ provider: r.provider, blockId: r.blockId, hasAuthUrl: !!r.authUrl })),
            streamWritable: !streamResponse.writableEnded && !streamResponse.destroyed,
            service: 'chatAnsweringService',
          });
          
          // Build auth message with links (format for Slack markdown)
          let authMessage = '🔐 *Calendar Authentication Required*\n\n';
          authMessage += 'To use calendar features, please authenticate your calendar account:\n\n';
          
          for (const authReq of authRequirements) {
            const providerName = authReq.provider === 'caldav' ? 'CalDAV' : 'Google Calendar';
            
            if (authReq.authUrl) {
              // Format as Slack markdown link: <url|text>
              authMessage += `*${providerName}*: <${authReq.authUrl}|Click here to authenticate>\n`;
            } else {
              authMessage += `*${providerName}*: Authentication required (no URL available)\n`;
            }
          }
          
          authMessage += '\nAfter authenticating, please send your message again.';
          
          // Send auth message as response
          try {
            if (streamResponse.writableEnded || streamResponse.destroyed) {
              throw new Error('Stream closed before sending auth chunk');
            }
            streamResponse.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: authMessage,
            })}\n\n`);
          } catch (writeError: unknown) {
            const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
            const errorStack = writeError instanceof Error ? writeError.stack : undefined;
            logger.error('Error writing auth chunk', writeError instanceof Error ? writeError : undefined, {
              streamWritable: !streamResponse.writableEnded && !streamResponse.destroyed,
              service: 'chatAnsweringService',
            });
            // Try to send error event before re-throwing
            try {
              if (!streamResponse.writableEnded && !streamResponse.destroyed) {
                streamResponse.write(`data: ${JSON.stringify({
                  type: 'error',
                  error: 'Failed to send authentication message. Please try again.'
                })}\n\n`);
                streamResponse.end();
              }
            } catch (e: unknown) {
              // Ignore
            }
            throw writeError;
          }
          
          // Send auth requirement metadata for Slack processor
          for (const authReq of authRequirements) {
            try {
              if (streamResponse.writableEnded || streamResponse.destroyed) {
                throw new Error('Stream closed before sending auth_required event');
              }
              streamResponse.write(`data: ${JSON.stringify({
                type: 'auth_required',
                requiresAuth: true,
                authProvider: authReq.provider,
                authUrl: authReq.authUrl,
                authBlockId: authReq.blockId,
                serverUrl: authReq.serverUrl,
                retryCount: authReq.retryCount || 0,
                message: `Please authenticate your ${authReq.provider === 'caldav' ? 'CalDAV' : 'Google Calendar'} account to use calendar features.`,
              })}\n\n`);
            } catch (writeError: unknown) {
              const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
              const errorStack = writeError instanceof Error ? writeError.stack : undefined;
              logger.error('Error writing auth_required event', writeError instanceof Error ? writeError : undefined, {
                streamWritable: !streamResponse.writableEnded && !streamResponse.destroyed,
                service: 'chatAnsweringService',
              });
              // Try to send error event before re-throwing
              try {
                if (!streamResponse.writableEnded && !streamResponse.destroyed) {
                  streamResponse.write(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Failed to send authentication requirement. Please try again.'
                  })}\n\n`);
                  streamResponse.end();
                }
              } catch (e: unknown) {
                // Ignore
              }
              throw writeError;
            }
          }
          
          // Send complete event to end the stream
          try {
            if (streamResponse.writableEnded || streamResponse.destroyed) {
              throw new Error('Stream closed before sending complete event');
            }
            streamResponse.write(`data: ${JSON.stringify({
              type: 'complete',
              fullResponse: authMessage,
            })}\n\n`);
            streamResponse.end();
            logger.info('Auth message sent successfully for Slack/API request', {
              service: 'chatAnsweringService',
            });
          } catch (writeError: unknown) {
            const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
            const errorStack = writeError instanceof Error ? writeError.stack : undefined;
            logger.error('Error writing complete event', writeError instanceof Error ? writeError : undefined, {
              streamWritable: !streamResponse.writableEnded && !streamResponse.destroyed,
              service: 'chatAnsweringService',
            });
            // Try to send error event before re-throwing
            try {
              if (!streamResponse.writableEnded && !streamResponse.destroyed) {
                streamResponse.write(`data: ${JSON.stringify({
                  type: 'error',
                  error: 'Failed to complete authentication flow. Please try again.'
                })}\n\n`);
                streamResponse.end();
              }
            } catch (e: unknown) {
              // Ignore
            }
            throw writeError;
          }
          
          return; // Don't continue with LLM generation
        }
      
        // For authenticated web users, hold response and wait for auth
        logger.info('Auth required for authenticated user - holding response', {
          service: 'chatAnsweringService',
        });
      
      // Send auth requirement event
      for (const authReq of authRequirements) {
        streamResponse.write(`data: ${JSON.stringify({
          type: 'auth_required',
          requiresAuth: true,
          authProvider: authReq.provider,
          authUrl: authReq.authUrl,
          authBlockId: authReq.blockId,
          serverUrl: authReq.serverUrl,
          retryCount: authReq.retryCount || 0,
        })}\n\n`);
      }
      
      // Hold response and wait for auth completion or timeout (5 minutes)
      const holdTimeout = 5 * 60 * 1000; // 5 minutes
      const startTime = Date.now();
      let authCompleted = false;
      
      // Poll for auth completion every 2 seconds
      while (!authCompleted && (Date.now() - startTime) < holdTimeout) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        // Check if all auth requirements are satisfied
        let allSatisfied = true;
        for (const authReq of authRequirements) {
          const connection = await prisma.userOAuthConnection.findUnique({
            where: {
              userId_chatbotId_blockId_provider: {
                userId: userId!,
                chatbotId: actualChatbotId,
                blockId: authReq.blockId ?? (null as unknown as string), // Prisma compound unique constraint with nullable field
                provider: authReq.provider === 'caldav' ? 'CALDAV' : 'GOOGLE_CALENDAR',
              },
            },
            select: { isActive: true },
          });
          
          if (!connection || !connection.isActive) {
            allSatisfied = false;
            break;
          }
        }
        
        if (allSatisfied) {
          authCompleted = true;
          // Re-execute calendar blocks with new auth
          calendarContext = '';
          const calendarSources: Source[] = [];
          availableCalendarEvents = []; // Reset events list
          authRequirements.length = 0; // Clear requirements
          
          for (const block of await prisma.block.findMany({
            where: {
              chatbotId: actualChatbotId,
              type: BlockType.CONTEXT,
              subtype: 'Calendar',
            },
          })) {
            try {
              const { executeCalendarBlock, formatEventForContext } = await import('./calendarBlockExecutionService');
              const result = await executeCalendarBlock(
                block,
                userId!,
                actualChatbotId,
                message,
                {},
                slackUserId, // Pass Slack user ID if available
                finalSessionId // Pass session ID for caching calendar results
              );
              
              if (result.requiresAuth) {
                // Still requires auth - break and continue with what we have
                break;
              } else if (result.events && result.events.length > 0) {
                // Store events for action detection
                availableCalendarEvents.push(...result.events);
                
                const eventsText = result.events.map((e: CalendarEvent) => formatEventForContext(e, userTimezone)).join('\n\n');
                calendarContext += `\n\nUpcoming Calendar Events:\n${eventsText}`;
                calendarSources.push({
                  type: 'calendar',
                  title: block.title || 'Calendar',
                  blockId: block.id,
                });
              }
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error('Calendar context block error after auth', error instanceof Error ? error : undefined, {
                service: 'chatAnsweringService',
              });
            }
          }
          
          // Update combined context and system prompt after auth
          const updatedCalendarContext = calendarContext; // Re-retrieved in auth flow
          combinedContext = combineContexts(
            weaviateContext,
            dbContext,
            cloudContext,
            updatedCalendarContext
          );
          systemPromptWithContext = buildSystemPrompt(
            systemPromptBlock,
            contextBlocks,
            combinedContext,
            includeMermaid,
            actionBlocks,
            additionalSystemInstructions
          );
          
          // Send auth completed event
          streamResponse.write(`data: ${JSON.stringify({
            type: 'auth_completed',
            message: 'Authentication completed, continuing response...',
          })}\n\n`);
        }
      }
      
        // If timeout reached, release hold and continue without calendar context
        if (!authCompleted) {
          streamResponse.write(`data: ${JSON.stringify({
            type: 'auth_timeout',
            message: 'Authentication timeout reached, continuing without calendar context...',
          })}\n\n`);
        }
      } catch (authError: unknown) {
        logger.error('Error handling auth requirements', authError instanceof Error ? authError : undefined, {
          userId: !!userId,
          authRequirementsCount: authRequirements.length,
          service: 'chatAnsweringService',
        });
        
        // If this is a Slack/API request and we failed to send auth message, try to send error
        if (!userId && isStreaming && streamResponse && !streamResponse.writableEnded && !streamResponse.destroyed) {
          try {
            if (!streamResponse.headersSent) {
              streamResponse.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              });
            }
            
            const errorMessage = '🔐 **Calendar Authentication Required**\n\nTo use calendar features, please authenticate your calendar account via the web interface.\n\nAfter authenticating, please send your message again.';
            
            streamResponse.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: errorMessage,
            })}\n\n`);
            
            streamResponse.write(`data: ${JSON.stringify({
              type: 'complete',
              fullResponse: errorMessage,
            })}\n\n`);
            
            streamResponse.end();
            return;
          } catch (fallbackError) {
            logger.error('Error in fallback auth message', fallbackError instanceof Error ? fallbackError : undefined, {
              service: 'chatAnsweringService',
            });
            throw authError; // Re-throw original error
          }
        } else {
          throw authError; // Re-throw for authenticated users
        }
      }
    }

    // 8. Track AI call and check message limit
    // Skip for Slack/API requests that already returned due to auth requirements
    if (userId || authRequirements.length === 0) {
      try {
        const limitCheck = await canSendMessage(actualChatbotId);
        if (!limitCheck.allowed) {
          const error = {
            error: limitCheck.message || 'Message limit reached',
            code: limitCheck.code,
            currentCount: limitCheck.currentCount,
            maxAllowed: limitCheck.maxAllowed,
            remaining: limitCheck.remaining
          };

          if (isStreaming && streamResponse) {
            if (!streamResponse.headersSent) {
              streamResponse.writeHead(403, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              });
            }
            streamResponse.write(`data: ${JSON.stringify({ 
              type: 'error', 
              error: error.error || 'Message limit reached',
              code: error.code,
              currentCount: error.currentCount,
              maxAllowed: error.maxAllowed,
              remaining: error.remaining
            })}\n\n`);
            streamResponse.end();
          }
          throw new Error(JSON.stringify(error));
        }
        await trackAICall(actualChatbotId, 'MESSAGE');
      } catch (error) {
        logger.warn('Error tracking AI call', {
          error: error instanceof Error ? error.message : String(error),
          service: 'chatAnsweringService',
        });
        // Continue if tracking fails (non-critical)
      }
    }

    // 9. Detect calendar ACTION blocks BEFORE generating response (to prevent AI from responding before confirmation)
    let calendarActionRequiresConfirmation = false;
    let calendarConfirmationToken: string | null = null;
    let calendarPendingAction: PendingCalendarAction | undefined = undefined;
    
    try {
      // Determine integration type
      const integrationType = request.slackUserId ? 'slack' : (request.apiToken ? 'api' : 'web');
      
      const calendarActionBlocks = await prisma.block.findMany({
        where: {
          chatbotId: actualChatbotId,
          type: BlockType.ACTION,
          subtype: 'Calendar',
        },
      });

      // Detect calendar action intent BEFORE generating LLM response
      for (const block of calendarActionBlocks) {
        try {
          const { detectCalendarActionIntent, matchEventByIdentifier } = await import('./calendarActionDetectionService');
          // Use empty string for assistantResponse since we haven't generated it yet
          const intentResult = await detectCalendarActionIntent(
            message,
            '', // No assistant response yet - we're detecting BEFORE generating
            llmProvider,
            llmModel,
            availableCalendarEvents // Pass available events for matching
          );

          if (intentResult.hasIntent && intentResult.confidence > 0.5) {
            const properties = block.properties as unknown as CalendarBlockProperties;
            const requiresConfirmation = properties.actionConfig?.requireConfirmation !== false;
            
            if (requiresConfirmation) {
              // For update/delete actions, verify event exists BEFORE showing confirmation
              let cachedEventInfo: CalendarEvent | undefined = undefined;
              let eventFound = true;
              
              if ((intentResult.action === 'update' || intentResult.action === 'delete') && 
                  intentResult.extractedDetails?.eventId) {
                const eventIdentifier = intentResult.extractedDetails.eventId;
                
                logger.debug('Verifying event exists before confirmation', {
                  action: intentResult.action,
                  eventIdentifier,
                  availableEventsCount: availableCalendarEvents.length,
                  service: 'chatAnsweringService',
                });
                
                // Use LLM to match event identifier to available events
                let matchingEvent: CalendarEvent | null = null;
                
                // First, try matching against cached events using LLM
                if (availableCalendarEvents.length > 0) {
                  matchingEvent = await matchEventByIdentifier(
                    eventIdentifier,
                    availableCalendarEvents,
                    llmProvider,
                    llmModel
                  );
                }
                
                // If not found in cache, search via calendar provider and use LLM to match
                if (!matchingEvent) {
                  try {
                    // Get calendar provider and access token
                    const { getCalendarProvider } = await import('./calendarProviders/providerFactory');
                    const { getUserOAuthConnection, ensureValidUserToken } = await import('./userOAuthService');
                    
                    const blockProperties = properties as CalendarBlockProperties;
                    const providerId = blockProperties.provider || 'google_calendar';
                    const calendarProvider = getCalendarProvider(providerId);
                    
                    // Get OAuth connection
                    const effectiveBlockId = blockProperties.shareCredentialsWithBlockId || block.id;
                    const oauthProvider = providerId === 'caldav' ? 'CALDAV' : 'GOOGLE_CALENDAR';
                    const connection = await getUserOAuthConnection(userId!, actualChatbotId, effectiveBlockId, oauthProvider);
                    
                    if (!connection || !connection.isActive) {
                      throw new Error('Calendar authentication required');
                    }
                    
                    const accessToken = await ensureValidUserToken(connection);
                    
                    // Search for events matching the identifier
                    const searchOptions = {
                      calendarId: blockProperties.actionConfig?.defaultCalendar,
                      timeMin: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
                      timeMax: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // Next 2 years
                      maxResults: 100,
                      query: '', // Search all events, let LLM do the matching
                      orderBy: 'startTime' as const,
                      singleEvents: true,
                    };
                    
                    const searchEvents = await calendarProvider.searchEvents(accessToken, searchOptions);
                    
                    // Use LLM to match the event identifier to one of the searched events
                    if (searchEvents.length > 0) {
                      matchingEvent = await matchEventByIdentifier(
                        eventIdentifier,
                        searchEvents,
                        llmProvider,
                        llmModel
                      );
                    }
                  } catch (searchError: unknown) {
                    const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
                    logger.error('Error searching for event before confirmation', searchError instanceof Error ? searchError : undefined, {
                      service: 'chatAnsweringService',
                    });
                    // If search fails, we'll proceed but event might not be found later
                  }
                }
                
                if (matchingEvent) {
                  cachedEventInfo = matchingEvent;
                  logger.debug('Event found and cached for confirmation', {
                    eventId: cachedEventInfo.id,
                    calendarId: cachedEventInfo.calendarId,
                    summary: cachedEventInfo.summary,
                    service: 'chatAnsweringService',
                  });
                } else {
                  // Event not found - don't show confirmation, return error instead
                  eventFound = false;
                  const errorMessage = `Event not found: "${eventIdentifier}". Please check the event name and try again. Available events: ${availableCalendarEvents.slice(0, 5).map((e: CalendarEvent) => e.summary).filter(Boolean).join(', ') || 'none'}`;
                  
                  if (isStreaming && streamResponse) {
                    streamResponse.write(`data: ${JSON.stringify({
                      type: 'chunk',
                      content: errorMessage,
                    })}\n\n`);
                    streamResponse.write(`data: ${JSON.stringify({
                      type: 'complete',
                      fullResponse: errorMessage,
                    })}\n\n`);
                    streamResponse.end();
                    return;
                  } else {
                    return {
                      response: errorMessage,
                      sources: [],
                      followUps: [],
                      sessionId: finalSessionId || '',
                    };
                  }
                }
              }
              
              // Only proceed with confirmation if event was found (or it's a create action)
              if (eventFound) {
                calendarActionRequiresConfirmation = true;
                // Generate confirmation token and store pending action
                const { generateConfirmationToken, storePendingAction } = await import('./calendarActionConfirmationService');
                calendarConfirmationToken = generateConfirmationToken();
                
                calendarPendingAction = {
                  blockId: block.id,
                  userId: userId || null,
                  chatbotId: actualChatbotId,
                  slackUserId: request.slackUserId || null,
                  sessionId: finalSessionId || undefined,
                  action: intentResult.action!,
                  eventDetails: intentResult.extractedDetails || {},
                  userMessage: message,
                  integrationType,
                  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                  cachedEventInfo: cachedEventInfo ? {
                    eventId: cachedEventInfo.id,
                    calendarId: cachedEventInfo.calendarId,
                    summary: cachedEventInfo.summary,
                    start: cachedEventInfo.start,
                    end: cachedEventInfo.end,
                  } : undefined, // Cache matched event info
                };
                
                if (calendarPendingAction) {
                  await storePendingAction(calendarConfirmationToken, calendarPendingAction);
                }
                break; // Stop checking other blocks once we find one that needs confirmation
              }
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Calendar action detection error', error instanceof Error ? error : undefined, {
            service: 'chatAnsweringService',
          });
          // Continue without blocking
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Calendar ACTION Block detection failed', error instanceof Error ? error : undefined, {
        service: 'chatAnsweringService',
      });
    }

    // If calendar action requires confirmation, send confirmation and STOP (don't generate LLM response)
    if (calendarActionRequiresConfirmation && calendarConfirmationToken && calendarPendingAction) {
      const integrationType = request.slackUserId ? 'slack' : (request.apiToken ? 'api' : 'web');
      
      if (integrationType === 'slack' || integrationType === 'web') {
        // For streaming (Slack/Web), send confirmation event and end stream WITHOUT generating LLM response
        if (isStreaming && streamResponse) {
          // Send confirmation event first
          streamResponse.write(`data: ${JSON.stringify({
            type: 'calendar_confirmation',
            confirmationType: integrationType,
            pendingAction: {
              confirmationToken: calendarConfirmationToken,
              action: calendarPendingAction.action,
              eventDetails: calendarPendingAction.eventDetails,
            },
          })}\n\n`);
          
          // End the stream immediately - no AI response until user confirms
          streamResponse.write(`data: ${JSON.stringify({
            type: 'complete',
            fullResponse: '' // Empty response - AI will respond after confirmation
          })}\n\n`);
          
          streamResponse.end();
          return; // Exit early - don't generate LLM response
        }
      } else if (integrationType === 'api') {
        // For API, return confirmation response with empty message
        return {
          response: '', // Empty response - AI will respond after confirmation
          sources: [],
          followUps: [],
          sessionId: finalSessionId || '',
          requiresConfirmation: true,
          confirmationType: 'api',
          pendingAction: {
            confirmationToken: calendarConfirmationToken,
            action: calendarPendingAction.action,
            eventDetails: calendarPendingAction.eventDetails,
            confirmUrl: `${config.API_BASE_URL || config.API_URL}/api/calendar-actions/confirm`,
          },
        };
      }
    }

    // 10. Generate LLM response (only if no calendar action requires confirmation)
    let assistantResponse = '';

    if (isStreaming && streamResponse) {
      // Streaming response
      assistantResponse = await generateStreamingResponse(
        actualChatbotId,
        systemPromptWithContext,
        finalHistory,
        message,
        streamResponse,
        finalSessionId,
        combinedContext,
        llmProvider,
        llmModel,
        customProviderConfig
      );
    } else {
      // Non-streaming response
      assistantResponse = await generateNonStreamingResponse(
        actualChatbotId,
        systemPromptWithContext,
        finalHistory,
        message,
        combinedContext,
        llmProvider,
        llmModel,
        customProviderConfig
      );
    }

    // 11. Handle calendar ACTION blocks that don't require confirmation (execute immediately)
    // Note: Actions requiring confirmation are handled in step 9 (before LLM response generation)
    try {
      const integrationType = request.slackUserId ? 'slack' : (request.apiToken ? 'api' : 'web');
      
      const calendarActionBlocks = await prisma.block.findMany({
        where: {
          chatbotId: actualChatbotId,
          type: BlockType.ACTION,
          subtype: 'Calendar',
        },
      });

      // Only process blocks that don't require confirmation (those requiring confirmation were handled earlier)
      for (const block of calendarActionBlocks) {
        try {
          const properties = block.properties as unknown as CalendarBlockProperties;
          const requiresConfirmation = properties.actionConfig?.requireConfirmation !== false;
          
          // Skip blocks that require confirmation (already handled in step 9)
          if (requiresConfirmation) {
            continue;
          }
          
          // For blocks that don't require confirmation, execute immediately
          const { detectCalendarActionIntent } = await import('./calendarActionDetectionService');
          const intentResult = await detectCalendarActionIntent(
            message,
            assistantResponse,
            llmProvider,
            llmModel,
            availableCalendarEvents // Pass available events for matching
          );
          
          // Import LLM matching function
          const { matchEventByIdentifier } = await import('./calendarActionDetectionService');

          if (intentResult.hasIntent && intentResult.confidence > 0.5) {
            logger.debug('Executing action without confirmation', {
              service: 'chatAnsweringService',
            });
            const { executeCalendarBlock } = await import('./calendarBlockExecutionService');
            const result = await executeCalendarBlock(
              block,
              userId,
              actualChatbotId,
              message,
              {},
              request.slackUserId,
              finalSessionId
            );
            
            if (result.requiresAuth) {
              authRequirements.push({
                provider: result.provider || 'google_calendar',
                authUrl: result.authUrl,
                blockId: block.id,
                serverUrl: (block.properties as unknown as CalendarBlockProperties)?.caldavConfig?.serverUrl,
              });
            } else if (result.eventCreated || result.eventUpdated || result.eventDeleted) {
              if (result.eventCreated) {
                assistantResponse += '\n\n✅ Calendar event created successfully.';
              } else if (result.eventUpdated) {
                assistantResponse += '\n\n✅ Calendar event updated successfully.';
              } else if (result.eventDeleted) {
                assistantResponse += '\n\n✅ Calendar event deleted successfully.';
              }
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          logger.error('Calendar action block error', error instanceof Error ? error : undefined, {
            blockId: block.id,
            service: 'chatAnsweringService',
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Calendar ACTION Block execution failed', error instanceof Error ? error : undefined, {
        service: 'chatAnsweringService',
      });
    }

    // 9. Save assistant message (if using database session)
    if (!useInMemorySession && chatSession && finalSessionId) {
      await saveAssistantMessage(finalSessionId, assistantResponse);
    }

    // 10. Generate follow-ups (asynchronously for streaming, synchronously for non-streaming)
    // Capture sources in a const to ensure closure has correct value
    const finalSources = sources;
    const generateFollowUpsPromise = generateFollowUps(
      actualChatbotId,
      systemPromptWithContext,
      finalHistory,
      message,
      assistantResponse,
      combinedContext,
      llmProvider,
      llmModel
    );

    if (isStreaming && streamResponse) {
      // Send auth requirements first if any
      if (authRequirements.length > 0) {
        // Build auth message for Slack/API users
        let authMessage = '';
        for (const authReq of authRequirements) {
          const providerName = authReq.provider === 'google_calendar' ? 'Google Calendar' : 'CalDAV';
          let authLink = '';
          
          if (authReq.provider === 'google_calendar') {
            authLink = authReq.authUrl || '';
          } else if (authReq.provider === 'caldav') {
            // Build CalDAV auth link
            const state = Buffer.from(JSON.stringify({
              userId: userId || 'current',
              chatbotId: actualChatbotId,
              blockId: authReq.blockId,
              provider: 'CALDAV',
              redirectUri: `${config.FRONTEND_URL}/caldav/auth`,
            })).toString('base64');
            authLink = `${config.FRONTEND_URL}/caldav/auth?state=${encodeURIComponent(state)}&serverUrl=${encodeURIComponent(authReq.serverUrl || '')}`;
          }
          
          authMessage += `\n\n⚠️ **Calendar Authentication Required**\nTo use calendar features, please connect your ${providerName} account.\n🔗 [Click here to authenticate](${authLink})\n`;
          
          try {
            streamResponse.write(`data: ${JSON.stringify({
              type: 'auth_required',
              provider: authReq.provider,
              authUrl: authReq.authUrl || authLink,
              blockId: authReq.blockId,
              serverUrl: authReq.serverUrl,
              authLink: authLink, // Full link for Slack/API users
            })}\n\n`);
          } catch (writeError) {
            logger.error('Error writing auth requirement', writeError instanceof Error ? writeError : undefined, {
              service: 'chatAnsweringService',
            });
          }
        }
        
        // For Slack/API, also append auth message to assistant response
        if (authMessage) {
          assistantResponse += authMessage;
        }
      }
      
      // For streaming, send sources and follow-ups after response completes
      // The LLM service already sent the streaming chunks, now send metadata
      generateFollowUpsPromise.then(followUps => {
        if (!streamResponse.writableEnded && !streamResponse.destroyed) {
          try {
            // Send sources/citations (use 'sources' for widget/slack, 'citations' for chat)
            const citations = formatCitations(finalSources);
            // Always send citations event, even if empty, so frontend knows sources are ready
            streamResponse.write(`data: ${JSON.stringify({
              type: 'citations',
              citations: citations || ""
            })}\n\n`);
            
            // Also send as 'sources' for widget/slack compatibility
            streamResponse.write(`data: ${JSON.stringify({
              type: 'sources',
              citations: citations || ""
            })}\n\n`);
            
            // Send follow-ups (use 'followUps' for chat interface - send full FollowUpSuggestion objects)
            streamResponse.write(`data: ${JSON.stringify({
              type: 'followUps',
              followUps: followUps // Send full FollowUpSuggestion objects with id, text, icon
            })}\n\n`);
            
            // Send as suggestions array for widget/slack (keep full FollowUpSuggestion objects)
            streamResponse.write(`data: ${JSON.stringify({
              type: 'followups',
              suggestions: followUps
            })}\n\n`);
            
            // Send complete event
            streamResponse.write(`data: ${JSON.stringify({
              type: 'complete',
              fullResponse: assistantResponse,
              sources: citations,
              sourcesArray: finalSources,
              followUps: followUps
            })}\n\n`);
            
            streamResponse.end();
          } catch (writeError) {
            logger.error('Error writing sources/follow-ups', writeError instanceof Error ? writeError : undefined, {
              service: 'chatAnsweringService',
            });
            // Try to end the stream if it's still open
            if (!streamResponse.writableEnded && !streamResponse.destroyed) {
              try {
                streamResponse.end();
              } catch (endError) {
                logger.error('Error ending stream', endError instanceof Error ? endError : undefined, {
                  service: 'chatAnsweringService',
                });
              }
            }
          }
        } else {
          logger.warn('Stream already ended, cannot send sources/follow-ups', {
            service: 'chatAnsweringService',
          });
        }
      }).catch(error => {
        logger.error('Error generating follow-ups', error instanceof Error ? error : undefined, {
          service: 'chatAnsweringService',
        });
        if (!streamResponse.writableEnded && !streamResponse.destroyed) {
          try {
            const citations = formatCitations(finalSources);
            // Send both formats for compatibility
            streamResponse.write(`data: ${JSON.stringify({
              type: 'citations',
              citations: citations || ''
            })}\n\n`);
            streamResponse.write(`data: ${JSON.stringify({
              type: 'sources',
              citations: citations || ''
            })}\n\n`);
            streamResponse.write(`data: ${JSON.stringify({
              type: 'complete',
              fullResponse: assistantResponse,
              sources: citations || '',
              sourcesArray: finalSources || [],
              followUps: []
            })}\n\n`);
            streamResponse.end();
          } catch (writeError) {
            logger.error('Error writing fallback complete event', writeError instanceof Error ? writeError : undefined, {
              service: 'chatAnsweringService',
            });
            // Try to end the stream if it's still open
            if (!streamResponse.writableEnded && !streamResponse.destroyed) {
              try {
                streamResponse.end();
              } catch (endError) {
                logger.error('Error ending stream', endError instanceof Error ? endError : undefined, {
                  service: 'chatAnsweringService',
                });
              }
            }
          }
        }
      });
      
      // Return void for streaming (events sent via streamResponse)
      return;
    } else {
      // For non-streaming, wait for follow-ups
      const followUps = await generateFollowUpsPromise;
      return {
        response: assistantResponse,
        sources: finalSources,
        followUps,
        sessionId: finalSessionId || '',
        metadata: {
          chatbotId: actualChatbotId,
          provider: llmProvider,
          model: llmModel,
        },
      };
    }
  } catch (error: unknown) {
    // Handle stream errors
    handleStreamError(error, isStreaming, streamResponse);
    
    // Handle limit errors specially
    const processedError = handleLimitError(error);
    throw processedError;
  }
}
