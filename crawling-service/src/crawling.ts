import puppeteer, { Page, Browser } from 'puppeteer';
import TurndownService from 'turndown';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import weaviate from 'weaviate-ts-client';
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

// Advanced scraping utilities
class AdvancedScraper {
  private page: Page;
  private maxScrollAttempts = 50;
  private scrollDelay = 1000;
  private clickDelay = 500;

  constructor(page: Page) {
    this.page = page;
  }

  // Wait for content to load with multiple strategies
  async waitForContentLoad(timeout = 30000): Promise<void> {
    try {
      // Wait for DOM to be ready
      await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
      
      // Wait for network to be idle (no requests for 500ms)
      await this.page.waitForFunction(() => {
        return new Promise<boolean>(resolve => {
          let timeoutId: NodeJS.Timeout;
          const checkIdle = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => resolve(true), 500);
          };
          
          // Check if there are any pending requests
          if (window.performance && window.performance.getEntriesByType) {
            const requests = window.performance.getEntriesByType('navigation');
            if (requests.length > 0) {
              checkIdle();
            } else {
              resolve(true);
            }
          } else {
            resolve(true);
          }
        });
      }, { timeout: 5000 });
      
    } catch (error) {
      // Fallback to simple timeout if advanced waiting fails
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Scroll to bottom and load all lazy content
  async scrollToLoadAllContent(): Promise<void> {
    let previousHeight = 0;
    let scrollAttempts = 0;
    let stableCount = 0;

    while (scrollAttempts < this.maxScrollAttempts) {
      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, this.scrollDelay));

      // Check if new content loaded
      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        stableCount++;
        if (stableCount >= 3) {
          // Content is stable, try clicking "Load More" buttons
          await this.clickLoadMoreButtons();
          await new Promise(resolve => setTimeout(resolve, this.scrollDelay));
          
          const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
          if (newHeight === currentHeight) {
            break; // No more content to load
          }
        }
      } else {
        stableCount = 0;
        previousHeight = currentHeight;
      }

      scrollAttempts++;
    }
  }

  // Click "Load More" or "Show More" buttons
  async clickLoadMoreButtons(): Promise<void> {
    const loadMoreSelectors = [
      'button[data-testid*="load"]',
      'button[data-testid*="more"]',
      'button[data-testid*="expand"]',
      'button:contains("Load more")',
      'button:contains("Show more")',
      'button:contains("See more")',
      'button:contains("View more")',
      'button:contains("Read more")',
      '[data-testid*="load-more"]',
      '[data-testid*="show-more"]',
      '.load-more',
      '.show-more',
      '.expand-content',
      'button[aria-label*="more"]',
      'button[aria-label*="load"]',
      'button[aria-label*="expand"]',
      '[role="button"][aria-label*="more"]',
      '.pagination .next',
      '.pagination .load-more',
      '.infinite-scroll-trigger',
      '.lazy-load-trigger'
    ];

    for (const selector of loadMoreSelectors) {
      try {
        const elements = await this.page.$$(selector);
        for (const element of elements) {
          try {
            const isVisible = await element.isIntersectingViewport();
            const isEnabled = await element.evaluate(el => !(el as HTMLElement).hasAttribute('disabled'));
            
            if (isVisible && isEnabled) {
              // Scroll element into view first
              await element.scrollIntoView();
              await new Promise(resolve => setTimeout(resolve, 200));
              
              // Click the element
              await element.click();
              await new Promise(resolve => setTimeout(resolve, this.clickDelay));
              
              console.log(`[CRAWL INTERACTION] - Clicked load more button: ${selector}`);
            }
          } catch (clickError) {
            // Try alternative click method
            try {
              await this.page.evaluate((el) => (el as HTMLElement).click(), element);
              await new Promise(resolve => setTimeout(resolve, this.clickDelay));
            } catch (altClickError) {
              // Ignore if both click methods fail
            }
          }
        }
      } catch (error) {
        // Ignore errors for individual selectors
      }
    }
  }

  // Handle Notion-specific interactions
  async handleNotionPage(): Promise<void> {
    // Wait for Notion to load
    await this.page.waitForSelector('[data-block-id]', { timeout: 10000 });
    
    // Click on collapsed blocks to expand them
    await this.page.evaluate(() => {
      const collapsedBlocks = document.querySelectorAll('[data-block-id] .notion-block-children[style*="display: none"]');
      collapsedBlocks.forEach(block => {
        const toggle = block.previousElementSibling?.querySelector('.notion-block-children-toggle');
        if (toggle) {
          (toggle as HTMLElement).click();
        }
      });
    });

    // Scroll to load all blocks
    await this.scrollToLoadAllContent();

    // Click on "Show more" for long text blocks
    await this.page.evaluate(() => {
      const showMoreButtons = document.querySelectorAll('[data-testid="show-more-button"]');
      showMoreButtons.forEach(button => {
        (button as HTMLElement).click();
      });
    });
  }

  // Handle infinite scroll pages
  async handleInfiniteScroll(): Promise<void> {
    let previousHeight = 0;
    let scrollAttempts = 0;

    while (scrollAttempts < this.maxScrollAttempts) {
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await new Promise(resolve => setTimeout(resolve, this.scrollDelay));

      const currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
      
      if (currentHeight === previousHeight) {
        break;
      }

      previousHeight = currentHeight;
      scrollAttempts++;
    }
  }

  // Detect page type and apply appropriate strategy
  async detectAndHandlePageType(): Promise<void> {
    const url = this.page.url();
    
    // Notion pages
    if (url.includes('notion.so') || url.includes('notion.site')) {
      await this.handleNotionPage();
      return;
    }

    // React/Vue/Angular SPAs
    if (await this.isSinglePageApp()) {
      await this.handleSinglePageApp();
      return;
    }

    // Social media platforms
    if (url.includes('reddit.com') || url.includes('twitter.com') || url.includes('linkedin.com')) {
      await this.handleSocialMediaPage();
      return;
    }

    // E-commerce sites
    if (url.includes('amazon.com') || url.includes('shopify.com') || url.includes('ecommerce')) {
      await this.handleEcommercePage();
      return;
    }

    // Generic infinite scroll
    await this.scrollToLoadAllContent();
  }

  // Check if page is a Single Page Application
  async isSinglePageApp(): Promise<boolean> {
    try {
      const hasReact = await this.page.evaluate(() => {
        return !!((window as any).React || document.querySelector('[data-reactroot]') || 
                 document.querySelector('[data-react-helmet]'));
      });

      const hasVue = await this.page.evaluate(() => {
        return !!((window as any).Vue || document.querySelector('[data-v-]') || 
                 document.querySelector('.v-application'));
      });

      const hasAngular = await this.page.evaluate(() => {
        return !!((window as any).ng || document.querySelector('[ng-app]') || 
                 document.querySelector('[ng-controller]'));
      });

      return hasReact || hasVue || hasAngular;
    } catch (error) {
      return false;
    }
  }

  // Handle Single Page Applications
  async handleSinglePageApp(): Promise<void> {
    console.log('[CRAWL SPA] - Detected Single Page Application');
    
    // Wait for initial content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Scroll to load content
    await this.scrollToLoadAllContent();
    
    // Wait for any lazy-loaded components
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Handle social media pages
  async handleSocialMediaPage(): Promise<void> {
    console.log('[CRAWL SOCIAL] - Detected social media page');
    
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Scroll multiple times to load content
    for (let i = 0; i < 10; i++) {
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Handle e-commerce pages
  async handleEcommercePage(): Promise<void> {
    console.log('[CRAWL ECOMMERCE] - Detected e-commerce page');
    
    // Wait for product listings to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Click on "Load More Products" or similar buttons
    await this.clickLoadMoreButtons();
    
    // Scroll to load more products
    await this.scrollToLoadAllContent();
  }

  // Extract clean content with better text extraction
  async extractContent(): Promise<{ content: string; title: string }> {
    // Remove unwanted elements
    await this.page.evaluate(() => {
      const unwantedSelectors = [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.ad',
        '.sidebar',
        '.menu',
        '.navigation',
        '.cookie-banner',
        '.popup',
        '.modal',
        '[data-testid*="ad"]',
        '[class*="ad-"]',
        '[id*="ad-"]'
      ];

      unwantedSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
    });

    // Get the main content and title
    const result = await this.page.evaluate(() => {
      // Extract page title
      const titleElement = document.querySelector('title');
      const title = titleElement ? titleElement.textContent?.trim() || '' : '';
      
      // Try to find main content area
      const mainSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.content',
        '.post-content',
        '.article-content',
        '.page-content',
        '#content',
        '.notion-page-content'
      ];

      let mainElement = null;
      for (const selector of mainSelectors) {
        mainElement = document.querySelector(selector);
        if (mainElement) break;
      }

      const content = mainElement ? mainElement.innerHTML : document.body.innerHTML;
      
      return { content, title };
    });

    return result;
  }
}

// Helper function to normalize a URL
const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    urlObj.hash = ''; // Remove fragment
    urlObj.search = ''; // Remove query parameters
    let pathname = urlObj.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    urlObj.pathname = pathname;
    return urlObj.toString();
  } catch (error) {
    // Handle invalid URLs gracefully
    return '';
  }
};

interface CrawlJob {
  startUrl: string;
  chatbotId: string;
  blockId: string;
  recursive: boolean;
  maxDepth: number;
}

class CrawlingService {
  private queue: CrawlJob[] = [];
  private isCrawling = false;
  private currentJob: CrawlJob | null = null;

  constructor() {
    this.createSchema();
    this.processQueue();
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
      // Ignore error if schema already exists
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
    
    // Remove jobs from queue for this chatbot and block
    this.queue = this.queue.filter(job => !(job.chatbotId === chatbotId && job.blockId === blockId));
    
    // If the current job matches, stop it
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
      await this.crawlWebsite(job.startUrl, job.chatbotId, job.blockId, job.recursive, job.maxDepth);
    } finally {
      this.currentJob = null;
    }
    
    this.processQueue();
  }

  private async crawlWebsite(startUrl: string, chatbotId: string, blockId: string, recursive: boolean, maxDepth: number) {
    console.log(`[CRAWL START] - blockId: ${blockId} - url: ${startUrl}`);
    
    // Check if this job should be stopped
    if (!this.currentJob || this.currentJob.blockId !== blockId) {
      console.log(`[CRAWL STOPPED] - Job for blockId: ${blockId} was stopped`);
      return { success: false, error: 'Crawl was stopped' };
    }

    // Retry configuration
    const maxRetries = 3;
    let retryCount = 0;

    // Content processing queue for async processing
    const contentProcessingQueue: Array<{
      url: string;
      html: string;
      markdown: string;
      depth: number;
      title: string;
    }> = [];

    // Background content processor
    let isProcessingContent = false;
    const processContentInBackground = async () => {
      if (isProcessingContent || contentProcessingQueue.length === 0) return;
      
      isProcessingContent = true;
      const content = contentProcessingQueue.shift();
      if (!content) {
        isProcessingContent = false;
        return;
      }

      try {
        console.log(`[CRAWL PROCESSING] - Processing content for: ${content.url} (Queue: ${contentProcessingQueue.length})`);
        
        // Check if WebsiteContext still exists before storing in Weaviate
        try {
          const websiteContext = await prisma.websiteContext.findUnique({
            where: { blockId }
          });
          if (!websiteContext) {
            console.log(`[CRAWL SKIP] - WebsiteContext record not found for blockId: ${blockId}, skipping Weaviate storage for: ${content.url}`);
            isProcessingContent = false;
            return;
          }
        } catch (error) {
          console.log(`[CRAWL SKIP] - Error checking WebsiteContext for blockId: ${blockId}, skipping Weaviate storage for: ${content.url}`);
          isProcessingContent = false;
          return;
        }

        // Store content in Weaviate
        if (client) {
          const chunkSize = 4000;
          for (let i = 0; i < content.markdown.length; i += chunkSize) {
            const chunk = content.markdown.substring(i, i + chunkSize);
            await client.data
              .creator()
              .withClassName('WebsiteContent')
              .withProperties({
                chatbotId,
                blockId,
                url: content.url,
                content: chunk,
                title: content.title,
              })
              .do();
        }
        console.log(`[CRAWL WEAVIATE] - Stored content for: ${content.url}`);
      } else {
        console.log(`[CRAWL SKIP] - Weaviate client not available, skipping storage for: ${content.url}`);
      }
      } catch (error) {
        console.error(`[CRAWL PROCESSING ERROR] - Error processing content for ${content.url}:`, error);
      } finally {
        isProcessingContent = false;
      }
    };

    // Start background processor
    const backgroundProcessor = setInterval(processContentInBackground, 100); // Process every 100ms

    // Check if the WebsiteContext record still exists (in case chatbot was deleted)
    try {
      const websiteContext = await prisma.websiteContext.findUnique({
        where: { blockId }
      });
      if (!websiteContext) {
        console.log(`[CRAWL STOPPED] - WebsiteContext record not found for blockId: ${blockId}, chatbot may have been deleted`);
        return { success: false, error: 'WebsiteContext record not found' };
      }
    } catch (error) {
      console.log(`[CRAWL STOPPED] - Error checking WebsiteContext for blockId: ${blockId}, chatbot may have been deleted`);
      return { success: false, error: 'Error checking WebsiteContext' };
    }
    
    if (!config.OPENAI_API_KEY) {
      console.error('[CRAWL ERROR] - OPENAI_API_KEY is not set');
      throw new Error('OPENAI_API_KEY is not set');
    }

    const startUrlNormalized = normalizeUrl(startUrl);
    if (!startUrlNormalized) {
      console.error(`[CRAWL ERROR] - Invalid start URL: ${startUrl}`);
      return { success: false, error: 'Invalid start URL' };
    }

    const queue: { url: string; depth: number }[] = [{ url: startUrlNormalized, depth: 0 }];
    const visited = new Set<string>();
    const queueSet = new Set<string>([startUrlNormalized]);
    const baseUrl = new URL(startUrlNormalized).origin;

    try {
      await prisma.websiteContext.update({
        where: { blockId },
        data: {
          crawlingStatus: { status: 'starting', progress: 0, total: 1, currentUrl: startUrl },
        },
      });
    } catch (error) {
      // If the WebsiteContext record doesn't exist (e.g., chatbot was deleted), log and continue
      console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}, continuing crawl...`);
    }

    let browser: Browser | undefined;
    let crawlResult = { success: false, error: '' };

    // Retry loop for the entire crawling process
    while (retryCount <= maxRetries) {
      try {
        console.log(`[CRAWL BROWSER] - Launching Puppeteer (attempt ${retryCount + 1}/${maxRetries + 1})`);
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
            '--disable-images', // Disable images for faster loading
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
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        console.error(`[CRAWL BROWSER ERROR] - Failed to launch Puppeteer (attempt ${retryCount}/${maxRetries + 1}):`, error);
        
        if (retryCount > maxRetries) {
          try {
            await prisma.websiteContext.update({
              where: { blockId },
              data: { crawlingStatus: { status: 'error' } },
            });
          } catch (updateError) {
            console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}, cannot update error status`);
          }
          return { success: false, error: 'Failed to launch browser after retries' };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
      }
    }

    try {
      while (queue.length > 0) {
        // Check if this job should be stopped
        if (!this.currentJob || this.currentJob.blockId !== blockId) {
          console.log(`[CRAWL STOPPED] - Job for blockId: ${blockId} was stopped during crawling`);
          break;
        }

        // Periodically check if the WebsiteContext record still exists (in case chatbot was deleted)
        if (visited.size % 10 === 0) { // Check every 10 pages
          try {
            const websiteContext = await prisma.websiteContext.findUnique({
              where: { blockId }
            });
            if (!websiteContext) {
              console.log(`[CRAWL STOPPED] - WebsiteContext record not found for blockId: ${blockId} during crawl, chatbot may have been deleted`);
              break;
            }
          } catch (error) {
            console.log(`[CRAWL STOPPED] - Error checking WebsiteContext for blockId: ${blockId} during crawl, chatbot may have been deleted`);
            break;
          }
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
              crawlingStatus: { status: 'crawling', progress: visited.size, total: visited.size + queue.length, currentUrl },
            },
          });
        } catch (error) {
          // If the WebsiteContext record doesn't exist (e.g., chatbot was deleted), log and continue
          console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}, continuing crawl...`);
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
            
            // Convert PDF text to markdown (basic conversion, same as document block)
            const markdown = pdfText
              .replace(/\s+/g, ' ')
              .trim()
              .replace(/\n\s*\n/g, '\n\n')
              .replace(/^([A-Z][A-Z\s]+)$/gm, '# $1')
              .replace(/^[\s]*[-•]\s+/gm, '- ')
              .replace(/^[\s]*(\d+\.)\s+/gm, '$1 ');
            
            // Add PDF content to processing queue (same way as HTML pages)
            contentProcessingQueue.push({
              url: currentUrl,
              html: `<div>${pdfText}</div>`,
              markdown: markdown,
              depth: depth,
              title: pdfTitle
            });
            console.log(`[CRAWL QUEUE] - Added PDF content to processing queue for: ${currentUrl}`);
            
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

        let pageRetryCount = 0;
        const maxPageRetries = 2;
        let pageSuccess = false;

        while (pageRetryCount <= maxPageRetries && !pageSuccess) {
          let page;
          try {
            page = await browser!.newPage();
            
            // Set user agent to avoid bot detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Set viewport for consistent rendering
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Enable JavaScript for dynamic content
            await page.setJavaScriptEnabled(true);
            
            // Set extra headers to avoid bot detection
            await page.setExtraHTTPHeaders({
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Upgrade-Insecure-Requests': '1',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            });
            
            // Navigate to page with enhanced wait strategy
            await page.goto(currentUrl, { 
              waitUntil: 'domcontentloaded', 
              timeout: 60000 
            });
            
            console.log(`[CRAWL PAGE LOADED] - Page loaded: ${currentUrl} (attempt ${pageRetryCount + 1})`);
            
            // Use advanced scraper for complex content
            const scraper = new AdvancedScraper(page);
            
            // Wait for initial content load
            await scraper.waitForContentLoad();
            
            // Detect page type and handle accordingly
            await scraper.detectAndHandlePageType();
            
            // Extract clean content
            const { content: html, title } = await scraper.extractContent();
            
            console.log(`[CRAWL PAGE SUCCESS] - Successfully crawled: ${currentUrl} (Title: ${title})`);

            // Convert to markdown with enhanced options
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

            // Add content to processing queue for async processing
            contentProcessingQueue.push({
              url: currentUrl,
              html: html,
              markdown: markdown,
              depth: depth,
              title: title
            });
            console.log(`[CRAWL QUEUE] - Added content to processing queue for: ${currentUrl}`);

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
                  
                  const normalizedAbsoluteUrl = normalizeUrl(absoluteUrl);

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

            await page.close();
            pageSuccess = true; // Mark as successful
            break; // Exit retry loop

          } catch (error) {
            console.error(`[CRAWL PAGE ERROR] - Error crawling ${currentUrl} (attempt ${pageRetryCount + 1}):`, error);
            pageRetryCount++;
            
            if (page) {
              try {
                await page.close();
              } catch (closeError) {
                // Ignore close errors
              }
            }
            
            if (pageRetryCount > maxPageRetries) {
              console.error(`[CRAWL PAGE FAILED] - Failed to crawl ${currentUrl} after ${maxPageRetries + 1} attempts`);
              break; // Exit retry loop and continue to next page
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * pageRetryCount));
          }
        }
      }

      // Wait for all content processing to complete
      console.log(`[CRAWL WAITING] - Waiting for ${contentProcessingQueue.length} items to be processed...`);
      while (contentProcessingQueue.length > 0 || isProcessingContent) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      }
      console.log(`[CRAWL PROCESSING] - All content processing completed`);
      
      // Clear the background processor
      clearInterval(backgroundProcessor);

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
        // If the WebsiteContext record doesn't exist (e.g., chatbot was deleted), log and continue
        console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}, cannot update completion status`);
      }

      console.log(`[CRAWL SUCCESS] - Crawled and stored content for blockId ${blockId} from ${startUrl}`);
      return { success: true };
    } catch (error) {
      console.error(`[CRAWL ERROR] - General error for blockId ${blockId}:`, error);
      try {
        await prisma.websiteContext.update({
          where: { blockId },
          data: {
            crawlingStatus: { status: 'error' },
          },
        });
      } catch (updateError) {
        // If the WebsiteContext record doesn't exist (e.g., chatbot was deleted), log and continue
        console.log(`[CRAWL WARNING] - WebsiteContext record not found for blockId: ${blockId}, cannot update error status`);
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
}

export { AdvancedScraper };
export default CrawlingService;
