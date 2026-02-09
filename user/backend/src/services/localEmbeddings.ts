// Use dynamic import for ESM module
// import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { logger } from '@shared/utils';

// Define types locally since we can't import them directly
type FeatureExtractionPipeline = any;

export class LocalEmbeddings {
  private pipeline: FeatureExtractionPipeline | null = null;
  private modelName: string = 'Xenova/all-MiniLM-L6-v2';

  constructor(modelName?: string) {
    if (modelName) {
      this.modelName = modelName;
    }
  }

  async init() {
    if (!this.pipeline) {
      logger.info(`Initializing local embeddings model: ${this.modelName}`, { service: 'LocalEmbeddings' });
      try {
        // Dynamic import for ESM module
        const { pipeline } = await import('@xenova/transformers');
        this.pipeline = await pipeline('feature-extraction', this.modelName);
        logger.info('Local embeddings model initialized', { service: 'LocalEmbeddings' });
      } catch (error) {
        logger.error('Failed to initialize local embeddings model', { 
          error: error instanceof Error ? error.message : String(error),
          service: 'LocalEmbeddings'
        });
        throw error;
      }
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    if (!this.pipeline) {
      await this.init();
    }
    
    if (!this.pipeline) {
      throw new Error('Embeddings pipeline not initialized');
    }

    try {
      // Run the pipeline
      const output = await this.pipeline(text, { pooling: 'mean', normalize: true });
      // Convert Tensor to array
      return Array.from(output.data);
    } catch (error) {
      logger.error('Error generating query embedding', { 
        error: error instanceof Error ? error.message : String(error),
        service: 'LocalEmbeddings'
      });
      throw error;
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      await this.init();
    }

    if (!this.pipeline) {
      throw new Error('Embeddings pipeline not initialized');
    }

    try {
      const embeddings: number[][] = [];
      for (const doc of documents) {
        const output = await this.pipeline(doc, { pooling: 'mean', normalize: true });
        embeddings.push(Array.from(output.data));
      }
      return embeddings;
    } catch (error) {
      logger.error('Error generating document embeddings', { 
        error: error instanceof Error ? error.message : String(error),
        service: 'LocalEmbeddings'
      });
      throw error;
    }
  }
}
