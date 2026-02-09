import { describe, it, expect } from 'vitest';
import {
  extractMermaidBlocks,
  removeMermaidBlocks,
  hasMermaidBlocks,
  MermaidBlock,
} from '../../utils/mermaidUtils';

describe('Mermaid Utils', () => {
  describe('extractMermaidBlocks', () => {
    it('should extract single Mermaid block', () => {
      const content = `
# Title
Some text here.

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`

More text.
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        code: 'graph TD\n    A[Start] --> B[End]',
        startIndex: expect.any(Number),
        endIndex: expect.any(Number),
      });
      expect(blocks[0].startIndex).toBeLessThan(blocks[0].endIndex);
    });

    it('should extract multiple Mermaid blocks', () => {
      const content = `
\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text.

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`

More text.

\`\`\`mermaid
flowchart LR
    Start --> End
\`\`\`
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(3);
      expect(blocks[0].code).toContain('graph TD');
      expect(blocks[1].code).toContain('sequenceDiagram');
      expect(blocks[2].code).toContain('flowchart LR');
    });

    it('should return empty array when no Mermaid blocks found', () => {
      const content = 'Just regular text with no mermaid diagrams.';

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toEqual([]);
    });

    it('should handle empty string', () => {
      const blocks = extractMermaidBlocks('');

      expect(blocks).toEqual([]);
    });

    it('should trim whitespace from code blocks', () => {
      const content = `
\`\`\`mermaid
    
    graph TD
        A --> B
    
\`\`\`
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('graph TD\n        A --> B');
      expect(blocks[0].code).not.toMatch(/^\s+/); // Should not start with whitespace
      expect(blocks[0].code).not.toMatch(/\s+$/); // Should not end with whitespace
    });

    it('should handle Mermaid blocks with newlines', () => {
      const content = `
\`\`\`mermaid
graph TD
    A[Node A]
    B[Node B]
    A --> B
\`\`\`
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain('graph TD');
      expect(blocks[0].code).toContain('A[Node A]');
      expect(blocks[0].code).toContain('B[Node B]');
      expect(blocks[0].code).toContain('A --> B');
    });

    it('should handle Mermaid blocks with special characters', () => {
      const content = `
\`\`\`mermaid
graph TD
    A["Node with 'quotes'"]
    B["Node with \\"escaped\\" quotes"]
    A --> B
\`\`\`
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain('Node with');
    });

    it('should correctly calculate start and end indices', () => {
      const content = 'Text before\n```mermaid\ngraph TD\nA --> B\n```\nText after';
      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].startIndex).toBeGreaterThanOrEqual(0);
      expect(blocks[0].endIndex).toBeGreaterThan(blocks[0].startIndex);
      expect(content.substring(blocks[0].startIndex, blocks[0].endIndex)).toContain('```mermaid');
    });

    it('should handle Mermaid blocks at start of content', () => {
      const content = '```mermaid\ngraph TD\nA --> B\n```\nText after';

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].startIndex).toBe(0);
    });

    it('should handle Mermaid blocks at end of content', () => {
      const content = 'Text before\n```mermaid\ngraph TD\nA --> B\n```';

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].endIndex).toBe(content.length);
    });

    it('should handle adjacent Mermaid blocks', () => {
      const content = '```mermaid\ngraph TD\nA --> B\n```\n```mermaid\nsequenceDiagram\nAlice->>Bob: Hi\n```';

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].endIndex).toBeLessThanOrEqual(blocks[1].startIndex);
    });

    it('should not match code blocks without mermaid language', () => {
      const content = `
\`\`\`javascript
console.log('not mermaid');
\`\`\`

\`\`\`mermaid
graph TD
    A --> B
\`\`\`
`;

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toContain('graph TD');
    });

    it('should handle Mermaid blocks with empty content', () => {
      const content = '```mermaid\n\n```';

      const blocks = extractMermaidBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].code).toBe('');
    });
  });

  describe('removeMermaidBlocks', () => {
    it('should remove single Mermaid block', () => {
      const content = `
# Title
Some text here.

\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`

More text.
`;

      const result = removeMermaidBlocks(content);

      expect(result).not.toContain('```mermaid');
      expect(result).not.toContain('graph TD');
      expect(result).toContain('# Title');
      expect(result).toContain('Some text here.');
      expect(result).toContain('More text.');
    });

    it('should remove multiple Mermaid blocks', () => {
      const content = `
\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text.

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`

More text.
`;

      const result = removeMermaidBlocks(content);

      expect(result).not.toContain('```mermaid');
      expect(result).not.toContain('graph TD');
      expect(result).not.toContain('sequenceDiagram');
      expect(result).toContain('Some text.');
      expect(result).toContain('More text.');
    });

    it('should return original content when no Mermaid blocks found', () => {
      const content = 'Just regular text with no mermaid diagrams.';

      const result = removeMermaidBlocks(content);

      expect(result).toBe(content);
    });

    it('should handle empty string', () => {
      const result = removeMermaidBlocks('');

      expect(result).toBe('');
    });

    it('should preserve content between blocks', () => {
      const content = 'Before\n```mermaid\ngraph TD\nA --> B\n```\nMiddle\n```mermaid\nsequenceDiagram\nAlice->>Bob: Hi\n```\nAfter';

      const result = removeMermaidBlocks(content);

      expect(result).toContain('Before');
      expect(result).toContain('Middle');
      expect(result).toContain('After');
      expect(result).not.toContain('```mermaid');
    });

    it('should handle Mermaid block at start', () => {
      const content = '```mermaid\ngraph TD\nA --> B\n```\nText after';

      const result = removeMermaidBlocks(content);

      // The replace removes the block, leaving the newline and text after
      expect(result).toBe('\nText after');
    });

    it('should handle Mermaid block at end', () => {
      const content = 'Text before\n```mermaid\ngraph TD\nA --> B\n```';

      const result = removeMermaidBlocks(content);

      expect(result).toBe('Text before\n');
    });

    it('should handle adjacent Mermaid blocks', () => {
      const content = '```mermaid\ngraph TD\nA --> B\n```\n```mermaid\nsequenceDiagram\nAlice->>Bob: Hi\n```';

      const result = removeMermaidBlocks(content);

      expect(result).toBe('\n');
    });

    it('should not remove non-mermaid code blocks', () => {
      const content = `
\`\`\`javascript
console.log('code');
\`\`\`

\`\`\`mermaid
graph TD
    A --> B
\`\`\`
`;

      const result = removeMermaidBlocks(content);

      expect(result).toContain('```javascript');
      expect(result).toContain("console.log('code')");
      expect(result).not.toContain('```mermaid');
    });
  });

  describe('hasMermaidBlocks', () => {
    it('should return true when Mermaid blocks exist', () => {
      const content = `
# Title
Some text.

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

More text.
`;

      expect(hasMermaidBlocks(content)).toBe(true);
    });

    it('should return false when no Mermaid blocks exist', () => {
      const content = 'Just regular text with no mermaid diagrams.';

      expect(hasMermaidBlocks(content)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(hasMermaidBlocks('')).toBe(false);
    });

    it('should return true for multiple Mermaid blocks', () => {
      const content = `
\`\`\`mermaid
graph TD
    A --> B
\`\`\`

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`
`;

      expect(hasMermaidBlocks(content)).toBe(true);
    });

    it('should return false for non-mermaid code blocks', () => {
      const content = `
\`\`\`javascript
console.log('code');
\`\`\`

\`\`\`python
print('hello')
\`\`\`
`;

      expect(hasMermaidBlocks(content)).toBe(false);
    });

    it('should return true even if block is empty', () => {
      const content = '```mermaid\n\n```';

      expect(hasMermaidBlocks(content)).toBe(true);
    });

    it('should handle Mermaid block with only whitespace', () => {
      const content = '```mermaid\n    \n```';

      expect(hasMermaidBlocks(content)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should work together: extract, check, and remove', () => {
      const content = `
# Document

Some text here.

\`\`\`mermaid
graph TD
    A[Start] --> B[Process] --> C[End]
\`\`\`

More content.

\`\`\`mermaid
sequenceDiagram
    User->>System: Request
    System-->>User: Response
\`\`\`

Final text.
`;

      // Check if has blocks
      expect(hasMermaidBlocks(content)).toBe(true);

      // Extract blocks
      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].code).toContain('graph TD');
      expect(blocks[1].code).toContain('sequenceDiagram');

      // Remove blocks
      const withoutBlocks = removeMermaidBlocks(content);
      expect(hasMermaidBlocks(withoutBlocks)).toBe(false);
      expect(withoutBlocks).toContain('# Document');
      expect(withoutBlocks).toContain('Some text here.');
      expect(withoutBlocks).toContain('More content.');
      expect(withoutBlocks).toContain('Final text.');
      expect(withoutBlocks).not.toContain('```mermaid');
    });

    it('should handle complex markdown with Mermaid', () => {
      const content = `
# Title

Paragraph with **bold** and *italic* text.

\`\`\`mermaid
flowchart LR
    Start([Start]) --> Decision{Decision?}
    Decision -->|Yes| Process1[Process 1]
    Decision -->|No| Process2[Process 2]
    Process1 --> End([End])
    Process2 --> End
\`\`\`

## Subtitle

- List item 1
- List item 2

\`\`\`mermaid
pie title Distribution
    "A" : 40
    "B" : 30
    "C" : 20
    "D" : 10
\`\`\`

Final paragraph.
`;

      expect(hasMermaidBlocks(content)).toBe(true);

      const blocks = extractMermaidBlocks(content);
      expect(blocks).toHaveLength(2);

      const withoutBlocks = removeMermaidBlocks(content);
      expect(hasMermaidBlocks(withoutBlocks)).toBe(false);
      expect(withoutBlocks).toContain('# Title');
      expect(withoutBlocks).toContain('Paragraph with');
      expect(withoutBlocks).toContain('## Subtitle');
      expect(withoutBlocks).toContain('List item');
      expect(withoutBlocks).toContain('Final paragraph');
    });
  });
});
