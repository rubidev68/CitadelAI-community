/**
 * Convert text to markdown
 */
export function convertTextToMarkdown(text: string): string {
  // Basic text to markdown conversion
  // This is a simple implementation - you might want to use a more sophisticated library
  let markdown = text
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim()
    // Convert line breaks to markdown line breaks
    .replace(/\n\s*\n/g, '\n\n')
    // Basic heading detection (very simple)
    .replace(/^([A-Z][A-Z\s]+)$/gm, '# $1')
    // Convert bullet points
    .replace(/^[\s]*[-•]\s+/gm, '- ')
    // Convert numbered lists
    .replace(/^[\s]*(\d+\.)\s+/gm, '$1 ');

  return markdown;
}

/**
 * Split content into chunks
 */
export function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks = [];
  let currentChunk = '';
  
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxLength) {
      currentChunk += sentence + '. ';
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + '. ';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
