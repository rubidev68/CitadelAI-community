import { ChatAnsweringResponse } from '../chatAnsweringService';
import { Source } from '../contextRetrievalService';
import { formatCitations } from './chatFormatter';
import { FollowUpSuggestion } from '../followUpGenerator';

/**
 * Format response for bubble/widget interface
 */
export function formatBubbleResponse(response: ChatAnsweringResponse): {
  fullResponse: string;
  sources: string;
  sourcesArray: Source[];
  followUps: FollowUpSuggestion[];
} {
  const citations = formatCitations(response.sources);

  return {
    fullResponse: response.response,
    sources: citations,
    sourcesArray: response.sources,
    followUps: response.followUps,
  };
}
