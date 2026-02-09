import puppeteer from 'puppeteer';
import { extractMermaidBlocks } from '@shared/utils';
import { logger } from '@shared/utils';

/**
 * Convert Mermaid diagram code to a base64 PNG image
 */
export async function mermaidToImage(mermaidCode: string): Promise<string> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1200, height: 800 });
    
    // Create HTML with Mermaid
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: white;
              font-family: Arial, sans-serif;
            }
            .mermaid {
              display: flex;
              justify-content: center;
              align-items: center;
            }
          </style>
        </head>
        <body>
          <div class="mermaid">
            ${mermaidCode}
          </div>
          <script>
            mermaid.initialize({ startOnLoad: true, theme: 'default' });
          </script>
        </body>
      </html>
    `;
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for mermaid to render (check for SVG elements)
    await page.waitForSelector('.mermaid svg', { timeout: 10000 });
    
    // Wait a bit more for any animations or final rendering
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Take screenshot of the mermaid diagram
    const mermaidElement = await page.$('.mermaid');
    if (!mermaidElement) {
      throw new Error('Mermaid diagram not found');
    }
    
    const screenshot = await mermaidElement.screenshot({ 
      type: 'png',
      encoding: 'base64',
    });
    
    return screenshot as string;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error converting mermaid to image', error instanceof Error ? error : undefined, {
      service: 'mermaidImageService',
    });
    throw new Error(`Failed to convert mermaid diagram to image: ${errorMessage}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Extract and convert all Mermaid diagrams in content to images
 * Returns array of { mermaidCode, imageBase64, startIndex, endIndex }
 */
export async function extractAndConvertMermaidDiagrams(content: string): Promise<Array<{
  mermaidCode: string;
  imageBase64: string;
  startIndex: number;
  endIndex: number;
}>> {
  const mermaidBlocks = extractMermaidBlocks(content);
  const results = [];
  
  for (const block of mermaidBlocks) {
    try {
      const imageBase64 = await mermaidToImage(block.code);
      results.push({
        mermaidCode: block.code,
        imageBase64,
        startIndex: block.startIndex,
        endIndex: block.endIndex,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to convert mermaid diagram', {
        startIndex: block.startIndex,
        error: errorMessage,
        service: 'mermaidImageService',
      });
      // Continue with other diagrams even if one fails
    }
  }
  
  return results;
}
