// Import from local copy in src tree (copied during Docker build)
import { getServiceBaseUrl } from '@shared/utils';
import { logger, extractMermaidBlocks, removeMermaidBlocks } from '@shared/utils';
import { config } from '../config';

const mermaidImageLogger = logger.child({ service: 'admin-backend', component: 'mermaidImageService' });

/**
 * Service to convert Mermaid diagrams to images for Slack
 * Calls user-backend's mermaid image service
 */

/**
 * Convert Mermaid diagram code to a base64 PNG image
 * Calls user-backend service to perform the conversion
 */
export async function mermaidToImage(mermaidCode: string): Promise<string> {
  const userBackendUrl = getServiceBaseUrl('user-backend');
  const internalServiceToken = config.INTERNAL_SERVICE_TOKEN;
  
  try {
    const response = await fetch(`${userBackendUrl}/api/mermaid/to-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Service': 'admin-backend',
        'X-Internal-Service-Token': internalServiceToken,
      },
      body: JSON.stringify({ mermaidCode }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to convert mermaid to image: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { imageBase64: string };
    return data.imageBase64;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    mermaidImageLogger.error('Error calling mermaid image service', { error: error instanceof Error ? error : new Error(String(error)) });
    throw new Error(`Failed to convert mermaid diagram to image: ${errorMessage}`);
  }
}

/**
 * Extract and convert all Mermaid diagrams in content to images
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
      mermaidImageLogger.error('Failed to convert mermaid diagram', { startIndex: block.startIndex, error: error instanceof Error ? error : new Error(String(error)) });
      // Continue with other diagrams even if one fails
    }
  }
  
  return results;
}
export { removeMermaidBlocks } from '@shared/utils';
