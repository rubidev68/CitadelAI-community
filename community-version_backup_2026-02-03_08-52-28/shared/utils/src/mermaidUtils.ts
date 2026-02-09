/**
 * Utility functions for handling Mermaid diagrams
 */

export interface MermaidBlock {
  code: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Extract all Mermaid code blocks from a markdown string
 */
export function extractMermaidBlocks(content: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  
  let match;
  while ((match = mermaidRegex.exec(content)) !== null) {
    blocks.push({
      code: match[1].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }
  
  return blocks;
}

/**
 * Remove Mermaid code blocks from content
 */
export function removeMermaidBlocks(content: string): string {
  return content.replace(/```mermaid\n[\s\S]*?```/g, '');
}

/**
 * Check if content contains Mermaid diagrams
 */
export function hasMermaidBlocks(content: string): boolean {
  return /```mermaid\n[\s\S]*?```/g.test(content);
}
