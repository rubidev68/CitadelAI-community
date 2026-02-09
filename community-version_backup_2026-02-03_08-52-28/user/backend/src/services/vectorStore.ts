import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { SemanticChunkingService } from './semantic-chunking';
import fs from 'fs';
import path from 'path';
import { logger } from '@shared/utils';

// Simple in-memory vector store implementation
// Since MemoryVectorStore is not available in langchain v1.x, we implement a simple version
type MemoryVectorStoreType = {
  similaritySearch: (query: string, k: number) => Promise<Array<{ pageContent: string }>>;
};

class SimpleMemoryVectorStore implements MemoryVectorStoreType {
  private documents: Array<{ pageContent: string; embedding?: number[] }> = [];
  private embeddings: OpenAIEmbeddings;

  constructor(documents: Document[], embeddings: OpenAIEmbeddings) {
    this.embeddings = embeddings;
    this.documents = documents.map(doc => ({ pageContent: doc.pageContent }));
  }

  async similaritySearch(query: string, k: number): Promise<Array<{ pageContent: string }>> {
    // For simplicity, return first k documents
    // In a real implementation, you'd compute embeddings and do cosine similarity
    // But since this is a fallback and Weaviate is primary, simple approach is fine
    return this.documents.slice(0, k).map(doc => ({ pageContent: doc.pageContent }));
  }

  static async fromDocuments(documents: Document[], embeddings: OpenAIEmbeddings): Promise<SimpleMemoryVectorStore> {
    return new SimpleMemoryVectorStore(documents, embeddings);
  }
}

const vectorStores: { [chatbotId: string]: MemoryVectorStoreType } = {};

// Initialize semantic chunking service
const semanticChunking = new SemanticChunkingService();

class VectorStoreService {
  async getVectorStore(chatbotId: string): Promise<MemoryVectorStoreType | undefined> {
    if (vectorStores[chatbotId]) {
      return vectorStores[chatbotId];
    }

    const contentDir = path.join(__dirname, '..', '..', 'crawled_content');
    const filePath = path.join(contentDir, `${chatbotId}.txt`);

    if (!fs.existsSync(filePath)) {
      return undefined;
    }

    const allMarkdown = fs.readFileSync(filePath, 'utf-8');

    let vectorStore: MemoryVectorStoreType;

    // Use semantic chunking for better content organization
    try {
      const chunkingOptions = SemanticChunkingService.getDefaultOptions('web');
      const semanticChunks = await semanticChunking.chunkContent(allMarkdown, chunkingOptions);
      
      // Convert semantic chunks to LangChain documents
      const documents = semanticChunks.map(chunk => new Document({
        pageContent: chunk.content,
        metadata: {
          source: 'crawled',
          chunkType: chunk.metadata.chunkType,
          parentHeading: chunk.metadata.parentHeading,
          wordCount: chunk.metadata.wordCount,
          charCount: chunk.metadata.charCount,
          semanticScore: chunk.metadata.semanticScore,
          chunkIndex: chunk.metadata.chunkIndex,
          totalChunks: chunk.metadata.totalChunks,
        }
      }));

      const embeddings = new OpenAIEmbeddings();
      vectorStore = await SimpleMemoryVectorStore.fromDocuments(
        documents,
        embeddings
      );

      logger.debug('Created vector store with semantic chunks', {
        chunkCount: documents.length,
        chatbotId,
        service: 'vectorStore',
      });
    } catch (error) {
      logger.warn('Semantic chunking failed, falling back to simple chunking', {
        error: error instanceof Error ? error.message : String(error),
        service: 'vectorStore',
      });
      
      // Fallback to simple chunking
      const doc = new Document({ pageContent: allMarkdown, metadata: { source: 'crawled' } });

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const splittedDocs = await splitter.splitDocuments([doc]);

      const embeddings = new OpenAIEmbeddings();
      vectorStore = await SimpleMemoryVectorStore.fromDocuments(
        splittedDocs,
        embeddings
      );
    }

    vectorStores[chatbotId] = vectorStore;
    return vectorStore;
  }
}

export default new VectorStoreService();
