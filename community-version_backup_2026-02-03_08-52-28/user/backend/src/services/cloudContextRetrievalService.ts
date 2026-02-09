/**
 * Cloud Context Retrieval Service
 * Retrieves cloud file content during chat conversations
 */

import { Block } from '@prisma/client';
import weaviate, { WeaviateClient } from 'weaviate-ts-client';
import { createCloudProvider } from './cloudProviders/providerFactory';
import { CloudProviderType, CloudProviderConfig } from './cloudProviders/types';
import { decryptToken } from '../utils/tokenEncryption';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

// Initialize Weaviate client only if not in test environment
let client: WeaviateClient | null = null;
if (config.NODE_ENV !== 'test') {
  const weaviateHost = config.WEAVIATE_URL.replace('http://', '').replace('https://', '');
  client = weaviate.client({
    scheme: 'http',
    host: weaviateHost,
  });
}

// Simple in-memory cache for file content (1 hour TTL)
interface CachedFileContent {
  content: Buffer;
  timestamp: number;
}

const fileContentCache = new Map<string, CachedFileContent>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get cloud context from Weaviate for a given message
 */
export async function getCloudContextFromWeaviate(
  message: string,
  chatbotId: string
): Promise<{
  context: string;
  sources: Array<{ type: string; title: string; blockId?: string; url?: string }>;
}> {
  if (!client) {
    logger.warn('Weaviate client not initialized, cannot retrieve cloud context', {
      service: 'cloudContextRetrievalService',
    });
    return { context: '', sources: [] };
  }

  try {
    // Check if CloudFileContent schema exists
    let cloudSchemaExists = false;
    try {
      const schemas = await client.schema.getter().do();
      cloudSchemaExists = schemas.classes?.some((c: { class?: string }) => c.class === 'CloudFileContent') || false;
      if (!cloudSchemaExists) {
        logger.debug('CloudFileContent schema does not exist in Weaviate', {
          service: 'cloudContextRetrievalService',
        });
        return { context: '', sources: [] };
      }
    } catch (schemaError: unknown) {
      const schemaErrorMessage = schemaError instanceof Error ? schemaError.message : 'Unknown error';
      logger.error('Error checking CloudFileContent schema', schemaError instanceof Error ? schemaError : undefined, {
        service: 'cloudContextRetrievalService',
      });
      return { context: '', sources: [] };
    }

    // Search Weaviate for relevant cloud files
    let cloudResponse: {
      data?: {
        Get?: {
          CloudFileContent?: Array<{
            chatbotId?: string;
            blockId?: string;
            provider?: string;
            fileId?: string;
            fileName?: string;
            filePath?: string;
            fileType?: string;
            mimeType?: string;
            fileSize?: number;
            summary?: string;
            content?: string;
          }>;
        };
      };
    };
    try {
      // Try hybrid search first (combines BM25 + vector search for better results)
      try {
        cloudResponse = await client.graphql
          .get()
          .withClassName('CloudFileContent')
          .withFields('chatbotId blockId provider fileId fileName filePath fileType mimeType fileSize summary content')
          .withHybrid({
            query: message,
            alpha: 0.7, // Weight: 0.7 for vector search, 0.3 for BM25
          })
          .withWhere({
            path: ['chatbotId'],
            operator: 'Equal',
            valueString: chatbotId,
          })
          .withLimit(10) // Top 10 most relevant files
          .do();
      } catch (hybridError: unknown) {
        // Fallback to BM25 if hybrid search fails
        const hybridErrorMessage = hybridError instanceof Error ? hybridError.message : 'Unknown error';
        logger.warn('Hybrid search failed for CloudFileContent, trying BM25', {
          error: hybridErrorMessage,
          service: 'cloudContextRetrievalService',
        });
        cloudResponse = await client.graphql
          .get()
          .withClassName('CloudFileContent')
          .withFields('chatbotId blockId provider fileId fileName filePath fileType mimeType fileSize summary content')
          .withBm25({
            query: message,
          })
          .withWhere({
            path: ['chatbotId'],
            operator: 'Equal',
            valueString: chatbotId,
          })
          .withLimit(10) // Top 10 most relevant files
          .do();
      }
    } catch (searchError: unknown) {
      const searchErrorMessage = searchError instanceof Error ? searchError.message : 'Unknown error';
      logger.error('Cloud file search failed', searchError instanceof Error ? searchError : undefined, {
        service: 'cloudContextRetrievalService',
      });
      return { context: '', sources: [] };
    }

    const cloudFiles = cloudResponse.data?.Get?.CloudFileContent || [];
    if (cloudFiles.length === 0) {
      logger.debug('No cloud files found in Weaviate', {
        chatbotId,
        query: message,
        service: 'cloudContextRetrievalService',
      });
      return { context: '', sources: [] };
    }
    
    logger.debug('Found cloud files in Weaviate', {
      count: cloudFiles.length,
      chatbotId,
      service: 'cloudContextRetrievalService',
    });

    // Fetch actual file content for each relevant file
    const contextChunks: string[] = [];
    const sources: Array<{ type: string; title: string; blockId?: string; url?: string }> = [];

    for (const file of cloudFiles) {
      try {
        // Get block to retrieve access token
        const block = await prisma.block.findUnique({
          where: { id: file.blockId },
        });

        if (!block) {
          continue;
        }

        const properties = block.properties as Record<string, unknown>;
        const provider = properties.provider as CloudProviderType | undefined;
        const authMethod = properties.authMethod as string | undefined || 'oauth';
        const encryptedAccessToken = properties.accessToken as string | undefined;

        if (!provider || !encryptedAccessToken) {
          continue;
        }

        // Get access token based on auth method
        let accessToken: string;
        let username: string | undefined;
        let encryptedPassphrase: string | undefined;

        if (authMethod === 'app_password') {
          // For App Password, accessToken is the app password itself (not encrypted)
          accessToken = encryptedAccessToken;
          username = properties.username as string | undefined;
        } else if (authMethod === 'ssh_key') {
          // SSH key-based authentication
          // For SSH, accessToken is the encrypted private key
          try {
            accessToken = decryptToken(encryptedAccessToken);
            username = properties.username as string | undefined;
            encryptedPassphrase = properties.passphrase as string | undefined;
            // Password is handled separately in provider config
          } catch (decryptError: unknown) {
            const decryptErrorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
            logger.error('Failed to decrypt SSH private key for file', decryptError instanceof Error ? decryptError : undefined, {
              fileId: file.fileId,
              service: 'cloudContextRetrievalService',
            });
            // Skip this file and continue
            continue;
          }
        } else {
          // OAuth - decrypt token
          try {
            accessToken = decryptToken(encryptedAccessToken);
          } catch (decryptError: unknown) {
            const decryptErrorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
            logger.error('Failed to decrypt access token for file', decryptError instanceof Error ? decryptError : undefined, {
              fileId: file.fileId,
              service: 'cloudContextRetrievalService',
            });
            // Token might be corrupted or encrypted with different key
            // Skip this file and continue
            continue;
          }
        }

        // Check cache first
        const cacheKey = `${file.blockId}:${file.fileId}`;
        let fileContent: Buffer | null = null;

        const cached = fileContentCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          fileContent = cached.content;
        } else {
          // Fetch from provider
          let providerConfig: CloudProviderConfig;
          
          if (provider === 'googledrive') {
            // Google Drive uses global OAuth credentials from environment
            const clientId = config.GOOGLE_DRIVE_CLIENT_ID;
            const clientSecret = config.GOOGLE_DRIVE_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
              logger.error('Google Drive OAuth credentials not configured in user-backend', undefined, {
                service: 'cloudContextRetrievalService',
              });
              continue; // Skip this file
            }

            providerConfig = {
              clientId,
              clientSecret,
              // No baseUrl needed for Google Drive
            };
          } else if (provider === 'ssh') {
            // SSH provider configuration
            const passphrase = encryptedPassphrase ? decryptToken(encryptedPassphrase) : undefined;
            const encryptedPassword = properties.password as string | undefined;
            let password: string | undefined;
            if (encryptedPassword) {
              try {
                password = decryptToken(encryptedPassword);
              } catch (decryptError) {
                logger.warn('Failed to decrypt SSH password, continuing without password', {
                  fileId: file.fileId,
                  service: 'cloudContextRetrievalService',
                });
                // Continue without password - might still work with just key
              }
            }
            providerConfig = {
              host: properties.host as string | undefined,
              port: properties.port as number | undefined || 22,
              username: username,
              privateKey: accessToken, // Already decrypted above
              passphrase: passphrase,
              password: password, // For key+password authentication
              basePath: properties.basePath as string | undefined || '/',
            };
          } else {
            // Nextcloud uses per-block configuration
            providerConfig = {
              baseUrl: properties.baseUrl as string | undefined,
              clientId: properties.clientId as string | undefined,
              clientSecret: properties.clientSecret as string | undefined,
            };
          }

          const providerInstance = createCloudProvider(provider, providerConfig);

          try {
            // For Nextcloud and SSH, fileId stored in Weaviate is actually the path
            // For other providers, fileId is the actual ID
            // Use filePath as fallback if fileId looks like a numeric ID (for backward compatibility)
            const fileIdValue = file.fileId || '';
            const filePathValue = file.filePath || '';
            const fileIdentifier = (provider === 'nextcloud' || provider === 'ssh') && /^\d+$/.test(fileIdValue) 
              ? filePathValue 
              : fileIdValue;
            
            if (!fileIdentifier) {
              logger.warn('No valid file identifier for file', {
                fileName: file.fileName,
                service: 'cloudContextRetrievalService',
              });
              continue;
            }
            
            // For SSH, username is needed for connection (already extracted above)
            // For other providers, username is only needed for App Password auth
            fileContent = await providerInstance.getFileContent(
              accessToken, 
              fileIdentifier, 
              provider === 'ssh' ? username : (authMethod === 'app_password' ? username : undefined)
            );

            // Cache the content
            fileContentCache.set(cacheKey, {
              content: fileContent,
              timestamp: Date.now(),
            });
          } catch (fetchError: unknown) {
            const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
            logger.warn('Failed to fetch cloud file', {
              filePath: file.filePath,
              error: fetchErrorMessage,
              service: 'cloudContextRetrievalService',
            });
            // Use summary/content from Weaviate as fallback
            if (file.summary || file.content) {
              contextChunks.push(`File: ${file.fileName}\n${file.summary || file.content || ''}`);
              sources.push({
                type: 'cloud',
                title: file.fileName || 'Unknown file',
                blockId: file.blockId || undefined,
                url: file.filePath || undefined, // This might be a file ID for Google Drive, but that's okay
              });
            }
            continue;
          }
        }

        // Process file content based on MIME type
        if (fileContent) {
          let textContent = '';

          if (file.mimeType === 'application/pdf') {
            try {
              const pdfParse = require('pdf-parse');
              const pdfData = await pdfParse(fileContent);
              textContent = pdfData.text || '';
            } catch (pdfError) {
              logger.warn('Failed to parse PDF', {
                fileName: file.fileName,
                error: pdfError instanceof Error ? pdfError.message : String(pdfError),
                service: 'cloudContextRetrievalService',
              });
              textContent = file.summary || file.content || '';
            }
          } else if (file.mimeType?.startsWith('text/')) {
            textContent = fileContent.toString('utf-8');
          } else {
            // For other types, use summary/content from Weaviate
            textContent = file.summary || file.content || '';
          }

          if (textContent.trim()) {
            // Limit content length (first 5000 chars per file)
            const limitedContent = textContent.substring(0, 5000);
            // For Google Drive, filePath might be a file ID, so only show it if it looks like a path
            const showPath = file.filePath && file.filePath.includes('/');
            const pathInfo = showPath ? ` (${file.filePath})` : '';
            contextChunks.push(`File: ${file.fileName}${pathInfo}\n${limitedContent}`);
            sources.push({
              type: 'cloud',
              title: file.fileName || 'Unknown file',
              blockId: file.blockId || undefined,
              url: file.filePath || undefined,
            });
          }
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Error processing cloud file', {
          fileName: file.fileName,
          error: errorMessage,
          service: 'cloudContextRetrievalService',
        });
        // Continue with next file
      }
    }

    // Clean up old cache entries (keep cache size reasonable)
    if (fileContentCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of fileContentCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          fileContentCache.delete(key);
        }
      }
    }

    const finalContext = contextChunks.join('\n\n');
    logger.debug('Cloud context retrieval completed', {
      contextLength: finalContext.length,
      sourceCount: sources.length,
      service: 'cloudContextRetrievalService',
    });
    
    return {
      context: finalContext,
      sources,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Error retrieving cloud context', error instanceof Error ? error : undefined, {
      service: 'cloudContextRetrievalService',
    });
    return { context: '', sources: [] };
  }
}
