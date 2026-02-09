import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectCalendarActionIntent,
  matchEventByIdentifier,
  CalendarActionIntent,
} from '../../services/calendarActionDetectionService';
import { CalendarEvent } from '../../services/calendarProviders/types';

// Mock llmService
const { mockLLMService, mockGenerateResponse } = vi.hoisted(() => {
  const mockGenerateResponseFn = vi.fn();
  const mockLLMService = {
    generateResponse: mockGenerateResponseFn,
  };
  return { mockLLMService, mockGenerateResponse: mockGenerateResponseFn };
});

vi.mock('../../services/llmService', () => ({
  createLLMService: vi.fn(() => mockLLMService),
}));

vi.mock('@shared/utils', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Calendar Action Detection Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectCalendarActionIntent', () => {
    it('should detect create intent with full details', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'create',
        confidence: 0.9,
        extractedDetails: {
          summary: 'Team Meeting',
          start: '2025-12-22T09:00:00Z',
          end: '2025-12-22T10:00:00Z',
          location: 'Conference Room A',
          attendees: ['john@example.com', 'jane@example.com'],
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Create a team meeting tomorrow at 9am',
        'I will create a team meeting for you.',
        'gemini'
      );

      expect(result.hasIntent).toBe(true);
      expect(result.action).toBe('create');
      expect(result.confidence).toBe(0.9);
      expect(result.extractedDetails?.summary).toBe('Team Meeting');
      expect(result.extractedDetails?.start).toBe('2025-12-22T09:00:00Z');
      expect(result.extractedDetails?.end).toBe('2025-12-22T10:00:00Z');
      expect(result.extractedDetails?.location).toBe('Conference Room A');
      expect(result.extractedDetails?.attendees).toEqual(['john@example.com', 'jane@example.com']);
    });

    it('should detect update intent', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'update',
        confidence: 0.85,
        extractedDetails: {
          summary: 'Team Meeting',
          start: '2025-12-22T10:00:00Z',
          eventId: 'Team Meeting',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Move the team meeting to 10am',
        'I will update the team meeting time.',
        'openai'
      );

      expect(result.hasIntent).toBe(true);
      expect(result.action).toBe('update');
      expect(result.confidence).toBe(0.85);
      expect(result.extractedDetails?.eventId).toBe('Team Meeting');
    });

    it('should detect delete intent', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'delete',
        confidence: 0.95,
        extractedDetails: {
          eventId: 'Team Meeting',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Cancel the team meeting',
        'I will cancel the team meeting for you.',
        'anthropic'
      );

      expect(result.hasIntent).toBe(true);
      expect(result.action).toBe('delete');
      expect(result.confidence).toBe(0.95);
      expect(result.extractedDetails?.eventId).toBe('Team Meeting');
    });

    it('should return no intent when user does not want calendar action', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: false,
        action: null,
        confidence: 0,
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'What is the weather today?',
        'The weather is sunny.',
        'mistral'
      );

      expect(result.hasIntent).toBe(false);
      expect(result.action).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.extractedDetails).toBeUndefined();
    });

    it('should include available events in prompt for update/delete operations', async () => {
      const availableEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: 'F.Norbert',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
        {
          id: 'event2',
          summary: 'Team Meeting',
          start: { dateTime: '2025-12-23T14:00:00Z' },
          end: { dateTime: '2025-12-23T15:00:00Z' },
        },
      ];

      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'update',
        confidence: 0.9,
        extractedDetails: {
          eventId: 'F.Norbert',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Update the f.norbert event',
        'I will update the F.Norbert event.',
        'gemini',
        undefined,
        availableEvents
      );

      expect(mockGenerateResponse).toHaveBeenCalled();
      const callArgs = mockGenerateResponse.mock.calls[0];
      const prompt = callArgs[3]; // 4th argument is the prompt
      expect(prompt).toContain('AVAILABLE CALENDAR EVENTS');
      expect(prompt).toContain('F.Norbert');
      expect(prompt).toContain('Team Meeting');
      expect(result.extractedDetails?.eventId).toBe('F.Norbert');
    });

    it('should handle available events with date only', async () => {
      const availableEvents: CalendarEvent[] = [
        {
          id: 'event1',
          summary: 'All Day Event',
          start: { date: '2025-12-22' },
          end: { date: '2025-12-22' },
        },
      ];

      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'delete',
        confidence: 0.9,
        extractedDetails: {
          eventId: 'All Day Event',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Delete the all day event',
        'I will delete it.',
        'gemini',
        undefined,
        availableEvents
      );

      expect(result.extractedDetails?.eventId).toBe('All Day Event');
    });

    it('should handle available events with no title', async () => {
      const availableEvents: CalendarEvent[] = [
        {
          id: 'event1',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      ];

      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'update',
        confidence: 0.8,
        extractedDetails: {
          eventId: '(no title)',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Update the event',
        'I will update it.',
        'gemini',
        undefined,
        availableEvents
      );

      expect(result.extractedDetails?.eventId).toBe('(no title)');
    });

    it('should extract JSON from markdown-wrapped response', async () => {
      const mockResponse = `Here is the JSON response:
\`\`\`json
{
  "hasIntent": true,
  "action": "create",
  "confidence": 0.9,
  "extractedDetails": {
    "summary": "Meeting"
  }
}
\`\`\``;

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.hasIntent).toBe(true);
      expect(result.action).toBe('create');
      expect(result.extractedDetails?.summary).toBe('Meeting');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockResponse = 'This is not valid JSON';

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const { logger } = await import('@shared/utils');

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.hasIntent).toBe(false);
      expect(result.action).toBeNull();
      expect(result.confidence).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse LLM response as JSON',
        expect.any(Error),
        expect.objectContaining({
          response: mockResponse,
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should handle missing hasIntent field', async () => {
      const mockResponse = JSON.stringify({
        action: 'create',
        confidence: 0.9,
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.hasIntent).toBe(false);
      expect(result.action).toBeNull();
    });

    it('should use default confidence when not provided', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'create',
        extractedDetails: {
          summary: 'Meeting',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.confidence).toBe(0.7); // Default for hasIntent: true
    });

    it('should use confidence 0 when hasIntent is false', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: false,
        action: null,
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'What is the weather?',
        'It is sunny.',
        'gemini'
      );

      expect(result.confidence).toBe(0);
    });

    it('should handle empty extractedDetails', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'create',
        confidence: 0.9,
        extractedDetails: {},
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.extractedDetails).toBeUndefined();
    });

    it('should include current date context in prompt', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'create',
        confidence: 0.9,
        extractedDetails: {
          summary: 'Meeting',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      await detectCalendarActionIntent(
        'Create a meeting next monday',
        'I will create it.',
        'gemini'
      );

      const callArgs = mockGenerateResponse.mock.calls[0];
      const prompt = callArgs[3];
      expect(prompt).toContain('CURRENT DATE CONTEXT');
      expect(prompt).toContain("Today's date:");
      expect(prompt).toContain('Current ISO date/time:');
    });

    it('should handle LLM service errors gracefully', async () => {
      const error = new Error('LLM service error');
      mockGenerateResponse.mockRejectedValue(error);

      const { logger } = await import('@shared/utils');

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.hasIntent).toBe(false);
      expect(result.action).toBeNull();
      expect(result.confidence).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'AI intent detection error',
        error,
        expect.objectContaining({
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockGenerateResponse.mockRejectedValue('String error');

      const { logger } = await import('@shared/utils');

      const result = await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'gemini'
      );

      expect(result.hasIntent).toBe(false);
      expect(result.action).toBeNull();
      expect(result.confidence).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'AI intent detection error',
        undefined,
        expect.objectContaining({
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should use custom LLM model when provided', async () => {
      const mockResponse = JSON.stringify({
        hasIntent: true,
        action: 'create',
        confidence: 0.9,
        extractedDetails: {
          summary: 'Meeting',
        },
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      await detectCalendarActionIntent(
        'Create a meeting',
        'I will create it.',
        'openai',
        'gpt-4'
      );

      const { createLLMService } = await import('../../services/llmService');
      expect(createLLMService).toHaveBeenCalledWith('openai', 'gpt-4');
    });
  });

  describe('matchEventByIdentifier', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'event1',
        summary: 'F.Norbert',
        start: { dateTime: '2025-12-22T09:00:00Z' },
        end: { dateTime: '2025-12-22T10:00:00Z' },
        location: 'Room A',
      },
      {
        id: 'event2',
        summary: 'Team Meeting',
        start: { dateTime: '2025-12-23T14:00:00Z' },
        end: { dateTime: '2025-12-23T15:00:00Z' },
      },
    ];

    it('should match event by identifier', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.95,
        reasoning: 'User is referring to F.Norbert event',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toEqual(mockEvents[0]);
      expect(result?.summary).toBe('F.Norbert');
    });

    it('should return null when no match found', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 0,
        confidence: 0,
        reasoning: 'No matching event found',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'nonexistent event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
    });

    it('should return null when confidence is too low', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.3, // Below 0.5 threshold
        reasoning: 'Low confidence match',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
    });

    it('should return null when matchedIndex is out of bounds', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 10, // Out of bounds
        confidence: 0.9,
        reasoning: 'Invalid index',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'some event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
    });

    it('should return null for empty events array', async () => {
      const result = await matchEventByIdentifier(
        'some event',
        [],
        'gemini'
      );

      expect(result).toBeNull();
      expect(mockGenerateResponse).not.toHaveBeenCalled();
    });

    it('should return null for null events array', async () => {
      const result = await matchEventByIdentifier(
        'some event',
        null as any,
        'gemini'
      );

      expect(result).toBeNull();
      expect(mockGenerateResponse).not.toHaveBeenCalled();
    });

    it('should handle events with date only', async () => {
      const eventsWithDateOnly: CalendarEvent[] = [
        {
          id: 'event1',
          summary: 'All Day Event',
          start: { date: '2025-12-22' },
          end: { date: '2025-12-22' },
        },
      ];

      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.9,
        reasoning: 'Matched all day event',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'all day event',
        eventsWithDateOnly,
        'gemini'
      );

      expect(result).toEqual(eventsWithDateOnly[0]);
    });

    it('should handle events with no location', async () => {
      const eventsWithoutLocation: CalendarEvent[] = [
        {
          id: 'event1',
          summary: 'Meeting',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      ];

      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.9,
        reasoning: 'Matched meeting',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'meeting',
        eventsWithoutLocation,
        'gemini'
      );

      expect(result).toEqual(eventsWithoutLocation[0]);
    });

    it('should handle events with no title', async () => {
      const eventsWithoutTitle: CalendarEvent[] = [
        {
          id: 'event1',
          start: { dateTime: '2025-12-22T09:00:00Z' },
          end: { dateTime: '2025-12-22T10:00:00Z' },
        },
      ];

      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.9,
        reasoning: 'Matched event',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'the event',
        eventsWithoutTitle,
        'gemini'
      );

      expect(result).toEqual(eventsWithoutTitle[0]);
    });

    it('should extract JSON from markdown-wrapped response', async () => {
      const mockResponse = `Here is the JSON:
\`\`\`json
{
  "matchedIndex": 2,
  "confidence": 0.9,
  "reasoning": "Matched team meeting"
}
\`\`\``;

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'team meeting',
        mockEvents,
        'gemini'
      );

      expect(result).toEqual(mockEvents[1]);
      expect(result?.summary).toBe('Team Meeting');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      const mockResponse = 'This is not valid JSON';

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const { logger } = await import('@shared/utils');

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse LLM event matching response as JSON',
        expect.any(Error),
        expect.objectContaining({
          response: mockResponse,
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should log debug when match is found', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.95,
        reasoning: 'User is referring to F.Norbert event',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const { logger } = await import('@shared/utils');

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).not.toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'LLM matched event',
        expect.objectContaining({
          eventIdentifier: 'f.norbert event',
          matchedIndex: 1,
          confidence: 0.95,
          matchedEventSummary: 'F.Norbert',
          reasoning: 'User is referring to F.Norbert event',
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should log debug when no match is found', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 0,
        confidence: 0.3,
        reasoning: 'No match found',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const { logger } = await import('@shared/utils');

      const result = await matchEventByIdentifier(
        'nonexistent event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'LLM found no match',
        expect.objectContaining({
          eventIdentifier: 'nonexistent event',
          matchedIndex: 0,
          confidence: 0.3,
          reasoning: 'No match found',
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should handle LLM service errors gracefully', async () => {
      const error = new Error('LLM service error');
      mockGenerateResponse.mockRejectedValue(error);

      const { logger } = await import('@shared/utils');

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'LLM event matching error',
        error,
        expect.objectContaining({
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockGenerateResponse.mockRejectedValue('String error');

      const { logger } = await import('@shared/utils');

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'LLM event matching error',
        undefined,
        expect.objectContaining({
          service: 'calendarActionDetectionService',
        })
      );
    });

    it('should use custom LLM model when provided', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 1,
        confidence: 0.9,
        reasoning: 'Matched',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'openai',
        'gpt-4'
      );

      const { createLLMService } = await import('../../services/llmService');
      expect(createLLMService).toHaveBeenCalledWith('openai', 'gpt-4');
    });

    it('should handle missing matchedIndex field', async () => {
      const mockResponse = JSON.stringify({
        confidence: 0.9,
        reasoning: 'Matched',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'f.norbert event',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
    });

    it('should handle matchedIndex of 0 (no match)', async () => {
      const mockResponse = JSON.stringify({
        matchedIndex: 0,
        confidence: 0.8,
        reasoning: 'No match',
      });

      mockGenerateResponse.mockResolvedValue(mockResponse);

      const result = await matchEventByIdentifier(
        'nonexistent',
        mockEvents,
        'gemini'
      );

      expect(result).toBeNull();
    });
  });
});
