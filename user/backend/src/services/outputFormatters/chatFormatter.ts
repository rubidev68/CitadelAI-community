import { ChatAnsweringResponse } from '../chatAnsweringService';
import { Source } from '../contextRetrievalService';
import { FollowUpSuggestion } from '../followUpGenerator';

/**
 * Format citations from sources
 */
export function formatCitations(sources: Source[]): string {
  if (!sources || sources.length === 0) {
    return '';
  }

  // Group sources by type and key
  const groupedSources: { [key: string]: Source[] } = {};
  
  sources.forEach((source: Source) => {
    let key: string;
    
    if (source.type === 'website') {
      key = `website:${source.url || source.title}`;
    } else if (source.type === 'document') {
      key = `document:${source.fileName || (source.title ? source.title.replace(/ \(Part \d+ of \d+\)$/, '') : 'unknown')}`;
    } else if (source.type === 'database') {
      key = `database:${source.blockId || source.title || 'unknown'}`;
    } else if (source.type === 'calendar') {
      key = `calendar:${source.blockId || source.title || 'unknown'}`;
    } else if (source.type === 'cloud') {
      // Group cloud sources by file path to avoid duplicates
      key = `cloud:${source.url || source.title || 'unknown'}`;
    } else {
      key = `other:${source.title || 'unknown'}`;
    }
    
    if (!groupedSources[key]) {
      groupedSources[key] = [];
    }
    groupedSources[key].push(source);
  });

  const citations = Object.values(groupedSources).map((group: Source[], index: number) => {
    const citationNumber = index + 1;
    const source = group[0];
    
    if (source.type === 'website') {
      const pageRefs = group.length > 1 ? ` (pages: ${group.length})` : '';
      return `${citationNumber}. [${source.title || 'Untitled'}](${source.url})${pageRefs}`;
    } else if (source.type === 'document') {
      const docName = source.fileName || (source.title ? source.title.replace(/ \(Part \d+ of \d+\)$/, '') : 'Unknown Document');
      const parts = group.map(s => (s.chunkIndex ?? 0) + 1).sort((a, b) => a - b);
      const partRefs = parts.length > 1 ? ` (pages: ${parts.join(', ')})` : ` (part ${parts[0]})`;
      return `${citationNumber}. ${docName}${partRefs}`;
    } else if (source.type === 'database') {
      return `${citationNumber}. ${source.title || 'Database'}`;
    } else if (source.type === 'calendar') {
      return `${citationNumber}. ${source.title || 'Calendar'}`;
    } else if (source.type === 'cloud') {
      // Cloud sources: show file name (title is the fileName from Weaviate)
      const fileName = source.title || 'Cloud File';
      const filePath = source.url || '';
      // For Google Drive, filePath might be a file ID, so don't show it if it looks like an ID
      // Only show filePath if it looks like an actual path (contains slashes)
      const isPath = filePath && filePath.includes('/');
      return `${citationNumber}. ${fileName}${isPath ? ` (${filePath})` : ''}`;
    }
    return `${citationNumber}. ${source.title || 'Unknown source'}`;
  });

  return `\n\n**Sources:**\n${citations.join('\n')}`;
}

/**
 * Format response for standard chat interface
 */
export function formatChatResponse(response: ChatAnsweringResponse): {
  message: string;
  followUps: FollowUpSuggestion[];
  chatSessionId: string;
  citations: string;
} {
  const citations = formatCitations(response.sources);
  const messageWithCitations = response.response + citations;

  return {
    message: messageWithCitations,
    followUps: response.followUps, // Send full FollowUpSuggestion objects with id, text, icon
    chatSessionId: response.sessionId,
    citations,
  };
}
