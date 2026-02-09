/**
 * Cloud Indexing Service
 * Indexes cloud file metadata into Weaviate for semantic search
 */

import { Block } from '@prisma/client';
import { getWeaviateClient } from '../weaviate';
import { getCloudAccessToken, refreshCloudAccessToken } from './cloudOAuthService';
import { createCloudProvider, CloudProviderType } from './cloudProviders/providerFactory';
import { CloudFileMetadata } from './cloudProviders/types';
import { CloudIntegrationProperties, getCloudIntegration, updateCloudIntegration } from './cloudIntegrationService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../lib/prisma';
import { logger } from '@shared/utils';
import { config } from '../config';

const cloudIndexingLogger = logger.child({ service: 'admin-backend', component: 'cloudIndexingService' });

// Initialize Gemini for summary generation
const genAI = config.GEMINI_API_KEY
  ? new GoogleGenerativeAI(config.GEMINI_API_KEY)
  : null;

// Parallel processing configuration
const CONCURRENT_FILES = config.CLOUD_INDEXING_CONCURRENT_FILES; // Number of files to process in parallel
const CONCURRENT_FOLDERS = config.CLOUD_INDEXING_CONCURRENT_FOLDERS; // Number of folders to list in parallel (for depth=1 fallback)

/**
 * Ensure CloudFileContent schema exists in Weaviate
 */
async function ensureCloudFileContentSchema(): Promise<void> {
  const client = getWeaviateClient();
  if (!client) {
    return;
  }

  try {
    // Check if schema already exists
    const schemaExists = await client.schema
      .getter()
      .do()
      .then((schemas: { classes?: Array<{ class?: string }> }) => {
        return schemas.classes?.some((c: { class?: string }) => c.class === 'CloudFileContent');
      })
      .catch(() => false);

    if (schemaExists) {
      return;
    }

    // Create schema
    const schemaConfig = {
      class: 'CloudFileContent',
      vectorizer: 'text2vec-openai',
      moduleConfig: {
        'text2vec-openai': {
          model: 'ada',
          modelVersion: '002',
          type: 'text',
        },
      },
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
          name: 'provider',
          dataType: ['string'], // 'nextcloud' | 'googledrive' | 'onedrive'
        },
        {
          name: 'fileId',
          dataType: ['string'], // Provider-specific file ID
        },
        {
          name: 'fileName',
          dataType: ['string'],
        },
        {
          name: 'filePath',
          dataType: ['string'], // Full path from root
        },
        {
          name: 'fileType',
          dataType: ['string'], // 'file' | 'folder'
        },
        {
          name: 'mimeType',
          dataType: ['string'],
        },
        {
          name: 'fileSize',
          dataType: ['int'],
        },
        {
          name: 'modifiedAt',
          dataType: ['date'],
        },
        {
          name: 'summary',
          dataType: ['text'], // LLM-generated summary for semantic search
        },
        {
          name: 'content',
          dataType: ['text'], // Optional: first chunk of content for better search
        },
      ],
    };

    await client.schema.classCreator().withClass(schemaConfig).do();
    cloudIndexingLogger.info('CloudFileContent schema created successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('already exists')) {
      // Schema already exists - that's fine
      return;
    }
    
    // Check for read-only errors
    if (errorMessage.includes('read-only') || errorMessage.includes('store is read-only')) {
      cloudIndexingLogger.error('Weaviate is read-only, cannot create CloudFileContent schema');
      throw new Error('Weaviate storage is read-only. Cannot create schema. Please fix Weaviate configuration first.');
    }
    
    cloudIndexingLogger.error('Error creating CloudFileContent schema', { error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

/**
 * Generate semantic summary for a file using LLM
 * If content is not available, generates summary from filename and metadata
 */
async function generateFileSummary(
  fileName: string,
  fileContent: string,
  mimeType?: string
): Promise<string> {
  if (!genAI) {
    // No LLM available - generate basic summary from filename
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return `File: ${nameWithoutExt}`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Limit content length for summary (first 5000 chars)
    const contentPreview = fileContent.substring(0, 5000);
    const fileType = mimeType || 'unknown';

    // If no content available, generate summary from filename only
    if (!fileContent || fileContent.trim().length === 0) {
      const prompt = `Generate a brief 1-2 sentence summary of what this file might contain based on its filename. Focus on likely topics and purpose.

File name: ${fileName}
File type: ${fileType}

Summary:`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text().trim();
      return summary || `File: ${fileName}`;
    }

    const prompt = `Generate a brief 1-2 sentence summary of this file for semantic search purposes. Focus on key topics, purpose, and main content.

File name: ${fileName}
File type: ${fileType}
Content preview:
${contentPreview}

Summary:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.text().trim();

    return summary || `File: ${fileName}`;
  } catch (error) {
    cloudIndexingLogger.error('Error generating file summary', { error: error instanceof Error ? error : new Error(String(error)) });
    // Fallback to filename-based summary
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    return `File: ${nameWithoutExt}`;
  }
}

/**
 * Process file content based on MIME type
 */
async function processFileContent(
  fileContent: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{ text: string; summary: string }> {
  let fileText = '';

  // Handle different file types
  if (mimeType === 'application/pdf') {
    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileContent);
      fileText = pdfData.text || '';
    } catch (error) {
      cloudIndexingLogger.warn('Failed to parse PDF', { error: error instanceof Error ? error : new Error(String(error)) });
      fileText = '';
    }
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    // DOCX/DOC support - would need mammoth or similar library
    // For now, return empty text
    fileText = '';
  } else if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') {
    // Markdown files - use as-is
    fileText = fileContent.toString('utf-8');
  } else if (mimeType?.startsWith('text/')) {
    // Plain text files
    fileText = fileContent.toString('utf-8');
  } else {
    // Default: try to decode as UTF-8
    fileText = fileContent.toString('utf-8');
  }

  // Generate summary
  const summary = await generateFileSummary(fileName, fileText, mimeType);

  return { text: fileText, summary };
}

/**
 * Index a single cloud file into Weaviate
 */
async function indexCloudFile(
  chatbotId: string,
  blockId: string,
  provider: CloudProviderType,
  file: CloudFileMetadata,
  fileContent?: Buffer
): Promise<void> {
  const client = getWeaviateClient();
  if (!client) {
    return;
  }

  try {
    let summary = `File: ${file.name}`;
    let contentPreview = '';

    // Process file content if available and it's a text file
    // We only download content during indexing to generate summaries
    // Full content is retrieved on-demand during chat conversations
    if (fileContent && file.type === 'file' && file.mimeType) {
      const textMimeTypes = [
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'application/pdf',
      ];

      if (textMimeTypes.some((type) => file.mimeType?.includes(type))) {
        const processed = await processFileContent(fileContent, file.name, file.mimeType);
        summary = processed.summary;
        // Only store small preview (first 1000 chars) for search, not full content
        // Full content will be retrieved on-demand during chat
        contentPreview = processed.text.substring(0, 1000);
      } else {
        // For non-text files, generate summary from filename
        summary = await generateFileSummary(file.name, '', file.mimeType);
      }
    } else {
      // No content available - generate summary from filename
      summary = await generateFileSummary(file.name, '', file.mimeType);
    }

    // For Nextcloud and SSH, use path as fileId (since getFileContent expects path, not numeric ID)
    // For other providers, use the actual file ID
    const fileIdForStorage = (provider === 'nextcloud' || provider === 'ssh') ? file.path : file.id;
    
    // Store in Weaviate - only store metadata and summary, NOT full content
    // Content will be retrieved on-demand during chat to avoid vectorizing everything
    try {
      await client.data
        .creator()
        .withClassName('CloudFileContent')
        .withProperties({
          chatbotId,
          blockId,
          provider,
          fileId: fileIdForStorage, // Use path for Nextcloud, ID for others
          fileName: file.name,
          filePath: file.path,
          fileType: file.type,
          mimeType: file.mimeType || undefined,
          fileSize: file.size || undefined,
          modifiedAt: file.modifiedAt?.toISOString() || undefined,
          summary, // LLM-generated summary for semantic search
          content: contentPreview, // Small preview only (first 1000 chars) - not full content
        })
        .do();
    } catch (weaviateError: unknown) {
      const weaviateErrorMessage = weaviateError instanceof Error ? weaviateError.message : 'Unknown error';
      // Handle Weaviate read-only errors gracefully
      if (weaviateErrorMessage.includes('read-only') || weaviateErrorMessage.includes('store is read-only')) {
        const errorMsg = `Weaviate is read-only, cannot index file ${file.path}. Please check Weaviate configuration.`;
        cloudIndexingLogger.error('Weaviate is read-only, cannot index file', { filePath: file.path });
        throw new Error(`Weaviate storage is read-only. Cannot index files. Please contact administrator.`);
      }
      throw weaviateError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    cloudIndexingLogger.error('Error indexing cloud file', { filePath: file.path, error: error instanceof Error ? error : new Error(String(error)) });
    throw error;
  }
}

/**
 * Index cloud files for a block
 */
export async function indexCloudFiles(blockId: string): Promise<{
  success: boolean;
  indexedCount: number;
  error?: string;
}> {
  try {
    // Get block
    const block = await prisma.block.findUnique({
      where: { id: blockId },
      include: {
        chatbot: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!block) {
      throw new Error('Block not found');
    }

    const properties = getCloudIntegration(block);
    const provider = properties.provider;

    if (!provider) {
      throw new Error('Cloud provider not configured');
    }

    if (!properties.isConnected) {
      throw new Error('Cloud storage not connected');
    }


    // Update indexing status and clear cancellation flag
    // Use updateCloudIntegration to preserve all properties correctly
    await updateCloudIntegration(blockId, {
      indexingStatus: 'indexing',
      indexingError: undefined,
      indexingCancelled: false,
      indexedFileCount: 0, // Reset counter when starting new indexing
      filesDiscovered: 0, // Reset discovered counter when starting new indexing
    });

    // Re-fetch block to get latest properties (in case they were updated)
    const updatedBlock = await prisma.block.findUnique({
      where: { id: blockId },
    });

    if (!updatedBlock) {
      throw new Error('Block not found after update');
    }

    // Get latest properties
    const latestProperties = getCloudIntegration(updatedBlock);

    // Ensure schema exists
    await ensureCloudFileContentSchema();

    // Get access token based on auth method
    const authMethod = latestProperties.authMethod || 'oauth';
    let accessToken: string;
    let username: string | undefined;

    if (authMethod === 'app_password') {
      // For App Password, accessToken is the app password itself (not encrypted)
      accessToken = latestProperties.accessToken as string | undefined || '';
      username = latestProperties.username as string | undefined;
      
      if (!username || !accessToken) {
        throw new Error(`Username and App Password are required for App Password authentication. Found: username=${!!username}, accessToken=${!!accessToken}, authMethod=${authMethod}`);
      }
    } else if (authMethod === 'ssh_key') {
      // SSH key-based authentication
      const encryptedPrivateKey = latestProperties.accessToken as string | undefined;
      const encryptedPassphrase = latestProperties.passphrase as string | undefined;
      const encryptedPassword = latestProperties.password as string | undefined;
      
      if (!encryptedPrivateKey) {
        throw new Error('SSH private key is required');
      }
      
      // Decrypt SSH credentials
      const { decryptToken } = await import('./cloudOAuthService');
      try {
        accessToken = decryptToken(encryptedPrivateKey);
        username = latestProperties.username as string | undefined;
      } catch (decryptError) {
        const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
        cloudIndexingLogger.error('Failed to decrypt SSH private key', {
          error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
        });
        throw new Error(`Failed to decrypt SSH private key: ${errorMessage}`);
      }
    } else {
      // OAuth flow - get encrypted token
      accessToken = await getCloudAccessToken(updatedBlock);
    }

    // Helper function to refresh token and retry operation on 401 errors
    const withTokenRefresh = async <T>(
      operation: (token: string) => Promise<T>,
      maxRetries: number = 1
    ): Promise<T> => {
      let currentToken = accessToken;
      let retries = 0;

      while (retries <= maxRetries) {
        try {
          return await operation(currentToken);
        } catch (error: unknown) {
          // Check if it's a 401 error (unauthorized/invalid token)
          interface TokenError {
            response?: {
              status?: number;
            };
            status?: number;
            code?: number | string;
            message?: string;
          }
          const tokenError = error as TokenError;
          const is401Error = tokenError.response?.status === 401 || 
                            tokenError.status === 401 || 
                            tokenError.code === 401 ||
                            (tokenError.message && (
                              tokenError.message.includes('Invalid Credentials') ||
                              tokenError.message.includes('invalid_token') ||
                              tokenError.message.includes('Unauthorized')
                            ));

          if (is401Error && authMethod === 'oauth' && provider !== 'ssh' && retries < maxRetries) {
            // Token expired or invalid, try to refresh
            cloudIndexingLogger.info('Token expired (401 error), attempting refresh', { attempt: retries + 1, maxRetries: maxRetries + 1 });
            
            try {
              // Re-fetch block to get latest state
              const currentBlock = await prisma.block.findUnique({
                where: { id: blockId },
              });
              
              if (!currentBlock) {
                throw new Error('Block not found');
              }

              const refreshed = await refreshCloudAccessToken(currentBlock);
              
              // Update block with new tokens
              await prisma.block.update({
                where: { id: blockId },
                data: {
                  properties: {
                    ...(currentBlock.properties as Record<string, unknown>),
                    accessToken: refreshed.accessToken,
                    refreshToken: refreshed.refreshToken,
                    tokenExpiresAt: refreshed.expiresAt?.toISOString(),
                  },
                },
              });

              // Re-fetch block to get updated properties
              const refreshedBlock = await prisma.block.findUnique({
                where: { id: blockId },
              });
              
              if (refreshedBlock) {
                // Update latestProperties and currentToken
                Object.assign(latestProperties, getCloudIntegration(refreshedBlock));
                currentToken = await getCloudAccessToken(refreshedBlock);
                accessToken = currentToken; // Update outer scope token
                retries++;
                continue; // Retry operation with new token
              } else {
                throw new Error('Block not found after token refresh');
              }
            } catch (refreshError) {
              const originalErrorMsg = tokenError.message || 'Unknown error';
              throw new Error(`Token refresh failed: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}. Original error: ${originalErrorMsg}`);
            }
          } else {
            // Not a 401 error or max retries reached, throw original error
            throw error;
          }
        }
      }

      throw new Error('Max retries reached for token refresh');
    };

    // Create provider instance
    let providerConfig;
    if (provider === 'googledrive') {
      // Google Drive uses global OAuth credentials
      providerConfig = {
        clientId: config.GOOGLE_DRIVE_CLIENT_ID,
        clientSecret: config.GOOGLE_DRIVE_CLIENT_SECRET,
      };
    } else if (provider === 'ssh') {
      // SSH provider configuration
      // Validate required SSH properties
      if (!latestProperties.host) {
        throw new Error('SSH host is required. Please configure the SSH connection first.');
      }
      
      const encryptedPassphrase = latestProperties.passphrase as string | undefined;
      const encryptedPassword = latestProperties.password as string | undefined;
      const { decryptToken } = await import('./cloudOAuthService');
      
      let passphrase: string | undefined;
      let password: string | undefined;
      
      if (encryptedPassphrase) {
        try {
          passphrase = decryptToken(encryptedPassphrase);
        } catch (decryptError) {
          cloudIndexingLogger.warn('Failed to decrypt SSH passphrase', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      if (encryptedPassword) {
        try {
          password = decryptToken(encryptedPassword);
        } catch (decryptError) {
          cloudIndexingLogger.warn('Failed to decrypt SSH password', {
            error: decryptError instanceof Error ? decryptError : new Error(String(decryptError)),
          });
        }
      }
      
      providerConfig = {
        host: latestProperties.host,
        port: latestProperties.port || 22,
        username: username || latestProperties.username, // Use username from auth or properties
        privateKey: accessToken, // Already decrypted above
        passphrase: passphrase,
        password: password,
        basePath: latestProperties.basePath || '/',
      };
    } else {
      // Nextcloud uses per-block configuration
      providerConfig = {
        baseUrl: latestProperties.baseUrl,
        clientId: latestProperties.clientId,
        clientSecret: latestProperties.clientSecret,
      };
    }
    const providerInstance = createCloudProvider(provider, providerConfig);

    // Get selected paths/IDs
    // For Google Drive: contains folder/file IDs
    // For Nextcloud: contains paths
    const selectedPaths = latestProperties.selectedPaths;
    
    // If no paths selected, don't index (user needs to select folders first)
    if (!selectedPaths || selectedPaths.length === 0) {
      throw new Error('No folders selected. Please select folders to index first.');
    }
    
    // Use selectedPaths as-is (can include empty string for root, or specific folder paths)
    const pathsToIndex = selectedPaths;

    // Get file type filters
    const fileTypeFilters = latestProperties.fileTypeFilters || [];

    let totalIndexed = 0;

    // Helper function to check if indexing was cancelled
    const checkCancellation = async (): Promise<boolean> => {
      const currentBlock = await prisma.block.findUnique({
        where: { id: blockId },
      });
      if (!currentBlock) return true;
      const currentProperties = getCloudIntegration(currentBlock);
      return currentProperties.indexingCancelled === true;
    };

      // Helper function to update listing progress with throttling
      let lastListingProgressUpdate = 0;
      const LISTING_PROGRESS_THROTTLE_MS = 2000; // Update at most every 2 seconds
      
      const updateListingProgress = async (filesDiscovered: number) => {
        const now = Date.now();
        // Throttle updates to avoid too many database writes
        if (now - lastListingProgressUpdate < LISTING_PROGRESS_THROTTLE_MS && filesDiscovered > 0) {
          return; // Skip this update
        }
        lastListingProgressUpdate = now;
        
        try {
          const currentBlock = await prisma.block.findUnique({
            where: { id: blockId },
          });
          if (currentBlock) {
            const currentProperties = getCloudIntegration(currentBlock);
            await prisma.block.update({
              where: { id: blockId },
              data: {
                properties: {
                  ...currentProperties,
                  filesDiscovered: filesDiscovered,
                },
              },
            });
          }
        } catch (error) {
          // Don't fail indexing if progress update fails
          cloudIndexingLogger.warn('Failed to update listing progress', { error: error instanceof Error ? error : new Error(String(error)) });
        }
      };

      // Track indexed file IDs to prevent double indexing
      // (e.g., if both parent and child folders are selected)
      const indexedFileIds = new Set<string>();

      // Index files from each selected path/ID
      for (const pathOrId of pathsToIndex) {
        // Check for cancellation before processing each path/ID
        if (await checkCancellation()) {
          throw new Error('Indexing cancelled');
        }

        // Reset files discovered for this path/ID
        await updateListingProgress(0);

        let files: CloudFileMetadata[] = [];

        if (provider === 'googledrive' || provider === 'onedrive') {
          // Google Drive: pathOrId is actually a folder/file ID
          const itemId = pathOrId || 'root';
          
          // Check if it's a file or folder by getting metadata
          try {
            const itemMetadata = await withTokenRefresh(async (token) => {
              return await providerInstance.getFileMetadata(token, itemId, undefined, true); // skipPathBuilding = true
            });
            
            if (itemMetadata.type === 'file') {
              // Single file - add directly
              files = [itemMetadata];
            } else {
              // Folder - list recursively
              // Create progress callback that updates filesDiscovered counter
              const listingProgressCallback = async (filesDiscovered: number) => {
                await updateListingProgress(filesDiscovered);
              };
              
              // For Google Drive, listFiles with folder ID
              // Skip path building for performance during indexing (use file ID as path)
              files = await withTokenRefresh(async (token) => {
                return await providerInstance.listFiles(
                  token,
                  itemId,
                  true, // recursive
                  undefined, // no username for Google Drive
                  true, // skipPathBuilding = true for performance
                  listingProgressCallback // Pass progress callback (6th parameter)
                );
              });
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            cloudIndexingLogger.error('Failed to process Google Drive item', { itemId, error: error instanceof Error ? error : new Error(String(error)) });
            // Continue with next item
            continue;
          }
        } else {
          // Nextcloud: pathOrId is a path
          const path = pathOrId;
          
          // List files recursively with progress callback for depth=1 fallback
          // Note: For depth=1 fallback, this may take time as it traverses folders
          // Progress will be shown via filesDiscovered counter
          
          // Create progress callback that updates filesDiscovered counter
          const listingProgressCallback = async (filesDiscovered: number) => {
            await updateListingProgress(filesDiscovered);
          };
          
          // Pass progress callback to provider (NextcloudProvider supports it for depth=1 fallback)
          files = await withTokenRefresh(async (token) => {
            return await providerInstance.listFiles(
              token, 
              path, 
              true, 
              username,
              false, // skipPathBuilding
              listingProgressCallback
            );
          });
        }
        
        // Final update after listing completes
        await updateListingProgress(files.length);

      // Filter by file type if specified and deduplicate
      const filteredFiles = files.filter((file: CloudFileMetadata) => {
        if (file.type === 'folder') {
          return false; // Skip folders
        }

        // Skip if already indexed (prevents double indexing when parent and child folders are both selected)
        if (indexedFileIds.has(file.id)) {
          return false;
        }

        if (fileTypeFilters.length > 0 && file.mimeType) {
          const extension = file.name.split('.').pop()?.toLowerCase();
          return fileTypeFilters.some((filter) => filter.toLowerCase() === extension);
        }

        return true;
      });

      // Helper function to update progress in database
      const updateProgress = async (count: number) => {
        try {
          const currentBlock = await prisma.block.findUnique({
            where: { id: blockId },
          });
          if (currentBlock) {
            const currentProperties = getCloudIntegration(currentBlock);
            await prisma.block.update({
              where: { id: blockId },
              data: {
                properties: {
                  ...currentProperties,
                  indexedFileCount: count,
                },
              },
            });
          }
        } catch (error) {
          // Don't fail indexing if progress update fails
          cloudIndexingLogger.warn('Failed to update indexing progress', { error: error instanceof Error ? error : new Error(String(error)) });
        }
      };

      // Process files in parallel batches for better performance
      const textMimeTypes = [
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'application/pdf',
      ];


      // Process files in batches
      for (let i = 0; i < filteredFiles.length; i += CONCURRENT_FILES) {
        // Check for cancellation before processing each batch
        if (await checkCancellation()) {
          throw new Error('Indexing cancelled');
        }

        const fileBatch = filteredFiles.slice(i, i + CONCURRENT_FILES);
        
        // Process batch in parallel: download content and index files
        const batchResults = await Promise.allSettled(
          fileBatch.map(async (file: CloudFileMetadata) => {
            try {
              // Check file size limit (10MB)
              if (file.size && file.size > 10 * 1024 * 1024) {
                cloudIndexingLogger.warn('Skipping file: exceeds 10MB limit', { filePath: file.path, fileSize: file.size });
                return { success: false, skipped: true };
              }

              // Download file content for text files in parallel
              // For Nextcloud, use path instead of numeric ID
              let fileContent: Buffer | undefined;
              if (file.mimeType && textMimeTypes.some((type) => file.mimeType?.includes(type))) {
                try {
                  // For Nextcloud, use path; for others, use ID
                  const fileIdentifier = (provider === 'nextcloud' || provider === 'ssh') ? file.path : file.id;
                  fileContent = await withTokenRefresh(async (token) => {
                    return await providerInstance.getFileContent(token, fileIdentifier, username);
                  });
                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  cloudIndexingLogger.warn('Failed to download file', { filePath: file.path, error: error instanceof Error ? error : new Error(String(error)) });
                  // Continue without content - will use summary only
                }
              }

              // Mark as indexed before processing to prevent duplicates
              indexedFileIds.add(file.id);

              // Index file
              await indexCloudFile(
                block.chatbot.id,
                blockId,
                provider,
                file,
                fileContent
              );

              return { success: true };
            } catch (error: unknown) {
              // Handle Weaviate read-only errors
              const weaviateErrorMessage = error instanceof Error ? error.message : '';
              if (weaviateErrorMessage.includes('read-only') || weaviateErrorMessage.includes('store is read-only')) {
                cloudIndexingLogger.error('Weaviate read-only error for file', { filePath: file.path });
                return { success: false, error: 'Weaviate storage is read-only', weaviateReadOnly: true };
              }
              cloudIndexingLogger.error('Error indexing file', { filePath: file.path, error: error instanceof Error ? error : new Error(String(error)) });
              return { success: false, error: weaviateErrorMessage };
            }
          })
        );

        // Count successful indexing operations
        let weaviateReadOnlyDetected = false;
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.success && !result.value.skipped) {
              totalIndexed++;
            } else if (result.value.weaviateReadOnly) {
              weaviateReadOnlyDetected = true;
            }
          }
        }
        
        // If Weaviate is read-only, stop indexing and throw error
        if (weaviateReadOnlyDetected) {
          throw new Error('Weaviate storage is read-only. Cannot index files. Please contact administrator to fix Weaviate configuration.');
        }
        
        // Update progress in database after each batch
        await updateProgress(totalIndexed);
      }
      
      // Final progress update to ensure accuracy
      await updateProgress(totalIndexed);
    }

    // Check if cancelled before marking as completed
    const wasCancelled = await checkCancellation();
    
    // Get latest properties for update
    const finalBlock = await prisma.block.findUnique({
      where: { id: blockId },
    });
    const finalProperties = finalBlock ? getCloudIntegration(finalBlock) : latestProperties;
    
    // Update indexing status
    await prisma.block.update({
      where: { id: blockId },
      data: {
        properties: {
          ...finalProperties,
          indexingStatus: wasCancelled ? 'idle' : 'completed',
          indexedFileCount: totalIndexed,
          filesDiscovered: totalIndexed, // Set to final count (same as indexed)
          lastIndexedAt: wasCancelled ? finalProperties.lastIndexedAt : new Date().toISOString(),
          indexingError: wasCancelled ? 'Indexing cancelled by user' : undefined,
          indexingCancelled: false, // Reset cancellation flag
        },
      },
    });

    if (wasCancelled) {
      return {
        success: false,
        indexedCount: totalIndexed,
        error: 'Indexing cancelled by user',
      };
    }

    return {
      success: true,
      indexedCount: totalIndexed,
    };
  } catch (error: unknown) {
    cloudIndexingLogger.error('Error indexing cloud files', { error: error instanceof Error ? error : new Error(String(error)) });

    // Update indexing status with error
    const block = await prisma.block.findUnique({
      where: { id: blockId },
    });
    if (block) {
      const properties = getCloudIntegration(block);
      await prisma.block.update({
        where: { id: blockId },
        data: {
          properties: {
            ...properties,
            indexingStatus: 'error',
            indexingError: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });
    }

    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      indexedCount: 0,
      error: errorMsg,
    };
  }
}
