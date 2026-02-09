import { ChatAnsweringResponse } from '../chatAnsweringService';
import { formatCitations } from './chatFormatter';
import { FollowUpSuggestion } from '../followUpGenerator';

/**
 * Format response for API interface
 */
export function formatApiResponse(response: ChatAnsweringResponse): {
  message: string;
  chatSessionId: string;
  citations: string;
  followUps?: FollowUpSuggestion[];
} {
  const citations = formatCitations(response.sources);
  const messageWithCitations = response.response + citations;

  return {
    message: messageWithCitations,
    chatSessionId: response.sessionId,
    citations,
    followUps: response.followUps,
  };
}
