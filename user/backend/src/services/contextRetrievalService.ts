import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { logger } from '@shared/utils';
import { config } from '../config';

// Types for Weaviate responses
type WeaviateSchema = {
  class?: string;
};

type WeaviateWebsiteContent = {
  url?: string;
  content?: string;
  title?: string;
  chatbotId?: string;
  blockId?: string;
};

type WeaviateDocumentContent = {
  content?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
  fileName?: string;
  chatbotId?: string;
  blockId?: string;
};

export type Source = {
  type: 'website' | 'document' | 'database' | 'calendar' | 'cloud';
  url?: string;
  title?: string;
  fileName?: string;
  chunkIndex?: number;
  totalChunks?: number;
  processedAt?: string;
  blockId?: string;
};

export type ContextItem = {
  content: string;
  source: Source;
};

export type ContextRetrievalResult = {
  context: string;
  sources: Source[];
};

// Initialize Weaviate client only if not in test environment
let client: WeaviateClient | null = null;
if (config.NODE_ENV !== 'test') {
  const weaviateHost = config.WEAVIATE_URL.replace('http://', '').replace('https://', '');
  client = weaviate.client({
    scheme: 'http',
    host: weaviateHost,
    apiKey: config.WEAVIATE_API_KEY ? new weaviate.ApiKey(config.WEAVIATE_API_KEY) : undefined,
  });
}

// Helper function to check if DocumentContent schema exists
const ensureDocumentContentSchema = async (): Promise<boolean> => {
  if (!client) {
    return false; // Skip schema check in test environment
  }
  
  try {
    const existingSchemas = await client.schema.getter().do();
    const documentContentExists = existingSchemas.classes?.some(
      (schema: WeaviateSchema) => schema.class === 'DocumentContent'
    );
    
    if (documentContentExists) {
      return true;
    }
    
    // Create the schema if it doesn't exist
    const schemaConfig = {
      class: 'DocumentContent',
      vectorizer: 'text2vec-transformers',
      properties: [
        {
          name: 'chatbotId',
          dataType: ['string'],
        },
        {
          name: 'blockId',
          dataType: ['string'],
        },
        {
          name: 'content',
          dataType: ['text'],
        },
        {
          name: 'type',
          dataType: ['string'],
        },
        {
          name: 'chunkIndex',
          dataType: ['int'],
        },
        {
          name: 'totalChunks',
          dataType: ['int'],
        },
        {
          name: 'processedAt',
          dataType: ['date'],
        },
        {
          name: 'fileName',
          dataType: ['string'],
        },
        {
          name: 'chunkType',
          dataType: ['string'],
        },
        {
          name: 'parentHeading',
          dataType: ['string'],
        },
        {
          name: 'wordCount',
          dataType: ['int'],
        },
        {
          name: 'charCount',
          dataType: ['int'],
        },
        {
          name: 'semanticScore',
          dataType: ['number'],
        },
      ],
    };
    
    await client.schema.classCreator().withClass(schemaConfig).do();
    logger.info('DocumentContent schema created successfully', {
      service: 'contextRetrievalService',
    });
    return true;
  } catch (error: unknown) {
    logger.error('Error ensuring DocumentContent schema', error instanceof Error ? error : undefined, {
      service: 'contextRetrievalService',
    });
    return false;
  }
};

// Helper function to extract a meaningful title from a website URL
const getWebsiteTitle = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Remove 'www.' prefix if present
    const cleanHostname = hostname.replace(/^www\./, '');
    
    // Convert to a more readable format
    // e.g., "example.com" -> "Example", "docs.example.com" -> "Docs Example"
    const parts = cleanHostname.split('.');
    if (parts.length >= 2) {
      const domain = parts[0];
      
      // Capitalize the first letter of each part
      const capitalizedDomain = domain.charAt(0).toUpperCase() + domain.slice(1);
      
      // For subdomains, include the main domain part
      if (parts.length > 2) {
        const subdomain = parts[0];
        const mainDomain = parts[1];
        return `${subdomain.charAt(0).toUpperCase() + subdomain.slice(1)} ${mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)}`;
      }
      
      return capitalizedDomain;
    }
    
    return cleanHostname;
  } catch (_error) {
    return 'Website';
  }
};

/**
 * Get context from Weaviate for a given message and chatbotId
 * This function retrieves relevant website and document content using semantic search
 */
export const getContextFromWeaviate = async (
  message: string,
  chatbotId: string
): Promise<ContextRetrievalResult> => {
  if (!client) {
    // Return empty context in test environment
    return {
      context: '',
      sources: []
    };
  }
  
  try {
    // Ensure chatbotId is a string for consistent comparison
    const chatbotIdStr = String(chatbotId);
    
    // Get website content with proper filtering by chatbotId
    // Use hybrid search (BM25 + vector) for RAG - combines keyword matching with semantic similarity
    // Falls back to BM25 if vectorizer is not available
    let websiteResponse: {
      data?: {
        Get?: {
          WebsiteContent?: Array<{
            chatbotId?: string;
            url?: string;
            title?: string;
            content?: string;
            chunkIndex?: number;
          }>;
        };
      };
    };
    try {
      // Try hybrid search first (requires vectorizer)
      try {
        websiteResponse = await client.graphql
          .get()
          .withClassName('WebsiteContent')
          .withFields('content url title chatbotId blockId')
          .withHybrid({
            query: message,
            alpha: 0.7, // 70% semantic (vector), 30% keyword (BM25)
          })
          .withWhere({
            path: ['chatbotId'],
            operator: 'Equal',
            valueString: chatbotIdStr,
          })
          .withLimit(10000)
          .do();
      } catch (hybridError: unknown) {
        // Fallback to BM25 if hybrid fails (no vectorizer)
        const hybridErrorMessage = hybridError instanceof Error ? hybridError.message : 'Unknown error';
        logger.warn('Hybrid search failed for WebsiteContent, trying BM25', {
          error: hybridErrorMessage,
          service: 'contextRetrievalService',
        });
        websiteResponse = await client.graphql
          .get()
          .withClassName('WebsiteContent')
          .withFields('content url title chatbotId blockId')
          .withBm25({
            query: message,
          })
          .withWhere({
            path: ['chatbotId'],
            operator: 'Equal',
            valueString: chatbotIdStr,
          })
          .withLimit(10000)
          .do();
      }
    } catch (weaviateError: unknown) {
      const errorMessage = weaviateError instanceof Error ? weaviateError.message : String(weaviateError);
      logger.error('Error querying Weaviate WebsiteContent', weaviateError instanceof Error ? weaviateError : undefined, {
        service: 'contextRetrievalService',
      });
      
      // Fallback: try without where filter if filtering fails
      try {
        // Try hybrid first, fallback to BM25
        try {
          websiteResponse = await client.graphql
            .get()
            .withClassName('WebsiteContent')
            .withFields('content url title chatbotId blockId')
            .withHybrid({
              query: message,
              alpha: 0.7,
            })
            .withLimit(10000)
            .do();
        } catch {
          websiteResponse = await client.graphql
            .get()
            .withClassName('WebsiteContent')
            .withFields('content url title chatbotId blockId')
            .withBm25({
              query: message,
            })
            .withLimit(10000)
            .do();
        }
      } catch (fallbackError: unknown) {
        logger.error('Fallback query also failed', fallbackError instanceof Error ? fallbackError : undefined, {
          service: 'contextRetrievalService',
        });
        return { context: '', sources: [] };
      }
    }

    // Process website context with sources
    const websiteContentArray = websiteResponse?.data?.Get?.WebsiteContent || [];
    
    // First filter by chatbotId and content quality
    const filteredItems = websiteContentArray.filter((item: WeaviateWebsiteContent) => {
      // Filter by chatbotId - ensure type consistency
      const itemChatbotId = String(item.chatbotId || '');
      if (itemChatbotId !== chatbotIdStr) {
        return false;
      }
      
      // Filter out malformed content
      if (!item.content || item.content.length < 100) return false;
      if (item.content.startsWith('pdf)')) return false;
      if (item.content.includes('\\>') && !item.content.includes('>')) return false; // Broken markdown
      if (item.content.includes('Gérer les options') && item.content.length < 200) return false; // Cookie banners
      
      return true;
    });
    
    // Limit to max chunks per URL to get more diverse sources
    // This ensures we get chunks from multiple pages, not just one page
    const urlChunkCounts = new Map<string, number>();
    const maxChunksPerUrl = 20; // Allow up to 20 chunks per URL
    const maxSources = 5; // Limit to top 5 sources
    const websiteContext = filteredItems
      .filter((item: WeaviateWebsiteContent) => {
        const url = item.url || '';
        const count = urlChunkCounts.get(url) || 0;
        // Stop if we already have maxSources and this URL is new
        if (urlChunkCounts.size >= maxSources && !urlChunkCounts.has(url)) {
          return false; // Skip new URLs if we already have maxSources
        }
        if (count >= maxChunksPerUrl) {
          return false; // Skip if we already have enough chunks from this URL
        }
        urlChunkCounts.set(url, count + 1);
        return true;
      })
      .slice(0, maxSources * maxChunksPerUrl) // Limit to max 5 sources * 20 chunks = 100 chunks total
      .map((item: WeaviateWebsiteContent) => {
        // Clean up the content by removing broken fragments
        let cleanedContent = item.content || '';
        
        // Remove broken URL fragments at the start
        cleanedContent = cleanedContent.replace(/^[^a-zA-Z]*[a-z]+\s*\.\s*[a-z]+\/[^a-zA-Z]*/, '');
        
        // Fix broken markdown
        cleanedContent = cleanedContent.replace(/\\\\>/g, '>');
        
        // Remove incomplete sentences at the end
        cleanedContent = cleanedContent.replace(/\s+[a-z]+\s*$/, '');
        
        return {
          content: cleanedContent,
          source: {
            type: 'website' as const,
            url: item.url,
            title: item.title || (item.url ? getWebsiteTitle(item.url) : 'Unknown website')
          }
        };
      });

    // Ensure DocumentContent schema exists before querying
    const documentSchemaExists = await ensureDocumentContentSchema();
    
    let documentResponse = { data: { Get: { DocumentContent: [] } } };
    if (documentSchemaExists) {
      try {
        // Get document content with proper filtering by chatbotId
        // Use hybrid search (BM25 + vector) for RAG
        try {
          documentResponse = await client.graphql
            .get()
            .withClassName('DocumentContent')
            .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId blockId')
            .withHybrid({
              query: message,
              alpha: 0.7, // 70% semantic (vector), 30% keyword (BM25)
            })
            .withWhere({
              path: ['chatbotId'],
              operator: 'Equal',
              valueString: chatbotIdStr,
            })
            .withLimit(10000)
            .do();
        } catch (hybridError: unknown) {
          // Fallback to BM25 if hybrid fails
          const hybridErrorMessage = hybridError instanceof Error ? hybridError.message : 'Unknown error';
          logger.warn('Hybrid search failed for DocumentContent, trying BM25', {
            error: hybridErrorMessage,
            service: 'contextRetrievalService',
          });
          documentResponse = await client.graphql
            .get()
            .withClassName('DocumentContent')
            .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId blockId')
            .withBm25({
              query: message,
            })
            .withWhere({
              path: ['chatbotId'],
              operator: 'Equal',
              valueString: chatbotIdStr,
            })
            .withLimit(10000)
            .do();
        }
      } catch (docError: unknown) {
        const errorMessage = docError instanceof Error ? docError.message : String(docError);
        logger.warn('Error querying DocumentContent', {
          error: errorMessage,
          service: 'contextRetrievalService',
        });
        
        // Fallback: try without where filter if filtering fails
        try {
          // Try hybrid first, fallback to BM25
          try {
            documentResponse = await client.graphql
              .get()
              .withClassName('DocumentContent')
              .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId blockId')
              .withHybrid({
                query: message,
                alpha: 0.7,
              })
              .withLimit(10000)
              .do();
          } catch {
            documentResponse = await client.graphql
              .get()
              .withClassName('DocumentContent')
              .withFields('content type chunkIndex totalChunks processedAt fileName chatbotId blockId')
              .withBm25({
                query: message,
              })
              .withLimit(10000)
              .do();
          }
        } catch (fallbackDocError: unknown) {
          logger.warn('Fallback document query also failed', {
            error: fallbackDocError instanceof Error ? fallbackDocError.message : String(fallbackDocError),
            service: 'contextRetrievalService',
          });
          documentResponse = { data: { Get: { DocumentContent: [] } } };
        }
      }
    }

    // Process document context with sources
    const documentContentArray = documentResponse?.data?.Get?.DocumentContent || [];
    
    const documentContext = documentContentArray
      .filter((item: WeaviateDocumentContent) => {
        // Filter by chatbotId - ensure type consistency
        const itemChatbotId = String(item.chatbotId || '');
        if (itemChatbotId !== chatbotIdStr) {
          return false;
        }
        
        // Filter out malformed content
        if (!item.content || item.content.length < 100) return false;
        if (item.content.startsWith('pdf)')) return false;
        if (item.content.includes('\\>') && !item.content.includes('>')) return false; // Broken markdown
        if (item.content.includes('Gérer les options') && item.content.length < 200) return false; // Cookie banners
        
        return true;
      })
      .slice(0, 5) // Limit to top 5 results
      .map((item: WeaviateDocumentContent) => ({
        content: item.content || '',
        source: {
          type: 'document' as const,
          chunkIndex: item.chunkIndex,
          totalChunks: item.totalChunks,
          processedAt: item.processedAt,
          fileName: item.fileName || 'Unknown Document',
          title: item.fileName ? `${item.fileName} (Part ${(item.chunkIndex ?? 0) + 1} of ${item.totalChunks ?? 1})` : `Document (Part ${(item.chunkIndex ?? 0) + 1} of ${item.totalChunks ?? 1})`
        }
      }));
    
    // Keep all website content chunks (they may have different content even if same URL)
    // But we'll deduplicate sources later to avoid showing same URL multiple times
    const allContext = [...websiteContext, ...documentContext];
    
    logger.debug('After filtering context items', {
      websiteItems: websiteContext.length,
      documentItems: documentContext.length,
      totalItems: allContext.length,
      service: 'contextRetrievalService',
    });
    
    // Check if we have any useful content
    const hasUsefulContent = allContext.some(item => 
      item.content && 
      item.content.length > 200 && 
      !item.content.startsWith('pdf)') && 
      !item.content.includes('Gérer les options')
    );
    
    // If no useful content, provide fallback information
    if (!hasUsefulContent) {
      return {
        context: 'No relevant context was found for this chatbot. Answer succinctly based on your general capabilities, and suggest consulting the organization\'s official documentation or website for authoritative details.',
        sources: []
      };
    }
    
    // Build context from all items (keep all content chunks - they may be different chunks from same URL/file)
    const context = allContext.map((item: ContextItem) => item.content).join('\n\n');
    
    // Deduplicate sources:
    // - For websites: deduplicate by URL (same URL = same source, even if multiple chunks)
    // - For documents: keep separate (each chunk is a different part of the document)
    const seenWebsiteUrls = new Set<string>();
    const deduplicatedSources = allContext
      .map((item: ContextItem) => item.source)
      .filter((source) => {
        if (source.type === 'website') {
          const url = source.url || '';
          if (seenWebsiteUrls.has(url)) {
            return false; // Skip duplicate website URLs
          }
          seenWebsiteUrls.add(url);
          return true;
        } else {
          // Documents: keep all chunks (they're different parts)
          return true;
        }
      });
    
    return {
      context,
      sources: deduplicatedSources
    };
  } catch (error) {
    logger.error('Error retrieving context from Weaviate', error instanceof Error ? error : undefined, {
      service: 'contextRetrievalService',
    });
    return { context: '', sources: [] };
  }
};
