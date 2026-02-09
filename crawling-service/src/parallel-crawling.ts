// Advanced parallel crawling implementation
// This is an alternative implementation with better performance

import puppeteer, { Page, Browser } from 'puppeteer';
import TurndownService from 'turndown';
import weaviate from 'weaviate-ts-client';
import { AdvancedScraper } from './crawling';
import prisma from './lib/prisma';
import { config } from './config';

// Initialize Weaviate client only if not in test environment
let client: any = null;
if (config.NODE_ENV !== 'test') {
  const weaviateHost = config.WEAVIATE_URL.replace('http://', '').replace('https://', '');
  client = weaviate.client({
    scheme: 'http',
    host: weaviateHost,
    apiKey: config.WEAVIATE_API_KEY ? new weaviate.ApiKey(config.WEAVIATE_API_KEY) : undefined,
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

interface CrawlJob {
  startUrl: string;
  chatbotId: string;
  blockId: string;
  recursive: boolean;
  maxDepth: number;
}

interface ContentItem {
  url: string;
  html: string;
  markdown: string;
  depth: number;
  title: string;
  timestamp: number;
}

class ParallelCrawlingService {
  private queue: CrawlJob[] = [];
  private isCrawling = false;
  private currentJob: CrawlJob | null = null;
  private contentProcessingQueue: ContentItem[] = [];
  private isProcessingContent = false;
  private processingStats = {
    processed: 0,
    failed: 0,
    total: 0
  };

  constructor() {
    this.createSchema();
    this.processQueue();
    this.startContentProcessor();
  }

  private async createSchema() {
    if (!client) {
      console.log('Weaviate client not available, skipping schema creation');
      return;
    }
    
    const schemaConfig = {
      class: 'WebsiteContent',
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
    if (!this.isCrawling) {
      this.processQueue();
    }
  }

  stopCrawling(chatbotId: string, blockId: string) {
    console.log(`Stopping crawling for chatbotId: ${chatbotId}, blockId: ${blockId}`);
    
    this.queue = this.queue.filter(job => !(job.chatbotId === chatbotId && job.blockId === blockId));
    
    if (this.currentJob && this.currentJob.chatbotId === chatbotId && this.currentJob.blockId === blockId) {
      console.log(`Stopping current crawl job for blockId: ${blockId}`);
      this.currentJob = null;
      this.isCrawling = false;
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isCrawling = false;
      this.currentJob = null;
      return;
    }

    this.isCrawling = true;
    const job = this.queue.shift()!;
    this.currentJob = job;
    console.log(`Processing job for chatbotId: ${job.chatbotId}, blockId: ${job.blockId}`);
    
    try {
      await this.crawlWebsiteParallel(job.startUrl, job.chatbotId, job.blockId, job.recursive, job.maxDepth);
    } finally {
      this.currentJob = null;
    }
    
    this.processQueue();
  }

  // Start the content processor in the background
  private startContentProcessor() {
    setInterval(async () => {
      if (this.contentProcessingQueue.length > 0 && !this.isProcessingContent) {
        await this.processContentBatch();
      }
    }, 1000); // Check every second
  }

  // Process content in batches for better performance
  private async processContentBatch() {
    if (this.isProcessingContent || this.contentProcessingQueue.length === 0) return;

    this.isProcessingContent = true;
    const batchSize = 5; // Process 5 items at a time
    const batch = this.contentProcessingQueue.splice(0, batchSize);

    console.log(`[CRAWL PROCESSING] - Processing batch of ${batch.length} items`);

    // Process batch in parallel
    // const promises = batch.map(content => this.processContentItem(content));
    
    try {
      // Process sequentially
      for (const content of batch) {
        await this.processContentItem(content);
      }
      this.processingStats.processed += batch.length;
      console.log(`[CRAWL PROCESSING] - Batch completed. Stats: ${this.processingStats.processed}/${this.processingStats.total} processed, ${this.processingStats.failed} failed`);
    } catch (error) {
      console.error(`[CRAWL PROCESSING ERROR] - Batch processing error:`, error);
    }

    this.isProcessingContent = false;
  }

  // Process a single content item
  private async processContentItem(content: ContentItem) {
    try {
      // Check if WebsiteContext still exists
      const websiteContext = await prisma.websiteContext.findUnique({
        where: { blockId: this.currentJob?.blockId }
      });
      
      if (!websiteContext) {
        console.log(`[CRAWL SKIP] - WebsiteContext record not found, skipping: ${content.url}`);
        return;
      }

      // Store content in Weaviate
      if (client) {
        const chunkSize = 4000;
        const chunks = [];
        
        for (let i = 0; i < content.markdown.length; i += chunkSize) {
          chunks.push(content.markdown.substring(i, i + chunkSize));
        }

        // Store all chunks in batches
        const BATCH_SIZE = 2;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE);
          const chunkPromises = batch.map((chunk, batchIndex) => 
            client.data
              .creator()
              .withClassName('WebsiteContent')
              .withProperties({
                chatbotId: this.currentJob?.chatbotId,
                blockId: this.currentJob?.blockId,
                url: content.url,
                content: chunk,
                title: content.title,
              })
              .do()
          );

          await Promise.all(chunkPromises);
        }

        console.log(`[CRAWL WEAVIATE] - Stored ${chunks.length} chunks for: ${content.url}`);
      } else {
        console.log(`[CRAWL SKIP] - Weaviate client not available, skipping storage for: ${content.url}`);
      }
      
    } catch (error) {
      console.error(`[CRAWL PROCESSING ERROR] - Error processing ${content.url}:`, error);
      this.processingStats.failed++;
    }
  }

  // Add content to processing queue
  private addContentToQueue(url: string, html: string, markdown: string, depth: number, title: string) {
    this.contentProcessingQueue.push({
      url,
      html,
      markdown,
      depth,
      title,
      timestamp: Date.now()
    });
    this.processingStats.total++;
    console.log(`[CRAWL QUEUE] - Added to processing queue: ${url} (Queue size: ${this.contentProcessingQueue.length})`);
  }

  // Wait for all content processing to complete
  private async waitForContentProcessing() {
    console.log(`[CRAWL WAITING] - Waiting for ${this.contentProcessingQueue.length} items to be processed...`);
    
    while (this.contentProcessingQueue.length > 0 || this.isProcessingContent) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[CRAWL PROCESSING] - All content processing completed. Final stats: ${this.processingStats.processed} processed, ${this.processingStats.failed} failed`);
  }

  private async crawlWebsiteParallel(startUrl: string, chatbotId: string, blockId: string, recursive: boolean, maxDepth: number) {
    console.log(`[CRAWL START] - blockId: ${blockId} - url: ${startUrl}`);
    
    if (!this.currentJob || this.currentJob.blockId !== blockId) {
      console.log(`[CRAWL STOPPED] - Job for blockId: ${blockId} was stopped`);
      return { success: false, error: 'Crawl was stopped' };
    }

    // Reset processing stats
    this.processingStats = { processed: 0, failed: 0, total: 0 };

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

      // Crawl pages sequentially but process content asynchronously
      while (queue.length > 0) {
        if (!this.currentJob || this.currentJob.blockId !== blockId) {
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

        console.log(`[CRAWL PAGE] - Visiting: ${currentUrl}`);
        visited.add(currentUrl);

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
            
            // Convert PDF text to markdown (basic conversion)
            const markdown = pdfText
              .replace(/\s+/g, ' ')
              .trim()
              .replace(/\n\s*\n/g, '\n\n')
              .replace(/^([A-Z][A-Z\s]+)$/gm, '# $1')
              .replace(/^[\s]*[-•]\s+/gm, '- ')
              .replace(/^[\s]*(\d+\.)\s+/gm, '$1 ');
            
            // Add to processing queue (treat PDF like HTML page)
            this.addContentToQueue(currentUrl, `<div>${pdfText}</div>`, markdown, depth, pdfTitle);
            
            console.log(`[CRAWL PDF SUCCESS] - Processed PDF: ${currentUrl} (Title: ${pdfTitle})`);
            
            // Update status after successful PDF processing - just update progress
            // The next iteration will update currentUrl naturally
            try {
              await prisma.websiteContext.update({
                where: { blockId },
                data: {
                  crawlingStatus: { 
                    status: 'crawling', 
                    progress: visited.size, 
                    total: visited.size + queue.length,
                    // Don't update currentUrl here - next iteration will update it
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
            // Update status - just update progress, next iteration will update currentUrl
            try {
              await prisma.websiteContext.update({
                where: { blockId },
                data: {
                  crawlingStatus: { 
                    status: 'crawling', 
                    progress: visited.size, 
                    total: visited.size + queue.length,
                    // Don't update currentUrl here - next iteration will update it
                    currentUrl: currentUrl
                  },
                },
              });
            } catch (error) {
              // Ignore update errors
            }
          }
          
          // PDFs don't have links to extract, so skip link extraction
          continue;
        }

        // Crawl the page (HTML content)
        const page = await browser.newPage();
        
        try {
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

          // Add to processing queue (async)
          this.addContentToQueue(currentUrl, html, markdown, depth, title);

          // Extract links for recursive crawling
          if (recursive && depth < maxDepth) {
            const links = await page.evaluate(() =>
              Array.from(document.querySelectorAll('a')).map(a => a.href)
            );

            for (const link of links) {
              try {
                const absoluteUrl = new URL(link, currentUrl).href;
                
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
          }

        } catch (error) {
          console.error(`[CRAWL PAGE ERROR] - Error crawling ${currentUrl}:`, error);
        } finally {
          await page.close();
        }
      }

      // Wait for all content processing to complete
      await this.waitForContentProcessing();

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
}

export default ParallelCrawlingService;