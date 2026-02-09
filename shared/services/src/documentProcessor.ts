import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@shared/utils';
import { SemanticChunkingService, Chunk } from './semantic-chunking';

const docProcessorLogger = logger.child({ service: 'shared-services', component: 'documentProcessor' });

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProcessedDocument {
  text: string;
  summary: string;
  usage?: Usage;
  chunks: Chunk[];
  metadata: {
    title?: string;
    fileType?: string;
    [key: string]: any;
  };
}

export interface DocumentProcessingOptions {
  generateSummary?: boolean;
  summaryModelId?: string;
  chunkingOptions?: {
    contentType: 'document' | 'web' | 'code';
    [key: string]: any;
  };
}

export class DocumentProcessorService {
  private genAI: GoogleGenerativeAI | null = null;
  private semanticChunking: SemanticChunkingService;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.semanticChunking = new SemanticChunkingService();
  }

  /**
   * Parse PDF content
   */
  async parsePDF(buffer: Buffer): Promise<{ text: string; info?: any }> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return {
        text: data.text,
        info: data.info
      };
    } catch (error) {
      docProcessorLogger.error('Failed to parse PDF', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse PDF document');
    }
  }

  /**
   * Parse DOCX content
   */
  async parseDocx(buffer: Buffer): Promise<string> {
    try {
      // Dynamic require to handle optional dependency
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      docProcessorLogger.error('Failed to parse DOCX', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse Word document');
    }
  }

  /**
   * Parse Excel content
   */
  async parseExcel(buffer: Buffer): Promise<string> {
    try {
      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let text = '';
      
      workbook.SheetNames.forEach((sheetName: string) => {
        const worksheet = workbook.Sheets[sheetName];
        // Convert to CSV as an intermediate text format
        const sheetText = XLSX.utils.sheet_to_csv(worksheet);
        if (sheetText && sheetText.trim()) {
          text += `Sheet: ${sheetName}\n${sheetText}\n\n`;
        }
      });
      
      return text;
    } catch (error) {
      docProcessorLogger.error('Failed to parse Excel', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse Excel document');
    }
  }

  /**
   * Parse CSV content
   */
  async parseCsv(buffer: Buffer): Promise<string> {
    try {
      // For simple extraction, just treat as text.
      // If we wanted structured, we could use csv-parse.
      // But since we flatten to text anyway, decoding as UTF-8 is often enough.
      // However, let's use csv-parse to handle escaping correctly if we want cleaner output.
      // Actually, simple string conversion is usually fine for RAG unless it's very complex.
      // Let's assume standard CSV.
      return buffer.toString('utf-8');
    } catch (error) {
      docProcessorLogger.error('Failed to parse CSV', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse CSV document');
    }
  }

  /**
   * Parse PowerPoint content
   */
  async parsePptx(buffer: Buffer): Promise<string> {
    try {
      const officeParser = require('officeparser');
      return await officeParser.parseOfficeAsync(buffer);
    } catch (error) {
      docProcessorLogger.error('Failed to parse PowerPoint', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse PowerPoint document');
    }
  }

  /**
   * Parse OpenDocument content (ODT, ODS, ODP)
   */
  async parseOpenDocument(buffer: Buffer): Promise<string> {
    try {
      const officeParser = require('officeparser');
      return await officeParser.parseOfficeAsync(buffer);
    } catch (error) {
      docProcessorLogger.error('Failed to parse OpenDocument', { error: error instanceof Error ? error : new Error(String(error)) });
      throw new Error('Failed to parse OpenDocument file');
    }
  }

  /**
   * Generate summary for content using Gemini
   */
  async generateSummary(
    title: string,
    content: string,
    fileType: string = 'text/plain',
    modelId: string = 'gemini-3-flash-preview' // Updated default model
  ): Promise<{ summary: string; usage?: Usage }> {
    if (!this.genAI) {
      docProcessorLogger.warn('No Gemini API key provided, returning basic summary');
      return { summary: `Content from: ${title}` };
    }

    try {
      // Use provided model or default - check if modelId is empty string
      const effectiveModelId = modelId || 'gemini-3-flash-preview';
      const model = this.genAI.getGenerativeModel({ model: effectiveModelId });
      
      // Limit content length for summary (first 5000 chars)
      const contentPreview = content.substring(0, 5000);

      let prompt = '';

      // If no content available
      if (!content || content.trim().length === 0) {
        prompt = `Generate a brief 1-2 sentence summary of what this document might contain based on its title. Focus on likely topics and purpose.

Title: ${title}
File type: ${fileType}

Summary:`;
      } else {
        prompt = `Generate a brief 1-2 sentence summary of this document for semantic search purposes. Focus on key topics, purpose, and main content.

Title: ${title}
File type: ${fileType}
Content preview:
${contentPreview}

Summary:`;
      }

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text().trim();
      
      const usageMetadata = response.usageMetadata;
      const usage = usageMetadata ? {
        promptTokens: usageMetadata.promptTokenCount || 0,
        completionTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0
      } : undefined;

      return { 
        summary: summary || `Content from: ${title}`,
        usage
      };
    } catch (error) {
      docProcessorLogger.error('Error generating summary', { error: error instanceof Error ? error : new Error(String(error)) });
      return { summary: `Content from: ${title}` };
    }
  }

  /**
   * Process a document (parse, summarize, chunk)
   * This is the main entry point for processing documents
   */
  async processDocument(
    content: string | Buffer,
    fileName: string,
    mimeType: string,
    options: DocumentProcessingOptions = {}
  ): Promise<ProcessedDocument> {
    let text = '';
    let title = fileName;
    
    // Parse content based on type
    if (Buffer.isBuffer(content)) {
      if (mimeType === 'application/pdf') {
        const pdfData = await this.parsePDF(content);
        text = pdfData.text;
        if (pdfData.info && pdfData.info.Title) {
          title = pdfData.info.Title;
        }
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || mimeType === 'application/msword') {
        text = await this.parseDocx(content);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mimeType === 'application/vnd.ms-excel') {
        text = await this.parseExcel(content);
      } else if (mimeType === 'text/csv' || mimeType === 'application/csv') {
        text = await this.parseCsv(content);
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || mimeType === 'application/vnd.ms-powerpoint') {
        text = await this.parsePptx(content);
      } else if (
        mimeType === 'application/vnd.oasis.opendocument.text' || 
        mimeType === 'application/vnd.oasis.opendocument.spreadsheet' || 
        mimeType === 'application/vnd.oasis.opendocument.presentation'
      ) {
        text = await this.parseOpenDocument(content);
      } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
        // Handle text-based formats (txt, md, json, code, etc.)
        text = content.toString('utf-8');
      } else {
        // Fallback: try treating as text if we don't know the format but it was uploaded
        // This covers markdown (.md) if mimetype wasn't detected as text/markdown
        docProcessorLogger.warn(`Unknown mime type ${mimeType}, attempting to process as text`, { fileName });
        text = content.toString('utf-8');
      }
    } else if (typeof content === 'string') {
      text = content;
    }

    // Clean text (basic cleaning)
    text = this.cleanText(text);

    // Generate summary if requested (default true)
    let summary = '';
    let usage: Usage | undefined;
    
    if (options.generateSummary !== false) {
      const summaryResult = await this.generateSummary(title, text, mimeType, options.summaryModelId);
      summary = summaryResult.summary;
      usage = summaryResult.usage;
    }

    // Chunk content
    const chunkingType = options.chunkingOptions?.contentType || 'document';
    const chunkingOpts = SemanticChunkingService.getDefaultOptions(chunkingType);
    const chunks = await this.semanticChunking.chunkContent(text, {
      ...chunkingOpts,
      ...options.chunkingOptions
    });

    return {
      text,
      summary,
      usage,
      chunks,
      metadata: {
        title,
        fileType: mimeType
      }
    };
  }

  /**
   * Basic text cleaning
   */
  private cleanText(text: string): string {
    return text
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Fix broken newlines often found in PDFs
      .replace(/\n\s*\n/g, '\n\n')
      // Remove null bytes
      .replace(/\0/g, '')
      .trim();
  }
}
