import { describe, it, expect } from 'vitest';
import { formatApiResponse } from '../../../services/outputFormatters/apiFormatter';
import { ChatAnsweringResponse } from '../../../services/chatAnsweringService';
import { FollowUpSuggestion } from '../../../services/followUpGenerator';

describe('apiFormatter', () => {
  it('should format response with sources and follow-ups', () => {
    const response: ChatAnsweringResponse = {
      response: 'This is a test response',
      sources: [
        {
          type: 'website',
          url: 'https://example.com',
          title: 'Example',
        },
      ],
      followUps: [
        {
          id: 'followup-1',
          text: 'Tell me more',
          icon: 'info',
        },
      ],
      sessionId: 'session-123',
    };

    const result = formatApiResponse(response);

    expect(result.message).toContain('This is a test response');
    expect(result.message).toContain('**Sources:**');
    expect(result.message).toContain('[Example](https://example.com)');
    expect(result.chatSessionId).toBe('session-123');
    expect(result.citations).toContain('**Sources:**');
    expect(result.followUps).toEqual(response.followUps);
  });

  it('should format response without sources', () => {
    const response: ChatAnsweringResponse = {
      response: 'This is a test response',
      sources: [],
      followUps: [],
      sessionId: 'session-123',
    };

    const result = formatApiResponse(response);

    expect(result.message).toBe('This is a test response');
    expect(result.chatSessionId).toBe('session-123');
    expect(result.citations).toBe('');
    expect(result.followUps).toEqual([]);
  });

  it('should include followUps in response', () => {
    const followUps: FollowUpSuggestion[] = [
      {
        id: 'followup-1',
        text: 'Tell me more',
      },
      {
        id: 'followup-2',
        text: 'Show examples',
        icon: 'example',
      },
    ];

    const response: ChatAnsweringResponse = {
      response: 'Response',
      sources: [],
      followUps,
      sessionId: 'session-456',
    };

    const result = formatApiResponse(response);

    expect(result.followUps).toEqual(followUps);
    expect(result.followUps).toHaveLength(2);
  });

  it('should format response with document sources', () => {
    const response: ChatAnsweringResponse = {
      response: 'Response with document',
      sources: [
        {
          type: 'document',
          fileName: 'test.pdf',
          chunkIndex: 0,
        },
        {
          type: 'document',
          fileName: 'test.pdf',
          chunkIndex: 1,
        },
      ],
      followUps: [],
      sessionId: 'session-789',
    };

    const result = formatApiResponse(response);

    expect(result.message).toContain('Response with document');
    expect(result.citations).toContain('test.pdf');
    expect(result.citations).toContain('pages: 1, 2');
  });
});
