/**
 * Semantic Chunking Service
 * 
 * This service provides intelligent content chunking that respects semantic boundaries
 * rather than using fixed character limits. It analyzes content structure, meaning,
 * and context to create more meaningful chunks for vector storage.
 */

import { LocalEmbeddings } from './localEmbeddings';
import { logger } from '@shared/utils';

const semanticChunkingLogger = logger.child({ service: 'shared-services', component: 'semanticChunking' });

export interface ChunkingOptions {
  maxChunkSize: number;
  minChunkSize: number;
  overlapSize: number;
  respectSentenceBoundaries: boolean;
  respectParagraphBoundaries: boolean;
  respectHeadingBoundaries: boolean;
  useSemanticSimilarity: boolean;
  similarityThreshold: number;
}

export interface Chunk {
  content: string;
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    chunkType: 'paragraph' | 'heading' | 'list' | 'code' | 'mixed';
    semanticScore?: number;
    parentHeading?: string;
    wordCount: number;
    charCount: number;
  };
}

export interface ContentStructure {
  headings: Array<{ level: number; text: string; position: number }>;
  paragraphs: Array<{ text: string; position: number; wordCount: number }>;
  lists: Array<{ items: string[]; position: number; type: 'ordered' | 'unordered' }>;
  codeBlocks: Array<{ content: string; position: number; language?: string }>;
}

export class SemanticChunkingService {
  private embeddings: LocalEmbeddings | null = null;
  private defaultOptions: ChunkingOptions = {
    maxChunkSize: 2000,
    minChunkSize: 200,
    overlapSize: 100,
    respectSentenceBoundaries: true,
    respectParagraphBoundaries: true,
    respectHeadingBoundaries: true,
    useSemanticSimilarity: true,
    similarityThreshold: 0.7
  };

  constructor(_apiKey?: string) {
    // Don't initialize embeddings immediately - lazy load when needed
  }

  /**
   * Get or create embeddings instance
   */
  private getEmbeddings(): LocalEmbeddings | null {
    if (!this.embeddings) {
      try {
        this.embeddings = new LocalEmbeddings();
      } catch (error) {
        semanticChunkingLogger.warn('Failed to initialize Local embeddings', { error: error instanceof Error ? error : new Error(String(error)) });
        return null;
      }
    }
    return this.embeddings;
  }

  /**
   * Main method to chunk content semantically
   */
  async chunkContent(
    content: string, 
    options: Partial<ChunkingOptions> = {}
  ): Promise<Chunk[]> {
    const opts = { ...this.defaultOptions, ...options };
    
    // Step 1: Analyze content structure
    const structure = this.analyzeContentStructure(content);
    
    // Step 2: Create initial chunks based on structure
    let chunks = this.createStructuralChunks(content, structure, opts);
    
    // Step 3: Refine chunks based on size constraints
    chunks = this.refineChunksBySize(chunks, opts);
    
    // Step 4: Apply semantic similarity-based merging/splitting
    if (opts.useSemanticSimilarity) {
      chunks = await this.applySemanticRefinement(chunks, opts);
    }
    
    // Step 5: Add overlap between chunks
    chunks = this.addChunkOverlap(chunks, opts);
    
    // Step 6: Finalize metadata
    chunks = this.finalizeChunkMetadata(chunks);
    
    return chunks;
  }

  /**
   * Analyze the structure of the content to identify semantic boundaries
   */
  private analyzeContentStructure(content: string): ContentStructure {
    const lines = content.split('\n');
    const structure: ContentStructure = {
      headings: [],
      paragraphs: [],
      lists: [],
      codeBlocks: []
    };

    let inCodeBlock = false;
    let currentCodeBlock: string[] = [];
    let codeBlockLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          structure.codeBlocks.push({
            content: currentCodeBlock.join('\n'),
            position: i - currentCodeBlock.length,
            language: codeBlockLanguage
          });
          currentCodeBlock = [];
          codeBlockLanguage = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          codeBlockLanguage = trimmedLine.slice(3).trim();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        currentCodeBlock.push(line);
        continue;
      }

      // Detect headings
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        structure.headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          position: i
        });
        continue;
      }

      // Detect lists
      const listMatch = trimmedLine.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (listMatch) {
        const existingList = structure.lists.find(list => 
          Math.abs(list.position - i) <= 2
        );
        
        if (existingList) {
          existingList.items.push(listMatch[3].trim());
        } else {
          structure.lists.push({
            items: [listMatch[3].trim()],
            position: i,
            type: /^\d+\./.test(listMatch[2]) ? 'ordered' : 'unordered'
          });
        }
        continue;
      }

      // Detect paragraphs (non-empty lines that aren't headings, lists, or code)
      if (trimmedLine.length > 0) {
        const existingParagraph = structure.paragraphs.find(p => 
          Math.abs(p.position - i) <= 1
        );
        
        if (existingParagraph) {
          existingParagraph.text += ' ' + trimmedLine;
          existingParagraph.wordCount = existingParagraph.text.split(/\s+/).length;
        } else {
          structure.paragraphs.push({
            text: trimmedLine,
            position: i,
            wordCount: trimmedLine.split(/\s+/).length
          });
        }
      }
    }

    return structure;
  }

  /**
   * Create initial chunks based on content structure
   */
  private createStructuralChunks(
    content: string, 
    structure: ContentStructure, 
    options: ChunkingOptions
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = content.split('\n');
    let chunkIndex = 0;

    // Group content by headings
    const headingGroups = this.groupContentByHeadings(structure, lines);

    for (const group of headingGroups) {
      const groupContent = group.content.join('\n').trim();
      
      if (groupContent.length === 0) continue;

      // Determine chunk type
      const chunkType = this.determineChunkType(group, structure);

      // If group is too large, split it further
      if (groupContent.length > options.maxChunkSize) {
        const subChunks = this.splitLargeGroup(groupContent, group, options);
        chunks.push(...subChunks.map((chunk) => ({
          content: chunk,
          metadata: {
            chunkIndex: chunkIndex++,
            totalChunks: 0, // Will be updated later
            chunkType,
            parentHeading: group.heading?.text,
            wordCount: chunk.split(/\s+/).length,
            charCount: chunk.length
          }
        })));
      } else {
        chunks.push({
          content: groupContent,
          metadata: {
            chunkIndex: chunkIndex++,
            totalChunks: 0, // Will be updated later
            chunkType,
            parentHeading: group.heading?.text,
            wordCount: groupContent.split(/\s+/).length,
            charCount: groupContent.length
          }
        });
      }
    }

    return chunks;
  }

  /**
   * Group content by headings to maintain semantic coherence
   */
  private groupContentByHeadings(structure: ContentStructure, lines: string[]): Array<{
    heading?: { level: number; text: string; position: number };
    content: string[];
    startLine: number;
    endLine: number;
  }> {
    const groups: Array<{
      heading?: { level: number; text: string; position: number };
      content: string[];
      startLine: number;
      endLine: number;
    }> = [];

    let currentGroup: {
      heading?: { level: number; text: string; position: number };
      content: string[];
      startLine: number;
      endLine: number;
    } = {
      content: [],
      startLine: 0,
      endLine: 0
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this line is a heading
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous group if it has content
        if (currentGroup.content.length > 0) {
          currentGroup.endLine = i - 1;
          groups.push({ ...currentGroup });
        }

        // Start new group with this heading
        currentGroup = {
          heading: {
            level: headingMatch[1].length,
            text: headingMatch[2].trim(),
            position: i
          },
          content: [line],
          startLine: i,
          endLine: i
        };
      } else {
        // Add line to current group
        currentGroup.content.push(line);
        currentGroup.endLine = i;
      }
    }

    // Add the last group
    if (currentGroup.content.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Determine the type of chunk based on its content
   */
  private determineChunkType(
    group: { heading?: { level: number; text: string; position: number }; content: string[] },
    _structure: ContentStructure
  ): 'paragraph' | 'heading' | 'list' | 'code' | 'mixed' {
    const content = group.content.join('\n');
    
    // Check for code blocks
    if (content.includes('```') || content.match(/^\s*[{}[\]]/m)) {
      return 'code';
    }
    
    // Check for lists
    const listLines = content.split('\n').filter(line => 
      line.trim().match(/^(\s*)([-*+]|\d+\.)\s+/)
    );
    if (listLines.length > content.split('\n').length * 0.5) {
      return 'list';
    }
    
    // Check for headings
    if (group.heading) {
      return 'heading';
    }
    
    // Check for mixed content
    const hasMultipleTypes = [
      content.includes('```'),
      content.match(/^(\s*)([-*+]|\d+\.)\s+/m),
      content.match(/^#{1,6}\s+/m)
    ].filter(Boolean).length > 1;
    
    return hasMultipleTypes ? 'mixed' : 'paragraph';
  }

  /**
   * Split large content groups into smaller chunks
   */
  private splitLargeGroup(
    content: string, 
    group: { heading?: { level: number; text: string; position: number }; content: string[] },
    options: ChunkingOptions
  ): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (trimmedParagraph.length === 0) continue;
      
      // If adding this paragraph would exceed max size, start a new chunk
      if (currentChunk.length + trimmedParagraph.length > options.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedParagraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Refine chunks based on size constraints
   */
  private refineChunksBySize(chunks: Chunk[], options: ChunkingOptions): Chunk[] {
    const refinedChunks: Chunk[] = [];
    
    for (const chunk of chunks) {
      if (chunk.content.length <= options.maxChunkSize) {
        refinedChunks.push(chunk);
        continue;
      }
      
      // Split oversized chunks
      const subChunks = this.splitOversizedChunk(chunk, options);
      refinedChunks.push(...subChunks);
    }
    
    return refinedChunks;
  }

  /**
   * Split chunks that exceed the maximum size
   */
  private splitOversizedChunk(chunk: Chunk, options: ChunkingOptions): Chunk[] {
    const chunks: Chunk[] = [];
    const sentences = chunk.content.split(/[.!?]+/);
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      
      const sentenceWithPunctuation = trimmedSentence + '.';
      
      if (currentChunk.length + sentenceWithPunctuation.length > options.maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            ...chunk.metadata,
            chunkIndex: chunk.metadata.chunkIndex + chunkIndex++,
            wordCount: currentChunk.split(/\s+/).length,
            charCount: currentChunk.length
          }
        });
        currentChunk = sentenceWithPunctuation;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
      }
    }
    
    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          ...chunk.metadata,
          chunkIndex: chunk.metadata.chunkIndex + chunkIndex,
          wordCount: currentChunk.split(/\s+/).length,
          charCount: currentChunk.length
        }
      });
    }
    
    return chunks;
  }

  /**
   * Apply semantic similarity-based refinement
   */
  private async applySemanticRefinement(chunks: Chunk[], options: ChunkingOptions): Promise<Chunk[]> {
    if (chunks.length < 2) return chunks;
    
    const refinedChunks: Chunk[] = [];
    let i = 0;
    
    while (i < chunks.length) {
      const currentChunk = chunks[i];
      let mergedChunk = { ...currentChunk };
      let j = i + 1;
      
      // Try to merge with subsequent chunks if they're semantically similar
      while (j < chunks.length) {
        const nextChunk = chunks[j];
        
        // Check if merging would exceed max size
        const mergedContent = mergedChunk.content + '\n\n' + nextChunk.content;
        if (mergedContent.length > options.maxChunkSize) {
          break;
        }
        
        // Check semantic similarity
        const similarity = await this.calculateSemanticSimilarity(
          mergedChunk.content, 
          nextChunk.content
        );
        
        if (similarity >= options.similarityThreshold) {
          // Merge chunks
          mergedChunk = {
            content: mergedContent,
            metadata: {
              ...mergedChunk.metadata,
              chunkType: 'mixed',
              wordCount: mergedContent.split(/\s+/).length,
              charCount: mergedContent.length,
              semanticScore: similarity
            }
          };
          j++;
        } else {
          break;
        }
      }
      
      refinedChunks.push(mergedChunk);
      i = j;
    }
    
    return refinedChunks;
  }

  /**
   * Calculate semantic similarity between two text chunks
   */
  private async calculateSemanticSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const embeddings = this.getEmbeddings();
      if (!embeddings) {
        semanticChunkingLogger.warn('Embeddings not available, skipping semantic similarity calculation');
        return 0;
      }

      const [embedding1, embedding2] = await Promise.all([
        embeddings.embedQuery(text1),
        embeddings.embedQuery(text2)
      ]);
      
      // Calculate cosine similarity
      const dotProduct = embedding1.reduce((sum: number, val: number, i: number) => sum + val * embedding2[i], 0);
      const magnitude1 = Math.sqrt(embedding1.reduce((sum: number, val: number) => sum + val * val, 0));
      const magnitude2 = Math.sqrt(embedding2.reduce((sum: number, val: number) => sum + val * val, 0));
      
      return dotProduct / (magnitude1 * magnitude2);
    } catch (error) {
      semanticChunkingLogger.warn('Failed to calculate semantic similarity', { error: error instanceof Error ? error : new Error(String(error)) });
      return 0;
    }
  }

  /**
   * Add overlap between chunks to maintain context
   */
  private addChunkOverlap(chunks: Chunk[], options: ChunkingOptions): Chunk[] {
    if (chunks.length < 2 || options.overlapSize <= 0) return chunks;
    
    const overlappedChunks: Chunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let content = chunk.content;
      
      // Add overlap from previous chunk
      if (i > 0) {
        const prevChunk = chunks[i - 1];
        const prevOverlap = this.extractOverlap(prevChunk.content, options.overlapSize);
        if (prevOverlap) {
          content = prevOverlap + '\n\n' + content;
        }
      }
      
      // Add overlap to next chunk
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const nextOverlap = this.extractOverlap(nextChunk.content, options.overlapSize);
        if (nextOverlap) {
          content = content + '\n\n' + nextOverlap;
        }
      }
      
      overlappedChunks.push({
        ...chunk,
        content,
        metadata: {
          ...chunk.metadata,
          wordCount: content.split(/\s+/).length,
          charCount: content.length
        }
      });
    }
    
    return overlappedChunks;
  }

  /**
   * Extract overlap text from a chunk
   */
  private extractOverlap(content: string, overlapSize: number): string {
    if (content.length <= overlapSize) return content;
    
    // Try to find a good sentence boundary for overlap
    const sentences = content.split(/[.!?]+/);
    let overlap = '';
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i].trim();
      if (sentence.length === 0) continue;
      
      const candidateOverlap = (overlap ? sentence + '. ' + overlap : sentence + '.');
      if (candidateOverlap.length <= overlapSize) {
        overlap = candidateOverlap;
      } else {
        break;
      }
    }
    
    return overlap || content.slice(-overlapSize);
  }

  /**
   * Finalize chunk metadata
   */
  private finalizeChunkMetadata(chunks: Chunk[]): Chunk[] {
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        totalChunks: chunks.length
      }
    }));
  }

  /**
   * Get default chunking options for different content types
   */
  static getDefaultOptions(contentType: 'document' | 'web' | 'code'): ChunkingOptions {
    const baseOptions: ChunkingOptions = {
      maxChunkSize: 2000,
      minChunkSize: 200,
      overlapSize: 100,
      respectSentenceBoundaries: true,
      respectParagraphBoundaries: true,
      respectHeadingBoundaries: true,
      useSemanticSimilarity: true,
      similarityThreshold: 0.7
    };

    switch (contentType) {
      case 'document':
        return {
          ...baseOptions,
          maxChunkSize: 1500,
          minChunkSize: 300,
          overlapSize: 150,
          respectHeadingBoundaries: true
        };
      
      case 'web':
        return {
          ...baseOptions,
          maxChunkSize: 2000,
          minChunkSize: 200,
          overlapSize: 100,
          respectHeadingBoundaries: true
        };
      
      case 'code':
        return {
          ...baseOptions,
          maxChunkSize: 3000,
          minChunkSize: 500,
          overlapSize: 200,
          respectHeadingBoundaries: false,
          respectParagraphBoundaries: false
        };
      
      default:
        return baseOptions;
    }
  }
}

export default SemanticChunkingService;
