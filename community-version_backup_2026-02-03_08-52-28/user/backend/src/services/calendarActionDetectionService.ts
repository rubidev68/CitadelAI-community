/**
 * Calendar Action Detection Service
 * Detects calendar action intents from user messages and LLM responses using AI
 */

import { createLLMService } from './llmService';
import { CalendarEvent } from './calendarProviders/types';
import { logger } from '@shared/utils';

export interface CalendarActionIntent {
  hasIntent: boolean;
  action: 'create' | 'update' | 'delete' | null;
  confidence: number;
  extractedDetails?: {
    summary?: string;
    start?: string;
    end?: string;
    location?: string;
    attendees?: string[];
    eventId?: string; // For update/delete operations
  };
}

/**
 * Detect calendar action intent from user message and assistant response using AI
 * @param availableEvents - Optional list of available calendar events to help match event names for update/delete operations
 */
export async function detectCalendarActionIntent(
  userMessage: string,
  assistantResponse: string,
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'custom' = 'gemini',
  llmModel?: string,
  availableEvents?: CalendarEvent[]
): Promise<CalendarActionIntent> {
  try {
    // For custom provider, use gemini as fallback for calendar action detection
    const effectiveProvider = llmProvider === 'custom' ? 'gemini' : llmProvider;
    const llmService = createLLMService(effectiveProvider, llmModel);
    
    // Build available events list for update/delete operations
    let availableEventsText = '';
    if (availableEvents && availableEvents.length > 0) {
      const eventList = availableEvents.map((e, idx) => {
        const summary = e.summary || '(no title)';
        const start = e.start?.dateTime || e.start?.date || 'unknown time';
        return `${idx + 1}. "${summary}" (${start})`;
      }).join('\n');
      
      availableEventsText = `\n\nAVAILABLE CALENDAR EVENTS:\n${eventList}\n\nIMPORTANT FOR UPDATE/DELETE OPERATIONS:\n- You MUST match the event name from the user's message to one of the available events listed above.\n- Use the EXACT event name/summary from the available events list in the "eventId" field.\n- If the user says "f.norbert event" or "F.Norbert", match it to the exact event name from the list above.\n- The eventId should be the exact summary/title from the available events, not a variation.\n`;
    }
    
    // Create prompt for AI-based intent detection
    // Get current date/time for context
    const now = new Date();
    const currentDateISO = now.toISOString();
    const currentDateReadable = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const detectionPrompt = `Analyze the following user message and assistant response to determine if the user wants to perform a calendar action (create, update, or delete an event).

CURRENT DATE CONTEXT:
- Today's date: ${currentDateReadable}
- Current ISO date/time: ${currentDateISO}
- Use this information to calculate relative dates (e.g., "next monday" should be calculated based on today's date)

User message: "${userMessage}"

Assistant response: "${assistantResponse}"${availableEventsText}

Determine:
1. Does the user want to perform a calendar action? (create, update, or delete an event)
2. What type of action? (create, update, or delete)
3. Extract relevant event details from the message:
   - Event title/summary (e.g., "F.Norbert", "Team meeting")
   - Start time: Convert relative dates (e.g., "next monday", "tomorrow") to ISO 8601 format (e.g., "2025-12-22T09:00:00Z")
     * Calculate the actual date based on today's date
     * For times, use 24-hour format in ISO string (e.g., "9am" becomes "09:00", "2:30pm" becomes "14:30")
     * Include timezone offset or use "Z" for UTC
   - End time: Same format as start time (ISO 8601)
   - Location (if mentioned)
   - Attendees (if mentioned, as array of emails or names)
   - Event ID or identifier (for update/delete operations, MUST match exactly one of the available events listed above)

IMPORTANT: 
- For dates: Convert relative dates to actual ISO dates. Example: If today is 2025-12-17 and user says "next monday", return "2025-12-22T09:00:00Z" (assuming 9am)
- For times: Convert to ISO format. Example: "9am" → "09:00", "2:30pm" → "14:30", "9:30p.m" → "21:30"
- For update operations, extract what needs to be changed and convert to ISO format
- For update/delete operations, you MUST match the event identifier to one of the available events listed above
- Use the EXACT event name/summary from the available events list in the "eventId" field
- Extract event identifiers mentioned in the message (e.g., "f.norbert event", "the meeting") and match them to available events
- Only return "hasIntent: true" if you're confident the user wants to perform a calendar action

You must respond with ONLY a valid JSON object in this exact format (no other text, no markdown):
{
  "hasIntent": true or false,
  "action": "create" or "update" or "delete" or null,
  "confidence": number between 0 and 1,
  "extractedDetails": {
    "summary": "event title or name",
    "start": "ISO 8601 datetime string (e.g., 2025-12-22T09:00:00Z) or natural language if ISO conversion not possible",
    "end": "ISO 8601 datetime string or natural language if ISO conversion not possible",
    "location": "location if mentioned",
    "attendees": ["email1@example.com", "email2@example.com"],
    "eventId": "event identifier for update/delete"
  }
}

If hasIntent is false, set action to null and confidence to 0. Only include fields in extractedDetails that are actually mentioned in the message.`;

    const systemPrompt = `You are a calendar action intent detection system. Analyze user messages to determine if they want to create, update, or delete calendar events. Extract relevant event details accurately.`;

    const llmResponse = await llmService.generateResponse(
      'calendar-detection', // chatbotId (not used for this purpose)
      systemPrompt,
      [],
      detectionPrompt
    );

    // Parse JSON response
    interface ParsedIntentResponse {
      hasIntent?: boolean;
      action?: 'create' | 'update' | 'delete' | null;
      confidence?: number;
      extractedDetails?: {
        summary?: string;
        start?: string;
        end?: string;
        location?: string;
        attendees?: string[];
        eventId?: string;
      };
    }
    let parsedResponse: ParsedIntentResponse;
    try {
      // Try to extract JSON from the response (in case LLM adds extra text)
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]) as ParsedIntentResponse;
      } else {
        parsedResponse = JSON.parse(llmResponse) as ParsedIntentResponse;
      }
    } catch (parseError) {
      logger.error('Failed to parse LLM response as JSON', parseError instanceof Error ? parseError : undefined, {
        response: llmResponse,
        service: 'calendarActionDetectionService',
      });
      // Fallback to no intent if parsing fails
      return {
        hasIntent: false,
        action: null,
        confidence: 0,
      };
    }

    // Validate and normalize the response
    const result: CalendarActionIntent = {
      hasIntent: parsedResponse.hasIntent === true,
      action: parsedResponse.hasIntent ? (parsedResponse.action || null) : null,
      confidence: parsedResponse.confidence || (parsedResponse.hasIntent ? 0.7 : 0),
      extractedDetails: parsedResponse.extractedDetails && Object.keys(parsedResponse.extractedDetails).length > 0
        ? parsedResponse.extractedDetails
        : undefined,
    };

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'AI intent detection failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('AI intent detection error', error instanceof Error ? error : undefined, {
      service: 'calendarActionDetectionService',
    });
    
    // Fallback to no intent on error
    return {
      hasIntent: false,
      action: null,
      confidence: 0,
    };
  }
}

/**
 * Match an event identifier to a specific calendar event using LLM
 * @param eventIdentifier - The event identifier from the user (e.g., "f.norbert event", "the meeting")
 * @param availableEvents - List of available calendar events to match against
 * @param llmProvider - LLM provider to use
 * @param llmModel - Optional LLM model override
 * @returns The matched CalendarEvent or null if no match found
 */
export async function matchEventByIdentifier(
  eventIdentifier: string,
  availableEvents: CalendarEvent[],
  llmProvider: 'gemini' | 'openai' | 'anthropic' | 'mistral' | 'custom' = 'gemini',
  llmModel?: string
): Promise<CalendarEvent | null> {
  if (!availableEvents || availableEvents.length === 0) {
    return null;
  }

  try {
    // For custom provider, use gemini as fallback for event matching
    const effectiveProvider = llmProvider === 'custom' ? 'gemini' : llmProvider;
    const llmService = createLLMService(effectiveProvider, llmModel);
    
    // Build event list for LLM
    const eventList = availableEvents.map((e, idx) => {
      const summary = e.summary || '(no title)';
      const start = e.start?.dateTime || e.start?.date || 'unknown time';
      const end = e.end?.dateTime || e.end?.date || 'unknown time';
      const location = e.location || '';
      return `${idx + 1}. "${summary}" (Start: ${start}, End: ${end}${location ? `, Location: ${location}` : ''})`;
    }).join('\n');
    
    const matchingPrompt = `You need to match a user's event identifier to one of the available calendar events.

User's event identifier: "${eventIdentifier}"

AVAILABLE CALENDAR EVENTS:
${eventList}

Your task:
1. Analyze the user's event identifier and understand what event they're referring to
2. Match it to one of the available events listed above
3. Consider variations, abbreviations, and natural language references (e.g., "f.norbert event" might match "F.Norbert", "the meeting" might match a specific meeting title)
4. Return the index number (1-based) of the matched event, or 0 if no match is found

You must respond with ONLY a valid JSON object in this exact format (no other text, no markdown):
{
  "matchedIndex": number (1-based index from the list above, or 0 if no match),
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of why this event was matched"
}

If no event matches, set matchedIndex to 0 and confidence to 0.`;

    const systemPrompt = `You are an event matching system. Match user-provided event identifiers to specific calendar events from a list. Use natural language understanding to handle variations and abbreviations.`;

    const llmResponse = await llmService.generateResponse(
      'event-matching', // chatbotId (not used for this purpose)
      systemPrompt,
      [],
      matchingPrompt
    );

    // Parse JSON response
    interface ParsedMatchResponse {
      matchedIndex?: number;
      confidence?: number;
      reasoning?: string;
    }
    let parsedResponse: ParsedMatchResponse;
    try {
      // Try to extract JSON from the response (in case LLM adds extra text)
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]) as ParsedMatchResponse;
      } else {
        parsedResponse = JSON.parse(llmResponse) as ParsedMatchResponse;
      }
    } catch (parseError) {
      logger.error('Failed to parse LLM event matching response as JSON', parseError instanceof Error ? parseError : undefined, {
        response: llmResponse,
        service: 'calendarActionDetectionService',
      });
      return null;
    }

    // Validate response
    const matchedIndex = parsedResponse.matchedIndex;
    const confidence = parsedResponse.confidence || 0;

    // Only return match if confidence is reasonable and index is valid
    if (matchedIndex !== undefined && confidence > 0.5 && matchedIndex > 0 && matchedIndex <= availableEvents.length) {
      const matchedEvent = availableEvents[matchedIndex - 1];
      logger.debug('LLM matched event', {
        eventIdentifier,
        matchedIndex,
        confidence,
        matchedEventSummary: matchedEvent.summary,
        reasoning: parsedResponse.reasoning,
        service: 'calendarActionDetectionService',
      });
      return matchedEvent;
    } else {
      logger.debug('LLM found no match', {
        eventIdentifier,
        matchedIndex,
        confidence,
        reasoning: parsedResponse.reasoning,
        service: 'calendarActionDetectionService',
      });
      return null;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'LLM event matching failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('LLM event matching error', error instanceof Error ? error : undefined, {
      service: 'calendarActionDetectionService',
    });
    return null;
  }
}
