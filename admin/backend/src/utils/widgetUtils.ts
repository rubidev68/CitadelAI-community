import { Block } from '@prisma/client';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '@shared/utils';
import { config } from '../config';

const widgetUtilsLogger = logger.child({ service: 'admin-backend', component: 'widget-utils' });

// Types
export type Source = {
  type: 'website' | 'document';
  url?: string;
  title?: string;
  fileName?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
};

type WeaviateWebsiteContent = {
  url?: string;
  content?: string;
  title?: string;
  chatbotId?: string;
};

type WeaviateDocumentContent = {
  content?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
  fileName?: string;
  chatbotId?: string;
};

export interface WidgetSession {
  id: string;
  chatbotId: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: Source[];
  }>;
  createdAt: Date;
  lastActivity: Date;
}

// In-memory session store (can be replaced with Redis for production)
export const widgetSessions = new Map<string, WidgetSession>();

// Clean up old sessions (older than 24 hours)
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of widgetSessions.entries()) {
    const hoursSinceActivity = (now.getTime() - session.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActivity > 24) {
      widgetSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export async function getOrCreateWidgetSession(sessionId: string, chatbotId: string): Promise<WidgetSession> {
  if (widgetSessions.has(sessionId)) {
    const session = widgetSessions.get(sessionId)!;
    session.lastActivity = new Date();
    return session;
  }
  
  const newSession: WidgetSession = {
    id: sessionId,
    chatbotId,
    history: [],
    createdAt: new Date(),
    lastActivity: new Date()
  };
  
  widgetSessions.set(sessionId, newSession);
  return newSession;
}

// Rate limiting store (in-memory, can be replaced with Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Helper function to format citations
export function formatCitations(sources: Source[]): string {
  if (!sources || sources.length === 0) {
    return '';
  }

  const groupedSources: { [key: string]: Source[] } = {};
  
  sources.forEach((source: Source) => {
    let key: string;
    
    if (source.type === 'website') {
      key = `website:${source.url || source.title}`;
    } else if (source.type === 'document') {
      key = `document:${source.fileName || (source.title ? source.title.replace(/ \(Part \d+ of \d+\)$/, '') : 'unknown')}`;
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
      const pages = group.map(s => s.url).filter(Boolean);
      const uniquePages = [...new Set(pages)];
      const pageRefs = uniquePages.length > 1 ? ` (pages: ${uniquePages.length})` : '';
      return `${citationNumber}. [${source.title || 'Untitled'}](${source.url})${pageRefs}`;
    } else if (source.type === 'document') {
      const docName = source.fileName || (source.title ? source.title.replace(/ \(Part \d+ of \d+\)$/, '') : 'Unknown Document');
      const parts = group.map(s => (s.chunkIndex ?? 0) + 1).sort((a, b) => a - b);
      const partRefs = parts.length > 1 ? ` (pages: ${parts.join(', ')})` : ` (part ${parts[0]})`;
      return `${citationNumber}. ${docName}${partRefs}`;
    }
    return `${citationNumber}. ${source.title || 'Unknown source'}`;
  });

  return `\n\n**Sources:**\n${citations.join('\n')}`;
}

// Initialize Weaviate client
const WEAVIATE_URL = config.WEAVIATE_URL;
let client: WeaviateClient | null = null;
if (config.NODE_ENV !== 'test') {
  client = weaviate.client({
    scheme: 'http',
    host: WEAVIATE_URL.replace('http://', '').replace('https://', ''),
  });
}

// Helper function to get context from Weaviate
export async function getContextFromWeaviate(message: string, chatbotId: string): Promise<{ context: string; sources: Source[] }> {
  if (!client) {
    return { context: '', sources: [] };
  }
  
  try {
    // Get website content
    const websiteResponse = await client.graphql
      .get()
      .withClassName('WebsiteContent')
      .withFields('content url title chatbotId')
      .withBm25({ query: message })
      .withLimit(10)
      .do();

    // Get document content
    let documentResponse = { data: { Get: { DocumentContent: [] } } };
    try {
      documentResponse = await client.graphql
        .get()
        .withClassName('DocumentContent')
        .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId')
        .withBm25({ query: message })
        .withLimit(5)
        .do();
    } catch {
      // DocumentContent schema might not exist
    }

    const websiteContext = (websiteResponse.data.Get.WebsiteContent || [])
      .filter((item: WeaviateWebsiteContent) => item.chatbotId === chatbotId && item.content && item.content.length > 100)
      .slice(0, 10)
      .map((item: WeaviateWebsiteContent) => ({
        content: item.content || '',
        source: {
          type: 'website' as const,
          url: item.url,
          title: item.title || item.url || 'Website',
        },
      }));

    const documentContext = (documentResponse.data.Get.DocumentContent || [])
      .filter((item: WeaviateDocumentContent) => item.chatbotId === chatbotId && item.content && item.content.length > 100)
      .slice(0, 5)
      .map((item: WeaviateDocumentContent) => ({
        content: item.content || '',
        source: {
          type: 'document' as const,
          chunkIndex: item.chunkIndex,
          totalChunks: item.totalChunks,
          processedAt: item.processedAt,
          fileName: item.fileName || 'Document',
          title: item.fileName || 'Document',
        },
      }));

    const allContext = [...websiteContext, ...documentContext];
    const context = allContext.map(item => item.content).join('\n\n');
    const sources = allContext.map(item => item.source);

    return { context, sources };
  } catch (error) {
    widgetUtilsLogger.error('Error getting context from Weaviate', { error: error instanceof Error ? error : new Error(String(error)) });
    return { context: '', sources: [] };
  }
}

// Simplified system prompt generator
export function generateSystemPrompt(systemPromptBlock: Block | null, contextBlocks: Block[], context: string): string {
  // Get current date
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  if (!systemPromptBlock) {
    return `You are a helpful assistant.\n\nToday's date is: ${currentDate}\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.\n\nUse the following context to answer the user's question:\n\n${context}`;
  }

  const properties = systemPromptBlock.properties as Record<string, unknown>;
  const botName = String(properties.botName || 'Assistant');
  const companyName = String(properties.companyName || '');
  const behavior = String(properties.behavior || 'helpful');
  const additionalInstructions = String(properties.additionalInstructions || '');

  // If there's a manually set prompt, use it
  const manualPrompt = String(properties.prompt || '');
  if (manualPrompt && manualPrompt.length > 50) {
    return `${manualPrompt}\n\nToday's date is: ${currentDate}\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.\n\nUse the following context to answer the user's question:\n\n${context}`;
  }

  // Generate prompt from configuration
  let systemPrompt = `You are ${botName}`;
  
  if (companyName) {
    systemPrompt += `, an AI assistant for ${companyName}`;
  }
  
  systemPrompt += `. You are helpful, accurate, and professional.`;
  
  // Add current date
  systemPrompt += `\n\nToday's date is: ${currentDate}`;
  
  if (contextBlocks.length > 0) {
    systemPrompt += `\n\nYou have access to the following knowledge sources:`;
    contextBlocks.forEach((contextBlock) => {
      if (contextBlock.subtype === 'Website') {
        const url = (contextBlock.properties as Record<string, unknown>)?.url;
        systemPrompt += `\n- Website: ${url || 'Connected website'}`;
      } else if (contextBlock.subtype === 'Document') {
        const filename = (contextBlock.properties as Record<string, unknown>)?.filename;
        systemPrompt += `\n- Document: ${filename || 'Connected document'}`;
      }
    });
    systemPrompt += `\n\nUse this information to provide accurate and helpful responses. Always cite your sources when referencing specific information.`;
  }
  
  // Always add instruction to use newest knowledge (context can come from various sources)
  systemPrompt += `\n\nIMPORTANT: Always prioritize and use the newest, most up-to-date knowledge available. When multiple sources contain conflicting information, prefer the most recent information.`;
  
  if (additionalInstructions) {
    systemPrompt += `\n\nAdditional instructions: ${additionalInstructions}`;
  }
  
  return `${systemPrompt}\n\nUse the following context to answer the user's question:\n\n${context}`;
}
