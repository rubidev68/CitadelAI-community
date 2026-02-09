import { describe, it, expect } from 'vitest';
import { formatBubbleResponse } from '../../../services/outputFormatters/bubbleFormatter';
import { ChatAnsweringResponse } from '../../../services/chatAnsweringService';
import { FollowUpSuggestion } from '../../../services/followUpGenerator';
import { Source } from '../../../services/contextRetrievalService';

describe('bubbleFormatter', () => {
  it('should format response with sources and follow-ups', () => {
    const sources: Source[] = [
      {
        type: 'website',
        url: 'https://example.com',
        title: 'Example',
      },
    ];

    const response: ChatAnsweringResponse = {
      response: 'This is a test response',
      sources,
      followUps: [
        {
          id: 'followup-1',
          text: 'Tell me more',
          icon: 'info',
        },
      ],
      sessionId: 'session-123',
    };

    const result = formatBubbleResponse(response);

    expect(result.fullResponse).toBe('This is a test response');
    expect(result.sources).toContain('**Sources:**');
    expect(result.sources).toContain('[Example](https://example.com)');
    expect(result.sourcesArray).toEqual(sources);
    expect(result.followUps).toEqual(response.followUps);
  });

  it('should format response without sources', () => {
    const response: ChatAnsweringResponse = {
      response: 'This is a test response',
      sources: [],
      followUps: [],
      sessionId: 'session-123',
    };

    const result = formatBubbleResponse(response);

    expect(result.fullResponse).toBe('This is a test response');
    expect(result.sources).toBe('');
    expect(result.sourcesArray).toEqual([]);
    expect(result.followUps).toEqual([]);
  });

  it('should include all sources in sourcesArray', () => {
    const sources: Source[] = [
      {
        type: 'website',
        url: 'https://example.com',
        title: 'Example',
      },
      {
        type: 'document',
        fileName: 'test.pdf',
        chunkIndex: 0,
      },
      {
        type: 'database',
        title: 'Users Table',
      },
    ];

    const response: ChatAnsweringResponse = {
      response: 'Response',
      sources,
      followUps: [],
      sessionId: 'session-456',
    };

    const result = formatBubbleResponse(response);

    expect(result.sourcesArray).toEqual(sources);
    expect(result.sourcesArray).toHaveLength(3);
  });

  it('should format response with multiple follow-ups', () => {
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
      sessionId: 'session-789',
    };

    const result = formatBubbleResponse(response);

    expect(result.followUps).toEqual(followUps);
    expect(result.followUps).toHaveLength(2);
  });
});
