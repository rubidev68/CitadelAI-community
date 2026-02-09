// Optimized crawling implementation with real performance improvements
// Focuses on the actual bottlenecks: Weaviate storage and content processing

import puppeteer, { Page, Browser } from 'puppeteer';
import TurndownService from 'turndown';
import weaviate from 'weaviate-ts-client';
import { AdvancedScraper } from './crawling';
import { SemanticChunkingService } from './semantic-chunking';
import prisma from './lib/prisma';
import { config } from './config';

// Initialize Weaviate client only if not in test environment
let client: any = null;
if (config.NODE_ENV !== 'test') {
  const weaviateHost = config.WEAVIATE_URL.replace('http://', '').replace('https://', '');
  const headers: Record<string, string> = {};
  
  if (config.OPENAI_API_KEY) {
    headers['X-OpenAI-Api-Key'] = config.OPENAI_API_KEY;
  }
  
  client = weaviate.client({
    scheme: 'http',
    host: weaviateHost,
    apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY || ''),
    headers: headers,
  });
}

// Resource file extensions that should be excluded from crawling
// Note: PDF is NOT excluded as it's supported by the document block
const RESOURCE_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif',
  // Documents (excluding PDF which is supported)
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Archives
  '.zip', '.rar', '.tar', '.gz', '.7z',
  // Media
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ogg',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Other
  '.css', '.js', '.json', '.xml', '.rss', '.atom'
];

/**
 * Check if a URL points to a PDF file
 */
function isPDFUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return false;
  }
}

/**
 * Check if a URL points to a resource file (image, etc.) that should not be crawled
 * Note: PDFs are NOT excluded as they're supported by the document block
 */
function isResourceFile(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check if pathname ends with a resource extension
    for (const ext of RESOURCE_EXTENSIONS) {
      if (pathname.endsWith(ext)) {
        return true;
      }
    }
    
    // Check for common resource patterns in query strings
    const searchParams = urlObj.searchParams;
    if (searchParams.has('format') || searchParams.has('download')) {
      const format = searchParams.get('format')?.toLowerCase();
      if (format && RESOURCE_EXTENSIONS.some(ext => format.includes(ext.replace('.', '')))) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

// Initialize semantic chunking service
const semanticChunking = new SemanticChunkingService();

interface CrawlJob {
  startUrl: string;
  chatbotId: string;
  blockId: string;
  recursive: boolean;
  maxDepth: number;
}

interface ContentBatch {
  chatbotId: string;
  blockId: string;
  url: string;
  content: string;
  title: string;
  timestamp: number;
}

class OptimizedCrawlingService {
  private queue: CrawlJob[] = [];
  private activeJobs: Map<string, { job: CrawlJob; activeCrawlers: number }> = new Map();
  private contentBatch: ContentBatch[] = [];
  private batchSize = 5; // Process 5 items at once
  private batchTimeout = 30000; // Flush batch every 30 seconds (increased from 5s)
  private batchTimer: NodeJS.Timeout | null = null;
  private maxConcurrentPagesPerJob = 5; // Process up to 5 pages simultaneously per website
  private maxConcurrentJobs = 4; // Process up to 4 websites simultaneously
  private queueLock = false; // Simple lock for queue operations

  constructor() {
    this.createSchema();
    this.processQueue();
    this.startBatchProcessor();
  }

  // Start periodic batch processor to handle timeouts
  private startBatchProcessor() {
    setInterval(() => {
      if (this.shouldProcessBatch()) {
        console.log(`[CRAWL BATCH] - Periodic check: processing batch with ${this.contentBatch.length} items`);
        this.processBatch();
      }
    }, 5000); // Check every 5 seconds
  }

  private async createSchema() {
    if (!client) {
      console.log('Weaviate client not available, skipping schema creation');
      return;
    }
    
    const schemaConfig = {
      class: 'WebsiteContent',
      vectorizer: 'text2vec-openai',
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
          name: 'url',
          dataType: ['string'],
        },
        {
          name: 'content',
          dataType: ['text'],
        },
        {
          name: 'title',
          dataType: ['string'],
        },
        // New semantic chunking metadata
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
        {
          name: 'chunkIndex',
          dataType: ['int'],
        },
        {
          name: 'totalChunks',
          dataType: ['int'],
        },
      ],
    };

    try {
      await client.schema.classCreator().withClass(schemaConfig).do();
      console.log('Schema created successfully');
    } catch (e) {
      const error = e as Error;
      if (error.message.includes('already exists')) {
        console.log('Schema already exists');
      } else {
        console.error('Error creating schema:', error);
      }
    }
  }

  addJobToQueue(job: CrawlJob) {
    console.log(`Adding job to queue for chatbotId: ${job.chatbotId}`);
    this.queue.push(job);
    // Always try to process queue when adding a job
    this.processQueue();
  }

  stopCrawling(chatbotId: string, blockId: string) {
    console.log(`Stopping crawling for chatbotId: ${chatbotId}, blockId: ${blockId}`);
    
    // Remove from queue
    this.queue = this.queue.filter(job => !(job.chatbotId === chatbotId && job.blockId === blockId));
    
    // Remove from active jobs
    const jobKey = `${chatbotId}-${blockId}`;
    if (this.activeJobs.has(jobKey)) {
      console.log(`Stopping active crawl job for blockId: ${blockId}`);
      this.activeJobs.delete(jobKey);
      
      // Process any remaining items in the batch
      if (this.contentBatch.length > 0) {
        console.log(`[CRAWL STOP] - Flushing batch with ${this.contentBatch.length} items before stopping`);
        this.processBatch();
      }
    }
  }

  private async processQueue() {
    // Start new jobs if we have capacity and jobs in queue
    while (this.queue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
      const job = this.queue.shift()!;
      const jobKey = `${job.chatbotId}-${job.blockId}`;
      
      console.log(`Starting job for chatbotId: ${job.chatbotId}, blockId: ${job.blockId} (Active jobs: ${this.activeJobs.size + 1}/${this.maxConcurrentJobs})`);
      
      // Add job to active jobs map
      this.activeJobs.set(jobKey, { job, activeCrawlers: 0 });
      
      // Start crawling this job in parallel (don't await)
      this.crawlWebsiteOptimized(job.startUrl, job.chatbotId, job.blockId, job.recursive, job.maxDepth)
        .finally(() => {
          // Remove job from active jobs when completed
          this.activeJobs.delete(jobKey);
          console.log(`Completed job for chatbotId: ${job.chatbotId}, blockId: ${job.blockId} (Active jobs: ${this.activeJobs.size})`);
          
          // Process more jobs if queue has items
          if (this.queue.length > 0) {
            this.processQueue();
          }
        });
    }
  }

  // Add content to batch for processing
  private addToBatch(chatbotId: string, blockId: string, url: string, content: string, title: string) {
    this.contentBatch.push({ 
      chatbotId, 
      blockId, 
      url, 
      content, 
      title,
      timestamp: Date.now() 
    });
    console.log(`[CRAWL BATCH] - Added to batch: ${url} (Batch size: ${this.contentBatch.length}/${this.batchSize})`);
    
    // Process batch if it should be processed (full or timeout)
    if (this.shouldProcessBatch()) {
      console.log(`[CRAWL BATCH] - Batch ready for processing, processing immediately`);
      this.processBatch();
    } else {
      // Only set timer if one isn't already set
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          console.log(`[CRAWL BATCH] - Timeout reached, processing batch with ${this.contentBatch.length} items`);
          this.processBatch();
        }, this.batchTimeout);
      }
    }
  }

  // Check if batch should be processed based on age
  private shouldProcessBatch(): boolean {
    if (this.contentBatch.length === 0) return false;
    
    const oldestItem = this.contentBatch[0];
    const age = Date.now() - oldestItem.timestamp;
    
    // Process if batch is full OR if oldest item is older than timeout
    return this.contentBatch.length >= this.batchSize || age >= this.batchTimeout;
  }

  // Safely add URLs to the queue from parallel crawlers
  private async addUrlsToQueue(
    urls: string[], 
    depth: number, 
    baseUrl: string, 
    visited: Set<string>, 
    queue: { url: string; depth: number }[], 
    queueSet: Set<string>
  ): Promise<void> {
    // Simple lock to prevent race conditions
    while (this.queueLock) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.queueLock = true;
    
    try {
      for (const url of urls) {
        try {
          const absoluteUrl = new URL(url, baseUrl).href;
          
          // Skip resource files
          if (isResourceFile(absoluteUrl)) {
            continue;
          }
          
          const normalizedAbsoluteUrl = this.normalizeUrl(absoluteUrl);

          if (
            normalizedAbsoluteUrl &&
            new URL(normalizedAbsoluteUrl).origin === baseUrl &&
            !visited.has(normalizedAbsoluteUrl) &&
            !queueSet.has(normalizedAbsoluteUrl)
          ) {
            queue.push({ url: normalizedAbsoluteUrl, depth: depth + 1 });
            queueSet.add(normalizedAbsoluteUrl);
          }
        } catch (error) {
          // Ignore invalid links
        }
      }
    } finally {
      this.queueLock = false;
    }
  }

  // Crawl a single page (used for parallel processing)
  private async crawlPage(
    browser: Browser, 
    currentUrl: string, 
    depth: number, 
    chatbotId: string, 
    blockId: string, 
    baseUrl: string, 
    recursive: boolean, 
    maxDepth: number,
    visited: Set<string>,
    queue: { url: string; depth: number }[],
    queueSet: Set<string>
  ): Promise<void> {
    // Check if this is a PDF URL - handle differently
    if (isPDFUrl(currentUrl)) {
      console.log(`[CRAWL PDF] - Detected PDF: ${currentUrl}`);
      try {
        // Update status to show we're processing PDF (use full URL, not "Processing PDF:" prefix)
        try {
          await prisma.websiteContext.update({
            where: { blockId },
            data: {
              crawlingStatus: { 
                status: 'crawling', 
                progress: visited.size, 
                total: visited.size + queue.length, 
                currentUrl: currentUrl
              },
            },
          });
        } catch (error) {
          // Ignore update errors
        }
        
        // Download PDF with timeout (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        let response: Response;
        try {
          response = await fetch(currentUrl, { 
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          clearTimeout(timeoutId);
        } catch (fetchError: unknown) {
          clearTimeout(timeoutId);
          const err = fetchError as { name?: string; message?: string };
          if (err.name === 'AbortError') {
            throw new Error('PDF download timeout after 30 seconds');
          }
          throw fetchError;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
        }
        
        // Limit PDF size to 10MB (same as document block)
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
          throw new Error('PDF file too large (max 10MB)');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Try to parse PDF if pdf-parse is available (with timeout)
        let pdfText = '';
        let pdfTitle = currentUrl.split('/').pop() || 'PDF Document';
        
        try {
          // Dynamic import to avoid errors if pdf-parse is not installed
          const pdfParse = require('pdf-parse');
          
          // Parse PDF with timeout protection
          const parsePromise = pdfParse(buffer);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('PDF parsing timeout after 60 seconds')), 60000)
          );
          
          const pdfData = await Promise.race([parsePromise, timeoutPromise]) as any;
          pdfText = pdfData.text || '';
          if (pdfData.info && pdfData.info.Title) {
            pdfTitle = pdfData.info.Title;
          }
        } catch (pdfError: unknown) {
          const err = pdfError as { message?: string };
          console.warn(`[CRAWL PDF] - pdf-parse failed for ${currentUrl}:`, err.message || err);
          // If pdf-parse fails, we'll still count the PDF as a page but without content
          pdfText = `PDF Document: ${pdfTitle}`;
        }
        
        // Convert PDF text to markdown (basic conversion, same as document block)
        const markdown = pdfText
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/\n\s*\n/g, '\n\n')
          .replace(/^([A-Z][A-Z\s]+)$/gm, '# $1')
          .replace(/^[\s]*[-•]\s+/gm, '- ')
          .replace(/^[\s]*(\d+\.)\s+/gm, '$1 ');
        
        // Add to content batch (treat PDF like HTML page)
        this.addToBatch(chatbotId, blockId, currentUrl, markdown, pdfTitle);
        
        console.log(`[CRAWL PDF SUCCESS] - Processed PDF: ${currentUrl} (Title: ${pdfTitle})`);
        
        // Update status after successful PDF processing - just update progress, let other crawlers update currentUrl
        // This avoids race conditions with parallel crawlers
        try {
          await prisma.websiteContext.update({
            where: { blockId },
            data: {
              crawlingStatus: { 
                status: 'crawling', 
                progress: visited.size, 
                total: visited.size + queue.length,
                // Don't update currentUrl here - let the next crawler update it to avoid conflicts
                currentUrl: currentUrl
              },
            },
          });
        } catch (error) {
          // Ignore update errors
        }
      } catch (pdfError: unknown) {
        const err = pdfError as { message?: string };
        console.error(`[CRAWL PDF ERROR] - Error processing PDF ${currentUrl}:`, err.message || err);
        // Still count it as visited even if processing failed
        // Update status - just update progress, let other crawlers update currentUrl
        try {
          await prisma.websiteContext.update({
            where: { blockId },
            data: {
              crawlingStatus: { 
                status: 'crawling', 
                progress: visited.size, 
                total: visited.size + queue.length,
                // Don't update currentUrl here - let the next crawler update it to avoid conflicts
                currentUrl: currentUrl
              },
            },
          });
        } catch (error) {
          // Ignore update errors
        }
      }
      
      // PDFs don't have links to extract, so return early
      // IMPORTANT: Decrement activeCrawlers before returning, otherwise the main loop will hang
      const jobKey = `${chatbotId}-${blockId}`;
      const jobData = this.activeJobs.get(jobKey);
      if (jobData) {
        jobData.activeCrawlers--;
        console.log(`[CRAWL PAGE] - Completed PDF: ${currentUrl} (Active crawlers for job: ${jobData.activeCrawlers}/${this.maxConcurrentPagesPerJob})`);
      }
      return;
    }

    const page = await browser.newPage();
    const jobKey = `${chatbotId}-${blockId}`;
    
    try {
      // Update status
      try {
        await prisma.websiteContext.update({
          where: { blockId },
          data: {
            crawlingStatus: { 
              status: 'crawling', 
              progress: visited.size, 
              total: visited.size + queue.length, 
              currentUrl 
            },
          },
        });
      } catch (error) {
        console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}`);
      }

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setJavaScriptEnabled(true);
      
      await page.goto(currentUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });

      // Use advanced scraper for complex content
      const scraper = new AdvancedScraper(page);
      await scraper.waitForContentLoad();
      await scraper.detectAndHandlePageType();
      const { content: html, title } = await scraper.extractContent();

      console.log(`[CRAWL PAGE SUCCESS] - Successfully crawled: ${currentUrl} (Title: ${title})`);

      // Convert to markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        linkReferenceStyle: 'full'
      });
      
      const markdown = turndownService.turndown(html);

      // Add to batch for processing (this is the key optimization)
      this.addToBatch(chatbotId, blockId, currentUrl, markdown, title);

      // Extract links for recursive crawling
      if (recursive && depth < maxDepth) {
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a')).map(a => a.href)
        );

        // Use safe method to add URLs to queue
        await this.addUrlsToQueue(links, depth, baseUrl, visited, queue, queueSet);
      }

    } catch (error) {
      console.error(`[CRAWL PAGE ERROR] - Error crawling ${currentUrl}:`, error);
    } finally {
      await page.close();
      
      // Decrement active crawler count for this job
      const jobData = this.activeJobs.get(jobKey);
      if (jobData) {
        jobData.activeCrawlers--;
        console.log(`[CRAWL PAGE] - Completed: ${currentUrl} (Active crawlers for job: ${jobData.activeCrawlers}/${this.maxConcurrentPagesPerJob})`);
      }
    }
  }

  // Process the current batch
  private async processBatch() {
    if (this.contentBatch.length === 0) return;

    const batch = [...this.contentBatch];
    this.contentBatch = [];
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    console.log(`[CRAWL BATCH] - Processing batch of ${batch.length} items`);

    try {
      // Process all items in the batch in parallel
      const promises = batch.map(item => this.processContentItem(item));
      await Promise.allSettled(promises);
      console.log(`[CRAWL BATCH] - Batch processing completed`);
    } catch (error) {
      console.error(`[CRAWL BATCH ERROR] - Batch processing failed:`, error);
    }
  }

  // Process a single content item using semantic chunking
  private async processContentItem(item: ContentBatch) {
    try {
      // Check if WebsiteContext still exists
      const websiteContext = await prisma.websiteContext.findUnique({
        where: { blockId: item.blockId }
      });
      
      if (!websiteContext) {
        console.log(`[CRAWL SKIP] - WebsiteContext record not found, skipping: ${item.url}`);
        return;
      }

      // Use semantic chunking for better content organization
      const chunkingOptions = SemanticChunkingService.getDefaultOptions('web');
      const semanticChunks = await semanticChunking.chunkContent(item.content, chunkingOptions);

      if (semanticChunks.length === 0) {
        console.log(`[CRAWL SKIP] - No semantic chunks generated for: ${item.url}`);
        return;
      }

      // Store all semantic chunks in parallel
      // IMPORTANT: Use chatbotId from websiteContext, not from item, to ensure consistency
      // This handles cases where the chatbotId might have changed after the crawl job started
      if (client) {
        const chatbotIdToUse = websiteContext.chatbotId;
        console.log(`[CRAWL WEAVIATE] - Storing content for blockId: ${item.blockId}, chatbotId: ${chatbotIdToUse}, url: ${item.url}`);
        
        const chunkPromises = semanticChunks.map(chunk => 
          client.data
            .creator()
            .withClassName('WebsiteContent')
            .withProperties({
              chatbotId: chatbotIdToUse, // Use chatbotId from database, not from job item
            blockId: item.blockId,
            url: item.url,
            content: chunk.content,
            title: item.title,
            // Semantic metadata
            chunkType: chunk.metadata.chunkType,
            parentHeading: chunk.metadata.parentHeading,
            wordCount: chunk.metadata.wordCount,
            charCount: chunk.metadata.charCount,
            semanticScore: chunk.metadata.semanticScore,
            chunkIndex: chunk.metadata.chunkIndex,
            totalChunks: chunk.metadata.totalChunks,
          })
          .do()
      );

        await Promise.all(chunkPromises);
        console.log(`[CRAWL WEAVIATE] - Stored ${semanticChunks.length} semantic chunks for: ${item.url} with chatbotId: ${chatbotIdToUse}`);
      } else {
        console.log(`[CRAWL SKIP] - Weaviate client not available, skipping storage for: ${item.url}`);
      }
      
    } catch (error) {
      console.error(`[CRAWL PROCESSING ERROR] - Error processing ${item.url}:`, error);
      // Fallback to simple chunking if semantic chunking fails
      await this.processContentItemFallback(item);
    }
  }

  // Fallback method using simple chunking
  private async processContentItemFallback(item: ContentBatch) {
    try {
      // Get websiteContext to ensure we use the correct chatbotId
      const websiteContext = await prisma.websiteContext.findUnique({
        where: { blockId: item.blockId }
      });
      
      if (!websiteContext) {
        console.log(`[CRAWL FALLBACK SKIP] - WebsiteContext record not found, skipping: ${item.url}`);
        return;
      }

      // Simple chunking fallback
      const chunkSize = 4000;
      const chunks = [];
      
      for (let i = 0; i < item.content.length; i += chunkSize) {
        chunks.push(item.content.substring(i, i + chunkSize));
      }

      // Store all chunks in parallel
      // IMPORTANT: Use chatbotId from websiteContext, not from item
      const chatbotIdToUse = websiteContext.chatbotId;
      console.log(`[CRAWL WEAVIATE FALLBACK] - Storing content for blockId: ${item.blockId}, chatbotId: ${chatbotIdToUse}, url: ${item.url}`);
      
      const chunkPromises = chunks.map((chunk, index) => 
        client.data
          .creator()
          .withClassName('WebsiteContent')
          .withProperties({
            chatbotId: chatbotIdToUse, // Use chatbotId from database, not from job item
            blockId: item.blockId,
            url: item.url,
            content: chunk,
            title: item.title,
            chunkIndex: index,
            totalChunks: chunks.length,
          })
          .do()
      );

      await Promise.all(chunkPromises);
      console.log(`[CRAWL WEAVIATE FALLBACK] - Stored ${chunks.length} simple chunks for: ${item.url} with chatbotId: ${chatbotIdToUse}`);
      
    } catch (error) {
      console.error(`[CRAWL FALLBACK ERROR] - Error processing ${item.url}:`, error);
    }
  }

  private async crawlWebsiteOptimized(startUrl: string, chatbotId: string, blockId: string, recursive: boolean, maxDepth: number) {
    console.log(`[CRAWL START] - blockId: ${blockId} - url: ${startUrl}`);
    
    const jobKey = `${chatbotId}-${blockId}`;
    const jobData = this.activeJobs.get(jobKey);
    
    if (!jobData) {
      console.log(`[CRAWL STOPPED] - Job for blockId: ${blockId} was stopped`);
      return { success: false, error: 'Crawl was stopped' };
    }

    const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
    const visited = new Set<string>();
    const queueSet = new Set<string>([startUrl]);
    const baseUrl = new URL(startUrl).origin;

    try {
      await prisma.websiteContext.update({
        where: { blockId },
        data: {
          crawlingStatus: { status: 'starting', progress: 0, total: 1, currentUrl: startUrl },
        },
      });
    } catch (error) {
      console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}`);
    }

    let browser: Browser | undefined;

    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-gpu', 
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-setuid-sandbox',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-crash-reporter',
          '--disable-crashpad',
          '--disable-breakpad'
        ],
      });

      console.log('[CRAWL BROWSER] - Puppeteer launched successfully');

      // Parallel crawling implementation
      const crawlPromises: Promise<void>[] = [];
      
      while (queue.length > 0 || jobData.activeCrawlers > 0) {
        // Start new crawlers if we have capacity and URLs to process
        while (queue.length > 0 && jobData.activeCrawlers < this.maxConcurrentPagesPerJob) {
          const currentJobData = this.activeJobs.get(jobKey);
          if (!currentJobData) {
            console.log(`[CRAWL STOPPED] - Job for blockId: ${blockId} was stopped during crawling`);
            break;
          }

          const { url: currentUrl, depth } = queue.shift()!;
          queueSet.delete(currentUrl);

          // Skip resource files (images, PDFs, etc.)
          if (isResourceFile(currentUrl)) {
            console.log(`[CRAWL SKIP] - Skipping resource file: ${currentUrl}`);
            continue;
          }

          if (visited.has(currentUrl)) {
            continue;
          }

          console.log(`[CRAWL PAGE] - Visiting: ${currentUrl} (Active crawlers for job: ${jobData.activeCrawlers + 1}/${this.maxConcurrentPagesPerJob})`);
          visited.add(currentUrl);

          // Start crawling this page in parallel
          const crawlPromise = this.crawlPage(browser, currentUrl, depth, chatbotId, blockId, baseUrl, recursive, maxDepth, visited, queue, queueSet);
          crawlPromises.push(crawlPromise);
          jobData.activeCrawlers++;
        }

        // Wait a bit before checking for more work
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for all crawling to complete
      console.log(`[CRAWL WAITING] - Waiting for ${crawlPromises.length} crawlers to complete...`);
      await Promise.allSettled(crawlPromises);

             // Process any remaining items in the batch
             if (this.contentBatch.length > 0) {
               console.log(`[CRAWL FINAL] - Flushing final batch with ${this.contentBatch.length} items`);
               await this.processBatch();
             }

      try {
        await prisma.websiteContext.update({
          where: { blockId },
          data: {
            crawlingStatus: { status: 'completed' },
            lastCrawledAt: new Date(),
            crawledPagesCount: visited.size,
          },
        });
      } catch (error) {
        console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}`);
      }

      console.log(`[CRAWL SUCCESS] - Crawled and stored content for blockId ${blockId} from ${startUrl}`);
      return { success: true };

    } catch (error) {
      console.error(`[CRAWL ERROR] - General error for blockId ${blockId}:`, error);
      try {
        await prisma.websiteContext.update({
          where: { blockId },
          data: { crawlingStatus: { status: 'error' } },
        });
      } catch (updateError) {
        console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}`);
      }
      return { success: false, error: 'Failed to crawl website' };
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('[CRAWL BROWSER] - Browser closed');
        } catch (closeError) {
          console.error('[CRAWL BROWSER] - Error closing browser:', closeError);
        }
      }
    }
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
      urlObj.hash = '';
      urlObj.search = '';
      let pathname = urlObj.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      urlObj.pathname = pathname;
      return urlObj.toString();
    } catch (error) {
      return '';
    }
  }

  // Get current concurrency status
  getConcurrencyStatus() {
    const activeJobs = Array.from(this.activeJobs.entries()).map(([key, data]) => ({
      jobKey: key,
      chatbotId: data.job.chatbotId,
      blockId: data.job.blockId,
      startUrl: data.job.startUrl,
      activeCrawlers: data.activeCrawlers,
      maxCrawlersPerJob: this.maxConcurrentPagesPerJob
    }));

    const totalActiveCrawlers = Array.from(this.activeJobs.values())
      .reduce((sum, job) => sum + job.activeCrawlers, 0);

    return {
      maxConcurrentJobs: this.maxConcurrentJobs,
      maxCrawlersPerJob: this.maxConcurrentPagesPerJob,
      maxTotalCrawlers: this.maxConcurrentJobs * this.maxConcurrentPagesPerJob,
      activeJobsCount: this.activeJobs.size,
      totalActiveCrawlers,
      queueLength: this.queue.length,
      activeJobs,
      queue: this.queue.map(job => ({
        chatbotId: job.chatbotId,
        blockId: job.blockId,
        startUrl: job.startUrl
      }))
    };
  }
}

export default OptimizedCrawlingService;